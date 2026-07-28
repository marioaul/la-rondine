import type { Env } from '../types';
import { supaFetch } from '../supabase';
import { jsonResp } from './index';
import { verifyAdmin } from '../admin-auth';

interface IncomingSource {
  url?: string;
  source_url?: string;
  name?: string;
  source_name?: string;
  provincia?: string;
  provincia_override?: string;
  type?: string;
  source_type?: string;
  is_enabled?: boolean;
  added_by?: string;
  notes?: string;
  categoria?: string;
  categoria_override?: string;
  quality?: number;
  quality_override?: number;
}

interface IngestionSourceRow {
  id: string;
  source_name: string;
  source_url: string;
  provincia: string | null;
  source_type: string;
  is_enabled: boolean;
  notes: string | null;
  quality_override: number | null;
}

export async function handleSources(request: Request, env: Env): Promise<Response> {
  if (!(await verifyAdmin(request, env))) return jsonResp({ error: 'Unauthorized' }, 401);

  if (request.method === 'GET') return handleListSources(env);
  if (request.method === 'DELETE') return handleDeleteSource(request, env);
  if (request.method === 'POST') return handleAddSources(request, env);
  return jsonResp({ error: 'Method not allowed' }, 405);
}

async function handleListSources(env: Env): Promise<Response> {
  try {
    const r = await supaFetch(
      env,
      '/rest/v1/ingestion_sources?select=id,source_name,source_url,provincia,source_type,is_enabled,notes,quality_override&order=source_name.asc'
    );
    if (!r.ok) return jsonResp({ ok: false, sources: [] });
    const sources = (await r.json()) as IngestionSourceRow[];
    return jsonResp({ ok: true, sources });
  } catch (e) {
    return jsonResp({ ok: false, error: (e as Error).message }, 500);
  }
}

async function handleDeleteSource(request: Request, env: Env): Promise<Response> {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return jsonResp({ ok: false, error: 'Parametro id mancante' }, 400);

  try {
    const r = await supaFetch(env, `/rest/v1/ingestion_sources?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return jsonResp({ ok: r.ok });
  } catch (e) {
    return jsonResp({ ok: false, error: (e as Error).message }, 500);
  }
}

async function handleAddSources(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as { sources?: Array<IncomingSource | string> };
    const rawSources = body.sources ?? [];

    const normalized = rawSources
      .map((s): IncomingSource => (typeof s === 'string' ? { url: s } : s))
      .filter((s) => {
        const u = s.url || s.source_url || '';
        return u.startsWith('http');
      });

    if (!normalized.length) return jsonResp({ ok: true, saved: 0, msg: 'Nessuna fonte valida' });

    const rows = normalized.map((s) => {
      const url = (s.url || s.source_url || '').trim().slice(0, 1000);
      const name = (s.name || s.source_name || url).slice(0, 255);
      const provincia = (s.provincia || s.provincia_override || '').slice(0, 100);
      return {
        source_name: name,
        source_url: url,
        url,
        provincia,
        source_type: s.type || s.source_type || 'custom',
        is_enabled: s.is_enabled !== false,
        added_by: s.added_by || 'app',
        notes: s.notes || `Sync da app ${new Date().toISOString().slice(0, 10)}`,
        provincia_override: s.provincia_override || s.provincia || null,
        categoria_override: s.categoria_override || s.categoria || null,
        quality_override: s.quality_override || s.quality || null,
      };
    });

    const r = await supaFetch(env, '/rest/v1/ingestion_sources?on_conflict=source_url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows),
    });

    if (!r.ok) {
      const errBody = await r.text().catch(() => '');
      return jsonResp({ ok: false, saved: 0, status: r.status, supabase_error: errBody.slice(0, 300) });
    }

    return jsonResp({ ok: true, saved: rows.length });
  } catch (e) {
    return jsonResp({ ok: false, error: (e as Error).message }, 500);
  }
}