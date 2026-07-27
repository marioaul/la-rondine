import type { ClassifiedEvent, Env } from './types';
import { sanitize, simpleHash, validateUrl } from './utils/text';
import { supaFetch } from './supabase';

function toRow(ev: ClassifiedEvent) {
  return {
    title: sanitize(ev.title, 255),
    description: sanitize(ev.description, 2000),
    location: sanitize(ev.location, 300),
    event_date: ev.eventDate || null,
    categoria: ev.categoria,
    source: sanitize(ev.source, 200),
    source_type: sanitize(ev.sourceType, 50),
    quality_score: ev.qualityScore || 5,
    price: sanitize(ev.price, 50),
    event_url: validateUrl(ev.eventUrl),
    provincia: sanitize(ev.provincia, 100),
    maps_query: sanitize(ev.mapsQuery, 300),
    is_active: true,
    is_discrete: true,
    availability_status: ev.availabilityStatus || 'available',
    dedup_hash: simpleHash(`${ev.title.slice(0, 60)}|${ev.eventDate}|${ev.provincia}`),
    source_url: validateUrl(ev.eventUrl),
  };
}

/** Upsert a batch di 50 (limite ragionevole per singola richiesta REST) */
export async function batchUpsertEvents(events: ClassifiedEvent[], env: Env): Promise<number> {
  if (!events.length) return 0;
  let added = 0;

  for (let i = 0; i < events.length; i += 50) {
    const chunk = events.slice(i, i + 50).map(toRow);
    try {
      const r = await supaFetch(env, '/rest/v1/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(chunk),
      });
      if (r.ok) added += chunk.length;
    } catch {
      // un batch fallito non deve bloccare i successivi
    }
  }
  return added;
}
