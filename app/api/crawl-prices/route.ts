import { NextResponse } from 'next/server';
import { fetchDetailPrice } from '@/lib/crawler';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/crawl-prices?ids=id1,id2,...,id5
 *   → Fetch prices for specific event IDs (max 5 per call)
 * 
 * GET /api/crawl-prices?date=2026-02-14&offset=0&limit=5
 *   → Fetch prices for events on a date that have null price
 * 
 * Designed to be called repeatedly from the client in small batches.
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const idsParam = searchParams.get('ids');
        const date = searchParams.get('date');
        const offset = parseInt(searchParams.get('offset') || '0', 10);
        const limit = parseInt(searchParams.get('limit') || '5', 10);

        let events: { id: string; url: string }[] = [];

        if (date) {
            // Mode: Fetch events without prices for a specific date
            const { data, error } = await supabase
                .from('match')
                .select('id, url')
                .eq('iso_date', date)
                .is('price', null)
                .range(offset, offset + limit - 1);

            if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
            events = data || [];

            // Also get total count of events needing prices
            const { count } = await supabase
                .from('match')
                .select('id', { count: 'exact', head: true })
                .eq('iso_date', date)
                .is('price', null);

            if (events.length === 0) {
                return NextResponse.json({ success: true, updated: 0, remaining: 0 });
            }

            // Fetch and update prices
            const results = await fetchAndUpdatePrices(events);

            return NextResponse.json({
                success: true,
                updated: results.updated,
                remaining: Math.max(0, (count || 0) - limit),
                total: count || 0,
            });
        } else if (idsParam) {
            // Mode: Fetch prices for specific IDs
            const ids = idsParam.split(',').filter(Boolean).slice(0, 10);
            if (ids.length === 0) return NextResponse.json({ success: true, updated: 0 });

            const { data, error } = await supabase
                .from('match')
                .select('id, url')
                .in('id', ids);

            if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
            events = data || [];

            if (events.length === 0) return NextResponse.json({ success: true, updated: 0 });

            const results = await fetchAndUpdatePrices(events);
            return NextResponse.json({ success: true, ...results });
        } else {
            return NextResponse.json({ success: false, error: 'Missing ids or date parameter' }, { status: 400 });
        }
    } catch (error) {
        console.error('crawl-prices error:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch prices' }, { status: 500 });
    }
}

async function fetchAndUpdatePrices(events: { id: string; url: string }[]) {
    const results = await Promise.all(
        events.map(async (event) => {
            const price = await fetchDetailPrice(event.url);
            return { id: event.id, price };
        })
    );

    let updated = 0;
    for (const result of results) {
        if (result.price !== null) {
            const { error } = await supabase
                .from('match')
                .update({ price: result.price })
                .eq('id', result.id);
            if (!error) updated++;
        }
    }

    return { updated, total: events.length, results: results.map(r => ({ id: r.id, price: r.price })) };
}
