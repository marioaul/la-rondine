export function sanitize(val: string | undefined | null, maxLen = 255): string {
  if (!val) return '';
  // eslint-disable-next-line no-control-regex
  return String(val).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').slice(0, maxLen);
}

export function validateUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  const s = String(url).trim();
  return /^https?:\/\/.{3,}/.test(s) ? s.slice(0, 1000) : null;
}

export function stripTags(s: string | undefined | null): string {
  return (s || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&#8230;/g, '…')
    .replace(/&#8216;|&#8217;/g, "'")
    .replace(/&#038;/g, '&')
    .replace(/&#\d+;/g, '')
    .trim();
}

/** Parsa una data in vari formati comuni verso YYYY-MM-DD, o null se non riconosciuta */
export function parseFlexDate(str: string | undefined | null): string | null {
  if (!str) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);

  const m = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m && m[1] && m[2] && m[3]) {
    const y = m[3].length === 2 ? '20' + m[3] : m[3];
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

export function simpleHash(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return 'h' + (h >>> 0).toString(16);
}
