/**
 * Daily Crawl Script for GitHub Actions
 * 
 * Runs independently of Vercel — no timeout limits.
 * Single-Phase: crawls list + fetches prices simultaneously.
 * 
 * Usage:
 *   SUPABASE_URL=... SUPABASE_KEY=... npx tsx scripts/daily-crawl.ts
 */

import { createClient } from '@supabase/supabase-js';
import { crawlListPage, fetchDetailPrice, type Event } from '../lib/crawler';
import { addDays, format } from 'date-fns';

// ─── Configuration ───
const DAYS = parseInt(process.env.CRAWL_DAYS || '30', 10);
const DAY_CONCURRENCY = 5;    // Process 5 days in parallel
const PRICE_CONCURRENCY = 10; // Fetch 10 prices in parallel per day batch

// ─── Supabase client ───
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Concurrency Helper ───
async function pMap<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let index = 0;

    const worker = async () => {
        while (index < items.length) {
            const i = index++;
            try {
                results[i] = await fn(items[i]);
            } catch (err) {
                console.error(`  Error processing item ${i}:`, err);
            }
        }
    };

    const workers = [];
    for (let i = 0; i < Math.min(concurrency, items.length); i++) workers.push(worker());
    await Promise.all(workers);
    return results;
}

// ─── Main ───
async function main() {
    const startDate = new Date();
    const startISO = format(startDate, 'yyyy-MM-dd');
    const endISO = format(addDays(startDate, DAYS - 1), 'yyyy-MM-dd');
    console.log(`\n🚀 Daily crawl: ${startISO} → ${endISO} (${DAYS} days)\n`);
    console.log(`⚡ Single-Phase: List + Price simultaneous (Day×${DAY_CONCURRENCY}, Price×${PRICE_CONCURRENCY})\n`);

    const startTime = Date.now();
    let totalEvents = 0;
    let totalPrices = 0;

    const daysToCrawl = Array.from({ length: DAYS }, (_, i) => format(addDays(startDate, i), 'yyyy-MM-dd'));

    // ════════════════════════════════════════════
    // Single Phase: Crawl list + fetch prices per day
    // ════════════════════════════════════════════

    await pMap(daysToCrawl, DAY_CONCURRENCY, async (dateStr) => {
        let page = 1;
        let hasNext = true;
        let dayEvents = 0;
        let dayPrices = 0;
        const dayAllEvents: Event[] = [];

        // Step A: Crawl all pages for this day
        while (hasNext && page <= 50) {
            const result = await crawlListPage(dateStr, page);
            if (result.events.length > 0) {
                dayAllEvents.push(...result.events);
            }
            hasNext = result.hasNext;
            page++;
        }

        if (dayAllEvents.length === 0) {
            process.stdout.write(`  ⬜ ${dateStr}: 0 events\n`);
            return;
        }

        // Step B: Fetch prices in parallel for ALL events of this day
        await pMap(dayAllEvents, PRICE_CONCURRENCY, async (event) => {
            if (event.url) {
                const price = await fetchDetailPrice(event.url);
                if (price !== null) {
                    event.price = price;
                    dayPrices++;
                }
            }
        });

        // Step C: Upsert all events WITH prices to DB in one batch
        const dbEvents = dayAllEvents.map(e => ({
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
            price: e.price,          // ← price included now!
            updated_at: new Date().toISOString()
        }));

        // Deduplicate by id
        const uniqueMap = new Map();
        dbEvents.forEach(e => uniqueMap.set(e.id, e));
        const unique = Array.from(uniqueMap.values());

        const { error } = await supabase
            .from('match')
            .upsert(unique, { onConflict: 'id' });

        if (error) {
            console.error(`  ❌ Upsert error ${dateStr}:`, error.message);
        } else {
            dayEvents = unique.length;
            totalEvents += dayEvents;
            totalPrices += dayPrices;
        }

        process.stdout.write(`  ✅ ${dateStr}: ${dayEvents} events, ${dayPrices} prices\n`);
    });

    // ════════════════════════════════════════════
    // Summary
    // ════════════════════════════════════════════
    const durationMin = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    console.log('\n═══════════════════════════════════');
    console.log(`📊 Summary:`);
    console.log(`   Events:  ${totalEvents}`);
    console.log(`   Prices:  ${totalPrices}`);
    console.log(`   Time:    ${durationMin} min`);
    console.log('═══════════════════════════════════\n');
}

main().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
