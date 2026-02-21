/**
 * Migration: Add map-related columns to stadium table
 * Usage: npx tsx scripts/migrate-map-columns.ts
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    console.log('\n🔧 Migrating stadium table — adding map columns\n');

    // We can't run raw DDL via supabase-js client.
    // Instead, print the SQL for the user to run in Supabase SQL Editor,
    // then verify column existence by attempting a select.

    const sql = `
-- Run in Supabase SQL Editor:
ALTER TABLE stadium ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE stadium ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
ALTER TABLE stadium ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'labola';
ALTER TABLE stadium ADD COLUMN IF NOT EXISTS business_status TEXT DEFAULT 'OPERATIONAL';
ALTER TABLE stadium ADD COLUMN IF NOT EXISTS place_id TEXT;
    `.trim();

    // Test if columns already exist by attempting to select them
    const { data, error } = await supabase
        .from('stadium')
        .select('id, lat, lng, source, business_status, place_id')
        .limit(1);

    if (!error) {
        console.log('✅ All columns already exist! No migration needed.');
        console.log('   Sample row:', JSON.stringify(data?.[0] || {}, null, 2));
        return;
    }

    // Columns don't exist yet
    console.log('⚠️  New columns need to be added. Please run this SQL in Supabase SQL Editor:');
    console.log('');
    console.log(sql);
    console.log('');
    console.log('📌 Go to: https://supabase.com/dashboard → SQL Editor → paste the above → Run');
}

main().catch(console.error);
