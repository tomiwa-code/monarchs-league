import { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUpDown,
  CloudDownload,
  CloudUpload,
  Eye,
  Info,
  List,
  Loader2,
  Pencil,
  PlusCircle,
  Trash2,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { useApp } from '../state/store';
import { Modal, SubmitButton } from '../components/Modal';
import { totalWeeks } from '../lib/league';
import { getRememberedUser, setRememberedUser } from '../lib/storage';

type SortKey = 'newest' | 'oldest' | 'name-asc' | 'name-desc';

interface LeaguesPageProps {
  onBack: () => void;
  onCreate: () => void;
  onOpen: (id: number) => void;
}

export function LeaguesPage({ onBack, onCreate, onOpen }: LeaguesPageProps) {
  const {
    leagues,
    isAdmin,
    showingDemo,
    demoLeague,
    removeDemo,
    deleteLeague,
    uploadToCloud,
    loadFromCloud,
    session,
    notify,
  } = useApp();
  const [sort, setSort] = useState<SortKey>('newest');
  const [dialog, setDialog] = useState<'upload' | 'load' | null>(null);

  const all = useMemo(() => (showingDemo && demoLeague ? [demoLeague] : leagues), [leagues, showingDemo, demoLeague]);

  const sorted = useMemo(() => {
    const copy = [...all];
    switch (sort) {
      case 'oldest':
        return copy.sort((a, b) => a.id - b.id);
      case 'name-asc':
        return copy.sort((a, b) => a.name.localeCompare(b.name));
      case 'name-desc':
        return copy.sort((a, b) => b.name.localeCompare(a.name));
      default:
        return copy.sort((a, b) => b.id - a.id);
    }
  }, [all, sort]);

  const confirmDelete = (id: number, name: string) => {
    if (window.confirm(`Delete "${name}" permanently? This cannot be undone.`)) {
      deleteLeague(id);
      notify('League deleted', 'info');
    }
  };

  return (
    <section className="section active" id="leagues">
      <button type="button" className="back-btn" onClick={onBack}>
        <ArrowLeft size={15} /> Home
      </button>

      <h2 className="section-title">
        <List size={22} /> My Leagues
      </h2>

      <div className="cloud-actions">
        {isAdmin && (
          <button type="button" className="btn btn-primary" onClick={() => setDialog('upload')}>
            <CloudUpload size={17} /> Upload to Cloud
          </button>
        )}
        <button type="button" className="btn btn-secondary" onClick={() => setDialog('load')}>
          <CloudDownload size={17} /> Load from Cloud
        </button>
      </div>

      {showingDemo && (
        <div className="demo-banner">
          <span>
            <Info size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
            You&apos;re viewing a sample season. Log in as an admin to manage real leagues.
          </span>
          <button type="button" className="btn btn-secondary" onClick={removeDemo}>
            Hide sample
          </button>
        </div>
      )}

      <div className="toolbar">
        <label className="toolbar-label" htmlFor="sort-leagues">
          <ArrowUpDown size={14} /> Sort
        </label>
        <select
          id="sort-leagues"
          className="select"
          value={sort}
          onChange={(event) => setSort(event.target.value as SortKey)}
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="name-asc">A → Z</option>
          <option value="name-desc">Z → A</option>
        </select>
      </div>

      <div className="leagues-grid">
        {sorted.length === 0 && (
          <div className="empty-state">
            <Trophy size={44} />
            <h3>{isAdmin ? 'No leagues yet' : 'No leagues loaded'}</h3>
            <p>
              {isAdmin
                ? 'Create your first league or load one from the cloud.'
                : 'Use “Load from Cloud” to fetch the leagues an admin has published.'}
            </p>
            {isAdmin ? (
              <button type="button" className="btn btn-primary" onClick={onCreate}>
                <PlusCircle size={17} /> Create League
              </button>
            ) : (
              <button type="button" className="btn btn-secondary" onClick={() => setDialog('load')}>
                <CloudDownload size={17} /> Load from Cloud
              </button>
            )}
          </div>
        )}

        {sorted.map((league) => {
          const weeks = totalWeeks(league.teams.length);
          const start = league.publicVisibleWeekStart || 1;
          const end = league.publicVisibleWeekEnd || weeks;
          return (
            <article className="league-card" key={league.id}>
              <header>
                <h3 title={league.name}>{league.name}</h3>
                <span className="status">{showingDemo ? 'Sample' : 'Active'}</span>
              </header>
              <div className="league-meta">
                <p>
                  <Users size={14} /> {league.teams.length} teams
                </p>
                <p>
                  <Trophy size={14} style={{ color: '#4ade80' }} />
                  {league.winnersCount} winner{league.winnersCount === 1 ? '' : 's'} ·{' '}
                  <ArrowDown size={14} style={{ color: '#f87171' }} />
                  {league.relegationCount} relegation{league.relegationCount === 1 ? '' : 's'}
                </p>
                <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Created {new Date(league.id).toLocaleDateString()}
                </p>
                <p style={{ fontSize: '0.75rem', color: '#60a5fa' }}>
                  <Eye size={13} /> Public weeks: {start} – {end}
                </p>
              </div>
              <div className="league-actions">
                <button type="button" className="action-btn view" onClick={() => onOpen(league.id)}>
                  <Eye size={14} /> View
                </button>
                {isAdmin && !showingDemo && (
                  <>
                    <button type="button" className="action-btn edit" onClick={() => onOpen(league.id)}>
                      <Pencil size={14} /> Edit
                    </button>
                    <button
                      type="button"
                      className="action-btn delete"
                      onClick={() => confirmDelete(league.id, league.name)}
                      aria-label={`Delete ${league.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {dialog === 'upload' && <UploadDialog onClose={() => setDialog(null)} onSubmit={uploadToCloud} defaultUser={session.username} />}
      {dialog === 'load' && <LoadDialog onClose={() => setDialog(null)} onSubmit={loadFromCloud} defaultUser={session.username || getRememberedUser()} />}
    </section>
  );
}

function UploadDialog({
  onClose,
  onSubmit,
  defaultUser,
}: {
  onClose: () => void;
  onSubmit: (username: string, code: string) => Promise<boolean>;
  defaultUser: string;
}) {
  const [username, setUsername] = useState(defaultUser);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !code.trim()) {
      setError('Fill in both fields');
      return;
    }
    setBusy(true);
    setError('');
    const ok = await onSubmit(username.trim(), code.trim());
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Modal title="Upload to Cloud" icon={<CloudUpload size={18} />} onClose={onClose} narrow>
      <form onSubmit={submit}>
        <div className="form-group">
          <label htmlFor="upload-user">Username</label>
          <input
            id="upload-user"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Enter username"
            autoCapitalize="none"
          />
        </div>
        <div className="form-group">
          <label htmlFor="upload-code">Access code</label>
          <input
            id="upload-code"
            type="password"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Enter access code"
            autoComplete="current-password"
          />
        </div>
        {error && <p className="error-text">{error}</p>}
        <div style={{ marginTop: 16 }}>
          <SubmitButton busy={busy} busyLabel="Uploading…" label="Upload" icon={<CloudUpload size={17} />} />
        </div>
      </form>
    </Modal>
  );
}

function LoadDialog({
  onClose,
  onSubmit,
  defaultUser,
}: {
  onClose: () => void;
  onSubmit: (username: string) => Promise<boolean>;
  defaultUser: string;
}) {
  const [username, setUsername] = useState(defaultUser);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!username.trim()) {
      setError('Enter a username');
      return;
    }
    setBusy(true);
    setError('');
    const ok = await onSubmit(username.trim());
    setBusy(false);
    if (ok) {
      setRememberedUser(remember ? username.trim() : '');
      onClose();
    }
  };

  return (
    <Modal title="Load from Cloud" icon={<CloudDownload size={18} />} onClose={onClose} narrow>
      <form onSubmit={submit}>
        <div className="form-group">
          <label htmlFor="load-user">Username</label>
          <input
            id="load-user"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Whose leagues should we fetch?"
            autoCapitalize="none"
          />
        </div>
        <label
          style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: '#94a3b8' }}
        >
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
            style={{ width: 16, height: 16, accentColor: '#60a5fa' }}
          />
          Remember this username on this device
        </label>
        {error && <p className="error-text">{error}</p>}
        <div style={{ marginTop: 16 }}>
          <SubmitButton
            busy={busy}
            busyLabel="Loading…"
            label="Load"
            icon={busy ? <Loader2 size={17} /> : <CloudDownload size={17} />}
          />
        </div>
      </form>
      <p className="info-text" style={{ marginTop: 12 }}>
        <X size={12} style={{ verticalAlign: -1, marginRight: 4 }} />
        Loading replaces the leagues stored on this device.
      </p>
    </Modal>
  );
}
