import { describe, expect, it } from 'vitest';
import { classifyEvent } from '../src/classify';
import type { RawEvent } from '../src/types';

function makeEvent(overrides: Partial<RawEvent>): RawEvent {
  return {
    title: 'Evento di prova',
    description: '',
    location: 'Napoli',
    eventDate: '2026-08-01',
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

describe('classifyEvent', () => {
  it('classifica come concerti se isMusicSignal è true', () => {
    const ev = makeEvent({ title: 'Show a sorpresa', isMusicSignal: true });
    expect(classifyEvent(ev)).toBe('concerti');
  });

  it('classifica come eventi_serali se sourceType è nightlife, anche senza parole chiave', () => {
    const ev = makeEvent({ title: 'Programma del weekend', sourceType: 'nightlife' });
    expect(classifyEvent(ev)).toBe('eventi_serali');
  });

  it('riconosce "concerto" nel titolo come concerti', () => {
    const ev = makeEvent({ title: 'Concerto di Natale in piazza' });
    expect(classifyEvent(ev)).toBe('concerti');
  });

  it('riconosce "discoteca" nel titolo come eventi_serali', () => {
    const ev = makeEvent({ title: 'Serata in discoteca con dj set' });
    expect(classifyEvent(ev)).toBe('eventi_serali');
  });

  it('dà priorità alla vita notturna se il testo contiene sia parole da concerto che da discoteca', () => {
    // Es: "concerto in discoteca" — è più simile a una serata che a un concerto puro
    const ev = makeEvent({ title: 'Concerto live in discoteca stasera' });
    expect(classifyEvent(ev)).toBe('eventi_serali');
  });

  it('finisce in eventi_generali senza segnali né parole chiave', () => {
    const ev = makeEvent({ title: 'Sagra della salsiccia', description: 'Stand gastronomici in piazza' });
    expect(classifyEvent(ev)).toBe('eventi_generali');
  });

  it('cerca le parole chiave anche nella descrizione, non solo nel titolo', () => {
    const ev = makeEvent({ title: 'Evento speciale', description: 'Grande dj set fino a notte fonda' });
    expect(classifyEvent(ev)).toBe('eventi_serali');
  });
});
