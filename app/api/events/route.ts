
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || new Date().toISOString().substring(0, 10);

    // Paginated fetch to bypass Supabase 1000 row default limit
    const PAGE_SIZE = 1000;
    let allData: any[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        const { data, error } = await supabase
            .from('match')
            .select('*')
            .gte('iso_date', startDate)
            .order('iso_date', { ascending: true })
            .order('start_time', { ascending: true })
            .range(from, to);

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        if (data && data.length > 0) {
            allData = allData.concat(data);
            page++;
            // If we got less than PAGE_SIZE, we've reached the end
            if (data.length < PAGE_SIZE) {
                hasMore = false;
            }
        } else {
            hasMore = false;
        }

        // Safety limit: max 50 pages = 50,000 rows
        if (page >= 50) {
            hasMore = false;
        }
    }

    // Map back to camelCase for Frontend
    const events = allData.map(e => ({
        id: e.id,
        date: e.date,
        isoDate: e.iso_date,
        time: e.time,
        startTime: e.start_time,
        title: e.title,
        stadium: e.stadium,
        address: e.address,
        region: e.region,
        url: e.url,
        booked: e.booked,
        capacity: e.capacity,
        status: e.status
    }));

    return NextResponse.json({ success: true, events, count: events.length });
}
