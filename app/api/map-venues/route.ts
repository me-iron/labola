import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/map-venues
 * Returns all stadiums with lat/lng coordinates for map display.
 * Includes event count and utilization stats for LaBOLA venues.
 */
export async function GET() {
    try {
        // Fetch stadiums with coordinates
        const { data: stadiums, error: sErr } = await supabase
            .from('stadium')
            .select('*')
            .not('lat', 'is', null)
            .not('lng', 'is', null)
            .order('name');

        if (sErr) throw sErr;

        // Fetch event counts from the optimized SQL view instead of loading the entire match table
        const { data: eventCounts, error: eErr } = await supabase
            .from('stadium_event_counts')
            .select('*');

        // If the view doesn't exist yet, don't crash the whole API, just use 0 events.
        const eventMap = new Map<string, number>();
        if (!eErr && eventCounts) {
            for (const e of eventCounts) {
                eventMap.set(e.stadium, Number(e.event_count));
            }
        } else if (eErr) {
            console.warn('stadium_event_counts view query failed (view might not exist yet):', eErr.message);
        }

        // Build result
        const venues = (stadiums || []).map(s => ({
            id: s.id,
            name: s.name,
            address: s.address,
            phone: s.phone || '',
            website: s.website || '',
            googleMapsUrl: s.google_maps_url || '',
            lat: s.lat,
            lng: s.lng,
            source: s.source || 'labola',
            businessStatus: s.business_status || 'OPERATIONAL',
            courtCount: s.court_count || 0,
            labolaUrl: s.labola_url || '',
            eventCount: eventMap.get(s.name) || 0,
        }));

        return NextResponse.json({
            success: true,
            venues,
            count: venues.length,
            stats: {
                total: venues.length,
                labola: venues.filter(v => v.source === 'labola').length,
                external: venues.filter(v => v.source !== 'labola').length,
            },
        });
    } catch (error) {
        console.error('Map venues API error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch venues' },
            { status: 500 }
        );
    }
}
