
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
    console.log('🧹 Resetting prices > 3000 yen to NULL (team fees cleanup)...');

    // Count affected events
    const { count, error: countError } = await supabase
        .from('match')
        .select('*', { count: 'exact', head: true })
        .gt('price', 3000);

    if (countError) {
        console.error('Error counting:', countError);
        return;
    }

    console.log(`Found ${count} events with price > 3000 yen.`);

    if (count === 0) {
        console.log('✨ No price cleanup needed!');
        return;
    }

    // Set price to null so re-crawl will fetch correct individual price
    const { error: updateError } = await supabase
        .from('match')
        .update({ price: null })
        .gt('price', 3000);

    if (updateError) {
        console.error('❌ Update failed:', updateError.message);
    } else {
        console.log(`✅ Reset ${count} prices to NULL. Next crawl will re-fetch with 3000 yen cap.`);
    }
})();
