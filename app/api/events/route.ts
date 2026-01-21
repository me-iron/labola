
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || new Date().toISOString().substring(0, 10);

    // Fetch events from DB where iso_date >= startDate
    const { data, error } = await supabase
        .from('events')
        .select('*')
        .gte('iso_date', startDate)
        .order('iso_date', { ascending: true });

    if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Map back to camelCase for Frontend
    const events = data?.map(e => ({
        id: e.id,
        date: e.date,
        isoDate: e.iso_date,
        time: e.time,
        title: e.title,
        stadium: e.stadium,
        address: e.address,
        region: e.region,
        url: e.url,
        booked: e.booked,
        capacity: e.capacity,
        status: e.status
    })) || [];

    return NextResponse.json({ success: true, events });
}
