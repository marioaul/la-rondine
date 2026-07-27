import type { Env, RawEvent, RuntimeConfig, SourceAdapter, SourceType } from '../types';
import { extractProvinceFromText } from '../utils/province';
import { stripTags } from '../utils/text';

export interface RssFeedConfig {
  url: string;
  provincia: string | null;
  sourceType: SourceType;
  quality: number;
}

/**
 * Elenco fonti RSS attive. Aggiungere una fonte = aggiungere una riga qui,
 * nessun'altra modifica necessaria altrove.
 */
export const RSS_FEEDS: RssFeedConfig[] = [
  { url: 'https://www.eventiesagre.it/RSS/', provincia: null, sourceType: 'sagre', quality: 7 },
  { url: 'https://sagritaly.com/categoria/eventi-e-sagre/feed/', provincia: null, sourceType: 'sagre', quality: 7 },
  { url: 'https://www.napolidavivere.it/feed/', provincia: 'Napoli', sourceType: 'sagre', quality: 8 },
  { url: 'https://www.napolidavivere.it/category/eventi/serate/feed/', provincia: 'Napoli', sourceType: 'nightlife', quality: 7 },
  { url: 'https://www.napolidavivere.it/category/eventi/sagre-e-feste/feed/', provincia: 'Napoli', sourceType: 'sagre', quality: 7 },
  { url: 'https://www.partynopea.it/feed/', provincia: 'Napoli', sourceType: 'nightlife', quality: 7 },
];

const MESI: Record<string, string> = {
  gennaio: '01', febbraio: '02', marzo: '03', aprile: '04', maggio: '05', giugno: '06',
  luglio: '07', agosto: '08', settembre: '09', ottobre: '10', novembre: '11', dicembre: '12',
};

function getTag(xml: string, tag: string): string {
  const cdata = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, 'i'));
  if (cdata?.[1]) return cdata[1].trim();
  const plain = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return plain?.[1]?.trim() ?? '';
}

function parseRssDate(str: string): string | null {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function parseRssItems(xml: string, feed: RssFeedConfig): RawEvent[] {
  const items: RawEvent[] = [];
  const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;

  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1] ?? '';
    const title = stripTags(getTag(block, 'title'));
    const desc = stripTags(getTag(block, 'description')).slice(0, 1000);
    const link = getTag(block, 'link');
    const pubDate = getTag(block, 'pubDate') || getTag(block, 'dc:date');
    if (!title || !link) continue;

    let eventDate: string | null = null;
    const fullText = `${title} ${desc}`;
    for (const [nome, num] of Object.entries(MESI)) {
      const re = new RegExp(`(\\d{1,2})\\s+${nome}(?:\\s+(\\d{4}))?`, 'i');
      const dm = fullText.match(re);
      if (dm?.[1]) {
        const anno = dm[2] ?? new Date().getFullYear().toString();
        eventDate = `${anno}-${num}-${dm[1].padStart(2, '0')}`;
        break;
      }
    }
    if (!eventDate) eventDate = parseRssDate(pubDate);
    if (!eventDate) {
      const dm3 = desc.match(/(\d{1,2})\/(\d{2})\/(\d{4})/);
      if (dm3?.[1] && dm3[2] && dm3[3]) eventDate = `${dm3[3]}-${dm3[2]}-${dm3[1].padStart(2, '0')}`;
    }
    if (!eventDate) continue;

    const provincia = feed.provincia || extractProvinceFromText(fullText) || '';

    items.push({
      title,
      description: desc,
      location: feed.provincia || 'Campania',
      eventDate,
      source: feed.url,
      sourceType: feed.sourceType,
      qualityScore: feed.quality,
      price: '',
      eventUrl: link.trim(),
      provincia,
      mapsQuery: feed.provincia ? `${feed.provincia}, Italia` : 'Campania, Italia',
      availabilityStatus: 'available',
    });
  }
  return items;
}

async function fetchOneFeed(feed: RssFeedConfig): Promise<RawEvent[]> {
  try {
    const r = await fetch(feed.url, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'RondineBot/1.0' },
    });
    if (!r.ok) return [];
    return parseRssItems(await r.text(), feed);
  } catch {
    return [];
  }
}

export const rssAdapter: SourceAdapter = {
  name: 'rss',
  async fetchEvents(_env: Env, _config: RuntimeConfig): Promise<RawEvent[]> {
    const results = await Promise.allSettled(RSS_FEEDS.map(fetchOneFeed));
    const events: RawEvent[] = [];
    for (const res of results) {
      if (res.status === 'fulfilled') events.push(...res.value);
    }
    return events;
  },
};
