import axios from 'axios';
import * as cheerio from 'cheerio';

// Helper for retrying axios requests to handle temporary network glitches
async function fetchWithRetry(url: string, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        timeout: 8000
      });
    } catch (error: any) {
      if (i === retries - 1) throw error;
      console.warn(`[Retry ${i + 1}/${retries}] Failed to fetch ${url}: ${error.message}`);
      await new Promise(res => setTimeout(res, 1000 * Math.pow(2, i)));
    }
  }
  throw new Error('Unreachable');
}

export interface Event {
  id: string;
  date: string;
  isoDate: string;
  time: string;
  startTime: string;  // Sortable start time (e.g. "10:00")
  title: string;
  stadium: string;
  address: string;
  url: string;
  booked: number;
  capacity: number;
  status: string;
  price: number | null; // Extracted Price (e.g. 2000)
  region: string | null; // Extracted Prefecture (e.g. 東京都)
}

const BASE_URL = 'https://labola.jp/r/event/?area=&kind=individual&category=futsal';

export async function fetchDetailPrice(url: string): Promise<number | null> {
  try {
    const { data } = await fetchWithRetry(url);
    const $ = cheerio.load(data);

    // Find the price row: tr#comment or th containing 料金
    let priceTd: ReturnType<typeof $> | null = null;
    const commentRow = $('tr#comment td');
    if (commentRow.length) {
      priceTd = commentRow;
    } else {
      $('table tr').each((_, tr) => {
        const th = $(tr).find('th').text();
        if (th.includes('料金') || th.includes('参加費')) {
          priceTd = $(tr).find('td');
          return false;
        }
      });
    }

    if (!priceTd || !priceTd.length) return null;

    const tdHtml = priceTd.html() || '';
    const fullText = priceTd.text() || '';

    // Handle completely free events
    if (fullText.includes('無料') && !fullText.match(/[1-9]/)) return 0;

    // ── Pattern A & B: structured <span><b>price</b> 円</span> blocks ──
    // Split by <br> to get individual plan lines
    const planBlocks = tdHtml.split(/<br\s*\/?>/i).map((b: string) => b.trim()).filter(Boolean);

    const plans: { price: number; label: string; target: string; isVisitor: boolean; isMember: boolean; isDiscount: boolean }[] = [];
    for (const block of planBlocks) {
      const block$ = cheerio.load(block);
      const bText = block$('b').first().text().trim();
      if (!bText) continue;

      const numStr = bText.replace(/[^0-9]/g, '');
      if (!numStr) continue;

      const price = parseInt(numStr, 10);
      if (price < 500 || price > 3000) continue;  // 개인 참가비 범위(500~3000엔)만 허용
      const targetSpan = block$('span.f12').text().trim();
      const labelText = block$.text().trim();

      // Determine audience type from label text AND target span
      const combinedText = labelText + targetSpan;
      const isVisitor = /ビジター|ゲスト|ビジタ/.test(combinedText);
      const isMember = /メンバー|会員/.test(combinedText);
      const isDiscount = /割|早割|期間限定|CP|キャンペーン|連続|追加|時間|パック|賢者|セット|女性|レディース|学生|GK|ゴレイロ|ゴールキーパー|キッズ/.test(labelText);

      plans.push({ price, label: labelText, target: targetSpan, isVisitor, isMember, isDiscount });
    }

    if (plans.length > 0) {
      // Priority 1: Explicit visitor-only plan (not a discount/extended)
      const visitorOnly = plans.find(p => p.isVisitor && !p.isMember && !p.isDiscount);
      if (visitorOnly) return visitorOnly.price;

      // Priority 2: Shared member/visitor plan (not a discount) — use first (= standard)
      const shared = plans.find(p => p.isVisitor && p.isMember && !p.isDiscount);
      if (shared) return shared.price;

      // Priority 3: Any plan labeled visitor (even with discount keyword)
      const anyVisitor = plans.find(p => p.isVisitor);
      if (anyVisitor) return anyVisitor.price;

      // Priority 4: Non-discount plan with highest price (likely visitor/standard)
      const nonDiscount = plans.filter(p => !p.isDiscount && p.price > 0);
      if (nonDiscount.length > 0) {
        const maxPrice = Math.max(...nonDiscount.map(p => p.price));
        if (maxPrice <= 3000) return maxPrice;
      }

      // Priority 5: First plan
      return plans[0].price;
    }

    // ── Pattern C: free-text in div.pre or plain text (no <b> tags) ──
    // Handles: "お一人様：1500円", "一般 ¥1,400", "一律：1,100", "ビジター 1,400円"
    const lines = fullText.split('\n').map((l: string) => l.trim()).filter(Boolean);

    // Helper: extract all prices from a line (¥X, X円, or bare X,XXX)
    const extractPrices = (line: string): number[] => {
      const prices: number[] = [];
      // Match ¥X or ￥X
      const yenPrefix = line.matchAll(/[￥¥]\s*(\d[\d,]+)/g);
      for (const m of yenPrefix) { const v = parseInt(m[1].replace(/,/g, ''), 10); if (v >= 500 && v <= 3000) prices.push(v); }
      // Match X円
      const yenSuffix = line.matchAll(/(\d[\d,]+)\s*円/g);
      for (const m of yenSuffix) { const v = parseInt(m[1].replace(/,/g, ''), 10); if (v >= 500 && v <= 3000) prices.push(v); }
      // Match bare numbers after ：or : (e.g. "一律：1,100")
      const colonPrice = line.matchAll(/[：:]\s*(\d[\d,]+)/g);
      for (const m of colonPrice) { const v = parseInt(m[1].replace(/,/g, ''), 10); if (v >= 500 && v <= 3000) prices.push(v); }
      return [...new Set(prices)];
    };

    // Pass 1: Find visitor/guest specific price line
    for (const line of lines) {
      if (/ビジター|ゲスト|ビジタ/.test(line)) {
        // Skip if the line is about cancellation/discount
        if (/キャンセル|割|LINE/.test(line)) continue;
        const prices = extractPrices(line);
        if (prices.length > 0) {
          // If line has both member and visitor, take the higher one (visitor is typically higher)
          if (/メンバー|会員/.test(line) && prices.length > 1) return Math.max(...prices);
          // Otherwise take the last price on the line (often the visitor-specific one)
          return prices[prices.length - 1];
        }
      }
    }

    // Pass 2: Find standard/general price (not discount)
    for (const line of lines) {
      if (/割|学生|女性|レディース|GK|ゴレイロ|キッズ|連続参加|追加|LINE|キャンセル/.test(line)) continue;
      if (/一律|通常|お一人|一般|参加費|当日|大人|男性/.test(line) || lines.indexOf(line) === 0) {
        // Handle range: take the higher value (= walk-in/standard)
        const rangeMatch = line.match(/(\d[\d,]+)\s*円?\s*[~〜]\s*(\d[\d,]+)\s*円?/);
        if (rangeMatch) {
          const high = parseInt(rangeMatch[2].replace(/,/g, ''), 10);
          if (high >= 500 && high <= 3000) return high;
        }
        const prices = extractPrices(line);
        if (prices.length > 0) return prices[0];
      }
    }

    // Pass 3: Broad fallback — any reasonable price in the text
    for (const line of lines) {
      if (/キャンセル|返金|払い戻/.test(line)) continue;
      const prices = extractPrices(line);
      if (prices.length > 0) return prices[0];
    }

    // ── Pattern D: MAX PRICE Strategy (Fallback) ──
    // If all else fails, find the highest number between 500 and 3000 in the price cell.
    // Capped at 3000 to exclude team fees (5000+) and focus on individual male guest pricing.
    const allNumbers = fullText.match(/\d[\d,]*\d/g) || [];
    const candidates: number[] = [];
    for (const numStr of allNumbers) {
      const v = parseInt(numStr.replace(/,/g, ''), 10);
      // Individual futsal in Tokyo: 500 ~ 3,000 yen
      if (v >= 500 && v <= 3000) {
        candidates.push(v);
      }
    }

    if (candidates.length > 0) {
      return Math.max(...candidates);
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Crawl a SINGLE page of event listings for a given date.
 * Designed to fit within Vercel Hobby 10s timeout (~2s per page).
 * Returns parsed events + whether there's a next page.
 */
export async function crawlListPage(dateStr: string, page: number): Promise<{ events: Event[]; hasNext: boolean }> {
  const url = `${BASE_URL}&hold_on=${dateStr}&page=${page}`;
  const events: Event[] = [];

  try {
    const { data } = await fetchWithRetry(url);
    const $ = cheerio.load(data);
    const eventCards = $('.c-eventcard');

    if (eventCards.length === 0) {
      return { events: [], hasNext: false };
    }

    eventCards.each((_, element) => {
      const dateDay = $(element).find('.c-eventcard__date__day').text().trim();
      const dateWeek = $(element).find('.c-eventcard__date__week').text().trim();
      const time = $(element).find('.c-eventcard__date__time').text().trim();

      const titleElement = $(element).find('.c-eventcard__title a');
      const title = titleElement.text().trim();
      const detailUrl = titleElement.attr('href') || '';
      const fullUrl = detailUrl.startsWith('http') ? detailUrl : `https://labola.jp${detailUrl}`;
      const eventId = detailUrl.split('/event/show/')[1]?.replace('/', '') || Math.random().toString(36).substring(7);

      const stadiumElement = $(element).find('.c-eventcard__text').first();
      const organizerText = stadiumElement.text().trim().replace('主催者：', '');

      const addressElement = $(element).find('.c-eventcard__text').eq(1);
      const address = addressElement.text().trim();

      const limitCountText = $(element).find('.c-eventcard__limit__count').text().trim();
      const [bookedStr, capacityStr] = limitCountText.split('/');
      const booked = parseInt(bookedStr || '0', 10);
      const capacity = parseInt(capacityStr || '0', 10);

      const status = $(element).find('.c-eventcard__state').text().trim();

      const regionMatch = address.match(/^(.+?[都道府県])/);
      const region = regionMatch ? regionMatch[0] : null;

      let startTime = time.split('-')[0]?.trim() || time;
      if (/^\d:/.test(startTime)) startTime = '0' + startTime;

      // ── SCOPE REFINEMENT: TOKYO ONLY ──
      // User requested to limit scope to Tokyo for better accuracy.
      // We filter here because direct URL filtering (area=tokyo) was unreliable.
      if (!address.includes('東京') && !region?.includes('東京')) {
        return; // Skip non-Tokyo events
      }

      events.push({
        id: eventId,
        date: `${dateDay} (${dateWeek})`,
        isoDate: dateStr,
        time,
        startTime,
        title,
        stadium: organizerText,
        address,
        region,
        url: fullUrl,
        booked: isNaN(booked) ? 0 : booked,
        capacity: isNaN(capacity) ? 0 : capacity,
        status,
        price: null,
      });
    });

    const hasNext = $('.c-pagination__link:contains("＞")').length > 0;
    return { events, hasNext };

  } catch (error) {
    console.error(`Error fetching ${dateStr} page ${page}:`, error);
    return { events: [], hasNext: false };
  }
}

