/**
 * Supabase cloud: accounts, per-user league snapshots and load analytics.
 * Every function resolves — callers get a typed result instead of a throw so
 * the UI can show a plain notification.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { normalizeLeague, type League } from './league';

export const SUPABASE_URL = 'https://hbvpnslzoulogjivoipv.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_UTf_89tttlvxQ0N4JAqQaw_iXl7ocpm';

export type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

const ok = <T>(data: T): Result<T> => ({ ok: true, data });
const done = (): Result => ({ ok: true, data: undefined });
const fail = (error: string): Result<never> => ({ ok: false, error });

let client: SupabaseClient | null = null;

export function getClient(): SupabaseClient | null {
  if (client) return client;
  try {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
  } catch (error) {
    console.warn('Supabase client failed to initialise', error);
    client = null;
  }
  return client;
}

export const cloudAvailable = (): boolean => getClient() !== null;

const friendly = (message?: string) => message?.trim() || 'Cloud request failed';

/* ── Accounts ───────────────────────────────────────────────────────────── */

export async function signUp(username: string, password: string, confirm: string): Promise<Result> {
  const sb = getClient();
  if (!sb) return fail('Cloud is unavailable. Check your connection.');

  const name = username.trim();
  if (name.length < 2) return fail('Username must be at least 2 characters');
  if (password.length < 4) return fail('Access code must be at least 4 characters');
  if (password !== confirm) return fail('Passwords do not match');

  const { data: existing, error: checkError } = await sb
    .from('users')
    .select('username')
    .eq('username', name)
    .maybeSingle();
  if (checkError) return fail(`Could not check username: ${friendly(checkError.message)}`);
  if (existing) return fail(`Username "${name}" is already taken`);

  const { error } = await sb.from('users').insert({ username: name, access_code: password });
  if (error) return fail(`Could not create account: ${friendly(error.message)}`);
  return done();
}

export async function signIn(username: string, password: string): Promise<Result> {
  const sb = getClient();
  if (!sb) return fail('Cloud is unavailable. Check your connection.');

  const { data, error } = await sb
    .from('users')
    .select('username')
    .eq('username', username.trim())
    .eq('access_code', password)
    .maybeSingle();

  if (error) return fail(friendly(error.message));
  if (!data) return fail('Invalid username or access code');
  return done();
}

export async function changeAccessCode(
  username: string,
  oldCode: string,
  newCode: string,
  confirm: string,
): Promise<Result> {
  const sb = getClient();
  if (!sb) return fail('Cloud is unavailable. Check your connection.');
  if (newCode !== confirm) return fail('New passwords do not match');
  if (newCode.length < 4) return fail('Password must be at least 4 characters');

  const { data: user, error: userError } = await sb
    .from('users')
    .select('username')
    .eq('username', username)
    .eq('access_code', oldCode)
    .maybeSingle();
  if (userError) return fail(friendly(userError.message));
  if (!user) return fail('Current password is incorrect');

  const { error } = await sb.from('users').update({ access_code: newCode }).eq('username', username);
  if (error) return fail(`Could not update password: ${friendly(error.message)}`);
  return done();
}

/* ── Cloud snapshots ────────────────────────────────────────────────────── */

export async function uploadLeagues(
  username: string,
  accessCode: string,
  leagues: League[],
): Promise<Result<{ uploaded: number }>> {
  const sb = getClient();
  if (!sb) return fail('Cloud is unavailable. Check your connection.');
  if (!username || !accessCode) return fail('Username and access code are required');
  if (leagues.length === 0) return fail('There are no leagues to upload');

  const { data: user, error: userError } = await sb
    .from('users')
    .select('username, access_code')
    .eq('username', username)
    .eq('access_code', accessCode)
    .maybeSingle();
  if (userError) return fail(friendly(userError.message));
  if (!user) return fail('Invalid username or access code');

  let uploaded = 0;
  for (const league of leagues) {
    const { error } = await sb.from('leagues').upsert(
      {
        id: league.id,
        username,
        data: league,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id,username' },
    );
    if (!error) {
      uploaded += 1;
    } else if (uploaded === 0) {
      // Surface the first failure early (usually RLS / schema drift).
      return fail(`Upload failed: ${friendly(error.message)}`);
    }
  }

  if (uploaded === 0) return fail('Nothing could be uploaded');
  return ok({ uploaded });
}

export async function fetchLeagues(username: string): Promise<Result<League[]>> {
  const sb = getClient();
  if (!sb) return fail('Cloud is unavailable. Check your connection.');
  if (!username.trim()) return fail('Username is required');

  const { data: user, error: userError } = await sb
    .from('users')
    .select('username')
    .eq('username', username.trim())
    .maybeSingle();
  if (userError) return fail(friendly(userError.message));
  if (!user) return fail(`Username "${username.trim()}" was not found`);

  const { data, error } = await sb.from('leagues').select('data').eq('username', username.trim());
  if (error) return fail(friendly(error.message));
  if (!data || data.length === 0) return fail(`No leagues found for "${username.trim()}"`);

  const leagues = data
    .map((row) => row.data as League)
    .filter(Boolean)
    .map((league) => normalizeLeague(league));

  return ok(leagues);
}

export async function logLoadEvent(username: string): Promise<void> {
  const sb = getClient();
  if (!sb || !username) return;
  try {
    await sb.from('load_events').insert({ username });
  } catch {
    /* analytics are best-effort */
  }
}

export interface LoadStats {
  labels: string[];
  counts: number[];
}

/** Cloud loads per day over the last 7 days (oldest first). */
export async function fetchLoadStats(): Promise<Result<LoadStats>> {
  const sb = getClient();
  if (!sb) return fail('Cloud is unavailable');

  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - 6);
  start.setHours(0, 0, 0, 0);

  const { data, error } = await sb
    .from('load_events')
    .select('timestamp')
    .gte('timestamp', start.toISOString());
  if (error) return fail(friendly(error.message));

  const labels: string[] = [];
  const counts: number[] = [];
  const index = new Map<string, number>();

  for (let i = 6; i >= 0; i--) {
    const day = new Date(now);
    day.setDate(now.getDate() - i);
    const key = day.toISOString().slice(0, 10);
    index.set(key, labels.length);
    labels.push(day.toLocaleDateString('en-US', { weekday: 'short' }));
    counts.push(0);
  }

  for (const row of data ?? []) {
    const key = new Date((row as { timestamp: string }).timestamp).toISOString().slice(0, 10);
    const at = index.get(key);
    if (at !== undefined) counts[at] += 1;
  }

  return ok({ labels, counts });
}
