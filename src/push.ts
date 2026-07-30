import { buildPushHTTPRequest } from '@pushforge/builder';
import type { Env } from './types';
import { supaFetch } from './supabase';
import { sendFcmNotification } from './fcm';

export interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface NativeTokenRow {
  id: string;
  user_id: string;
  token: string;
  platform: 'ios' | 'android';
}

interface FavoriteRow {
  user_id: string;
  event_data: { title: string; event_date: string; location?: string };
}

export function getTomorrowDateString(now: Date = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Raggruppa le iscrizioni push per utente, per sapere a chi mandare cosa */
export function groupSubscriptionsByUser(
  subs: PushSubscriptionRow[]
): Map<string, PushSubscriptionRow[]> {
  const map = new Map<string, PushSubscriptionRow[]>();
  for (const s of subs) {
    const list = map.get(s.user_id) ?? [];
    list.push(s);
    map.set(s.user_id, list);
  }
  return map;
}

/** Stesso raggruppamento, per i token dei dispositivi nativi (Android/iOS) */
export function groupNativeTokensByUser(tokens: NativeTokenRow[]): Map<string, NativeTokenRow[]> {
  const map = new Map<string, NativeTokenRow[]>();
  for (const t of tokens) {
    const list = map.get(t.user_id) ?? [];
    list.push(t);
    map.set(t.user_id, list);
  }
  return map;
}

async function sendPushToSubscription(
  env: Env,
  sub: PushSubscriptionRow,
  notification: { title: string; body: string }
): Promise<'ok' | 'expired' | 'error'> {
  try {
    const { endpoint, headers, body } = await buildPushHTTPRequest({
      privateJWK: JSON.parse(env.VAPID_PRIVATE_KEY_JWK),
      subscription: { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      message: { payload: { notification }, adminContact: 'mailto:info@rondine.app', options: { ttl: 86400 } },
    });
    const r = await fetch(endpoint, { method: 'POST', headers, body });
    if (r.status === 404 || r.status === 410) return 'expired';
    return r.ok ? 'ok' : 'error';
  } catch {
    return 'error';
  }
}

export async function sendEventReminders(env: Env): Promise<{ sent: number; expired: number }> {
  const tomorrow = getTomorrowDateString();
  let sent = 0;
  let expired = 0;

  try {
    const favRes = await supaFetch(
      env,
      `/rest/v1/favorites?select=user_id,event_data&event_date=eq.${tomorrow}`
    );
    if (!favRes.ok) return { sent, expired };
    const favorites = (await favRes.json()) as FavoriteRow[];
    if (!favorites.length) return { sent, expired };

   const userIds = [...new Set(favorites.map((f) => f.user_id))];
    const subsRes = await supaFetch(
      env,
      `/rest/v1/push_subscriptions?select=*&user_id=in.(${userIds.join(',')})`
    );
    const subs = subsRes.ok ? ((await subsRes.json()) as PushSubscriptionRow[]) : [];
    const subsByUser = groupSubscriptionsByUser(subs);

    const nativeRes = await supaFetch(
      env,
      `/rest/v1/native_push_tokens?select=*&user_id=in.(${userIds.join(',')})`
    );
    const nativeTokens = nativeRes.ok ? ((await nativeRes.json()) as NativeTokenRow[]) : [];
    const nativeByUser = groupNativeTokensByUser(nativeTokens);

    for (const fav of favorites) {
      const notification = {
        title: '🔔 Promemoria evento',
        body: `"${fav.event_data.title}" è in programma domani!`,
      };

      const userSubs = subsByUser.get(fav.user_id) ?? [];
      for (const sub of userSubs) {
        const result = await sendPushToSubscription(env, sub, notification);
        if (result === 'ok') sent++;
        if (result === 'expired') {
          expired++;
          await supaFetch(env, `/rest/v1/push_subscriptions?id=eq.${sub.id}`, { method: 'DELETE' });
        }
      }

      const userNativeTokens = nativeByUser.get(fav.user_id) ?? [];
      for (const nativeToken of userNativeTokens) {
        if (nativeToken.platform !== 'android') continue;
        const result = await sendFcmNotification(env, nativeToken.token, notification);
        if (result === 'ok') sent++;
        if (result === 'expired') {
          expired++;
          await supaFetch(env, `/rest/v1/native_push_tokens?id=eq.${nativeToken.id}`, { method: 'DELETE' });
        }
      }
    }
  } catch {
    // un errore qui non deve mai far fallire lo scheduled handler
  }

  return { sent, expired };
}