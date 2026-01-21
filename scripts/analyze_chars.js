const fs = require('fs');
const events = require('../data/events.json');

const allText = events.map(e => e.title + e.stadium + e.address).join('');
const uniqueChars = new Set(allText.split(''));
const kanji = [];
const katakana = [];

// Range check
// Katakana: \u30A0-\u30FF
// Kanji: \u4E00-\u9FAF

for (const char of uniqueChars) {
    if (char >= '\u30A0' && char <= '\u30FF') {
        katakana.push(char);
    } else if (char >= '\u4E00' && char <= '\u9FAF') {
        kanji.push(char);
    }
}

console.log(`Found ${katakana.length} unique Katakana chars.`);
console.log(`Found ${kanji.length} unique Kanji chars.`);
console.log('Katakana:', katakana.join(''));
console.log('Kanji:', kanji.join(''));
