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

    return jsonResp({ error: 'Not found', path }, 404);
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runPipeline(env, loadRuntimeConfig(env), ADAPTERS).then(() => undefined));
  },
};
