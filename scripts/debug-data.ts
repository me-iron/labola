import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(process.cwd(), '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
});

const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function main() {
    // 1) Sample slots from shop 3154
    const { data } = await sb.from('stadium_slot')
        .select('stadium_id, court_name, slot_date, start_time, end_time, is_available, event_label')
        .eq('stadium_id', '3154')
        .order('slot_date').order('court_name').order('start_time')
        .limit(50);

    console.log('=== Sample slots (shop 3154) ===');
    data?.forEach(s => {
        const [sh, sm] = s.start_time.split(':').map(Number);
        const [eh, em] = s.end_time.split(':').map(Number);
        const dur = (eh * 60 + em) - (sh * 60 + sm);
        console.log(
            s.slot_date,
            `${s.start_time}-${s.end_time}`,
            `(${dur}min)`.padEnd(8),
            s.event_label.padEnd(16),
            s.court_name
        );
    });

    // 2) Overall type distribution
    const { data: allSlots, count } = await sb.from('stadium_slot')
        .select('event_label, start_time, end_time', { count: 'exact' });

    const counts: Record<string, number> = {};
    let totalMinutes = 0;
    allSlots?.forEach(s => {
        counts[s.event_label] = (counts[s.event_label] || 0) + 1;
        const [sh, sm] = s.start_time.split(':').map(Number);
        const [eh, em] = s.end_time.split(':').map(Number);
        totalMinutes += (eh * 60 + em) - (sh * 60 + sm);
    });

    console.log('\n=== Type distribution ===');
    Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) =>
        console.log(String(k).padEnd(16), v, `(${Math.round(v / (count || 1) * 100)}%)`)
    );
    console.log('Total rows:', count);
    console.log('Total minutes:', totalMinutes, '=', Math.round(totalMinutes / 60), 'hours');

    // 3) Per-stadium slot count
    const { data: perStadium } = await sb.from('stadium_slot')
        .select('stadium_id');
    const stadiumCounts: Record<string, number> = {};
    perStadium?.forEach(s => { stadiumCounts[s.stadium_id] = (stadiumCounts[s.stadium_id] || 0) + 1; });
    console.log('\n=== Per-stadium slot counts (top 10) ===');
    Object.entries(stadiumCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([k, v]) =>
        console.log(`  ${k}: ${v} slots`)
    );
}

main().catch(console.error);
