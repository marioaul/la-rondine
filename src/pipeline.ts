import type { Env, RuntimeConfig, SourceAdapter } from './types';
import { classifyAll } from './classify';
import { applyFilters, deduplicateEvents } from './filter';
import { batchUpsertEvents } from './upsert';
import { logRun, supaFetch } from './supabase';
import { parseCountResponse } from './utils/count';

export interface PipelineResult {
  added: number;
  total: number;
  durationMs: number;
  runId: string;
  sources: { ok: number; err: number };
  /** Diagnostica per fonte: utile per capire dove si perdono eventi lungo la pipeline */
  debug: Array<{
    adapter: string;
    fetched: number;
    afterDedup: number;
    afterFilter: number;
    upserted: number;
    error?: string;
    upsertErrors?: string[];
  }>;
}

export async function runPipeline(
  env: Env,
  config: RuntimeConfig,
  adapters: SourceAdapter[]
): Promise<PipelineResult> {
  const runId = crypto.randomUUID();
  const startMs = Date.now();
  const startedAt = new Date().toISOString();

  await logRun(env, runId, 'running', startedAt);

  let totalAdded = 0;
  let sourcesOk = 0;
  let sourcesErr = 0;
  const debug: PipelineResult['debug'] = [];

  for (const adapter of adapters) {
    try {
      const raw = await adapter.fetchEvents(env, config);
      let afterDedup = 0;
      let afterFilter = 0;
      let upserted = 0;
      let upsertErrors: string[] = [];

      if (raw.length > 0) {
        const deduped = deduplicateEvents(
          raw.map((e) => ({ ...e, title: e.title, eventDate: e.eventDate, provincia: e.provincia }))
        );
        afterDedup = deduped.length;
        const classified = classifyAll(deduped);
        const filtered = applyFilters(classified);
        afterFilter = filtered.length;
        const result = await batchUpsertEvents(filtered, env);
        upserted = result.added;
        upsertErrors = result.errors;
        totalAdded += upserted;
      }
      sourcesOk++;
      debug.push({
        adapter: adapter.name,
        fetched: raw.length,
        afterDedup,
        afterFilter,
        upserted,
        ...(upsertErrors.length ? { upsertErrors } : {}),
      });
    } catch (e) {
      sourcesErr++;
      debug.push({
        adapter: adapter.name,
        fetched: 0,
        afterDedup: 0,
        afterFilter: 0,
        upserted: 0,
        error: (e as Error).message,
      });
    }
  }

  let eventsTotal = 0;
  try {
    const totalR = await supaFetch(env, '/rest/v1/events?select=count', {
      headers: { Prefer: 'count=exact' },
    });
    if (totalR.ok) {
      const body = await totalR.json().catch(() => null);
      eventsTotal = parseCountResponse(totalR.headers.get('content-range'), body);
    }
  } catch {
    // non blocca il risultato della pipeline
  }

  const durationMs = Date.now() - startMs;
  await logRun(env, runId, 'ok', startedAt, {
    events_added: totalAdded,
    events_total: eventsTotal,
    duration_ms: durationMs,
    sources_ok: sourcesOk,
    sources_err: sourcesErr,
  });

  return {
    added: totalAdded,
    total: eventsTotal,
    durationMs,
    runId,
    sources: { ok: sourcesOk, err: sourcesErr },
    debug,
  };
}

export function loadRuntimeConfig(env: Env): RuntimeConfig {
  return {
    ticketmasterKey: env.TICKETMASTER_KEY ?? '',
    vivaticketToken: env.VIVATICKET_TOKEN ?? '',
  };
}
