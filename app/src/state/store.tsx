/**
 * App store: session, league collection, cloud sync and toast notifications.
 * Persistence happens inside the mutating functions (never in an effect) so
 * there is exactly one writer per change and no write/lockstep races.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  buildLeague,
  createDemoLeague,
  generateFixtures,
  normalizeLeague,
  recalculateTable,
  type CreateLeagueInput,
  type League,
} from '../lib/league';
import * as cloud from '../lib/cloud';
import {
  clearSession,
  demoDismissed,
  dismissDemo,
  loadLeagues,
  loadSession,
  saveLeagues,
  saveSession,
  setRememberedUser,
  type AdminSession,
} from '../lib/storage';

export type ToastKind = 'success' | 'error' | 'info';
export interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

export type SyncState = 'idle' | 'syncing' | 'synced' | 'error';

interface AppValue {
  /* session */
  session: AdminSession;
  isAdmin: boolean;
  cloudReady: boolean;
  signIn: (username: string, password: string) => Promise<boolean>;
  signUp: (username: string, password: string, confirm: string) => Promise<boolean>;
  signOut: () => void;
  changePassword: (oldCode: string, newCode: string, confirm: string) => Promise<boolean>;

  /* leagues */
  leagues: League[];
  getLeague: (id: number | null) => League | undefined;
  createLeague: (input: CreateLeagueInput) => League;
  updateScore: (leagueId: number, fixtureId: number, side: 'home' | 'away', raw: string) => void;
  renameTeams: (leagueId: number, names: string[]) => boolean;
  deleteLeague: (id: number) => void;
  setVisibleWeeks: (leagueId: number, start: number, end: number) => boolean;
  replaceLeagues: (leagues: League[]) => void;
  resetFixtures: (leagueId: number) => void;

  /* cloud */
  syncState: SyncState;
  lastSyncedAt: number | null;
  uploadToCloud: (username: string, code: string) => Promise<boolean>;
  loadFromCloud: (username: string) => Promise<boolean>;

  /* demo */
  showingDemo: boolean;
  demoLeague: League | null;
  removeDemo: () => void;

  /* toasts */
  toasts: Toast[];
  notify: (message: string, kind?: ToastKind) => void;
  dismissToast: (id: number) => void;
}

const AppContext = createContext<AppValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AdminSession>(() => loadSession());
  const [leagues, setLeagues] = useState<League[]>(() =>
    loadLeagues(loadSession().isAdmin ? loadSession().username : undefined),
  );
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [demo, setDemo] = useState<League | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Refs mirror the latest values for async/debounced code paths.
  const leaguesRef = useRef(leagues);
  leaguesRef.current = leagues;
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const syncTimer = useRef<number | null>(null);
  const syncing = useRef(false);

  const notify = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current.slice(-2), { id, message, kind }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, kind === 'error' ? 4200 : 3000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const storageKey = () => {
    const current = sessionRef.current;
    return current.isAdmin && current.username ? current.username : undefined;
  };

  const persist = useCallback((next: League[]) => {
    setLeagues(next);
    saveLeagues(next, storageKey());
  }, []);

  /* ── Auto-sync: debounce cloud writes after edits ─────────────────────── */
  const pushToCloud = useCallback(
    async (silent: boolean) => {
      const current = sessionRef.current;
      if (!current.isAdmin || !current.username || !current.accessCode) return false;
      if (syncing.current) return false;
      syncing.current = true;
      setSyncState('syncing');
      const result = await cloud.uploadLeagues(current.username, current.accessCode, leaguesRef.current);
      syncing.current = false;
      if (result.ok) {
        setSyncState('synced');
        setLastSyncedAt(Date.now());
        return true;
      }
      if (!silent) {
        setSyncState('error');
        notify(result.error, 'error');
      } else {
        setSyncState('idle');
      }
      return false;
    },
    [notify],
  );

  const scheduleAutoSync = useCallback(() => {
    const current = sessionRef.current;
    if (!current.isAdmin || !current.username || !current.accessCode) return;
    if (syncTimer.current) window.clearTimeout(syncTimer.current);
    syncTimer.current = window.setTimeout(() => {
      syncTimer.current = null;
      void pushToCloud(true);
    }, 1500);
  }, [pushToCloud]);

  const commit = useCallback(
    (mutate: (draft: League[]) => League[], { sync = true } = {}) => {
      const next = mutate(leaguesRef.current.map((league) => ({ ...league })));
      leaguesRef.current = next;
      persist(next);
      if (sync) scheduleAutoSync();
      return next;
    },
    [persist, scheduleAutoSync],
  );

  useEffect(() => () => {
    if (syncTimer.current) window.clearTimeout(syncTimer.current);
  }, []);

  /* ── Demo league for signed-out visitors ──────────────────────────────── */
  const [demoUsed, setDemoUsed] = useState(() => demoDismissed());
  const demoLeague = useMemo(() => {
    if (session.isAdmin || demoUsed || leagues.length > 0) return null;
    return demo ?? createDemoLeague();
  }, [session.isAdmin, demoUsed, leagues.length, demo]);

  const removeDemo = useCallback(() => {
    dismissDemo();
    setDemoUsed(true);
    setDemo(null);
  }, []);

  /* ── Auth ─────────────────────────────────────────────────────────────── */
  const hydrateFor = useCallback((username?: string) => {
    const stored = loadLeagues(username);
    leaguesRef.current = stored;
    setLeagues(stored);
    setSyncState('idle');
    setLastSyncedAt(null);
  }, []);

  const signIn = useCallback(
    async (username: string, password: string) => {
      const name = username.trim();
      const result = await cloud.signIn(name, password);
      if (!result.ok) {
        notify(result.error, 'error');
        return false;
      }
      const nextSession: AdminSession = { isAdmin: true, username: name, accessCode: password };
      sessionRef.current = nextSession;
      setSession(nextSession);
      saveSession(nextSession);
      setRememberedUser(name);
      hydrateFor(name);
      notify(`Logged in as ${name}`);
      return true;
    },
    [hydrateFor, notify],
  );

  const signUp = useCallback(
    async (username: string, password: string, confirm: string) => {
      const result = await cloud.signUp(username, password, confirm);
      if (!result.ok) {
        notify(result.error, 'error');
        return false;
      }
      notify('Account created — logging you in');
      return signIn(username, password);
    },
    [notify, signIn],
  );

  const signOut = useCallback(() => {
    if (syncTimer.current) window.clearTimeout(syncTimer.current);
    const nextSession: AdminSession = { isAdmin: false, username: '', accessCode: '' };
    sessionRef.current = nextSession;
    setSession(nextSession);
    clearSession();
    hydrateFor(undefined);
    notify('Logged out');
  }, [hydrateFor, notify]);

  const changePassword = useCallback(
    async (oldCode: string, newCode: string, confirm: string) => {
      const current = sessionRef.current;
      if (!current.isAdmin) {
        notify('Log in first', 'error');
        return false;
      }
      const result = await cloud.changeAccessCode(current.username, oldCode, newCode, confirm);
      if (!result.ok) {
        notify(result.error, 'error');
        return false;
      }
      const nextSession: AdminSession = { ...current, accessCode: newCode };
      sessionRef.current = nextSession;
      setSession(nextSession);
      saveSession(nextSession);
      notify('Password changed');
      return true;
    },
    [notify],
  );

  /* ── League mutations ─────────────────────────────────────────────────── */
  const getLeague = useCallback(
    (id: number | null) => {
      if (id === null) return undefined;
      return leagues.find((league) => league.id === id) ?? (demoLeague?.id === id ? demoLeague : undefined);
    },
    [leagues, demoLeague],
  );

  const createLeague = useCallback(
    (input: CreateLeagueInput) => {
      const league = buildLeague(input);
      commit((draft) => [...draft, league], { sync: true });
      return league;
    },
    [commit],
  );

  const updateScore = useCallback(
    (leagueId: number, fixtureId: number, side: 'home' | 'away', raw: string) => {
      const value = raw.trim();
      const score = value === '' ? null : Math.max(0, Math.floor(Number(value)));
      if (value !== '' && !Number.isFinite(score)) return;

      commit((draft) =>
        draft.map((league) => {
          if (league.id !== leagueId) return league;
          const fixtures = league.fixtures.map((fixture) =>
            fixture.id === fixtureId
              ? { ...fixture, [side === 'home' ? 'homeScore' : 'awayScore']: score }
              : fixture,
          );
          return {
            ...league,
            fixtures,
            table: recalculateTable({ teams: league.teams, fixtures }),
          };
        }),
      );
    },
    [commit],
  );

  const renameTeams = useCallback(
    (leagueId: number, names: string[]) => {
      const league = leaguesRef.current.find((item) => item.id === leagueId);
      if (!league) return false;
      if (names.length !== league.teams.length) {
        notify('Team count cannot change', 'error');
        return false;
      }
      if (new Set(names).size !== names.length) {
        notify('Team names must be unique', 'error');
        return false;
      }
      const mapping = new Map(league.teams.map((team, index) => [team, names[index]]));
      if (mapping.size !== league.teams.length) {
        notify('Existing team names contain duplicates', 'error');
        return false;
      }

      commit((draft) =>
        draft.map((item) => {
          if (item.id !== leagueId) return item;
          const fixtures = item.fixtures.map((fixture) => ({
            ...fixture,
            home: mapping.get(fixture.home) ?? fixture.home,
            away: mapping.get(fixture.away) ?? fixture.away,
          }));
          return {
            ...item,
            teams: [...names],
            fixtures,
            table: recalculateTable({ teams: names, fixtures }),
          };
        }),
      );
      notify('Teams updated');
      return true;
    },
    [commit, notify],
  );

  const deleteLeague = useCallback(
    (id: number) => commit((draft) => draft.filter((league) => league.id !== id)),
    [commit],
  );

  const setVisibleWeeks = useCallback(
    (leagueId: number, start: number, end: number) => {
      if (start > end) {
        notify('Start week cannot be after end week', 'error');
        return false;
      }
      commit((draft) =>
        draft.map((league) =>
          league.id === leagueId
            ? { ...league, publicVisibleWeekStart: start, publicVisibleWeekEnd: end }
            : league,
        ),
      );
      notify(`Public weeks set to ${start} – ${end}`);
      return true;
    },
    [commit, notify],
  );

  const replaceLeagues = useCallback(
    (next: League[]) => {
      const normalized = next.map((league) => normalizeLeague(league));
      commit(() => normalized);
    },
    [commit],
  );

  const resetFixtures = useCallback(
    (leagueId: number) => {
      commit((draft) =>
        draft.map((league) => {
          if (league.id !== leagueId) return league;
          const fixtures = generateFixtures(league.teams);
          return { ...league, fixtures, table: recalculateTable({ teams: league.teams, fixtures }) };
        }),
      );
      notify('Season reset — all scores cleared');
    },
    [commit, notify],
  );

  /* ── Cloud snapshots ──────────────────────────────────────────────────── */
  const uploadToCloud = useCallback(
    async (username: string, code: string) => {
      const current = sessionRef.current;
      if (!current.isAdmin) {
        notify('Log in as an admin to upload', 'error');
        return false;
      }
      if (leaguesRef.current.length === 0) {
        notify('There are no leagues to upload', 'error');
        return false;
      }
      setSyncState('syncing');
      const result = await cloud.uploadLeagues(username, code, leaguesRef.current);
      if (!result.ok) {
        setSyncState('error');
        notify(result.error, 'error');
        return false;
      }
      setSyncState('synced');
      setLastSyncedAt(Date.now());
      notify(`Uploaded ${result.data.uploaded} ${result.data.uploaded === 1 ? 'league' : 'leagues'}`);
      return true;
    },
    [notify],
  );

  const loadFromCloud = useCallback(
    async (username: string) => {
      const name = username.trim();
      if (!name) {
        notify('Username is required', 'error');
        return false;
      }
      const current = sessionRef.current;
      if (current.isAdmin && name.toLowerCase() !== current.username.toLowerCase()) {
        notify(`You are logged in as "${current.username}" and can only load your own data`, 'error');
        return false;
      }

      const result = await cloud.fetchLeagues(name);
      if (!result.ok) {
        notify(result.error, 'error');
        return false;
      }
      void cloud.logLoadEvent(name);
      commit(() => result.data, { sync: false });
      notify(`Loaded ${result.data.length} ${result.data.length === 1 ? 'league' : 'leagues'} from "${name}"`);
      return true;
    },
    [commit, notify],
  );

  const value: AppValue = {
    session,
    isAdmin: session.isAdmin,
    cloudReady: cloud.cloudAvailable(),
    signIn,
    signUp,
    signOut,
    changePassword,
    leagues,
    getLeague,
    createLeague,
    updateScore,
    renameTeams,
    deleteLeague,
    setVisibleWeeks,
    replaceLeagues,
    resetFixtures,
    syncState,
    lastSyncedAt,
    uploadToCloud,
    loadFromCloud,
    showingDemo: !!demoLeague,
    demoLeague,
    removeDemo,
    toasts,
    notify,
    dismissToast,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp(): AppValue {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside <AppProvider>');
  return context;
}
