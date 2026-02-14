const cheerio = require('cheerio');

const testCases = [
    { html: '<div class="c-eventcard__price">¥2,000</div>', expected: 2000 },
    { html: '<div class="c-eventcard__price">2,000円</div>', expected: 2000 },
    { html: '<div class="c-eventcard__price">1500円</div>', expected: 1500 },
    { html: '<div class="c-eventcard__price">無料</div>', expected: 0 },
    { html: '<div class="c-eventcard__price">参加費：1,000円</div>', expected: 1000 },
    { html: '<div class="c-eventcard__price"></div>', expected: null },
    { html: '<div class="c-eventcard__price">  ¥ 3,000  </div>', expected: 3000 },
];

console.log('Running Price Extraction Tests...');
let passed = 0;

testCases.forEach((test, index) => {
    const $ = cheerio.load(test.html);
    const priceText = $('.c-eventcard__price').text().trim();

    let price = null;
    if (priceText) {
        const priceNumStr = priceText.replace(/[^0-9]/g, '');
        if (priceNumStr) {
            price = parseInt(priceNumStr, 10);
        } else if (priceText.includes('無料')) {
            price = 0;
        }
    }

    const result = price === test.expected ? 'PASS' : `FAIL (Expected ${test.expected}, got ${price})`;
    console.log(`Test Case ${index + 1}: "${priceText}" -> ${price} [${result}]`);
    if (price === test.expected) passed++;
});

console.log(`\nResult: ${passed}/${testCases.length} Passed`);
