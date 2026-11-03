import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  Copy,
  Database,
  Download,
  Edit3,
  Eye,
  History,
  ListOrdered,
  RotateCcw,
  Save,
  Table2,
  Trash2,
  Trophy,
  Upload,
} from 'lucide-react';
import { useApp } from '../state/store';
import { Modal } from '../components/Modal';
import { StandingsTable } from '../components/StandingsTable';
import { FixturesPanel } from '../components/FixturesPanel';
import { normalizeLeague, parseTeamNames, standings, totalWeeks, type League } from '../lib/league';
import { navigate } from '../lib/router';

interface LeagueDetailProps {
  league: League;
  onBack: () => void;
}

type Dialog = 'edit' | 'backup' | 'reset' | 'delete' | null;

export function LeagueDetailPage({ league, onBack }: LeagueDetailProps) {
  const {
    isAdmin,
    updateScore,
    renameTeams,
    deleteLeague,
    setVisibleWeeks,
    replaceLeagues,
    leagues,
    resetFixtures,
    notify,
  } = useApp();

  const weeks = totalWeeks(league.teams.length);
  const publicStart = league.publicVisibleWeekStart || 1;
  const publicEnd = league.publicVisibleWeekEnd || weeks;

  const [tab, setTab] = useState<'table' | 'fixtures'>('table');
  const [week, setWeek] = useState(() => (isAdmin ? 1 : publicStart));
  const [dialog, setDialog] = useState<Dialog>(null);

  /* Movement arrows compare the current standings with the previous render. */
  const snapshot = useMemo(() => {
    const ranks: Record<string, number> = {};
    standings(league).forEach((team, index) => {
      ranks[team.name] = index + 1;
    });
    return ranks;
  }, [league]);
  const previousRanks = useRef<Record<string, number>>({});
  useEffect(() => {
    previousRanks.current = snapshot;
  }, [snapshot]);

  const weekOptions = useMemo(() => Array.from({ length: weeks }, (_, index) => index + 1), [weeks]);
  const selectedWeek = Math.min(Math.max(1, week), Math.max(1, weeks));

  const canSeeWeek = (w: number) => isAdmin || (w >= publicStart && w <= publicEnd);

  const jumpToWeek = (w: number) => {
    if (!canSeeWeek(w)) {
      notify('This week is not publicly available yet', 'error');
      return;
    }
    setWeek(w);
    setTab('fixtures');
  };

  const handleDelete = () => {
    deleteLeague(league.id);
    notify('League deleted', 'info');
    setDialog(null);
    navigate({ name: 'leagues' });
  };

  return (
    <section className="section active" id="league-detail">
      <button type="button" className="back-btn" onClick={onBack}>
        <ArrowLeft size={15} /> Back
      </button>

      <div className="detail-header">
        <span className="eyebrow">
          <CalendarDays size={12} /> {weeks} matchweeks · {league.teams.length} teams
        </span>
      </div>
      <h2 className="section-title">
        <Trophy size={22} /> {league.name}
      </h2>

      {isAdmin && (
        <div className="action-buttons">
          <button type="button" className="btn btn-secondary" onClick={() => setDialog('edit')}>
            <Edit3 size={15} /> Edit Teams
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setDialog('backup')}>
            <Database size={15} /> Backup
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setDialog('reset')}>
            <RotateCcw size={15} /> Reset Season
          </button>
          <button type="button" className="btn btn-danger-outline" onClick={() => setDialog('delete')}>
            <Trash2 size={15} /> Delete
          </button>
        </div>
      )}

      {isAdmin && (
        <div className="visible-week-setting">
          <label htmlFor="week-start">
            <Eye size={13} /> Public weeks
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <select
              id="week-start"
              className="select"
              value={publicStart}
              onChange={(event) => setVisibleWeeks(league.id, Number(event.target.value), publicEnd)}
            >
              {weekOptions.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
            <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>to</span>
            <select
              id="week-end"
              className="select"
              aria-label="Last publicly visible week"
              value={publicEnd}
              onChange={(event) => setVisibleWeeks(league.id, publicStart, Number(event.target.value))}
            >
              {weekOptions.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="tabs" role="tablist" aria-label="League views">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'table'}
          className={`tab-btn${tab === 'table' ? ' active' : ''}`}
          onClick={() => setTab('table')}
        >
          <Table2 size={15} /> Table
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'fixtures'}
          className={`tab-btn${tab === 'fixtures' ? ' active' : ''}`}
          onClick={() => setTab('fixtures')}
        >
          <ListOrdered size={15} /> Fixtures
        </button>
      </div>

      <div className="tab-panel" hidden={tab !== 'table'}>
        <StandingsTable league={league} previousRankings={previousRanks.current} />
        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <button type="button" className="btn btn-secondary" onClick={() => setTab('fixtures')}>
            <CalendarDays size={15} /> View fixtures
          </button>
        </div>
      </div>

      <div className="tab-panel" hidden={tab !== 'fixtures'}>
        <div className="week-selector" role="group" aria-label="Matchweek">
          {weekOptions.map((w) => {
            const visible = canSeeWeek(w);
            return (
              <button
                key={w}
                type="button"
                disabled={!visible}
                className={`week-btn${w === selectedWeek ? ' active' : ''}${
                  !isAdmin && visible ? ' public' : ''
                }`}
                onClick={() => jumpToWeek(w)}
                aria-label={`Matchweek ${w}${visible ? '' : ' (not published)'}`}
              >
                {w}
              </button>
            );
          })}
        </div>

        <p className="fixture-counter">
          Matchweek <strong>{selectedWeek}</strong> of {weeks}
        </p>

        <FixturesPanel
          league={league}
          week={selectedWeek}
          editable={isAdmin}
          onScore={(fixtureId, side, value) => updateScore(league.id, fixtureId, side, value)}
        />

        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 18 }}>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={selectedWeek <= 1}
            onClick={() => setWeek(selectedWeek - 1)}
          >
            <ArrowLeft size={15} /> Previous
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={selectedWeek >= weeks || !canSeeWeek(selectedWeek + 1)}
            onClick={() => setWeek(selectedWeek + 1)}
          >
            Next
          </button>
        </div>
      </div>

      {dialog === 'edit' && (
        <EditTeamsDialog
          league={league}
          onClose={() => setDialog(null)}
          onSave={(names) => {
            if (renameTeams(league.id, names)) setDialog(null);
          }}
        />
      )}

      {dialog === 'backup' && (
        <BackupDialog
          league={league}
          allLeagues={leagues}
          onClose={() => setDialog(null)}
          onRestore={(incoming) => {
            replaceLeagues(incoming);
            setDialog(null);
            const restored = incoming.find((item) => item.name === league.name) ?? incoming[0];
            if (restored) navigate({ name: 'league', id: restored.id });
          }}
        />
      )}

      {dialog === 'reset' && (
        <Modal title="Reset season" icon={<RotateCcw size={18} />} onClose={() => setDialog(null)} narrow>
          <p className="modal-note">
            This clears every recorded score and regenerates the fixture list for all {league.teams.length} teams.
            Team names stay the same.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => {
              resetFixtures(league.id);
              setDialog(null);
            }}
          >
            <RotateCcw size={17} /> Reset all scores
          </button>
        </Modal>
      )}

      {dialog === 'delete' && (
        <Modal title="Delete league" icon={<Trash2 size={18} />} onClose={() => setDialog(null)} narrow>
          <p className="modal-note">
            “{league.name}” and every result in it will be removed. This cannot be undone.
          </p>
          <button type="button" className="btn btn-danger-outline btn-block" onClick={handleDelete}>
            <Trash2 size={17} /> Delete permanently
          </button>
        </Modal>
      )}
    </section>
  );
}

function EditTeamsDialog({
  league,
  onClose,
  onSave,
}: {
  league: League;
  onClose: () => void;
  onSave: (names: string[]) => void;
}) {
  const [text, setText] = useState(league.teams.join('\n'));
  const parsed = parseTeamNames(text);

  return (
    <Modal title="Edit Teams" icon={<Edit3 size={18} />} onClose={onClose}>
      <div className="form-group">
        <label htmlFor="edit-teams">Team names (one per line)</label>
        <textarea
          id="edit-teams"
          value={text}
          onChange={(event) => setText(event.target.value)}
          style={{ minHeight: 260 }}
          spellCheck={false}
        />
        <p className="info-text">
          {parsed.length} of {league.teams.length} teams · renaming keeps every recorded result.
        </p>
      </div>
      <button type="button" className="btn btn-primary btn-block" onClick={() => onSave(parsed)}>
        <Save size={17} /> Save Changes
      </button>
    </Modal>
  );
}

function BackupDialog({
  league,
  allLeagues,
  onClose,
  onRestore,
}: {
  league: League;
  allLeagues: League[];
  onClose: () => void;
  onRestore: (leagues: League[]) => void;
}) {
  const { notify } = useApp();
  const [mode, setMode] = useState<'league' | 'all'>('league');
  const [paste, setPaste] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const payload = mode === 'league' ? [league] : allLeagues;
  const json = JSON.stringify(payload, null, 2);
  const filename = `${(mode === 'league' ? league.name : 'league_arena').replace(/\s+/g, '_').toLowerCase()}_backup.json`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      notify('Backup copied to clipboard');
    } catch {
      notify('Clipboard blocked — download the file instead', 'error');
    }
  };

  const download = () => {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    notify('Backup downloaded');
  };

  const restoreText = (text: string) => {
    try {
      const parsed = JSON.parse(text);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      if (list.length === 0) throw new Error('empty');
      const normalized = list.map((item) => normalizeLeague(item));
      onRestore(normalized);
      notify(`Restored ${normalized.length} ${normalized.length === 1 ? 'league' : 'leagues'}`);
    } catch {
      notify('That does not look like a League Arena backup', 'error');
    }
  };

  return (
    <Modal title="Backup & Restore" icon={<Database size={18} />} onClose={onClose}>
      <div className="form-group">
        <label>What to export</label>
        <div className="distribution-options">
          <div
            className={`distribution-option${mode === 'league' ? ' selected' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => setMode('league')}
            onKeyDown={(event) => event.key === 'Enter' && setMode('league')}
          >
            <Trophy size={20} />
            <h3>This league</h3>
            <p>{league.name}</p>
          </div>
          <div
            className={`distribution-option${mode === 'all' ? ' selected' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => setMode('all')}
            onKeyDown={(event) => event.key === 'Enter' && setMode('all')}
          >
            <Database size={20} />
            <h3>Everything</h3>
            <p>{allLeagues.length} leagues</p>
          </div>
        </div>
      </div>

      <div className="form-group">
        <label>Backup data</label>
        <textarea className="backup-area" readOnly value={json} onFocus={(event) => event.target.select()} />
        <div className="split-buttons">
          <button type="button" className="btn btn-secondary" onClick={() => void copy()}>
            <Copy size={15} /> Copy
          </button>
          <button type="button" className="btn btn-primary" onClick={download}>
            <Download size={15} /> Download
          </button>
        </div>
      </div>

      <div className="divider" />

      <div className="form-group">
        <label htmlFor="restore-file">Restore</label>
        <input
          id="restore-file"
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="file-input"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => restoreText(String(reader.result ?? ''));
            reader.readAsText(file);
          }}
        />
        <textarea
          className="backup-area"
          placeholder="…or paste backup data here"
          value={paste}
          onChange={(event) => setPaste(event.target.value)}
        />
        <button
          type="button"
          className="btn btn-secondary btn-block"
          style={{ marginTop: 8 }}
          disabled={!paste.trim()}
          onClick={() => restoreText(paste)}
        >
          <History size={15} /> Restore pasted data
        </button>
      </div>

      <p className="info-text" style={{ marginTop: 8 }}>
        <Upload size={12} style={{ verticalAlign: -1, marginRight: 4 }} />
        Restoring replaces your current set of leagues on this device.
      </p>
    </Modal>
  );
}
