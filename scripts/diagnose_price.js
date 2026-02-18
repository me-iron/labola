const axios = require('axios');
const cheerio = require('cheerio');

async function getSampleEvents() {
    console.log('Fetching sample events list...');
    // Fetch a list page to getting fresh URLs
    const url = 'https://labola.jp/r/event/?area=&kind=individual&category=futsal';
    try {
        const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(data);
        const links = [];
        $('.c-eventcard__title a').each((i, el) => {
            if (i < 5) {
                const href = $(el).attr('href');
                links.push(href.startsWith('http') ? href : 'https://labola.jp' + href);
            }
        });
        return links;
    } catch (e) {
        console.error('Failed to fetch list:', e.message);
        return [];
    }
}

function extractMaxPrice($) {
    // 1. naive text scan for numbers 500-5000
    const text = $('body').text();
    const numbers = text.match(/\d{3,5}/g) || [];
    const validPrices = numbers.map(n => parseInt(n, 10))
        .filter(n => n >= 500 && n <= 3000); // Filter for reasonable individual futsal prices
    return validPrices.length ? Math.max(...validPrices) : null;
}

function extractDetailPrice($) {
    // Replicating current logic from crawler.ts approximately to compare
    let priceTd = null;
    const commentRow = $('tr#comment td');
    if (commentRow.length) priceTd = commentRow;
    else {
        $('table tr').each((_, tr) => {
            const th = $(tr).find('th').text();
            if (th.includes('料金') || th.includes('参加費')) {
                priceTd = $(tr).find('td');
                return false; // break
            }
        });
    }

    if (!priceTd) return 'NO_TD_FOUND';

    const fullText = priceTd.text().trim();
    if (fullText.includes('無料') && !fullText.match(/[1-9]/)) return 0;

    // Pattern A/B: <b>...</b>
    const bTags = [];
    priceTd.find('b').each((_, el) => {
        bTags.push($(el).text().trim());
    });

    return {
        text: fullText.substring(0, 100).replace(/\n/g, ' '),
        bTags: bTags,
        // ... (complex logic omitted for brevity, just seeing what we have)
    };
}

(async () => {
    const links = await getSampleEvents();
    if (links.length === 0) {
        console.log('No links found.');
        return;
    }

    console.log(`Analyzing ${links.length} events...\n`);

    for (const url of links) {
        try {
            console.log(`URL: ${url}`);
            const { data } = await axios.get(url, {
                timeout: 5000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
            const $ = cheerio.load(data);

            const currentExtraction = extractDetailPrice($);
            const maxPrice = extractMaxPrice($);

            console.log('  Current Logic sees:', JSON.stringify(currentExtraction));
            console.log('  Max Price strategy:', maxPrice);
            console.log('-----------------------------------');

        } catch (e) {
            console.error(`  Error: ${e.message}`);
        }
    }
})();
