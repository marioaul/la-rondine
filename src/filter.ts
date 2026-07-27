import type { ClassifiedEvent } from './types';
import { isCampaniaProvince } from './utils/province';

const SOLDOUT_TERMS = [
  'sold out', 'sold-out', 'esaurito', 'esauriti', 'biglietti terminati',
  'tickets exhausted', 'no tickets', 'evento terminato', 'acquisto terminato',
  'non disponibile', 'unavailable', 'off sale', 'offsale',
];
const BLOCKED_TERMS = ['xxx', 'porn', 'adult', 'escort', 'cam girl', 'scommesse illegali'];
const VIOLENT_TERMS = ['terrorismo', 'odio razziale', 'violenza estrema'];

export function applyFilters(events: ClassifiedEvent[]): ClassifiedEvent[] {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const maxFuture = new Date();
  maxFuture.setDate(maxFuture.getDate() + 365);

  return events.filter((ev) => {
    if (!ev.title || ev.title.trim().length < 3 || !ev.eventDate) return false;

    const evDate = new Date(`${ev.eventDate}T12:00:00`);
    if (isNaN(evDate.getTime()) || evDate < yesterday || evDate > maxFuture) return false;

    const text = `${ev.title}${ev.description}`.toLowerCase();
    if (BLOCKED_TERMS.some((t) => text.includes(t))) return false;
    if (VIOLENT_TERMS.some((t) => text.includes(t))) return false;
    if (SOLDOUT_TERMS.some((t) => text.includes(t))) return false;
    if (ev.availabilityStatus === 'soldout') return false;

    // Vincolo regionale: scarta tutto ciò che non è chiaramente in Campania
    if (!isCampaniaProvince(ev.provincia)) return false;

    return true;
  });
}

export function deduplicateEvents<T extends { title: string; eventDate: string; provincia: string }>(
  events: T[]
): T[] {
  const seen = new Set<string>();
  return events.filter((ev) => {
    const key = `${ev.title.toLowerCase().slice(0, 60)}|${ev.eventDate}|${ev.provincia.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
