import { describe, expect, it } from 'vitest';
import { extractProvinceFromText, isCampaniaProvince, normalizeProvince } from '../../src/utils/province';

describe('normalizeProvince', () => {
  it('riconosce le sigle italiane', () => {
    expect(normalizeProvince('NA')).toBe('Napoli');
    expect(normalizeProvince('sa')).toBe('Salerno');
  });

  it('riconosce il nome per esteso indipendentemente da maiuscole/minuscole', () => {
    expect(normalizeProvince('napoli')).toBe('Napoli');
    expect(normalizeProvince('CASERTA')).toBe('Caserta');
  });

  it('restituisce stringa vuota per province fuori Campania', () => {
    expect(normalizeProvince('Milano')).toBe('');
    expect(normalizeProvince('RM')).toBe('');
  });

  it('restituisce stringa vuota per input vuoto', () => {
    expect(normalizeProvince('')).toBe('');
    expect(normalizeProvince(undefined)).toBe('');
  });
});

describe('extractProvinceFromText', () => {
  it('trova una provincia campana citata nel testo', () => {
    expect(extractProvinceFromText('Grande festa a Salerno stasera')).toBe('Salerno');
  });

  it('restituisce stringa vuota se nessuna provincia campana è citata', () => {
    expect(extractProvinceFromText('Grande festa a Milano stasera')).toBe('');
  });
});

describe('isCampaniaProvince', () => {
  it('è true per le 5 province campane', () => {
    expect(isCampaniaProvince('Napoli')).toBe(true);
    expect(isCampaniaProvince('benevento')).toBe(true);
  });

  it('è false per province non campane o vuote', () => {
    expect(isCampaniaProvince('Roma')).toBe(false);
    expect(isCampaniaProvince('')).toBe(false);
    expect(isCampaniaProvince(null)).toBe(false);
  });
});
