/**
 * Stadium Calendar Crawler v5
 * 
 * Parses the WEEKLY calendar view (/calendar_week/).
 * HTML: #calendar_width table, 1 col = 5 min.
 * 
 * 2-tier classification:
 *   slot_type (공통 6개): available / rental_booking / individual / school / other / block
 *   event_label (rawClass): 원본 CSS class 보존 (구장별 고유 라벨 추적용)
 * 
 * Usage: npx tsx scripts/stadium-calendar-crawler.ts [weeks=1]
 */
import axios from 'axios';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local
try {
    const envContent = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8');
    envContent.split('\n').forEach(line => {
        const match = line.match(/^([^#=]+)=(.*)$/);
        if (match) process.env[match[1].trim()] = match[2].trim();
    });
} catch { }


const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const BASE = 'https://yoyaku.labola.jp';
const CONCURRENCY = 1;
const DELAY = 1500;
const MAX_RETRIES = 3;

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

interface SlotData {
    stadium_id: string;
    court_name: string;
    slot_date: string;
    start_time: string;
    end_time: string;
    slot_type: string;    // 공통 6개: available/rental_booking/individual/school/other/block
    event_label: string;  // rawClass: 원본 CSS class (구장별 고유 라벨)
}

/**
 * 2-tier slot classification:
 *   slot_type = 공통 카테고리 (available / rental_booking / individual / school / other / block)
 *   rawClass  = 원본 CSS class 이름 (구장별 고유 라벨 보존)
 */
function classifySlot(classes: string, text: string): { slotType: string; rawClass: string } {
    const c = ' ' + classes.toLowerCase() + ' ';

    // 1) 공통 라벨
    if (c.includes(' empty ')) return { slotType: 'available', rawClass: 'empty' };
    if (c.includes('rental_booking')) return { slotType: 'rental_booking', rawClass: 'rental_booking' };
    const memberMatch = classes.match(/member\d+/);
    if (memberMatch) return { slotType: 'rental_booking', rawClass: memberMatch[0] };
    if (c.includes('individual')) return { slotType: 'individual', rawClass: 'individual' };
    if (c.includes('school')) return { slotType: 'school', rawClass: 'school' };
    if (c.includes('facility_usage')) return { slotType: 'school', rawClass: 'facility_usage' };

    // 2) Block (영업시간 외 / 예약 불가 빈 슬롯)
    if (c.includes('excess')) return { slotType: 'block', rawClass: 'excess' };

    // 3) 기타 예약 (구장별 고유)
    if (c.includes('tournament')) return { slotType: 'other', rawClass: 'tournament' };
    if (c.includes('league')) return { slotType: 'other', rawClass: 'league' };
    if (c.includes('match_make')) return { slotType: 'other', rawClass: 'match_make' };
    if (c.includes('private')) return { slotType: 'other', rawClass: 'private' };
    if (c.includes('visitor')) return { slotType: 'other', rawClass: 'visitor' };

    // 4) not_allowed: 텍스트가 있으면 기타(외부 예약), 없으면 block
    if (c.includes('not_allowed')) {
        const t = text.trim();
        if (t && t !== '') return { slotType: 'other', rawClass: 'not_allowed' };
        return { slotType: 'block', rawClass: 'not_allowed' };
    }

    return { slotType: 'other', rawClass: 'unknown' };
}

function colPosToTime(colPos: number, startHour: number, startMin: number): string {
    const totalMinutes = startHour * 60 + startMin + colPos * 5;
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

async function fetchWithRetry(url: string, shopId: string, retries = MAX_RETRIES): Promise<string | null> {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const { data: html } = await axios.get(url, {
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                    'Accept-Language': 'ja,en;q=0.9',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
                    'Referer': `${BASE}/r/shop/${shopId}/`,
                },
            });
            return html;
        } catch (err: any) {
            const status = err.response?.status;
            const code = err.code;
            if (attempt < retries) {
                const waitMs = 2000 * attempt; // exponential-ish backoff
                console.error(`    ⚠️ [${shopId}] attempt ${attempt}/${retries} failed (${status || code || err.message}), retrying in ${waitMs}ms...`);
                await sleep(waitMs);
            } else {
                console.error(`    ❌ [${shopId}] all ${retries} attempts failed (${status || code || err.message})`);
                return null;
            }
        }
    }
    return null;
}

async function scrapeCalendarWeek(shopId: string, weekOffset: number = 0): Promise<SlotData[]> {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + weekOffset * 7);
    const y = targetDate.getFullYear();
    const mo = targetDate.getMonth() + 1;
    const d = targetDate.getDate();

    const url = weekOffset === 0
        ? `${BASE}/r/shop/${shopId}/calendar_week/`
        : `${BASE}/r/shop/${shopId}/calendar_week/${y}/${mo}/${d}/`;

    const slots: SlotData[] = [];

    const html = await fetchWithRetry(url, shopId);
    if (!html) return slots;

    try {
        const $ = cheerio.load(html);

        // Find the calendar table (#calendar_width)
        const table = $('#calendar_width');
        if (!table.length) {
            // Check if the page has any content at all (might be a page without calendar)
            const bodyText = $('body').text().trim();
            if (bodyText.length > 100) {
                // Page loaded but no calendar found — may use a different layout
            }
            return slots;
        }

        // Parse header row to find start hour
        const headerRow = table.find('tr.time').first();
        let startHour = 5; // default (observed: 05:00)
        let startMin = 0;

        headerRow.find('td.hour').first().each((_, el) => {
            const text = $(el).text().trim();
            const m = text.match(/(\d{1,2})\s*:\s*(\d{2})/);
            if (m) {
                startHour = parseInt(m[1]);
                startMin = parseInt(m[2]);
            }
        });

        // Process data rows (tr.spaces)
        let currentDate = '';
        const now = new Date();
        const currentYear = now.getFullYear();

        const dataRows = table.find('tr.spaces');

        dataRows.each((_, row) => {
            const $row = $(row);
            const cells = $row.find('> td, > th');

            let courtName = '';
            let slotColPos = 0;

            cells.each((_, cell) => {
                const $cell = $(cell);
                const tag = cell.tagName?.toLowerCase() || 'td';
                const cls = ($cell.attr('class') || '').trim();
                const text = $cell.text().trim();
                const colspan = parseInt($cell.attr('colspan') || '1');

                // Date cell: <th class="day ...">02/18(水)</th>
                if (tag === 'th' && cls.includes('day')) {
                    const dateMatch = text.match(/(\d{1,2})\/(\d{1,2})/);
                    if (dateMatch) {
                        const mm = parseInt(dateMatch[1]);
                        const dd = parseInt(dateMatch[2]);
                        let year = currentYear;
                        if (mm === 1 && now.getMonth() >= 11) year++;
                        currentDate = `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
                    }
                    return; // skip — not a column in the slots grid
                }

                // Court cell: <td class="court">コート名</td>
                if (cls.includes('court')) {
                    courtName = text.replace(/\s+/g, ' ').trim().substring(0, 80);
                    return; // skip — not a column in the slots grid
                }

                // Slot cell: <td class="slot ex_btn ..." colspan=N>
                if (cls.includes('slot')) {
                    const { slotType, rawClass } = classifySlot(cls, text);

                    if (currentDate && courtName) {
                        const startTime = colPosToTime(slotColPos, startHour, startMin);
                        const endTime = colPosToTime(slotColPos + colspan, startHour, startMin);

                        slots.push({
                            stadium_id: shopId,
                            court_name: courtName,
                            slot_date: currentDate,
                            start_time: startTime,
                            end_time: endTime,
                            slot_type: slotType,
                            event_label: rawClass,
                        });
                    }

                    slotColPos += colspan;
                    return;
                }

                // Any other cell in a slot row — track position
                // (shouldn't happen normally but just in case)
            });
        });

    } catch (err: any) {
        console.error(`    ❌ [${shopId}] parse error: ${err.message}`);
    }

    return slots;
}

// ─── Save to Supabase ───

async function saveSlots(slots: SlotData[]): Promise<number> {
    if (slots.length === 0) return 0;

    let saved = 0;
    for (let i = 0; i < slots.length; i += 100) {
        const batch = slots.slice(i, i + 100);
        const { error } = await supabase.from('stadium_slot').upsert(
            batch.map(s => ({
                stadium_id: s.stadium_id,
                court_name: s.court_name,
                slot_date: s.slot_date,
                start_time: s.start_time,
                end_time: s.end_time,
                event_label: s.event_label,  // rawClass 원본 저장
            })),
            { onConflict: 'stadium_id,court_name,slot_date,start_time' }
        );
        if (error) {
            console.error(`  DB error: ${error.message}`);
        } else {
            saved += batch.length;
        }
    }
    return saved;
}

// ─── Main ───

async function main() {
    const weeksToScrape = parseInt(process.argv[2] || '1');

    console.log(`\n📅 Stadium Calendar Crawler v3 — Weekly View (${weeksToScrape} week(s))\n`);

    // Clear old data
    console.log('🧹 Clearing old slot data...');
    const { error: delErr } = await supabase.from('stadium_slot').delete().neq('stadium_id', '__impossible__');
    if (delErr) console.log(`  Warning: ${delErr.message}`);
    else console.log('  Done.\n');

    const { data: stadiums } = await supabase.from('stadium').select('id, name').order('name');
    if (!stadiums || stadiums.length === 0) {
        console.log('❌ No stadiums in DB.');
        return;
    }
    console.log(`📋 Found ${stadiums.length} stadiums\n`);

    let totalSlots = 0;
    const totalWork = stadiums.length * weeksToScrape;
    let processed = 0;
    let successCount = 0;
    const globalTypeCounts: Record<string, number> = {};

    for (let week = 0; week < weeksToScrape; week++) {
        if (weeksToScrape > 1) console.log(`\n📆 Week ${week + 1}\n`);

        for (let si = 0; si < stadiums.length; si += CONCURRENCY) {
            const batch = stadiums.slice(si, si + CONCURRENCY);

            await Promise.allSettled(
                batch.map(async (stadium) => {
                    const slots = await scrapeCalendarWeek(stadium.id, week);
                    let saved = 0;
                    if (slots.length > 0) {
                        saved = await saveSlots(slots);
                        totalSlots += saved;
                        successCount++;
                    }
                    processed++;
                    const pct = Math.round((processed / totalWork) * 100);

                    if (saved > 0) {
                        const types: Record<string, number> = {};
                        slots.forEach(s => { types[s.event_label] = (types[s.event_label] || 0) + 1; });
                        Object.entries(types).forEach(([k, v]) => {
                            globalTypeCounts[k] = (globalTypeCounts[k] || 0) + v;
                        });
                        const typeStr = Object.entries(types).map(([k, v]) => `${k}:${v}`).join(' ');
                        console.log(`  ✅ [${pct}%] ${stadium.name}: ${saved} slots (${typeStr})`);
                    } else {
                        console.log(`  ⬜ [${pct}%] ${stadium.name}: no data`);
                    }
                })
            );

            await sleep(DELAY);
        }
    }

    console.log(`\n═══════════════════════════════════`);
    console.log(`📊 Calendar Crawl Summary:`);
    console.log(`   Stadiums: ${stadiums.length}`);
    console.log(`   With data: ${successCount}`);
    console.log(`   Total slots: ${totalSlots}`);
    if (Object.keys(globalTypeCounts).length > 0) {
        console.log(`   Breakdown:`);
        Object.entries(globalTypeCounts).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
            const pct = Math.round((count / totalSlots) * 100);
            console.log(`     ${type}: ${count} (${pct}%)`);
        });
    }
    console.log(`═══════════════════════════════════`);
}

main().catch(console.error);
