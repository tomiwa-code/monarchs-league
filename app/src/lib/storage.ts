/** Local persistence + session storage for League Arena. */

import { normalizeLeague, type League } from './league';

const LEAGUE_KEY = (username?: string) => (username ? `leagueArenaData_${username}` : 'leagueArenaData_public');
const SESSION_KEY = 'leagueArenaAdmin';
const COOKIE_KEY = 'leagueArenaCookie';
const DEMO_DISMISSED_KEY = 'leagueArenaDemoDismissed';

export interface AdminSession {
  isAdmin: boolean;
  username: string;
  accessCode: string;
}

export function loadLeagues(username?: string): League[] {
  const raw = safeGet(LEAGUE_KEY(username));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => normalizeLeague(item));
  } catch {
    return [];
  }
}

/** Returns false when the browser refuses to persist (private mode, full disk). */
export function saveLeagues(leagues: League[], username?: string): boolean {
  return safeSet(LEAGUE_KEY(username), JSON.stringify(leagues));
}

export function loadSession(): AdminSession {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.isAdmin && parsed?.username) {
        return { isAdmin: true, username: parsed.username, accessCode: parsed.accessCode ?? '' };
      }
    }
  } catch {
    /* corrupted session — ignore */
  }
  return { isAdmin: false, username: '', accessCode: '' };
}

export function saveSession(session: AdminSession): void {
  if (!session.isAdmin) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

/* Optional "remember my cloud username" convenience cookie. */
export function setRememberedUser(username: string): void {
  try {
    document.cookie = username
      ? `${COOKIE_KEY}=${encodeURIComponent(username)}; max-age=31536000; path=/; samesite=lax`
      : `${COOKIE_KEY}=; max-age=0; path=/`;
  } catch {
    /* cookies unavailable — non critical */
  }
}

export function getRememberedUser(): string {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_KEY}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : '';
  } catch {
    return '';
  }
}

export function demoDismissed(): boolean {
  return safeGet(DEMO_DISMISSED_KEY) === '1';
}

export function dismissDemo(): void {
  safeSet(DEMO_DISMISSED_KEY, '1');
}

/* Cross-tab notification so a second tab refreshes instead of silently
 * overwriting the first tab's edits. */
const SYNC_EVENT = 'leagueArenaSync';
const CHANNEL = 'leagueArenaChannel';

export function broadcastChange(username?: string): void {
  try {
    const message = { key: LEAGUE_KEY(username), at: Date.now() };
    localStorage.setItem(SYNC_EVENT, JSON.stringify(message));
    const channel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL) : null;
    channel?.postMessage(message);
    channel?.close();
  } catch {
    /* not supported — single-tab behaviour is still correct */
  }
}

export function listenForChanges(handler: (key: string) => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === SYNC_EVENT && event.newValue) {
      try {
        handler(JSON.parse(event.newValue).key);
      } catch {
        /* ignore malformed payloads */
      }
    }
  };
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL) : null;
  if (channel) {
    channel.onmessage = (event: MessageEvent) => {
      if (event.data?.key) handler(event.data.key);
    };
  }
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener('storage', onStorage);
    channel?.close();
  };
}

export const storageKeyFor = LEAGUE_KEY;

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
