import type { Env, SourceAdapter } from '../types';
import { runPipeline, loadRuntimeConfig } from '../pipeline';
import { supaFetch } from '../supabase';
import { parseCountResponse } from '../utils/count';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Worker-Secret',
};

export function jsonResp(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

export async function handleTrigger(request: Request, env: Env, adapters: SourceAdapter[]): Promise<Response> {
  if (request.method !== 'POST') return jsonResp({ error: 'Method not allowed' }, 405);
  try {
    const result = await runPipeline(env, loadRuntimeConfig(env), adapters);
    return jsonResp({ ok: true, ...result });
  } catch (e) {
    return jsonResp({ ok: false, error: (e as Error).message }, 500);
  }
}

export async function handleStatus(_request: Request, env: Env): Promise<Response> {
  try {
    const [totalR, logsR] = await Promise.allSettled([
      supaFetch(env, '/rest/v1/events?select=count', { headers: { Prefer: 'count=exact' } }),
      supaFetch(env, '/rest/v1/cron_log?select=*&order=run_at.desc&limit=10'),
    ]);

    let total = 0;
    if (totalR.status === 'fulfilled' && totalR.value.ok) {
      const body = await totalR.value.json().catch(() => null);
      total = parseCountResponse(totalR.value.headers.get('content-range'), body);
    }

    const logs = logsR.status === 'fulfilled' && logsR.value.ok ? await logsR.value.json() : [];
    return jsonResp({ ok: true, total_events: total, recent_runs: logs });
  } catch (e) {
    return jsonResp({ ok: false, error: (e as Error).message }, 500);
  }
}

export async function handleSearch(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const q = url.searchParams.get('q') ?? '';
  const provincia = url.searchParams.get('provincia') ?? '';
  const categoria = url.searchParams.get('categoria') ?? '';

  if (!q && !provincia && !categoria) return jsonResp({ events: [] });

  const today = new Date().toISOString().slice(0, 10);
  let path = `/rest/v1/events?select=*&is_active=eq.true&event_date=gte.${today}&order=event_date.asc&limit=100`;
  if (q) path += `&or=(title.ilike.*${encodeURIComponent(q)}*,description.ilike.*${encodeURIComponent(q)}*)`;
  if (provincia) path += `&provincia=ilike.*${encodeURIComponent(provincia)}*`;
  if (categoria && categoria !== 'tutte') path += `&categoria=eq.${encodeURIComponent(categoria)}`;

  try {
    const r = await supaFetch(env, path);
    const events = r.ok ? await r.json() : [];
    return jsonResp({ ok: true, events });
  } catch (e) {
    return jsonResp({ ok: false, error: (e as Error).message }, 500);
  }
}

export async function handleCleanup(request: Request, env: Env): Promise<Response> {
  const auth = request.headers.get('X-Worker-Secret');
  if (!auth || auth !== env.WORKER_SECRET) return jsonResp({ error: 'Unauthorized' }, 401);

  const today = new Date().toISOString().slice(0, 10);
  const countR = await supaFetch(env, `/rest/v1/events?event_date=lt.${today}&select=count`, {
    headers: { Prefer: 'count=exact' },
  });
  const deleted = countR.ok
    ? parseInt(countR.headers.get('content-range')?.split('/')?.[1] ?? '0', 10)
    : 0;
  const r = await supaFetch(env, `/rest/v1/events?event_date=lt.${today}`, { method: 'DELETE' });
  return jsonResp({ ok: r.ok, deleted, status: r.status });
}

export async function handleDebugCount(_request: Request, env: Env): Promise<Response> {
  try {
    const r = await supaFetch(env, '/rest/v1/events?select=count', { headers: { Prefer: 'count=exact' } });
    const rawBody = await r.text();
    return jsonResp({
      ok: true,
      status: r.status,
      contentRangeHeader: r.headers.get('content-range'),
      allHeaders: Object.fromEntries(r.headers.entries()),
      rawBody,
    });
  } catch (e) {
    return jsonResp({ ok: false, error: (e as Error).message }, 500);
  }
}

export function handleOptions(): Response {
  return new Response(null, { headers: CORS_HEADERS });
}
