/**
 * Daily Crawl Prices Script for GitHub Actions
 * 
 * Runs independently of Vercel — no timeout limits.
 * Focuses solely on fetching prices for events that have price IS NULL
 * within the next 30 days.
 * 
 * Usage:
 *   SUPABASE_URL=... SUPABASE_KEY=... npx tsx scripts/daily-crawl-prices.ts
 */

import { createClient } from '@supabase/supabase-js';
import { fetchDetailPrice } from '../lib/crawler';
import { addDays, format } from 'date-fns';

// ─── Configuration ───
const DAYS = parseInt(process.env.CRAWL_DAYS || '30', 10);
const PRICE_CONCURRENCY = 10; // Fetch 10 prices in parallel

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

    console.log(`\n🚀 Daily price crawl: ${startISO} → ${endISO} (${DAYS} days)\n`);
    console.log(`⚡ Concurrency: Price×${PRICE_CONCURRENCY}\n`);

    const startTime = Date.now();
    let totalPricesFetched = 0;
    let totalPricesUpdated = 0;

    // 1. Fetch events that need prices
    console.log('Fetching events with missing prices...');

    // We need to fetch all events between startISO and endISO where price IS NULL
    // Supabase has a max limit of 1000 per request by default, better to paginate if there are many,
    // or just fetch all since we run this daily. For safety, let's fetch in chunks if needed.

    const { data: events, error } = await supabase
        .from('match')
        .select('id, url, iso_date')
        .gte('iso_date', startISO)
        .lte('iso_date', endISO)
        .is('price', null);

    if (error) {
        console.error('❌ Failed to fetch events from Supabase:', error.message);
        process.exit(1);
    }

    if (!events || events.length === 0) {
        console.log('✅ No events found requiring price updates.');
        return;
    }

    console.log(`Found ${events.length} events needing price updates. Fetching prices...`);

    // 2. Fetch prices in parallel
    const updates: { id: string; price: number }[] = [];
    let progress = 0;

    await pMap(events, PRICE_CONCURRENCY, async (event) => {
        if (event.url) {
            const price = await fetchDetailPrice(event.url);
            if (price !== null) {
                updates.push({ id: event.id, price });
                totalPricesFetched++;
            }
        }
        progress++;
        if (progress % 50 === 0 || progress === events.length) {
            process.stdout.write(`  ⏳ Progress: ${progress} / ${events.length} (${Math.round((progress / events.length) * 100)}%)\r`);
        }
    });
    console.log(''); // New line after progress

    // 3. Bulk update prices
    if (updates.length > 0) {
        console.log(`\nUpdating ${updates.length} prices in Database...`);

        // Supabase bulk update using pg's 'upsert' with id. 
        // We only want to update the price, but upsert requires the whole row or it will nullify other columns
        // Let's just update each one or do batches of updates since it's a small number typically.
        // Or we can do individual updates concurrently.

        await pMap(updates, PRICE_CONCURRENCY, async (update) => {
            const { error: updateError } = await supabase
                .from('match')
                .update({ price: update.price, updated_at: new Date().toISOString() })
                .eq('id', update.id);

            if (!updateError) {
                totalPricesUpdated++;
            } else {
                console.error(`  ❌ Failed to update price for ${update.id}:`, updateError.message);
            }
        });

        console.log(`✅ Successfully updated ${totalPricesUpdated} prices.`);
    } else {
        console.log('⚠️ No valid prices extracted from the fetched pages.');
    }

    // ════════════════════════════════════════════
    // Summary
    // ════════════════════════════════════════════
    const durationMin = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    console.log('\n═══════════════════════════════════');
    console.log(`📊 Summary:`);
    console.log(`   Pending Events: ${events.length}`);
    console.log(`   Prices Fetched: ${totalPricesFetched}`);
    console.log(`   Prices Updated: ${totalPricesUpdated}`);
    console.log(`   Time:           ${durationMin} min`);
    console.log('═══════════════════════════════════\n');
}

main().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
