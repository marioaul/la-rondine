import type { EventCategory, RawEvent, ClassifiedEvent } from './types';

const CONCERT_KEYWORDS = [
  'concerto', 'concert', 'live', 'tour', 'recital', 'orchestra',
  'sinfonica', 'cantautore', 'rapper live', 'tribute band', 'tributo band',
  'musica dal vivo',
];

const NIGHTLIFE_KEYWORDS = [
  'discoteca', 'disco ', 'festa in', 'serata', 'dj set', 'djset',
  'clubbing', 'club night', 'movida', 'nightclub', 'after party',
  'capodanno', 'halloween party', 'notte bianca',
];

/**
 * Classifica un evento in una delle 3 categorie fisse.
 * Ordine di priorità:
 *  1. Segnali espliciti ad alta confidenza dalla fonte (source_type, isMusicSignal)
 *  2. Parole chiave nel titolo/descrizione (vita notturna prima, poi concerti)
 *  3. Default: eventi_generali
 */
export function classifyEvent(ev: RawEvent): EventCategory {
  if (ev.sourceType === 'nightlife') return 'eventi_serali';
  if (ev.isMusicSignal) return 'concerti';

  const text = `${ev.title} ${ev.description}`.toLowerCase();

  if (NIGHTLIFE_KEYWORDS.some((kw) => text.includes(kw))) return 'eventi_serali';
  if (CONCERT_KEYWORDS.some((kw) => text.includes(kw))) return 'concerti';

  return 'eventi_generali';
}

export function classifyAll(events: RawEvent[]): ClassifiedEvent[] {
  return events.map((ev) => ({ ...ev, categoria: classifyEvent(ev) }));
}
