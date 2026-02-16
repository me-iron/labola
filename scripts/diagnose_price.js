// Diagnostic: crawl one day, fetch detail pages, report which events have no price and why
const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://labola.jp/r/event/?area=&kind=individual&category=futsal';

async function getEventUrls(dateStr) {
    const events = [];
    let page = 1;
    let keepFetching = true;
    while (keepFetching && page <= 5) { // limit to 5 pages for speed
        const url = `${BASE_URL}&hold_on=${dateStr}&page=${page}`;
        try {
            const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 });
            const $ = cheerio.load(data);
            const cards = $('.c-eventcard');
            if (cards.length === 0) break;
            cards.each((_, el) => {
                const a = $(el).find('.c-eventcard__title a');
                const href = a.attr('href') || '';
                const fullUrl = href.startsWith('http') ? href : `https://labola.jp${href}`;
                events.push({ url: fullUrl, title: a.text().trim().substring(0, 40) });
            });
            if (!$('.c-pagination__link:contains("＞")').length) break;
            page++;
        } catch (e) { break; }
    }
    return events;
}

async function diagnosePrice(url) {
    try {
        const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000 });
        const $ = cheerio.load(data);

        // Try to find price row
        let priceTd = null;
        let method = '';
        const commentRow = $('tr#comment td');
        if (commentRow.length) { priceTd = commentRow; method = 'tr#comment'; }
        else {
            $('table tr').each((_, tr) => {
                const th = $(tr).find('th').text();
                if (th.includes('料金') || th.includes('参加費')) { priceTd = $(tr).find('td'); method = 'th:' + th.trim().substring(0, 10); return false; }
            });
        }

        if (!priceTd) return { status: 'NO_ROW', method: 'none', detail: 'No price row found' };

        const tdHtml = priceTd.html() || '';
        const fullText = priceTd.text().trim();
        const hasBTag = priceTd.find('b').length > 0;
        const hasFontTag = priceTd.find('font').length > 0;
        const hasDivPre = priceTd.find('div.pre').length > 0;

        // Try structured <b> extraction
        const planBlocks = tdHtml.split(/<br\s*\/?>/i).map(b => b.trim()).filter(Boolean);
        let bCount = 0;
        for (const block of planBlocks) {
            const b$ = cheerio.load(block);
            if (b$('b').first().text().trim()) bCount++;
        }

        // Try free text
        const yenMatches = fullText.match(/\d[\d,]+\s*円/g) || [];

        return {
            status: (bCount > 0 || yenMatches.length > 0) ? 'HAS_PRICE' : 'NO_PRICE_DATA',
            method,
            hasBTag: bCount > 0,
            hasFontTag,
            hasDivPre,
            bBlockCount: bCount,
            yenMatches: yenMatches.length,
            textPreview: fullText.substring(0, 120).replace(/\n/g, ' '),
            htmlSnippet: tdHtml.substring(0, 200)
        };
    } catch (e) {
        return { status: 'ERROR', detail: e.message };
    }
}

(async () => {
    const dateStr = '2026-02-16';
    console.log(`Crawling events for ${dateStr}...`);
    const events = await getEventUrls(dateStr);
    console.log(`Found ${events.length} events. Diagnosing prices...\n`);

    const BATCH = 10;
    const failures = [];
    let successCount = 0;
    let totalChecked = 0;

    for (let i = 0; i < events.length; i += BATCH) {
        const batch = events.slice(i, i + BATCH);
        const results = await Promise.all(batch.map(e => diagnosePrice(e.url)));
        results.forEach((r, idx) => {
            totalChecked++;
            const event = batch[idx];
            if (r.status === 'HAS_PRICE') {
                successCount++;
            } else {
                failures.push({ ...event, ...r });
                console.log(`❌ ${event.title}`);
                console.log(`   URL: ${event.url}`);
                console.log(`   Status: ${r.status} | Method: ${r.method}`);
                if (r.textPreview) console.log(`   Text: ${r.textPreview}`);
                if (r.htmlSnippet) console.log(`   HTML: ${r.htmlSnippet}`);
                console.log();
            }
        });
    }

    console.log(`\n=== SUMMARY ===`);
    console.log(`Total: ${totalChecked} | Success: ${successCount} | Failures: ${failures.length}`);
    console.log(`Success rate: ${(successCount / totalChecked * 100).toFixed(1)}%`);

    if (failures.length > 0) {
        console.log('\n=== FAILURE PATTERNS ===');
        const byStatus = {};
        failures.forEach(f => { byStatus[f.status] = (byStatus[f.status] || 0) + 1; });
        console.log(byStatus);
    }
})();
