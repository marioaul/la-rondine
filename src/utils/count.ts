/**
 * Estrae il conteggio totale da una risposta PostgREST con Prefer: count=exact.
 * Alcune configurazioni lo restituiscono nell'header Content-Range (es. "0-9/33"),
 * altre nel corpo JSON (es. [{"count": 33}]). Si controllano entrambi.
 */
export function parseCountResponse(contentRange: string | null, jsonBody: unknown): number {
  const cr = contentRange ?? '';
  const match = cr.match(/\/(\d+)$/);
  const fromHeader = match?.[1] ? parseInt(match[1], 10) : 0;
  if (fromHeader) return fromHeader;

  if (Array.isArray(jsonBody) && jsonBody.length > 0) {
    const first = jsonBody[0] as { count?: unknown };
    if (typeof first?.count === 'number') return first.count;
  }
  return 0;
}
