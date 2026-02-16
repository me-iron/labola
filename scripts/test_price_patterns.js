// Test script to analyze price HTML patterns across different event pages
const axios = require('axios');
const cheerio = require('cheerio');

const TEST_URLS = [
    'https://labola.jp/r/shop/2148/event/show/2669989/',
    'https://labola.jp/r/shop/3154/event/show/2572096/',
    'https://labola.jp/r/shop/3050/event/show/2628110/',
    'https://labola.jp/r/shop/3007/event/show/2586358/',
    'https://labola.jp/r/shop/2002/event/show/2235593/',
    'https://labola.jp/r/shop/661/event/show/2556480/',
    'https://labola.jp/r/shop/3281/event/show/2147844/',
    'https://labola.jp/r/shop/3094/event/show/2199572/',
    'https://labola.jp/r/shop/3403/event/show/2390568/',
    'https://labola.jp/r/shop/3339/event/show/2500059/',
    'https://labola.jp/r/shop/2044/event/show/2555970/',
    'https://labola.jp/r/shop/2106/event/show/2596619/',
];

async function analyzePage(url) {
    try {
        const { data } = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000
        });
        const $ = cheerio.load(data);

        // Find the price row
        let priceTd = null;
        let method = '';

        // Method 1: tr#comment
        const commentRow = $('tr#comment td');
        if (commentRow.length) { priceTd = commentRow; method = 'tr#comment'; }

        // Method 2: th containing 料金
        if (!priceTd) {
            $('table tr').each((_, tr) => {
                const th = $(tr).find('th').text();
                if (th.includes('料金')) {
                    priceTd = $(tr).find('td');
                    method = 'th:料金';
                    return false;
                }
            });
        }

        // Method 3: th containing 参加費
        if (!priceTd) {
            $('table tr').each((_, tr) => {
                const th = $(tr).find('th').text();
                if (th.includes('参加費')) {
                    priceTd = $(tr).find('td');
                    method = 'th:参加費';
                    return false;
                }
            });
        }

        if (!priceTd) return { url, error: 'NO PRICE ROW FOUND', method: 'none' };

        const html = priceTd.html();
        const text = priceTd.text().trim();
        const hasBTag = priceTd.find('b').length > 0;
        const hasFontTag = priceTd.find('font').length > 0;
        const hasDivPre = priceTd.find('div.pre').length > 0;
        const hasSpanF12 = priceTd.find('span.f12').length > 0;

        const bTexts = [];
        priceTd.find('b').each((_, el) => bTexts.push($(el).text().trim()));

        const fontTexts = [];
        priceTd.find('font').each((_, el) => fontTexts.push($(el).text().trim()));

        // Try to find numbers after 円 pattern
        const yenMatches = text.match(/[\d,]+\s*円/g) || [];

        // Look for  ビジター, ゲスト patterns
        const hasVisitor = text.includes('ビジター');
        const hasGuest = text.includes('ゲスト');
        const hasMember = text.includes('メンバー');

        return {
            url: url.replace('https://labola.jp/r/shop/', '').replace('/event/show/', ' #'),
            method,
            hasBTag, hasFontTag, hasDivPre, hasSpanF12,
            bTexts: bTexts.join(' | '),
            fontTexts: fontTexts.length > 0 ? fontTexts.join(' | ').substring(0, 100) : '-',
            yenMatches: yenMatches.join(' | '),
            hasVisitor, hasGuest, hasMember,
            textPreview: text.substring(0, 200).replace(/\n/g, ' '),
            htmlPreview: html.substring(0, 300)
        };
    } catch (e) {
        return { url, error: e.message };
    }
}

(async () => {
    console.log('Analyzing price patterns across', TEST_URLS.length, 'event pages...\n');

    for (const url of TEST_URLS) {
        const result = await analyzePage(url);
        console.log('---');
        console.log(JSON.stringify(result, null, 2));
    }
})();
