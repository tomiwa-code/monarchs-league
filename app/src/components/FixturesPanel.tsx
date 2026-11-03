import { CheckCircle2, CircleDashed } from 'lucide-react';
import type { Fixture, League } from '../lib/league';

interface FixturesPanelProps {
  league: League;
  week: number;
  editable: boolean;
  onScore: (fixtureId: number, side: 'home' | 'away', value: string) => void;
}

export function FixturesPanel({ league, week, editable, onScore }: FixturesPanelProps) {
  const weekFixtures = league.fixtures.filter((fixture) => fixture.week === week);
  const playedCount = weekFixtures.filter(isPlayed).length;
  const progress = weekFixtures.length === 0 ? 0 : Math.round((playedCount / weekFixtures.length) * 100);

  if (weekFixtures.length === 0) {
    return (
      <div className="empty-state" style={{ padding: 32, marginTop: 20 }}>
        <CircleDashed size={36} />
        <h3>No fixtures for this week</h3>
      </div>
    );
  }

  return (
    <>
      <div className="fixture-progress">
        <span>
          {playedCount}/{weekFixtures.length} played
        </span>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <span>{progress}%</span>
      </div>

      <div className="fixtures-list">
        {weekFixtures.map((fixture) => (
          <article className={`fixture-card${isPlayed(fixture) ? ' played' : ''}`} key={fixture.id}>
            <div className="fixture-teams">
              <div className="fixture-side">
                <div className="name">{fixture.home}</div>
                <div className="role">{isPlayed(fixture) && resultOf(fixture) === 'home' ? 'Winner' : 'Home'}</div>
              </div>

              <div className="score-box">
                {editable ? (
                  <>
                    <input
                      className="score-input"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      enterKeyHint="done"
                      autoComplete="off"
                      aria-label={`${fixture.home} score`}
                      value={fixture.homeScore ?? ''}
                      onChange={(event) => onScore(fixture.id, 'home', digitsOnly(event.target.value))}
                    />
                    <span className="vs">VS</span>
                    <input
                      className="score-input"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      enterKeyHint="done"
                      autoComplete="off"
                      aria-label={`${fixture.away} score`}
                      value={fixture.awayScore ?? ''}
                      onChange={(event) => onScore(fixture.id, 'away', digitsOnly(event.target.value))}
                    />
                  </>
                ) : (
                  <>
                    <span className={`score-readonly${isPlayed(fixture) ? ' filled' : ''}`}>
                      {fixture.homeScore ?? '–'}
                    </span>
                    <span className="vs">VS</span>
                    <span className={`score-readonly${isPlayed(fixture) ? ' filled' : ''}`}>
                      {fixture.awayScore ?? '–'}
                    </span>
                  </>
                )}
              </div>

              <div className="fixture-side">
                <div className="name">{fixture.away}</div>
                <div className="role">{isPlayed(fixture) && resultOf(fixture) === 'away' ? 'Winner' : 'Away'}</div>
              </div>
            </div>
            {isPlayed(fixture) && (
              <CheckCircle2
                size={16}
                aria-label="Result recorded"
                style={{ color: '#4ade80', flex: 'none' }}
              />
            )}
          </article>
        ))}
      </div>
    </>
  );
}

/** Numeric keyboards on some platforms still allow punctuation — keep 2 digits. */
const digitsOnly = (value: string): string => value.replace(/\D/g, '').slice(0, 2);

export const isPlayed = (fixture: Fixture): boolean =>
  fixture.homeScore !== null && fixture.awayScore !== null;

function resultOf(fixture: Fixture): 'home' | 'away' | 'draw' {
  if (fixture.homeScore === null || fixture.awayScore === null) return 'draw';
  if (fixture.homeScore > fixture.awayScore) return 'home';
  if (fixture.homeScore < fixture.awayScore) return 'away';
  return 'draw';
}
