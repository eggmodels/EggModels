import React, { useState, useEffect } from 'react';
import '../App.css';
import { useSeason } from '../hooks/useSeason';
import { currentWeek, uniqueWeeks, weekLabel } from '../utils/week';
import { formatWinProbability, formatSpread } from '../utils/format';
import SeasonSelector from './SeasonSelector';
import type { NflGame } from '../types/nfl';

function ScheduleNFL() {
  const { season, setSeason, games, loading, stale } = useSeason();
  const [selectedWeek, setSelectedWeek] = useState<number>(() => currentWeek(games));

  useEffect(() => {
    setSelectedWeek(currentWeek(games));
  }, [season, games]);

  const weeks = uniqueWeeks(games);
  const weekGames = games.filter((g: NflGame) => g.Week === selectedWeek);
  const selectedWeekLabel = weekLabel(selectedWeek);

  if (loading) {
    return (
      <div className="nfl-schedule">
        <div className="week-selector">
          <label>Loading NFL data...</label>
        </div>
      </div>
    );
  }

  return (
    <div className="nfl-schedule">
      {stale && !loading && (
        <div style={{ background: '#fff3cd', color: '#856404', padding: '6px 12px', fontSize: '0.85em', textAlign: 'center', marginBottom: '12px' }}>
          Showing last saved data — live update failed.
        </div>
      )}
      <div className="week-selector">
        <label>Season&nbsp;</label>
        <SeasonSelector season={season} onSeasonChange={setSeason} />
        <span className="week-select-field">
          <span className="week-select-sizer" aria-hidden="true">
            {selectedWeekLabel}
          </span>
          <select
            className="week-select"
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(parseInt(e.target.value, 10))}
          >
            {weeks.map((week) => (
              <option key={week} value={week}>
                {weekLabel(week)}
              </option>
            ))}
          </select>
        </span>
        <label>Projections</label>
      </div>

      <div className="games-container">
        {weekGames.map((game, index) => (
          <div key={index} className="game-box">
            <table className="game-table">
              <thead>
                <tr>
                  <th>Teams</th>
                  <th>Win%</th>
                  <th>Spread</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="team-name">
                    <img
                      className="team-logo"
                      src={require(`../logosnfl/${game.Away}.png`)}
                      alt={`${game.Away} Logo`}
                    />
                    {game.Away}
                  </td>
                  <td>{formatWinProbability(game.probA)}</td>
                  <td></td>
                  <td className="score">{game.ScoreA}</td>
                </tr>
                <tr>
                  <td className="team-name">
                    <img
                      className="team-logo"
                      src={require(`../logosnfl/${game.Home}.png`)}
                      alt={`${game.Home} Logo`}
                    />
                    {game.Home}
                  </td>
                  <td>{formatWinProbability(game.probH)}</td>
                  <td>{formatSpread(game.eloSpread)}</td>
                  <td className="score">{game.ScoreH}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ScheduleNFL;
