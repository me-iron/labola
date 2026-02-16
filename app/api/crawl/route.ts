import { NextResponse } from 'next/server';
import { crawlListPage } from '@/lib/crawler';
import { supabase } from '@/lib/supabase';
import { addDays, format } from 'date-fns';

export const dynamic = 'force-dynamic';

/**
 * GET /api/crawl?startDate=2026-02-15&days=1
 * 
 * Safe crawl API — upsert only, NO DELETE.
 * Crawls event lists and upserts to DB, preserving existing prices.
 * 
 * ⚠️ This route crawls ALL pages for all days in a single request.
 * For Vercel Hobby (10s limit), use days=1 max.
 * For longer crawls, use the GitHub Actions script or client-side orchestration.
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const startDate = searchParams.get('startDate') || new Date().toISOString().substring(0, 10);
        const days = Math.min(parseInt(searchParams.get('days') || '1', 10), 3); // Cap at 3 days for safety

        console.log(`Crawling: ${startDate} for ${days} days (safe upsert, no delete)`);

        let totalEvents = 0;
        const allIds: string[] = [];

        for (let d = 0; d < days; d++) {
            const dateStr = format(addDays(new Date(startDate), d), 'yyyy-MM-dd');
            let page = 1;
            let hasNext = true;

            while (hasNext && page <= 50) {
                const { events, hasNext: next } = await crawlListPage(dateStr, page);

                if (events.length > 0) {
                    // Upsert WITHOUT price field — preserves existing prices
                    const dbEvents = events.map(e => ({
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
                        // price intentionally omitted — preserved on update
                    }));

                    const uniqueMap = new Map();
                    dbEvents.forEach(e => uniqueMap.set(e.id, e));
                    const unique = Array.from(uniqueMap.values());

                    const { error } = await supabase
                        .from('match')
                        .upsert(unique, { onConflict: 'id' });

                    if (error) {
                        console.error(`Upsert error on ${dateStr} p${page}:`, error);
                    }

                    totalEvents += unique.length;
                    allIds.push(...unique.map(e => e.id));
                }

                hasNext = next;
                page++;
            }
        }

        return NextResponse.json({
            success: true,
            count: totalEvents,
            days,
            message: `Crawled ${totalEvents} events (safe upsert, no delete)`,
            pendingPriceIds: allIds
        });
    } catch (error) {
        console.error('Crawl failed:', error);
        return NextResponse.json({ success: false, error: 'Failed to crawl' }, { status: 500 });
    }
}
