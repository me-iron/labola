import { NextResponse } from 'next/server';
import { crawlLaBOLA } from '@/lib/crawler';
import { supabase } from '@/lib/supabase';
import { addDays, format } from 'date-fns';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Allow up to 5 minutes for full crawl

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const startDate = searchParams.get('startDate') || new Date().toISOString().substring(0, 10);
        const days = parseInt(searchParams.get('days') || '30', 10);
        const clean = searchParams.get('clean') === 'true';

        // If clean mode, delete existing data for the date range first
        if (clean) {
            const endDate = format(addDays(new Date(startDate), days - 1), 'yyyy-MM-dd');
            console.log(`Clean mode: Deleting events from ${startDate} to ${endDate}`);

            const { error: deleteError } = await supabase
                .from('match')
                .delete()
                .gte('iso_date', startDate)
                .lte('iso_date', endDate);

            if (deleteError) {
                console.error('Delete error:', deleteError);
                return NextResponse.json({ success: false, error: 'Delete failed: ' + deleteError.message }, { status: 500 });
            }
            console.log(`Deleted events for date range ${startDate} to ${endDate}`);
        }

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

        // 3. Upsert to Supabase
        const { error } = await supabase
            .from('match')
            .upsert(dbEvents, { onConflict: 'id' });

        if (error) {
            console.error('Supabase Upsert Error:', error);
            return NextResponse.json({ success: false, error: 'Database Error: ' + error.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            count: events.length,
            message: `Data crawled and saved. ${clean ? '(Clean mode)' : ''}`,
            clean,
            days
        });
    } catch (error) {
        console.error('Crawl failed:', error);
        return NextResponse.json({ success: false, error: 'Failed to crawl' }, { status: 500 });
    }
}

