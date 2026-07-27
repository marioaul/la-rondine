import type { Env, RawEvent, RuntimeConfig, SourceAdapter } from '../types';
import { CAMPANIA_PROVINCES } from '../types';
import { normalizeProvince } from '../utils/province';

interface TMVenue {
  name?: string;
  city?: { name?: string };
  state?: { stateCode?: string };
}
interface TMClassification {
  segment?: { name?: string };
}
interface TMEvent {
  name: string;
  info?: string;
  pleaseNote?: string;
  dates?: { start?: { localDate?: string }; status?: { code?: string } };
  classifications?: TMClassification[];
  priceRanges?: Array<{ min?: number; max?: number }>;
  url?: string;
  _embedded?: { venues?: TMVenue[] };
}
interface TMResponse {
  _embedded?: { events?: TMEvent[] };
}

function formatPrice(pr: { min?: number; max?: number } | undefined): string {
  if (!pr) return '';
  if (pr.min === 0 && pr.max === 0) return 'Gratuito';
  const mn = pr.min ? `EUR ${Math.round(pr.min)}` : '';
  const mx = pr.max ? `EUR ${Math.round(pr.max)}` : '';
  return mn === mx ? mn : `${mn}-${mx}`;
}

async function fetchCityPage(city: string, page: number, apiKey: string): Promise<RawEvent[]> {
  try {
    const url =
      `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${apiKey}` +
      `&locale=it-it,en-us,*&countryCode=IT&city=${encodeURIComponent(city)}` +
      `&size=200&page=${page}&sort=date,asc`;
    const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!r.ok) return [];
    const d = (await r.json()) as TMResponse;

    return (d._embedded?.events ?? [])
      .filter((e) => {
        const status = e.dates?.status?.code ?? '';
        return status !== 'offsale' && status !== 'cancelled';
      })
      .map((e): RawEvent => {
        const v = e._embedded?.venues?.[0];
        const segment = (e.classifications?.[0]?.segment?.name ?? '').toLowerCase();
        return {
          title: e.name,
          description: e.info || e.pleaseNote || '',
          location: v ? `${v.name}, ${v.city?.name}` : city,
          eventDate: e.dates?.start?.localDate ?? '',
          isMusicSignal: segment.includes('music'),
          source: 'Ticketmaster',
          sourceType: 'ticketmaster',
          qualityScore: 9,
          price: formatPrice(e.priceRanges?.[0]),
          eventUrl: e.url ?? '',
          provincia: normalizeProvince(v?.state?.stateCode || city),
          mapsQuery: v ? `${v.name}, ${v.city?.name}, Italia` : `${city}, Italia`,
          availabilityStatus: e.dates?.status?.code ?? 'available',
        };
      });
  } catch {
    return [];
  }
}

export const ticketmasterAdapter: SourceAdapter = {
  name: 'ticketmaster',
  async fetchEvents(_env: Env, config: RuntimeConfig): Promise<RawEvent[]> {
    if (!config.ticketmasterKey) return [];

    // 2 pagine per provincia — budget libero grazie al focus regionale (solo 5 province)
    const tasks: Array<{ city: string; page: number }> = [];
    for (const city of CAMPANIA_PROVINCES) {
      for (const page of [0, 1]) tasks.push({ city, page });
    }

    const events: RawEvent[] = [];
    for (let i = 0; i < tasks.length; i += 20) {
      const batch = tasks.slice(i, i + 20);
      const results = await Promise.allSettled(
        batch.map((t) => fetchCityPage(t.city, t.page, config.ticketmasterKey))
      );
      for (const res of results) {
        if (res.status === 'fulfilled') events.push(...res.value);
      }
    }
    return events;
  },
};
