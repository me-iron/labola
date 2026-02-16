import { NextResponse } from 'next/server';
import { crawlListPage } from '@/lib/crawler';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/crawl-list?date=2026-02-14&page=1
 * 
 * Crawls exactly ONE page of event listings for a given date.
 * Upserts events to DB, PRESERVING existing prices.
 * Returns event IDs and whether there's a next page.
 * Designed to run in ~2 seconds (within Vercel Hobby 10s limit).
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date');
        const page = parseInt(searchParams.get('page') || '1', 10);

        if (!date) {
            return NextResponse.json({ success: false, error: 'Missing date parameter' }, { status: 400 });
        }

        // 1. Crawl one page of listings
        const { events, hasNext } = await crawlListPage(date, page);

        if (events.length === 0) {
            return NextResponse.json({ success: true, count: 0, hasNext: false, ids: [] });
        }

        // 2. Upsert to DB — PRESERVE existing prices
        //    We only update non-price fields; price stays if already set
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
            // NOTE: price is intentionally omitted so existing prices are preserved
        }));

        // Deduplicate
        const uniqueMap = new Map();
        dbEvents.forEach(e => uniqueMap.set(e.id, e));
        const unique = Array.from(uniqueMap.values());

        const { error } = await supabase
            .from('match')
            .upsert(unique, {
                onConflict: 'id',
                // Only update these columns, leaving 'price' untouched
                ignoreDuplicates: false,
            });

        if (error) {
            console.error('Upsert error:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            count: unique.length,
            page,
            hasNext,
            ids: unique.map(e => e.id)
        });
    } catch (error) {
        console.error('crawl-list error:', error);
        return NextResponse.json({ success: false, error: 'Failed to crawl list page' }, { status: 500 });
    }
}
