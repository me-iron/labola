import { NextResponse } from 'next/server';
import { crawlLaBOLA } from '@/lib/crawler';
import { supabase } from '@/lib/supabase';

// This is now a Write operation (Trigger Crawl -> Save to DB)
// But strictly it's still a GET request for simplicity, or we can assume GET triggers the crawl.
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const startDate = searchParams.get('startDate') || new Date().toISOString().substring(0, 10);
        const days = parseInt(searchParams.get('days') || '30', 10);

        // 1. Crawl Data
        console.log(`Crawling started: ${startDate} for ${days} days`);
        const events = await crawlLaBOLA(startDate, days);
        console.log(`Crawled ${events.length} events`);

        // 2. Map to DB Schema (snake_case)
        const dbEvents = events.map(e => ({
            id: e.id,
            date: e.date,
            iso_date: e.isoDate,
            time: e.time,
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

        // 3. Upsert to Supabase
        const { error } = await supabase
            .from('match')
            .upsert(dbEvents, { onConflict: 'id' });

        if (error) {
            console.error('Supabase Upsert Error:', error);
            // Even if save fails, we return success: false
            return NextResponse.json({ success: false, error: 'Database Error: ' + error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, count: events.length, message: 'Data crawled and saved to DB.' });
    } catch (error) {
        console.error('Crawl failed:', error);
        return NextResponse.json({ success: false, error: 'Failed to crawl' }, { status: 500 });
    }
}
