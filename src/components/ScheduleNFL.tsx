import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import '../App.css';
import { useSeason } from '../hooks/useSeason';
import { currentWeek, uniqueWeeks, weekLabel } from '../utils/week';
import { getNflTeamLogo } from '../utils/teamLogo';
import { formatWinProbability, formatSpread } from '../utils/format';
import SeasonSelector from './SeasonSelector';
import type { NflGame } from '../types/nfl';

interface PickInsight {
  home: string;
  away: string;
  tier: string;
  blurb: string;
}

// Insights are rated by TypeSafe once a week (functions/index.js's
// refreshWeeklyPickInsights) rather than on every page load, and written to
// this Firestore doc — so this just reads them, no TypeSafe call per visit.
function usePickInsights(): Record<string, PickInsight> {
  const [insights, setInsights] = useState<Record<string, PickInsight>>({});

  useEffect(() => {
    let cancelled = false;

    getDoc(doc(db, 'nfl_2026', 'pickInsights'))
      .then((snap) => {
        if (cancelled || !snap.exists()) return;
        setInsights((snap.data().insights as Record<string, PickInsight>) || {});
      })
      .catch(() => {
        // Non-essential enhancement — the schedule still renders without it.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return insights;
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
  const { season, setSeason, games, loading, stale, trustScores } = useSeason();
  const [selectedWeek, setSelectedWeek] = useState<number>(() => currentWeek(games, trustScores));

  useEffect(() => {
    setSelectedWeek(currentWeek(games, trustScores));
  }, [season, games, trustScores]);

  const weeks = uniqueWeeks(games);
  const weekGames = games.filter((g: NflGame) => g.Week === selectedWeek);
  const selectedWeekLabel = weekLabel(selectedWeek);
  const pickInsights = usePickInsights();

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
                    <TeamLogoOrFallback team={game.Away} />
                    {game.Away}
                  </td>
                  <td>{formatWinProbability(game.probA)}</td>
                  <td></td>
                  <td className="score">{game.ScoreA}</td>
                </tr>
                <tr>
                  <td className="team-name">
                    <TeamLogoOrFallback team={game.Home} />
                    {game.Home}
                  </td>
                  <td>{formatWinProbability(game.probH)}</td>
                  <td>{formatSpread(game.eloSpread)}</td>
                  <td className="score">{game.ScoreH}</td>
                </tr>
              </tbody>
            </table>
            {pickInsights[`${game.Away}@${game.Home}`] && (
              <p className="pick-insight" style={{ fontSize: '0.85em', color: '#555', margin: '6px 0 0' }}>
                {pickInsights[`${game.Away}@${game.Home}`].blurb}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default ScheduleNFL;
