import type { Env, RuntimeConfig, SourceAdapter } from './types';
import { classifyAll } from './classify';
import { applyFilters, deduplicateEvents } from './filter';
import { batchUpsertEvents } from './upsert';
import { logRun, supaFetch } from './supabase';

export interface PipelineResult {
  added: number;
  total: number;
  durationMs: number;
  runId: string;
  sources: { ok: number; err: number };
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

  for (const adapter of adapters) {
    try {
      const raw = await adapter.fetchEvents(env, config);
      if (raw.length > 0) {
        const deduped = deduplicateEvents(
          raw.map((e) => ({ ...e, title: e.title, eventDate: e.eventDate, provincia: e.provincia }))
        );
        const classified = classifyAll(deduped);
        const filtered = applyFilters(classified);
        totalAdded += await batchUpsertEvents(filtered, env);
      }
      sourcesOk++;
    } catch {
      sourcesErr++;
    }
  }

  let eventsTotal = 0;
  try {
    const totalR = await supaFetch(env, '/rest/v1/events?select=count', {
      headers: { Prefer: 'count=exact' },
    });
    if (totalR.ok) {
      const cr = totalR.headers.get('content-range') ?? '';
      const match = cr.match(/\/(\d+)$/);
      eventsTotal = match?.[1] ? parseInt(match[1], 10) : 0;
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

  return { added: totalAdded, total: eventsTotal, durationMs, runId, sources: { ok: sourcesOk, err: sourcesErr } };
}

export function loadRuntimeConfig(env: Env): RuntimeConfig {
  return {
    ticketmasterKey: env.TICKETMASTER_KEY ?? '',
    vivaticketToken: env.VIVATICKET_TOKEN ?? '',
  };
}
