import { describe, expect, it } from 'vitest';
import { parseCountResponse } from '../../src/utils/count';

describe('parseCountResponse', () => {
  it('legge il conteggio dall\'header Content-Range quando presente', () => {
    expect(parseCountResponse('0-9/33', null)).toBe(33);
  });

  it('legge il conteggio dal corpo JSON quando l\'header è assente o vuoto', () => {
    expect(parseCountResponse('', [{ count: 33 }])).toBe(33);
    expect(parseCountResponse(null, [{ count: 33 }])).toBe(33);
  });

  it('preferisce l\'header quando entrambi sono presenti', () => {
    expect(parseCountResponse('0-9/10', [{ count: 999 }])).toBe(10);
  });

  it('restituisce 0 se né header né corpo hanno un conteggio valido', () => {
    expect(parseCountResponse('', null)).toBe(0);
    expect(parseCountResponse('formato-inatteso', [])).toBe(0);
  });

  it('è il caso reale che ha causato il bug in produzione: 0 eventi mostrati nonostante 33 righe esistenti', () => {
    // Questo è esattamente lo scenario incontrato: Content-Range assente/vuoto,
    // conteggio vero disponibile solo nel corpo JSON.
    expect(parseCountResponse('', [{ count: 33 }])).toBe(33);
  });
});
