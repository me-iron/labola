/**
 * Discover External Venues — Find futsal courts in Tokyo via Google Places API.
 * 
 * Uses Text Search (New) to find venues not in LaBOLA database.
 * Only includes OPERATIONAL businesses.
 * 
 * Usage: npx tsx scripts/discover-external-venues.ts
 */
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// Tokyo bounding box (approximate)
const TOKYO_BOUNDS = {
    south: 35.50,
    north: 35.90,
    west: 138.90,
    east: 139.95,
};

interface PlaceResult {
    id: string;               // Google Place ID
    displayName: { text: string; languageCode: string };
    formattedAddress: string;
    location: { latitude: number; longitude: number };
    businessStatus?: string;
    websiteUri?: string;
    nationalPhoneNumber?: string;
    googleMapsUri?: string;
}

const SEARCH_QUERIES = [
    'フットサルコート 東京',
    'フットサル場 東京都',
    'フットサルパーク 東京',
    'フットボールスタジアム 東京 フットサル',
    'フットサル 練習場 東京',
    'ソサイチ 東京',
];

/**
 * Search for places using Google Places API (New) Text Search.
 */
async function textSearch(query: string): Promise<PlaceResult[]> {
    const allResults: PlaceResult[] = [];
    let pageToken: string | undefined;

    do {
        try {
            const body: any = {
                textQuery: query,
                languageCode: 'ja',
                locationBias: {
                    rectangle: {
                        low: { latitude: TOKYO_BOUNDS.south, longitude: TOKYO_BOUNDS.west },
                        high: { latitude: TOKYO_BOUNDS.north, longitude: TOKYO_BOUNDS.east },
                    },
                },
                maxResultCount: 20,
            };
            if (pageToken) body.pageToken = pageToken;

            const resp = await axios.post(
                'https://places.googleapis.com/v1/places:searchText',
                body,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Goog-Api-Key': GOOGLE_API_KEY,
                        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.businessStatus,places.websiteUri,places.nationalPhoneNumber,places.googleMapsUri,nextPageToken',
                    },
                    timeout: 15000,
                }
            );

            const places = resp.data.places || [];
            allResults.push(...places);
            pageToken = resp.data.nextPageToken;

            if (pageToken) await sleep(2000); // Wait for next page token to become active
        } catch (err: any) {
            console.error(`  ❌ Search error for "${query}": ${err.response?.data?.error?.message || err.message}`);
            break;
        }
    } while (pageToken);

    return allResults;
}

/**
 * Check if a place is within Tokyo bounds.
 */
function isInTokyo(lat: number, lng: number): boolean {
    return lat >= TOKYO_BOUNDS.south && lat <= TOKYO_BOUNDS.north &&
        lng >= TOKYO_BOUNDS.west && lng <= TOKYO_BOUNDS.east;
}

/**
 * Calculate distance between two coordinates in meters (Haversine).
 */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Basic string similarity (0.0 to 1.0) using Levenshtein distance approach.
 */
function getStringSimilarity(s1: string, s2: string): number {
    let longer = s1;
    let shorter = s2;
    if (s1.length < s2.length) { longer = s2; shorter = s1; }
    const longerLength = longer.length;
    if (longerLength === 0) return 1.0;

    const costs = new Array();
    for (let i = 0; i <= longer.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= shorter.length; j++) {
            if (i == 0) costs[j] = j;
            else {
                if (j > 0) {
                    let newValue = costs[j - 1];
                    if (longer.charAt(i - 1) != shorter.charAt(j - 1))
                        newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                    costs[j - 1] = lastValue;
                    lastValue = newValue;
                }
            }
        }
        if (i > 0) costs[shorter.length] = lastValue;
    }
    return (longerLength - costs[shorter.length]) / parseFloat(longerLength.toString());
}

async function main() {
    console.log('\n🔍 Discover External Venues — Google Places API\n');

    if (!GOOGLE_API_KEY) {
        console.error('❌ GOOGLE_MAPS_API_KEY not set');
        process.exit(1);
    }

    // Step 1: Load existing stadiums for dedup
    const { data: existing, error: fetchErr } = await supabase
        .from('stadium')
        .select('id, name, address, lat, lng, place_id');

    if (fetchErr) {
        console.error('❌ Supabase error:', fetchErr.message);
        process.exit(1);
    }

    const existingStadiums = existing || [];
    const existingPlaceIds = new Set(existingStadiums.filter(s => s.place_id).map(s => s.place_id));
    console.log(`📋 Existing stadiums: ${existingStadiums.length} (${existingPlaceIds.size} with place_id)\n`);

    // Step 2: Search all queries
    const allPlaces = new Map<string, PlaceResult>(); // keyed by place ID

    for (const query of SEARCH_QUERIES) {
        console.log(`🔎 Searching: "${query}"`);
        const results = await textSearch(query);
        console.log(`   Found ${results.length} results`);

        for (const place of results) {
            if (!allPlaces.has(place.id)) {
                allPlaces.set(place.id, place);
            }
        }
        await sleep(500);
    }

    console.log(`\n📊 Total unique places found: ${allPlaces.size}\n`);

    // Step 3: Filter & dedup
    let added = 0;
    let skipped = 0;
    let outOfBounds = 0;
    let notOperational = 0;

    for (const [placeId, place] of allPlaces) {
        const lat = place.location.latitude;
        const lng = place.location.longitude;
        const name = place.displayName?.text || '';
        const address = place.formattedAddress || '';

        // Filter: only Tokyo
        if (!isInTokyo(lat, lng)) {
            outOfBounds++;
            continue;
        }

        // Filter: only OPERATIONAL
        if (place.businessStatus && place.businessStatus !== 'OPERATIONAL') {
            notOperational++;
            console.log(`  🚫 Closed: ${name} (${place.businessStatus})`);
            continue;
        }

        // Dedup: check place_id
        if (existingPlaceIds.has(placeId)) {
            skipped++;
            continue;
        }

        // Dedup: check proximity (within 100m of existing)
        let tooClose = false;
        for (const ex of existingStadiums) {
            if (ex.lat && ex.lng) {
                const dist = haversineDistance(lat, lng, ex.lat, ex.lng);
                if (dist < 100) {
                    tooClose = true;
                    // Update existing with place_id for future dedup
                    await supabase.from('stadium').update({ place_id: placeId }).eq('id', ex.id);
                    break;
                }
            }
        }

        if (tooClose) {
            skipped++;
            continue;
        }

        // Also check by name similarity (strict)
        const normalizedName = name.replace(/[\s\u3000]/g, '').toLowerCase();
        let bestMatch = null;
        let highestSim = 0;

        for (const ex of existingStadiums) {
            const exName = (ex.name || '').replace(/[\s\u3000]/g, '').toLowerCase();
            if (!exName) continue;

            const sim = getStringSimilarity(normalizedName, exName);
            if (sim > highestSim) {
                highestSim = sim;
                bestMatch = ex;
            }
        }

        // Only consider a match if similarity is > 75% or one is a very exact substring
        if (bestMatch && (highestSim > 0.75 || (normalizedName.length > 5 && (normalizedName.includes(bestMatch.name.replace(/[\s\u3000]/g, '').toLowerCase()) && bestMatch.name.length > 5)))) {
            skipped++;
            // Update existing with place_id and coords if missing
            const updates: any = { place_id: placeId };
            if (!bestMatch.lat) { updates.lat = lat; updates.lng = lng; }
            await supabase.from('stadium').update(updates).eq('id', bestMatch.id);
            continue;
        }



        // Insert new venue
        const newId = `gp_${placeId.substring(0, 20)}`;
        const { error: insertErr } = await supabase.from('stadium').upsert({
            id: newId,
            name: name,
            address: address,
            phone: place.nationalPhoneNumber || '',
            website: place.websiteUri || '',
            google_maps_url: place.googleMapsUri || '',
            lat,
            lng,
            source: 'google_places',
            business_status: 'OPERATIONAL',
            place_id: placeId,
            court_count: 0,
        }, { onConflict: 'id' });

        if (insertErr) {
            console.error(`  ❌ Insert failed for ${name}: ${insertErr.message}`);
        } else {
            added++;
            console.log(`  ✅ Added: ${name} (${address})`);
        }
    }

    console.log(`\n═══════════════════════════════════`);
    console.log(`📊 Discovery Summary:`);
    console.log(`   Total found:     ${allPlaces.size}`);
    console.log(`   Added (new):     ${added}`);
    console.log(`   Skipped (dedup): ${skipped}`);
    console.log(`   Out of bounds:   ${outOfBounds}`);
    console.log(`   Not operational: ${notOperational}`);
    console.log(`═══════════════════════════════════`);
}

main().catch(console.error);
