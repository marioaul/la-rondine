import { CAMPANIA_PROVINCES } from '../types';

const PROVINCE_ABBR: Record<string, string> = {
  NA: 'Napoli',
  SA: 'Salerno',
  CE: 'Caserta',
  AV: 'Avellino',
  BN: 'Benevento',
};

/** Normalizza una stringa arbitraria (sigla, nome, variazioni) al nome canonico provincia, se in Campania */
export function normalizeProvince(input: string | undefined | null): string {
  if (!input) return '';
  const upper = input.toUpperCase().trim();
  if (PROVINCE_ABBR[upper]) return PROVINCE_ABBR[upper];

  const lower = input.toLowerCase().trim();
  const match = CAMPANIA_PROVINCES.find((p) => p.toLowerCase() === lower);
  return match ?? '';
}

/** Cerca il nome di una provincia campana citata dentro un testo libero */
export function extractProvinceFromText(text: string | undefined | null): string {
  const lc = (text || '').toLowerCase();
  return CAMPANIA_PROVINCES.find((p) => lc.includes(p.toLowerCase())) ?? '';
}

/** true se la provincia (nome canonico) è una delle 5 della Campania */
export function isCampaniaProvince(provincia: string | undefined | null): boolean {
  if (!provincia) return false;
  const p = provincia.trim().toLowerCase();
  return CAMPANIA_PROVINCES.some((c) => c.toLowerCase() === p);
}
