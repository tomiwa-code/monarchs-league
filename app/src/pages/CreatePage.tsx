import { useMemo, useState } from 'react';
import { ArrowDown, ArrowLeft, Dices, Pencil, PlusCircle, RotateCw, Trophy } from 'lucide-react';
import { useApp } from '../state/store';
import { MAX_TEAMS, MIN_TEAMS, parseTeamNames, shuffle } from '../lib/league';

const PREMIER_LEAGUE_TEAMS = `Arsenal
Aston Villa
Bournemouth
Brentford
Brighton
Burnley
Chelsea
Crystal Palace
Everton
Fulham
Liverpool
Luton Town
Manchester City
Manchester United
Newcastle United
Nottingham Forest
Sheffield United
Tottenham Hotspur
West Ham United
Wolverhampton Wanderers`;

interface CreatePageProps {
  onBack: () => void;
  onCreated: (id: number) => void;
}

export function CreatePage({ onBack, onCreated }: CreatePageProps) {
  const { createLeague, notify } = useApp();
  const [name, setName] = useState('Premier League');
  const [teamCount, setTeamCount] = useState(20);
  const [winners, setWinners] = useState(1);
  const [relegation, setRelegation] = useState(3);
  const [mode, setMode] = useState<'custom' | 'random'>('custom');
  const [namesText, setNamesText] = useState(PREMIER_LEAGUE_TEAMS);
  const [shuffled, setShuffled] = useState<string[]>([]);
  const [error, setError] = useState('');

  const customNames = useMemo(() => parseTeamNames(namesText), [namesText]);

  const randomPool = useMemo(() => {
    const base = customNames.length > 0 ? customNames : PREMIER_LEAGUE_TEAMS.split('\n');
    const list = [...base];
    while (list.length < teamCount) list.push(`Team ${list.length + 1}`);
    return list.slice(0, teamCount);
  }, [customNames, teamCount]);

  const randomPreview = shuffled.length === teamCount ? shuffled : randomPool;

  const reshuffle = () => setShuffled(shuffle(randomPool));

  const pickMode = (next: 'custom' | 'random') => {
    setMode(next);
    if (next === 'random') setShuffled(shuffle(randomPool));
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Give the league a name');
      return;
    }
    if (teamCount % 2 !== 0) {
      setError('Number of teams must be even so everyone plays each week');
      return;
    }
    if (winners + relegation > teamCount) {
      setError(`Winners + relegation cannot exceed ${teamCount} teams`);
      return;
    }

    let teams: string[];
    if (mode === 'custom') {
      teams = [...customNames];
      if (teams.length !== teamCount) {
        setError(`You listed ${teams.length} team${teams.length === 1 ? '' : 's'} but selected ${teamCount}`);
        return;
      }
      if (new Set(teams).size !== teams.length) {
        setError('Team names must be unique');
        return;
      }
    } else {
      teams = [...randomPreview];
    }

    setError('');
    const league = createLeague({
      name: trimmed,
      teams,
      winnersCount: winners,
      relegationCount: relegation,
      distribution: mode,
    });
    notify(`${league.name} created`);
    onCreated(league.id);
  };

  return (
    <section className="section active" id="create">
      <button type="button" className="back-btn" onClick={onBack}>
        <ArrowLeft size={15} /> Home
      </button>

      <h2 className="section-title">
        <PlusCircle size={22} /> Create League
      </h2>

      <form className="form-card" onSubmit={submit}>
        <div className="form-group">
          <label htmlFor="league-name">League name</label>
          <input
            id="league-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Premier League"
          />
        </div>

        <div className="form-group">
          <label htmlFor="team-count">Number of teams (even)</label>
          <input
            id="team-count"
            type="number"
            min={MIN_TEAMS}
            max={MAX_TEAMS}
            step={2}
            value={teamCount}
            onChange={(event) => {
              const value = Math.min(MAX_TEAMS, Math.max(MIN_TEAMS, Number(event.target.value) || MIN_TEAMS));
              setTeamCount(value);
              setShuffled([]);
            }}
          />
          <p className="info-text">Must be even so every team has an opponent each week.</p>
        </div>

        <div className="field-row">
          <div className="form-group">
            <label htmlFor="winners">
              <Trophy size={13} className="label-icon" style={{ color: '#4ade80' }} /> Winners
            </label>
            <input
              id="winners"
              type="number"
              min={0}
              max={10}
              value={winners}
              onChange={(event) => setWinners(Math.max(0, Math.min(10, Number(event.target.value) || 0)))}
            />
            <p className="info-text">Top teams highlighted in green.</p>
          </div>
          <div className="form-group">
            <label htmlFor="relegation">
              <ArrowDown size={13} style={{ color: '#f87171' }} /> Relegation
            </label>
            <input
              id="relegation"
              type="number"
              min={0}
              max={10}
              value={relegation}
              onChange={(event) => setRelegation(Math.max(0, Math.min(10, Number(event.target.value) || 0)))}
            />
            <p className="info-text">Bottom teams highlighted in red.</p>
          </div>
        </div>

        <div className="form-group">
          <label>Team distribution</label>
          <div className="distribution-options">
            <div
              className={`distribution-option${mode === 'custom' ? ' selected' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => pickMode('custom')}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  pickMode('custom');
                }
              }}
            >
              <Pencil size={22} />
              <h3>Custom</h3>
              <p>Enter your own names</p>
            </div>
            <div
              className={`distribution-option${mode === 'random' ? ' selected' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => pickMode('random')}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  pickMode('random');
                }
              }}
            >
              <Dices size={22} />
              <h3>Randomize</h3>
              <p>Shuffle the list</p>
            </div>
          </div>
        </div>

        {mode === 'custom' ? (
          <div className="form-group">
            <label htmlFor="team-names">Team names (one per line)</label>
            <textarea
              id="team-names"
              value={namesText}
              onChange={(event) => setNamesText(event.target.value)}
              placeholder="Enter team names, one per line"
              spellCheck={false}
            />
            <p className="info-text">
              {customNames.length} names listed · must match the number of teams above.
            </p>
          </div>
        ) : (
          <div className="form-group">
            <label>Shuffled teams</label>
            <div className="team-names-box">
              <div className="team-list">
                {randomPreview.map((team, index) => (
                  <div key={`${team}-${index}`}>
                    <span className="index">{index + 1}</span>
                    {team}
                  </div>
                ))}
              </div>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-block"
              style={{ marginTop: 12 }}
              onClick={reshuffle}
            >
              <RotateCw size={16} /> Shuffle Again
            </button>
          </div>
        )}

        {error && <p className="error-text">{error}</p>}

        <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 16 }}>
          <PlusCircle size={18} /> Create League
        </button>
      </form>
    </section>
  );
}
