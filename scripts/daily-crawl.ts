/**
 * Daily Crawl Script for GitHub Actions
 * 
 * Runs independently of Vercel — no timeout limits.
 * Uses the NEW pipeline: crawlListPage() + fetchDetailPrice()
 * 
 * Usage:
 *   npx tsx scripts/daily-crawl.ts
 * 
 * Environment variables (set as GitHub Secrets):
 *   SUPABASE_URL    — Supabase project URL
 *   SUPABASE_KEY    — Supabase service role key (or anon key)
 */

import { createClient } from '@supabase/supabase-js';
import { crawlListPage, fetchDetailPrice, type Event } from '../lib/crawler';
import { addDays, format } from 'date-fns';

// ─── Configuration ───
const DAYS = parseInt(process.env.CRAWL_DAYS || '14', 10);
const PRICE_BATCH_SIZE = 5;     // Concurrent detail page fetches
const PRICE_DELAY_MS = 200;     // Delay between batches to be polite

// ─── Supabase client (independent of lib/supabase.ts for portability) ───
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Main ───
async function main() {
    const startDate = new Date();
    const startISO = format(startDate, 'yyyy-MM-dd');
    console.log(`\n🚀 Daily crawl: ${startISO} → ${format(addDays(startDate, DAYS - 1), 'yyyy-MM-dd')} (${DAYS} days)\n`);

    let totalEvents = 0;
    let totalPrices = 0;
    const allEventIds: string[] = [];

    // ════════════════════════════════════════════
    // Phase 1: Crawl event lists
    // ════════════════════════════════════════════
    console.log('📋 Phase 1: Crawling event lists...\n');

    for (let d = 0; d < DAYS; d++) {
        const dateStr = format(addDays(startDate, d), 'yyyy-MM-dd');
        let page = 1;
        let hasNext = true;
        let dayCount = 0;

        while (hasNext && page <= 50) {
            const result = await crawlListPage(dateStr, page);

            if (result.events.length > 0) {
                // Upsert WITHOUT price — preserve existing prices
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
                    // price intentionally omitted
                }));

                const { error } = await supabase
                    .from('match')
                    .upsert(dbEvents, { onConflict: 'id' });

                if (error) {
                    console.error(`  ❌ Upsert error ${dateStr} p${page}:`, error.message);
                }

                dayCount += result.events.length;
                allEventIds.push(...result.events.map(e => e.id));
            }

            hasNext = result.hasNext;
            page++;
        }

        totalEvents += dayCount;
        process.stdout.write(`  ${dateStr}: ${dayCount} events (${page - 1} pages)\n`);
    }

    console.log(`\n✅ Phase 1 complete: ${totalEvents} events across ${DAYS} days\n`);

    // ════════════════════════════════════════════
    // Phase 2: Fetch prices for events with null price
    // ════════════════════════════════════════════
    console.log('💰 Phase 2: Fetching prices...\n');

    // Query DB for events without prices
    const { data: needPrice, error: queryError } = await supabase
        .from('match')
        .select('id, url')
        .is('price', null)
        .in('id', allEventIds);

    if (queryError) {
        console.error('❌ Query error:', queryError.message);
        return;
    }

    const pending = needPrice || [];
    console.log(`  ${pending.length} events need prices (out of ${allEventIds.length} total)\n`);

    for (let i = 0; i < pending.length; i += PRICE_BATCH_SIZE) {
        const batch = pending.slice(i, i + PRICE_BATCH_SIZE);

        const results = await Promise.all(
            batch.map(async (event) => {
                const price = await fetchDetailPrice(event.url);
                return { id: event.id, price };
            })
        );

        // Update prices in DB
        for (const result of results) {
            if (result.price !== null) {
                const { error } = await supabase
                    .from('match')
                    .update({ price: result.price })
                    .eq('id', result.id);

                if (!error) totalPrices++;
            }
        }

        // Progress
        const done = Math.min(i + PRICE_BATCH_SIZE, pending.length);
        if (done % 50 === 0 || done === pending.length) {
            process.stdout.write(`  💰 ${done}/${pending.length} processed (${totalPrices} prices found)\n`);
        }

        // Polite delay
        if (PRICE_DELAY_MS > 0) {
            await new Promise(r => setTimeout(r, PRICE_DELAY_MS));
        }
    }

    console.log(`\n✅ Phase 2 complete: ${totalPrices} prices collected out of ${pending.length} events\n`);

    // ════════════════════════════════════════════
    // Summary
    // ════════════════════════════════════════════
    console.log('═══════════════════════════════════');
    console.log(`📊 Summary:`);
    console.log(`   Events:  ${totalEvents}`);
    console.log(`   Prices:  ${totalPrices} new`);
    console.log(`   Days:    ${DAYS}`);
    console.log(`   Time:    ${((Date.now() - startDate.getTime()) / 1000 / 60).toFixed(1)} min`);
    console.log('═══════════════════════════════════\n');
}

main().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
