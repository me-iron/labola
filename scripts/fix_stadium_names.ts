import { createClient } from '@supabase/supabase-js';

const sb = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

(async () => {
    const { data } = await sb.from('stadium').select('id, name');
    if (!data) return;
    let fixed = 0;
    for (const s of data) {
        const clean = s.name.replace(/ - LaBOLA総合予約$/, '');
        if (clean !== s.name) {
            await sb.from('stadium').update({ name: clean }).eq('id', s.id);
            console.log('Fixed:', s.name, '->', clean);
            fixed++;
        }
    }
    console.log(`Done. Fixed ${fixed}/${data.length} names.`);
})();
