import type { Env, SourceAdapter } from './types';
import { ticketmasterAdapter } from './adapters/ticketmaster';
import { rssAdapter } from './adapters/rss';
import { customSourcesAdapter } from './adapters/custom';
import { runPipeline, loadRuntimeConfig } from './pipeline';
import {
  handleCleanup,
  handleDebugCount,
  handleOptions,
  handleSearch,
  handleStatus,
  handleTrigger,
  jsonResp,
} from './handlers/index';
import { handleSources } from './handlers/sources';
import { sendEventReminders } from './push';
import { verifyAdmin } from './admin-auth';

const VERSION = '1.1.0';

/**
 * Fonti attive nel cron automatico. Aggiungere/rimuovere una fonte = una riga qui.
 */
const ADAPTERS: SourceAdapter[] = [ticketmasterAdapter, rssAdapter, customSourcesAdapter];

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return handleOptions();

    const path = new URL(request.url).pathname.replace(/\/$/, '');

    if (path === '/health' || path === '') {
      return jsonResp({ ok: true, version: VERSION, ts: new Date().toISOString() });
    }
    if (path === '/trigger') return handleTrigger(request, env, ADAPTERS);
    if (path === '/status') return handleStatus(request, env);
    if (path === '/search') return handleSearch(request, env);
    if (path === '/cleanup') return handleCleanup(request, env);
    if (path === '/sources') return handleSources(request, env);
 if (path === '/debug-count') return handleDebugCount(request, env);
    if (path === '/push/test-reminders') {
      if (request.method !== 'POST') return jsonResp({ error: 'Method not allowed' }, 405);
      if (!(await verifyAdmin(request, env))) return jsonResp({ error: 'Unauthorized' }, 401);
      const result = await sendEventReminders(env);
      return jsonResp({ ok: true, ...result });
    }

    return jsonResp({ error: 'Not found', path }, 404);
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    if (event.cron === '0 9 * * *') {
      ctx.waitUntil(sendEventReminders(env).then(() => undefined));
    } else {
      ctx.waitUntil(runPipeline(env, loadRuntimeConfig(env), ADAPTERS).then(() => undefined));
    }
  },
};
