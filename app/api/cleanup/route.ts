import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import axios from 'axios';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60 seconds for cleanup

interface EventRecord {
    id: string;
    url: string;
    iso_date: string;
}

async function checkUrl(url: string): Promise<boolean> {
    try {
        const response = await axios.head(url, {
            timeout: 5000,
            validateStatus: (status) => status < 500, // Don't throw on 4xx
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
        });
        return response.status !== 404;
    } catch {
        // Network error or timeout - assume URL is still valid
        return true;
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date');

        if (!date) {
            return NextResponse.json({ success: false, error: 'date parameter required' }, { status: 400 });
        }

        // 1. Fetch events for the specified date
        const { data: events, error: fetchError } = await supabase
            .from('match')
            .select('id, url, iso_date')
            .eq('iso_date', date);

        if (fetchError) {
            return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 });
        }

        if (!events || events.length === 0) {
            return NextResponse.json({ success: true, message: 'No events to check', deleted: [] });
        }

        console.log(`Checking ${events.length} events for date ${date}`);

        // 2. Check URLs in batches of 5
        const BATCH_SIZE = 5;
        const invalidEvents: string[] = [];

        for (let i = 0; i < events.length; i += BATCH_SIZE) {
            const batch = events.slice(i, i + BATCH_SIZE);

            const results = await Promise.all(
                batch.map(async (event: EventRecord) => {
                    const isValid = await checkUrl(event.url);
                    return { id: event.id, isValid };
                })
            );

            results.forEach(({ id, isValid }) => {
                if (!isValid) {
                    invalidEvents.push(id);
                }
            });
        }

        console.log(`Found ${invalidEvents.length} invalid events`);

        // 3. Delete invalid events
        if (invalidEvents.length > 0) {
            const { error: deleteError } = await supabase
                .from('match')
                .delete()
                .in('id', invalidEvents);

            if (deleteError) {
                return NextResponse.json({
                    success: false,
                    error: 'Failed to delete: ' + deleteError.message,
                    found: invalidEvents
                }, { status: 500 });
            }
        }

        return NextResponse.json({
            success: true,
            checked: events.length,
            deleted: invalidEvents,
            deletedCount: invalidEvents.length
        });

    } catch (error) {
        console.error('Cleanup failed:', error);
        return NextResponse.json({ success: false, error: 'Cleanup failed' }, { status: 500 });
    }
}
