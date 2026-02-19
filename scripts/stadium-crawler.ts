/**
 * Stadium Crawler v2 — Fetches ALL Tokyo futsal venues from LaBOLA search pages.
 * Scrapes search result pages 1-4 (74+ shops) and upserts into `stadium` + `stadium_court`.
 * 
 * stadium.id = shop_id (TEXT primary key)
 */
import axios from 'axios';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const BASE = 'https://yoyaku.labola.jp';
const CONCURRENCY = 5;
const DELAY = 500;

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

interface ShopEntry {
    shopId: string;
    name: string;
}

// ─────────────── Step 1: Discover all shop IDs from search pages ───────────────

async function discoverAllShops(): Promise<ShopEntry[]> {
    const shops: ShopEntry[] = [];
    const seenIds = new Set<string>();

    for (let page = 1; page <= 10; page++) {
        const url = `${BASE}/r/search/?page=${page}&category=futsal&area=tokyo&sort_order=location`;
        try {
            const { data: html } = await axios.get(url, { timeout: 15000 });
            const $ = cheerio.load(html);

            let foundOnPage = 0;

            // Parse shop links — format: /r/shop/{id}/
            $('a[href*="/r/shop/"]').each((_, el) => {
                const href = $(el).attr('href') || '';
                const match = href.match(/\/r\/shop\/(\d+)\/?$/);
                if (match && !seenIds.has(match[1])) {
                    const shopId = match[1];
                    const text = $(el).text().trim();
                    // Filter: only shop name links, not "予約カレンダー" or "詳細"
                    if (text && !text.includes('予約') && !text.includes('詳細') && text.length > 1 && text.length < 100) {
                        seenIds.add(shopId);
                        shops.push({ shopId, name: text });
                        foundOnPage++;
                    }
                }
            });

            console.log(`  Page ${page}: +${foundOnPage} shops (total: ${shops.length})`);
            if (foundOnPage === 0) break;
            await sleep(300);
        } catch (err: any) {
            console.error(`  Page ${page} error: ${err.message}`);
            break;
        }
    }

    return shops;
}

// ─────────────── Step 2: Scrape individual shop profile ───────────────

async function scrapeShopProfile(shopId: string) {
    const url = `${BASE}/r/shop/${shopId}/`;
    const { data: html } = await axios.get(url, { timeout: 15000 });
    const $ = cheerio.load(html);

    const rawName = $('h1').first().text().trim();
    const name = rawName.replace(/\s*-\s*LaBOLA総合予約$/, '');

    // Address — try various selectors
    let address = '';
    $('p, span, div').each((_, el) => {
        const text = $(el).text().trim();
        if (!address && text.match(/^東京都/) && text.length < 100) {
            address = text;
        }
    });

    const phone = $('a[href^="tel:"]').first().text().trim();
    const email = $('a[href^="mailto:"]').first().attr('href')?.replace('mailto:', '') || '';

    // External website
    let website = '';
    $('a').each((_, el) => {
        const h = $(el).attr('href') || '';
        if (!website && !h.includes('labola.jp') && !h.includes('google.com/maps') && !h.includes('maps.google') &&
            (h.startsWith('http://') || h.startsWith('https://')) && !h.includes('twitter') && !h.includes('facebook') && !h.includes('instagram') && !h.includes('youtube')) {
            website = h;
        }
    });

    const googleMapsUrl = $('a[href*="google.com/maps"], a[href*="maps.google"]').first().attr('href') || '';

    // Description
    let description = '';
    const descEl = $('.shop-description, .description, .shop_description, .introduce');
    if (descEl.length) {
        description = descEl.first().text().trim().substring(0, 500);
    }

    // Courts — from tabs or space listings
    const courts: { name: string; spaceId: string; dimensions: string; surface: string; sportType: string; rentalPrice: number | null; calendarUrl: string }[] = [];
    const courtNames = new Set<string>();

    // Method 1: Tab headers  
    $('a[href*="/calendar/"], .tab-label, .space-name, li.tab').each((_, el) => {
        const text = $(el).text().trim();
        const href = $(el).attr('href') || '';

        // Extract space/facility name
        if (text && text.length < 60 && !text.includes('カレンダー') && !text.includes('週') && !text.includes('日') && !text.includes('今日') && !text.includes('すべて')) {
            const spaceMatch = href.match(/facility\/(\d+)/);
            const spaceId = spaceMatch ? spaceMatch[1] : '';
            if (!courtNames.has(text)) {
                courtNames.add(text);
                courts.push({
                    name: text,
                    spaceId,
                    dimensions: '',
                    surface: '',
                    sportType: '',
                    rentalPrice: null,
                    calendarUrl: `${BASE}/r/shop/${shopId}/calendar/`,
                });
            }
        }
    });

    return { name, address, phone, email, website, description, googleMapsUrl, courts };
}

// ─────────────── Step 3: Save to Supabase ───────────────

async function saveStadium(shopId: string, shopName: string, profile: Awaited<ReturnType<typeof scrapeShopProfile>>) {
    const stadiumData = {
        id: shopId,  // TEXT primary key = shop_id
        name: profile.name || shopName,
        name_kana: '',
        address: profile.address,
        phone: profile.phone,
        email: profile.email,
        website: profile.website,
        google_maps_url: profile.googleMapsUrl,
        description: profile.description,
        court_count: profile.courts.length,
        labola_url: `${BASE}/r/shop/${shopId}/`,
    };

    // Upsert stadium
    await supabase.from('stadium').upsert(stadiumData, { onConflict: 'id' });

    // Upsert courts
    for (const court of profile.courts) {
        const courtId = court.spaceId || `${shopId}_${court.name}`;
        await supabase.from('stadium_court').upsert({
            id: courtId,
            stadium_id: shopId,
            name: court.name,
            dimensions: court.dimensions,
            surface: court.surface,
            sport_type: court.sportType,
            rental_price: court.rentalPrice,
            calendar_url: court.calendarUrl,
        }, { onConflict: 'id' });
    }
}

// ─────────────── Main ───────────────

async function main() {
    console.log('\n🏟️  Stadium Crawler v2 — Full Tokyo Futsal\n');

    // Step 1: Discover
    console.log('📋 Step 1: Discovering all Tokyo futsal shops from search pages...');
    const shops = await discoverAllShops();
    console.log(`\n  Total discovered: ${shops.length} shops\n`);

    if (shops.length === 0) {
        console.log('❌ No shops found!');
        return;
    }

    // Step 2: Scrape profiles in batches
    console.log('🏗️  Step 2: Scraping shop profiles...');
    let successCount = 0;
    let totalCourtCount = 0;

    for (let i = 0; i < shops.length; i += CONCURRENCY) {
        const batch = shops.slice(i, i + CONCURRENCY);
        await Promise.allSettled(
            batch.map(async (shop) => {
                try {
                    const profile = await scrapeShopProfile(shop.shopId);
                    await saveStadium(shop.shopId, shop.name, profile);
                    totalCourtCount += profile.courts.length;
                    console.log(`  ✅ [${shop.shopId}] ${profile.name || shop.name} (${profile.courts.length} courts)`);
                    successCount++;
                } catch (err: any) {
                    console.log(`  ❌ [${shop.shopId}] ${shop.name}: ${err.message}`);
                }
            })
        );
        await sleep(DELAY);
    }

    console.log(`\n═══════════════════════════════════`);
    console.log(`📊 Summary:`);
    console.log(`   Discovered: ${shops.length}`);
    console.log(`   Saved: ${successCount}`);
    console.log(`   Courts: ${totalCourtCount}`);
    console.log(`═══════════════════════════════════`);
}

main().catch(console.error);
