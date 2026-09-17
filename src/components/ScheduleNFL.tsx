import React, { useState, useEffect } from 'react';
import '../App.css';
import { useSeason } from '../hooks/useSeason';
import { currentWeek, uniqueWeeks, weekLabel } from '../utils/week';
import { getNflTeamLogo } from '../utils/teamLogo';
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

function TeamLogoOrFallback({ team }: { team: string }) {
  const logoSrc = getNflTeamLogo(team);
  if (logoSrc) {
    return <img className="team-logo" src={logoSrc} alt={`${team} Logo`} />;
  }
  const initials = team.substring(0, 2).toUpperCase();
  return (
    <div
      className="team-logo"
      style={{
        width: 24,
        height: 24,
        backgroundColor: '#ccc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '10px',
        fontWeight: 'bold',
      }}
      title={team}
    >
      {initials}
    </div>
  );
}

function ScheduleNFL() {
  const { season, setSeason, games, loading } = useSeason();
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
                    <TeamLogoOrFallback team={game.Away} />
                    {game.Away}
                  </td>
                  <td>{calculateWinProbability(game.probA)}</td>
                  <td></td>
                  <td className="score">{game.ScoreA}</td>
                </tr>
                <tr>
                  <td className="team-name">
                    <TeamLogoOrFallback team={game.Home} />
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
