import React, { useState, useEffect } from 'react';
import '../App.css';
import { useSeason } from '../hooks/useSeason';
import { latestPlayedWeek, uniqueWeeks, weekLabel } from '../utils/week';
import SeasonSelector from './SeasonSelector';
import type { NflGame } from '../types/nfl';

function calculateWinProbability(prob: number | null): string | null {
  if (prob == null) return null;
  return `${(prob * 100).toFixed(2)}%`;
}

function formatSpread(spread: number | null): string | null {
  if (spread == null) return null;
  const rounded = Math.round(Math.abs(spread) * 2) / 2;
  const sign = spread >= 0 ? '+' : '-';
  return `${sign}${rounded}`;
}

function ScheduleNFL() {
  const { season, setSeason, games } = useSeason();
  const [selectedWeek, setSelectedWeek] = useState<number>(() => latestPlayedWeek(games));

  useEffect(() => {
    setSelectedWeek(latestPlayedWeek(games));
  }, [season, games]);

  const weeks = uniqueWeeks(games);
  const weekGames = games.filter((g: NflGame) => g.Week === selectedWeek);
  const selectedWeekLabel = weekLabel(selectedWeek);

  return (
    <div className="nfl-schedule">
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
                  <td>{calculateWinProbability(game.probA)}</td>
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
                  <td>{calculateWinProbability(game.probH)}</td>
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
