/**
 * Run Supabase migration for stadium tables.
 * Creates tables via direct REST API calls.
 * 
 * Usage: source .env.local && npx tsx scripts/run_migration.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testTable(tableName: string) {
    const { error } = await supabase.from(tableName).select('*').limit(1);
    return !error;
}

async function main() {
    console.log('🔍 Checking if stadium tables exist...\n');

    const stadiumExists = await testTable('stadium');
    const courtExists = await testTable('stadium_court');

    if (stadiumExists && courtExists) {
        console.log('✅ Both tables already exist!');
        return;
    }

    console.log(`  stadium: ${stadiumExists ? '✅ exists' : '❌ missing'}`);
    console.log(`  stadium_court: ${courtExists ? '✅ exists' : '❌ missing'}`);
    console.log('\n⚠️  Please run the following SQL in Supabase SQL Editor:');
    console.log('   File: scripts/migration_stadium.sql\n');
    console.log('   Steps:');
    console.log('   1. Go to https://supabase.com/dashboard');
    console.log('   2. Select your project');
    console.log('   3. Go to SQL Editor');
    console.log('   4. Paste the contents of scripts/migration_stadium.sql');
    console.log('   5. Click "Run"');
    console.log('\n   Then re-run this script to verify.');
    process.exit(1);
}

main();
