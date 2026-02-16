// Verification script to test the updated fetchDetailPrice logic against all event patterns
const axios = require('axios');
const cheerio = require('cheerio');

async function fetchDetailPrice(url) {
    try {
        const { data } = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 8000
        });
        const $ = cheerio.load(data);

        let priceTd = null;
        const commentRow = $('tr#comment td');
        if (commentRow.length) { priceTd = commentRow; }
        else {
            $('table tr').each((_, tr) => {
                const th = $(tr).find('th').text();
                if (th.includes('料金') || th.includes('参加費')) {
                    priceTd = $(tr).find('td');
                    return false;
                }
            });
        }
        if (!priceTd || !priceTd.length) return { price: null, reason: 'no price row' };

        const tdHtml = priceTd.html() || '';
        const fullText = priceTd.text() || '';
        if (fullText.includes('無料') && !fullText.match(/[1-9]/)) return { price: 0, reason: 'free' };

        const planBlocks = tdHtml.split(/<br\s*\/?>/i).map(b => b.trim()).filter(Boolean);
        const plans = [];
        for (const block of planBlocks) {
            const block$ = cheerio.load(block);
            const bText = block$('b').first().text().trim();
            if (!bText) continue;
            const numStr = bText.replace(/[^0-9]/g, '');
            if (!numStr) continue;
            const price = parseInt(numStr, 10);
            const targetSpan = block$('span.f12').text().trim();
            const labelText = block$.text().trim();
            const combinedText = labelText + targetSpan;
            const isVisitor = /ビジター|ゲスト|ビジタ/.test(combinedText);
            const isMember = /メンバー|会員/.test(combinedText);
            const isDiscount = /割|早割|期間限定|CP|キャンペーン|連続/.test(labelText);
            plans.push({ price, label: labelText.substring(0, 40), isVisitor, isMember, isDiscount });
        }

        if (plans.length > 0) {
            const visitorOnly = plans.find(p => p.isVisitor && !p.isMember && !p.isDiscount);
            if (visitorOnly) return { price: visitorOnly.price, reason: 'visitor-only', plans: plans.length };
            const shared = plans.filter(p => p.isVisitor && p.isMember && !p.isDiscount);
            if (shared.length > 0) return { price: Math.max(...shared.map(p => p.price)), reason: 'shared', plans: plans.length };
            const anyVisitor = plans.find(p => p.isVisitor);
            if (anyVisitor) return { price: anyVisitor.price, reason: 'any-visitor', plans: plans.length };
            const nonDiscount = plans.filter(p => !p.isDiscount && p.price > 0);
            if (nonDiscount.length > 0) return { price: Math.max(...nonDiscount.map(p => p.price)), reason: 'highest-non-discount', plans: plans.length };
            return { price: plans[0].price, reason: 'first-plan', plans: plans.length };
        }

        // Pattern C: free-text fallback
        const yenPattern = /(?:￥|¥)?(\d[\d,]*)\s*円?(?:\s*[-~〜]\s*(?:￥|¥)?(\d[\d,]*)\s*円?)?/g;
        const amounts = [];
        let match;
        while ((match = yenPattern.exec(fullText)) !== null) {
            const v1 = parseInt(match[1].replace(/,/g, ''), 10);
            if (v1 > 0 && v1 < 100000) amounts.push(v1);
            if (match[2]) {
                const v2 = parseInt(match[2].replace(/,/g, ''), 10);
                if (v2 > 0 && v2 < 100000) amounts.push(v2);
            }
        }
        const filtered = amounts.filter(a => a >= 500);
        if (filtered.length > 0) return { price: Math.max(...filtered), reason: 'free-text-yen', amounts };
        if (amounts.length > 0) return { price: Math.max(...amounts), reason: 'free-text-all', amounts };
        return { price: null, reason: 'no-match' };
    } catch (e) {
        return { price: null, reason: 'error: ' + e.message };
    }
}

const TEST_URLS = [
    'https://labola.jp/r/shop/2148/event/show/2669989/',  // Pattern B: shared 2500
    'https://labola.jp/r/shop/3154/event/show/2572096/',  // Pattern B: multi plans
    'https://labola.jp/r/shop/3050/event/show/2628110/',  // Pattern B: 1200 shared
    'https://labola.jp/r/shop/3007/event/show/2586358/',  // unknown
    'https://labola.jp/r/shop/2002/event/show/2235593/',  // unknown
    'https://labola.jp/r/shop/661/event/show/2556480/',   // Pattern A: multi, 通常2000
    'https://labola.jp/r/shop/3281/event/show/2147844/',  // Pattern A: member 1500, visitor 2000
    'https://labola.jp/r/shop/3094/event/show/2199572/',  // Pattern B: 2200
    'https://labola.jp/r/shop/3403/event/show/2390568/',  // Pattern A: member 2000, visitor 2500
    'https://labola.jp/r/shop/3339/event/show/2500059/',  // Pattern B: 1800
    'https://labola.jp/r/shop/2044/event/show/2555970/',  // Pattern C: free-text 1500-1700
    'https://labola.jp/r/shop/2106/event/show/2596619/',  // Pattern A: member 1800, visitor 2300
];

(async () => {
    console.log('Testing price extraction on', TEST_URLS.length, 'pages...\n');
    let success = 0;
    for (const url of TEST_URLS) {
        const result = await fetchDetailPrice(url);
        const shortUrl = url.replace('https://labola.jp/r/shop/', '').replace('/event/show/', ' → ');
        const status = result.price !== null ? '✅' : '❌';
        if (result.price !== null) success++;
        console.log(`${status} ${shortUrl}  ¥${result.price}  (${result.reason})`);
    }
    console.log(`\n${success}/${TEST_URLS.length} pages with price`);
})();
