import type { Env, RawEvent, RuntimeConfig, SourceAdapter, SourceType } from '../types';
import { normalizeProvince } from '../utils/province';
import { supaFetch } from '../supabase';
import { parseRssItems, type RssFeedConfig } from './rss';

interface IngestionSourceRow {
  source_url: string;
  url: string | null;
  source_type: string | null;
  provincia: string | null;
  provincia_override: string | null;
  categoria_override: string | null;
  quality_override: number | null;
}

interface JsonEventLike {
  title?: string;
  name?: string;
  description?: string;
  location?: string;
  venue?: string;
  date?: string;
  start_date?: string;
  event_date?: string;
  url?: string;
  link?: string;
  city?: string;
  province?: string;
}

/** Carica le fonti custom attive dalla tabella ingestion_sources su Supabase */
async function loadCustomSources(env: Env): Promise<IngestionSourceRow[]> {
  try {
    const r = await supaFetch(
      env,
      '/rest/v1/ingestion_sources?select=source_url,url,source_type,provincia,provincia_override,categoria_override,quality_override&is_enabled=eq.true&limit=5000'
    );
    if (!r.ok) return [];
    const rows = (await r.json()) as IngestionSourceRow[];
    return rows.filter((row) => row.url || row.source_url);
  } catch {
    return [];
  }
}

/** Estrae eventi da markup Schema.org (application/ld+json) presente nella pagina HTML */
export function parseHtmlEvents(html: string, sourceUrl: string, src: IngestionSourceRow): RawEvent[] {
  const events: RawEvent[] = [];
  const ldRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const EVENT_TYPES = ['Event', 'MusicEvent', 'TheaterEvent', 'ExhibitionEvent', 'SportsEvent', 'FoodEvent'];
  let m: RegExpExecArray | null;

  while ((m = ldRe.exec(html)) !== null) {
    try {
      const data = JSON.parse(m[1] ?? '{}');
      const items: Array<Record<string, unknown>> = Array.isArray(data)
        ? data
        : (data['@graph'] as Array<Record<string, unknown>>) ?? [data];

      for (const item of items) {
        if (!item || !EVENT_TYPES.includes(String(item['@type']))) continue;
        const title = String(item.name ?? '');
        const eventDate = item.startDate ? String(item.startDate).slice(0, 10) : null;
        if (!title || !eventDate) continue;

        const location = item.location as { name?: string; address?: { streetAddress?: string; addressLocality?: string } } | undefined;
        const offers = item.offers as { price?: number } | undefined;

        events.push({
          title: title.slice(0, 255),
          description: String(item.description ?? '').slice(0, 500),
          location: (location?.name ?? location?.address?.streetAddress ?? sourceUrl).slice(0, 300),
          eventDate,
          source: sourceUrl,
          sourceType: (src.source_type as SourceType) ?? 'html',
          qualityScore: src.quality_override ?? 6,
          price: offers?.price ? `EUR ${offers.price}` : '',
          eventUrl: String(item.url ?? sourceUrl),
          provincia: normalizeProvince(location?.address?.addressLocality ?? src.provincia_override ?? ''),
          mapsQuery: `${location?.name ?? sourceUrl}, Italia`,
          availabilityStatus: 'available',
        });
      }
    } catch {
      // blocco ld+json malformato: si ignora e si prosegue
    }
  }
  return events;
}

async function fetchOneCustomSource(src: IngestionSourceRow): Promise<RawEvent[]> {
  const url = src.source_url || src.url || '';
  if (!url) return [];

  try {
    const r = await fetch(url, {
      signal: AbortSignal.timeout(12000),
      headers: {
        'User-Agent': 'RondineBot/1.0',
        Accept: 'application/rss+xml,application/xml,text/xml,text/html,application/json',
      },
    });
    if (!r.ok) return [];

    const contentType = r.headers.get('content-type') ?? '';
    const text = await r.text();
    const provincia = src.provincia_override || src.provincia || null;

    if (contentType.includes('xml') || contentType.includes('rss') || text.trim().startsWith('<?xml') || text.includes('<rss')) {
      const feedConfig: RssFeedConfig = {
        url,
        provincia,
        sourceType: (src.source_type as SourceType) ?? 'custom',
        quality: src.quality_override ?? 6,
      };
      return parseRssItems(text, feedConfig);
    }

    if (contentType.includes('json')) {
      try {
        const json = JSON.parse(text) as { events?: JsonEventLike[]; items?: JsonEventLike[]; data?: JsonEventLike[] } | JsonEventLike[];
        const arr: JsonEventLike[] = Array.isArray(json) ? json : json.events ?? json.items ?? json.data ?? [];
        return arr
          .slice(0, 200)
          .map((e): RawEvent => ({
            title: e.title ?? e.name ?? '',
            description: (e.description ?? '').slice(0, 500),
            location: e.location ?? e.venue ?? url,
            eventDate: e.date ?? e.start_date ?? e.event_date ?? '',
            source: url,
            sourceType: (src.source_type as SourceType) ?? 'custom',
            qualityScore: src.quality_override ?? 6,
            price: '',
            eventUrl: e.url ?? e.link ?? url,
            provincia: provincia || normalizeProvince(e.city ?? e.province ?? ''),
            mapsQuery: e.location ?? url,
            availabilityStatus: 'available',
          }))
          .filter((e) => e.title && e.eventDate);
      } catch {
        return [];
      }
    }

    return parseHtmlEvents(text, url, src);
  } catch {
    return [];
  }
}

export const customSourcesAdapter: SourceAdapter = {
  name: 'custom-sources',
  async fetchEvents(env: Env, _config: RuntimeConfig): Promise<RawEvent[]> {
    const sources = await loadCustomSources(env);
    if (!sources.length) return [];

    const results = await Promise.allSettled(sources.map(fetchOneCustomSource));
    const events: RawEvent[] = [];
    for (const res of results) {
      if (res.status === 'fulfilled') events.push(...res.value);
    }
    return events;
  },
};
