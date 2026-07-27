import { describe, expect, it } from 'vitest';
import { applyFilters, deduplicateEvents } from '../src/filter';
import type { ClassifiedEvent } from '../src/types';

function makeEvent(overrides: Partial<ClassifiedEvent>): ClassifiedEvent {
  const future = new Date();
  future.setDate(future.getDate() + 10);
  return {
    title: 'Evento valido',
    description: '',
    location: 'Napoli',
    eventDate: future.toISOString().slice(0, 10),
    categoria: 'eventi_generali',
    source: 'test',
    sourceType: 'custom',
    qualityScore: 5,
    price: '',
    eventUrl: 'https://example.com',
    provincia: 'Napoli',
    mapsQuery: 'Napoli, Italia',
    availabilityStatus: 'available',
    ...overrides,
  };
}

describe('applyFilters', () => {
  it('tiene un evento valido in Campania con data futura', () => {
    const result = applyFilters([makeEvent({})]);
    expect(result).toHaveLength(1);
  });

  it('scarta eventi fuori Campania', () => {
    const result = applyFilters([makeEvent({ provincia: 'Milano' })]);
    expect(result).toHaveLength(0);
  });

  it('scarta eventi sold out', () => {
    const result = applyFilters([makeEvent({ availabilityStatus: 'soldout' })]);
    expect(result).toHaveLength(0);
  });

  it('scarta eventi con titolo troppo corto', () => {
    const result = applyFilters([makeEvent({ title: 'Ab' })]);
    expect(result).toHaveLength(0);
  });

  it('scarta eventi senza data', () => {
    const result = applyFilters([makeEvent({ eventDate: '' })]);
    expect(result).toHaveLength(0);
  });

  it('scarta eventi con termini bloccati nel testo', () => {
    const result = applyFilters([makeEvent({ description: 'contenuto per adult' })]);
    expect(result).toHaveLength(0);
  });
});

describe('deduplicateEvents', () => {
  it('rimuove duplicati con stessa chiave titolo+data+provincia', () => {
    const a = makeEvent({ title: 'Stesso evento' });
    const b = makeEvent({ title: 'Stesso evento' });
    expect(deduplicateEvents([a, b])).toHaveLength(1);
  });

  it('tiene eventi con titoli diversi', () => {
    const a = makeEvent({ title: 'Evento A' });
    const b = makeEvent({ title: 'Evento B' });
    expect(deduplicateEvents([a, b])).toHaveLength(2);
  });
});
