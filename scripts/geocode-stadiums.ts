/**
 * Geocode Stadiums — Convert addresses in `stadium` table to lat/lng coordinates.
 * 
 * Strategy:
 * 1. Try extracting coordinates from existing google_maps_url
 * 2. Fall back to Google Geocoding API
 * 3. Fall back to Nominatim (OpenStreetMap) API (Free, No Key Required)
 * 
 * Usage: npx tsx scripts/geocode-stadiums.ts
 */
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Try to extract lat/lng from a Google Maps URL.
 */
function extractCoordsFromUrl(url: string): { lat: number; lng: number } | null {
    if (!url) return null;

    // Pattern: @lat,lng
    const atMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (atMatch) {
        return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
    }

    // Pattern: ll=lat,lng or q=lat,lng
    const paramMatch = url.match(/[?&](?:ll|q|center)=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (paramMatch) {
        return { lat: parseFloat(paramMatch[1]), lng: parseFloat(paramMatch[2]) };
    }

    return null;
}

/**
 * Geocode an address using Google Geocoding API.
 */
async function geocodeAddressGoogle(address: string): Promise<{ lat: number; lng: number } | null> {
    if (!address || !GOOGLE_API_KEY) return null;

    try {
        const resp = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
            params: { address, key: GOOGLE_API_KEY, language: 'ja', region: 'jp' },
            timeout: 10000,
        });

        if (resp.data.status === 'OK' && resp.data.results.length > 0) {
            const loc = resp.data.results[0].geometry.location;
            return { lat: loc.lat, lng: loc.lng };
        }

        console.warn(`  ⚠️ Google Geocoding failed: ${resp.data.status}`);
        return null;
    } catch (err: any) {
        console.error(`  ❌ Google Geocoding error: ${err.message}`);
        return null;
    }
}

/**
 * Geocode an address using Nominatim (OpenStreetMap) API.
 * Free but requires strict Rate Limiting (1 request per second) and User-Agent.
 */
async function geocodeAddressNominatim(address: string): Promise<{ lat: number; lng: number } | null> {
    if (!address) return null;

    // Extract core address parts to help Nominatim (remove building names etc if possible, but keep simple for now)
    // Mostly just taking the first token before a space to try matching the city/block
    const cleanAddress = address.replace(/〒\d{3}-\d{4}/, '').trim();

    try {
        const resp = await axios.get('https://nominatim.openstreetmap.org/search', {
            params: {
                q: cleanAddress,
                format: 'json',
                limit: 1,
                countrycodes: 'jp',
            },
            headers: {
                'User-Agent': 'LaBOLA-Futsal-Map-Crawler/1.0',
            },
            timeout: 10000,
        });

        if (resp.data && resp.data.length > 0) {
            return {
                lat: parseFloat(resp.data[0].lat),
                lng: parseFloat(resp.data[0].lon),
            };
        }

        console.warn(`  ⚠️ Nominatim Geocoding no results for: ${cleanAddress}`);
        return null;
    } catch (err: any) {
        console.error(`  ❌ Nominatim Geocoding error: ${err.message}`);
        return null;
    }
}

async function main() {
    console.log('\n📍 Geocode Stadiums (V2) — Adding lat/lng coordinates\n');

    // Fetch stadiums without coordinates
    const { data: stadiums, error } = await supabase
        .from('stadium')
        .select('id, name, address, google_maps_url, lat, lng')
        .is('lat', null)
        .order('id');

    if (error) {
        console.error('❌ Supabase error:', error.message);
        process.exit(1);
    }

    if (!stadiums || stadiums.length === 0) {
        console.log('✅ All stadiums already have coordinates!');
        return;
    }

    console.log(`📋 Found ${stadiums.length} stadiums without coordinates\n`);

    let fromUrl = 0;
    let fromGoogle = 0;
    let fromOSM = 0;
    let failed = 0;

    for (const stadium of stadiums) {
        let coords = extractCoordsFromUrl(stadium.google_maps_url || '');

        if (coords) {
            fromUrl++;
            console.log(`  🔗 [${stadium.id}] ${stadium.name} → URL (${coords.lat}, ${coords.lng})`);
        } else if (stadium.address) {
            // First try Google (if Key exists)
            coords = await geocodeAddressGoogle(stadium.address);
            if (coords) {
                fromGoogle++;
                console.log(`  🌐 [${stadium.id}] ${stadium.name} → Google (${coords.lat}, ${coords.lng})`);
            } else {
                // Fallback to Nominatim
                await sleep(1500); // Strict 1s+ rate limit for OSM
                coords = await geocodeAddressNominatim(stadium.address);
                if (coords) {
                    fromOSM++;
                    console.log(`  🗺️  [${stadium.id}] ${stadium.name} → Nominatim (${coords.lat}, ${coords.lng})`);
                }
            }
        }

        if (coords) {
            const { error: updateErr } = await supabase
                .from('stadium')
                .update({ lat: coords.lat, lng: coords.lng })
                .eq('id', stadium.id);

            if (updateErr) {
                console.error(`  ❌ Update failed for ${stadium.id}: ${updateErr.message}`);
                failed++;
            }
        } else {
            console.log(`  ❓ [${stadium.id}] ${stadium.name} — Geocoding exhausted`);
            failed++;
        }

        await sleep(200);
    }

    console.log(`\n═══════════════════════════════════`);
    console.log(`📊 Geocoding Summary (V2):`);
    console.log(`   From URL:       ${fromUrl}`);
    console.log(`   From Google:    ${fromGoogle}`);
    console.log(`   From Nominatim: ${fromOSM}`);
    console.log(`   Failed:         ${failed}`);
    console.log(`   Total:          ${stadiums.length}`);
    console.log(`═══════════════════════════════════`);
}

main().catch(console.error);
