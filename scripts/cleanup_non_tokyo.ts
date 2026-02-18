
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
    console.log('🧹 Cleaning up NON-TOKYO events...');

    // Count before deleting
    const { count, error: countError } = await supabase
        .from('match')
        .select('*', { count: 'exact', head: true })
        .not('address', 'ilike', '%東京%')
        // some events have null region, assume non-Tokyo unless address says Tokyo
        ;

    if (countError) {
        console.error('Error counting:', countError);
        return;
    }

    console.log(`Found ${count} non-Tokyo events (address does not contain '東京').`);

    if (count === 0) {
        console.log('✨ Database is already clean!');
        return;
    }

    // Delete
    const { error: deleteError } = await supabase
        .from('match')
        .delete()
        .not('address', 'ilike', '%東京%');

    if (deleteError) {
        console.error('❌ Delete failed:', deleteError.message);
    } else {
        console.log(`✅ Deleted ${count} non-Tokyo events.`);
    }
})();
