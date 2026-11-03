import { standings, type League, type TeamRow } from '../lib/league';

interface StandingsTableProps {
  league: League;
  previousRankings: Record<string, number>;
}

const FORM_ORDER = 5;

export function StandingsTable({ league, previousRankings }: StandingsTableProps) {
  const rows = standings(league);
  const { winnersCount, relegationCount } = league;

  return (
    <>
      <div className="table-card">
        <table className="standings">
          <thead>
            <tr>
              <th className="pos">Pos</th>
              <th>Team</th>
              <th className="num">P</th>
              <th className="num">W</th>
              <th className="num">D</th>
              <th className="num">L</th>
              <th className="num">GF</th>
              <th className="num">GA</th>
              <th className="num">GD</th>
              <th className="num">Pts</th>
              <th>Form</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((team, index) => {
              const pos = index + 1;
              const isWinner = winnersCount > 0 && pos <= winnersCount;
              const isRelegated = relegationCount > 0 && pos > rows.length - relegationCount;
              return (
                <tr
                  key={team.name}
                  className={isWinner ? 'winner' : isRelegated ? 'relegation' : undefined}
                >
                  <td className="pos">{pos}</td>
                  <td>
                    <span className="team-name">
                      <span className={`movement ${movementClass(pos, previousRankings[team.name])}`}>
                        {movementGlyph(pos, previousRankings[team.name])}
                      </span>
                      <span className="pos-marker" aria-hidden="true" />
                      {team.name}
                    </span>
                  </td>
                  <td className="num">{team.played}</td>
                  <td className="num">{team.wins}</td>
                  <td className="num">{team.draws}</td>
                  <td className="num">{team.losses}</td>
                  <td className="num">{team.gf}</td>
                  <td className="num">{team.ga}</td>
                  <td className="num">
                    {team.gd > 0 ? '+' : ''}
                    {team.gd}
                  </td>
                  <td className="num points">{team.points}</td>
                  <td>
                    <FormBadges form={team.form} label={team.name} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="legend">
        {winnersCount > 0 && (
          <span>
            <i className="win-dot" /> Winners ({winnersCount})
          </span>
        )}
        {relegationCount > 0 && (
          <span>
            <i className="rel-dot" /> Relegation ({relegationCount})
          </span>
        )}
        <span>Win 3 · Draw 1 · Loss 0</span>
      </div>
    </>
  );
}

function FormBadges({ form, label }: { form: TeamRow['form']; label: string }) {
  const padded = [...form, ...Array(Math.max(0, FORM_ORDER - form.length)).fill(null)];
  return (
    <div className="form-badges" aria-label={`Recent form for ${label}`}>
      {padded.map((result, index) => (
        <span
          key={index}
          className={`form-badge ${
            result === 'W' ? 'win' : result === 'D' ? 'draw' : result === 'L' ? 'loss' : 'empty'
          }`}
        >
          {result ?? ''}
        </span>
      ))}
    </div>
  );
}

function movementClass(current: number, previous?: number) {
  if (previous === undefined || previous === current) return '';
  return current < previous ? 'up' : 'down';
}

function movementGlyph(current: number, previous?: number) {
  if (previous === undefined || previous === current) return '–';
  return current < previous ? '▲' : '▼';
}
