import axios from 'axios';
import * as cheerio from 'cheerio';
import { addDays, format } from 'date-fns';

export interface Event {
  id: string;
  date: string;
  isoDate: string;
  time: string;
  title: string;
  stadium: string;
  address: string;
  url: string;
  booked: number;
  capacity: number;
  status: string;
  region: string | null; // Extracted Prefecture (e.g. 東京都)
}

const BASE_URL = 'https://labola.jp/r/event/?area=&kind=individual&category=futsal';

export async function crawlLaBOLA(startDate: string, days: number): Promise<Event[]> {
  const start = new Date(startDate);
  const datesToCrawl: string[] = [];
  for (let i = 0; i < days; i++) {
    datesToCrawl.push(format(addDays(start, i), 'yyyy-MM-dd'));
  }

  console.log(`Starting crawl from ${startDate} for ${days} days (Parallel)...`);

  // Simple concurrency control
  // Reduced to 5 to prevent Vercel Function Timeouts (10s limit on Hobby tier)
  const CONCURRENCY = 5;
  const results: Event[] = [];

  for (let i = 0; i < datesToCrawl.length; i += CONCURRENCY) {
    const batch = datesToCrawl.slice(i, i + CONCURRENCY);
    console.log(`Processing batch ${i / CONCURRENCY + 1}/${Math.ceil(datesToCrawl.length / CONCURRENCY)}: ${batch.join(', ')}`);

    try {
      const batchResults = await Promise.all(
        batch.map(dateStr => crawlDate(dateStr))
      );
      batchResults.forEach(events => results.push(...events));
    } catch (err) {
      console.error('Batch failed', err);
    }
  }

  return results;
}

async function crawlDate(dateStr: string): Promise<Event[]> {
  let page = 1;
  let keepFetching = true;
  const dateEvents: Event[] = [];

  while (keepFetching) {
    if (page > 10) break; // Safety limit

    const url = `${BASE_URL}&hold_on=${dateStr}&page=${page}`;

    try {
      const { data } = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        timeout: 10000 // 10s timeout
      });
      const $ = cheerio.load(data);
      const eventCards = $('.c-eventcard');

      if (eventCards.length === 0) {
        keepFetching = false;
        break;
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

        // Extract Region from Address
        // Regex looks for [Any Chars] + [都|道|府|県] at the start of address
        const regionMatch = address.match(/^(.+?[都道府県])/);
        const region = regionMatch ? regionMatch[0] : null;

        dateEvents.push({
          id: eventId,
          date: `${dateDay} (${dateWeek})`,
          isoDate: dateStr,
          time,
          title,
          stadium: organizerText,
          address,
          region, // Start saving this explicitly
          url: fullUrl,
          booked: isNaN(booked) ? 0 : booked,
          capacity: isNaN(capacity) ? 0 : capacity,
          status,
        });
      });

      const nextLink = $('.c-pagination__link:contains("＞")');
      if (nextLink.length === 0) {
        keepFetching = false;
      } else {
        page++;
      }

    } catch (error) {
      console.error(`Error fetching ${dateStr} page ${page}:`, error);
      keepFetching = false;
    }
  }
  return dateEvents;
}
