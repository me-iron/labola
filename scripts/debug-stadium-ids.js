const { readFileSync } = require('fs');
const { resolve } = require('path');
const { createClient } = require('@supabase/supabase-js');

try {
    const envContent = readFileSync(resolve(__dirname, '..', '.env.local'), 'utf-8');
    envContent.split('\n').forEach(line => {
        const match = line.match(/^([^#=]+)=(.*)$/);
        if (match) process.env[match[1].trim()] = match[2].trim();
    });
} catch { }

const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
    // Check if 3098, 3138, 526 exist in stadium table
    const { data: found } = await sb.from('stadium').select('id, name, labola_url').in('id', ['3098', '3138', '526']);
    console.log('=== Target stadiums in DB ===');
    console.log(JSON.stringify(found, null, 2));

    // Get all stadiums and their slot counts
    const { data: all } = await sb.from('stadium').select('id, name, labola_url').order('name');

    // Check which have slots
    const { data: slotCounts } = await sb.from('stadium_slot').select('stadium_id');
    const countMap = {};
    (slotCounts || []).forEach(s => {
        countMap[s.stadium_id] = (countMap[s.stadium_id] || 0) + 1;
    });

    const noData = (all || []).filter(s => !countMap[s.id]);
    console.log('\n=== Stadiums WITHOUT slot data (' + noData.length + '/' + all.length + ') ===');
    noData.forEach(s => {
        const shopMatch = (s.labola_url || '').match(/shop\/(\d+)/);
        const shopId = shopMatch ? shopMatch[1] : s.id;
        console.log('  id=' + s.id + ' shop=' + shopId + ' ' + s.name);
    });

    console.log('\n=== Stadiums WITH slot data (' + Object.keys(countMap).length + ') ===');
    const withData = (all || []).filter(s => countMap[s.id]);
    withData.slice(0, 5).forEach(s => {
        console.log('  id=' + s.id + ' slots=' + countMap[s.id] + ' ' + s.name);
    });
}
check();
