/**
 * Daily Crawl Script for GitHub Actions
 * 
 * Runs independently of Vercel — no timeout limits.
 * Uses the NEW pipeline: crawlListPage() + fetchDetailPrice()
 * Optimized for parallelism to reduce runtime from ~65m to ~15m.
 * 
 * Usage:
 *   npx tsx scripts/daily-crawl.ts
 */

import { createClient } from '@supabase/supabase-js';
import { crawlListPage, fetchDetailPrice, type Event } from '../lib/crawler';
import { addDays, format } from 'date-fns';

// ─── Configuration ───
const DAYS = parseInt(process.env.CRAWL_DAYS || '14', 10);

// Concurrency Settings
const LIST_CONCURRENCY = 5;    // Process 5 days in parallel
const PRICE_CONCURRENCY = 20;  // Process 20 price checks in parallel

// ─── Supabase client ───
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Helper: Simple Concurrency Limiter ───
async function runConcurrent<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
    const results: R[] = [];
    const running: Promise<void>[] = [];

    for (const item of items) {
        const p = fn(item).then(res => {
            results.push(res);
        });
        running.push(p);

        // cleanup finished promises
        const clean = () => running.filter(p => {
            // This is a hacky way to check promise state in older node, 
            // but simple array management works fine for this script
            return p;
        });

        if (running.length >= concurrency) {
            await Promise.race(running);
            // Remove finished promises
            // Actually Promise.race returns the value, but we need to remove the promise from 'running'
            // A standardized p-limit approaches:
        }
    }
    await Promise.all(running);
    return results;
}

// Better implementation of runConcurrent
async function pMap<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let index = 0;

    const worker = async () => {
        while (index < items.length) {
            const i = index++;
            try {
                results[i] = await fn(items[i]);
            } catch (err) {
                console.error(`Error processing item ${i}:`, err);
                // Keep strictly typed, maybe return null or handle error
            }
        }
    };

    const workers = [];
    for (let i = 0; i < concurrency; i++) workers.push(worker());
    await Promise.all(workers);
    return results;
}


// ─── Main ───
async function main() {
    const startDate = new Date();
    const startISO = format(startDate, 'yyyy-MM-dd');
    console.log(`\n🚀 Daily crawl: ${startISO} → ${format(addDays(startDate, DAYS - 1), 'yyyy-MM-dd')} (${DAYS} days)\n`);

    const startTime = Date.now();
    let totalEvents = 0;
    let totalPrices = 0;
    const allEventIds: string[] = [];

    // ════════════════════════════════════════════
    // Phase 1: Crawl event lists (Parallel)
    // ════════════════════════════════════════════
    console.log(`📋 Phase 1: Crawling event lists (Concurrency: ${LIST_CONCURRENCY})...\n`);

    const daysToCrawl = Array.from({ length: DAYS }, (_, i) => format(addDays(startDate, i), 'yyyy-MM-dd'));

    await pMap(daysToCrawl, LIST_CONCURRENCY, async (dateStr) => {
        let page = 1;
        let hasNext = true;
        let dayCount = 0;

        // Crawl all pages for this day
        while (hasNext && page <= 50) {
            const result = await crawlListPage(dateStr, page);

            if (result.events.length > 0) {
                const dbEvents = result.events.map(e => ({
                    id: e.id,
                    date: e.date,
                    iso_date: e.isoDate,
                    time: e.time,
                    start_time: e.startTime,
                    title: e.title,
                    stadium: e.stadium,
                    address: e.address,
                    region: e.region,
                    url: e.url,
                    booked: e.booked,
                    capacity: e.capacity,
                    status: e.status,
                    updated_at: new Date().toISOString()
                }));

                const { error } = await supabase
                    .from('match')
                    .upsert(dbEvents, { onConflict: 'id' });

                if (error) {
                    console.error(`  ❌ Upsert error ${dateStr} p${page}:`, error.message);
                } else {
                    dayCount += result.events.length;
                    allEventIds.push(...result.events.map(e => e.id));
                }
            }

            hasNext = result.hasNext;
            page++;
        }
        process.stdout.write(`  ✅ ${dateStr}: ${dayCount} events\n`);
    });

    totalEvents = allEventIds.length;
    console.log(`\n✅ Phase 1 complete: ${totalEvents} events\n`);

    // ════════════════════════════════════════════
    // Phase 2: Fetch prices (Parallel)
    // ════════════════════════════════════════════
    console.log(`💰 Phase 2: Fetching prices (Concurrency: ${PRICE_CONCURRENCY})...\n`);

    // Query DB for events without prices
    // We chunk the ID list to 1000 items per query to avoid URL length issues
    let needPriceIds: string[] = [];

    // Chunking for Supabase 'in' query
    const QUERY_CHUNK_SIZE = 200;
    for (let i = 0; i < allEventIds.length; i += QUERY_CHUNK_SIZE) {
        const chunk = allEventIds.slice(i, i + QUERY_CHUNK_SIZE);
        const { data, error } = await supabase
            .from('match')
            .select('id')
            .is('price', null)
            .in('id', chunk);

        if (data) needPriceIds.push(...data.map(e => e.id));
    }

    // Also verify URL
    const { data: eventsWithUrl } = await supabase
        .from('match')
        .select('id, url')
        .in('id', needPriceIds);

    const pending = eventsWithUrl || [];
    console.log(`  ${pending.length} events need prices (out of ${totalEvents} scanned)\n`);

    let progress = 0;

    await pMap(pending, PRICE_CONCURRENCY, async (event) => {
        const price = await fetchDetailPrice(event.url);
        if (price !== null) {
            const { error } = await supabase
                .from('match')
                .update({ price })
                .eq('id', event.id);
            if (!error) totalPrices++;
        }
        progress++;
        if (progress % 50 === 0 || progress === pending.length) {
            process.stdout.write(`  💰 ${progress}/${pending.length} checked (${totalPrices} found)\n`);
        }
    });

    console.log(`\n✅ Phase 2 complete: ${totalPrices} prices collected\n`);

    // ════════════════════════════════════════════
    // Summary
    // ════════════════════════════════════════════
    const durationMin = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    console.log('═══════════════════════════════════');
    console.log(`📊 Summary:`);
    console.log(`   Events:  ${totalEvents}`);
    console.log(`   Prices:  ${totalPrices} new`);
    console.log(`   Time:    ${durationMin} min (was ~65 min)`);
    console.log('═══════════════════════════════════\n');
}

main().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
