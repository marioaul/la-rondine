import type { Env } from './types';

export async function supaFetch(env: Env, path: string, opts: RequestInit = {}): Promise<Response> {
  const base = env.SUPABASE_URL.replace(/\/$/, '');
  return fetch(`${base}${path}`, {
    ...opts,
    headers: {
      apikey: env.SUPABASE_KEY,
      Authorization: `Bearer ${env.SUPABASE_KEY}`,
      ...(opts.headers ?? {}),
    },
    signal: opts.signal ?? AbortSignal.timeout(20000),
  });
}

export async function logRun(
  env: Env,
  runId: string,
  status: 'running' | 'ok' | 'error',
  startedAt: string,
  extra: Record<string, unknown> = {}
): Promise<void> {
  try {
    await supaFetch(env, '/rest/v1/cron_log?on_conflict=id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        id: runId,
        run_at: startedAt,
        status,
        sources_ok: 0,
        sources_err: 0,
        events_deleted: 0,
        ...extra,
      }),
    });
  } catch {
    // il logging non deve mai far fallire la pipeline
  }
}
