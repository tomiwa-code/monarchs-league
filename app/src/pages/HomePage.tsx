import { useEffect, useState } from 'react';
import {
  ArrowDown,
  CalendarDays,
  Database,
  Download,
  List,
  PlusCircle,
  ShieldCheck,
  Smartphone,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import { useApp } from '../state/store';
import { useAuthDialogs } from '../components/AuthModals';
import { fetchLoadStats, type LoadStats } from '../lib/cloud';
import type { PwaApi } from '../hooks/usePwa';

interface HomePageProps {
  pwa: PwaApi;
  onCreate: () => void;
  onLeagues: () => void;
  onOpenLeague: (id: number) => void;
}

export function HomePage({ pwa, onCreate, onLeagues, onOpenLeague }: HomePageProps) {
  const { isAdmin, leagues, demoLeague, notify } = useApp();
  const { openLogin } = useAuthDialogs();
  const [stats, setStats] = useState<LoadStats | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      setStats(null);
      return;
    }
    let cancelled = false;
    fetchLoadStats().then((result) => {
      if (!cancelled && result.ok) setStats(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const startCreate = () => {
    if (!isAdmin) {
      notify('Log in as an admin to create leagues', 'error');
      openLogin();
      return;
    }
    onCreate();
  };

  const shortcut = demoLeague ?? (leagues.length > 0 ? leagues[0] : null);

  return (
    <section className="section active" id="home">
      <div className="hero">
        <h1 className="app-title">
          League <span>Arena</span>
        </h1>
        <p className="sub">Manage your football leagues with clarity and ease.</p>

        <div className="home-actions">
          <button type="button" className={`home-action-card${isAdmin ? '' : ' disabled'}`} onClick={startCreate}>
            <PlusCircle size={38} />
            <h3>Create League</h3>
            <p>Set up a new league with custom teams</p>
          </button>
          <button type="button" className="home-action-card" onClick={onLeagues}>
            <List size={38} />
            <h3>My Leagues</h3>
            <p>View and manage your existing leagues</p>
          </button>
        </div>

        {shortcut && (
          <div className="install-card" style={{ borderStyle: 'solid' }}>
            <span className="icon">
              <Trophy size={20} />
            </span>
            <div>
              <h4>{shortcut.name}</h4>
              <p>
                {shortcut.teams.length} teams ·{' '}
                {demoLeague ? 'sample season — explore standings & fixtures' : 'jump back into the table'}
              </p>
            </div>
            <button type="button" className="btn btn-secondary" onClick={() => onOpenLeague(shortcut.id)}>
              Open
            </button>
          </div>
        )}

        {pwa.canInstall && (
          <div className="install-card">
            <span className="icon">
              <Smartphone size={20} />
            </span>
            <div>
              <h4>Install League Arena</h4>
              <p>Add it to your home screen and run it full screen, even offline.</p>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => void pwa.install()}>
              <Download size={15} /> Install
            </button>
          </div>
        )}

        {pwa.needsManualInstall && !pwa.canInstall && (
          <div className="install-card">
            <span className="icon">
              <Smartphone size={20} />
            </span>
            <div>
              <h4>Install on iPhone or iPad</h4>
              <p>Tap the Share button, then “Add to Home Screen” to keep League Arena one tap away.</p>
            </div>
          </div>
        )}

        <div className="features">
          <div className="feature-item">
            <Trophy size={22} />
            <h4>Winners &amp; Relegation</h4>
            <p>Set how many teams win and go down — highlighted at a glance.</p>
          </div>
          <div className="feature-item">
            <CalendarDays size={22} />
            <h4>Full Fixtures</h4>
            <p>Round-robin schedule with live score entry and standings update.</p>
          </div>
          <div className="feature-item">
            <Database size={22} />
            <h4>Backup &amp; Restore</h4>
            <p>Export or import your league data in one click.</p>
          </div>
        </div>
      </div>

      {isAdmin && (
        <div className="stats-card">
          <h3 className="stats-title">
            <TrendingUp size={20} /> Cloud Load Activity (Last 7 Days)
          </h3>
          {stats ? (
            <div className="chart" role="img" aria-label="Cloud loads per day for the last seven days">
              {stats.labels.map((label, index) => {
                const max = Math.max(1, ...stats.counts);
                const height = Math.max(4, Math.round((stats.counts[index] / max) * 160));
                return (
                  <div className="chart-col" key={`${label}-${index}`}>
                    <span className="chart-value">{stats.counts[index]}</span>
                    <div className="chart-bar" style={{ height }} />
                    <span className="chart-label">{label}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="info-text">
              <ShieldCheck size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
              Analytics appear here once cloud loads are recorded.
            </p>
          )}
        </div>
      )}

      <div className="legend" style={{ marginTop: 28 }}>
        <span>
          <ArrowDown size={13} /> Win = 3 pts · Draw = 1 pt
        </span>
        <span>Goal difference → goals scored → head-to-head</span>
      </div>
    </section>
  );
}
