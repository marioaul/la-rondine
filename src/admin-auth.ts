import type { Env } from './types';
import { supaFetch } from './supabase';

interface SupabaseUser {
  id?: string;
}

export async function verifyAdmin(request: Request, env: Env): Promise<boolean> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);

  try {
    const userRes = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`, {
      headers: { apikey: env.SUPABASE_KEY, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!userRes.ok) return false;

    const user = (await userRes.json()) as SupabaseUser;
    if (!user.id) return false;

    const adminRes = await supaFetch(env, `/rest/v1/admins?user_id=eq.${user.id}&select=user_id`);
    if (!adminRes.ok) return false;

    const rows = (await adminRes.json()) as unknown[];
    return rows.length > 0;
  } catch {
    return false;
  }
}