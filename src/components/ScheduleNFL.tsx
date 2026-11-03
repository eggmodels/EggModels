import React, { useState, useEffect } from 'react';
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

function usePickInsights(weekGames: NflGame[]): Record<string, PickInsight> {
  const [insights, setInsights] = useState<Record<string, PickInsight>>({});

  useEffect(() => {
    if (weekGames.length === 0) {
      setInsights({});
      return;
    }

    let cancelled = false;
    const games = weekGames.map((g) => ({
      home: g.Home,
      away: g.Away,
      probH: g.probH,
      probA: g.probA,
      eloSpread: g.eloSpread,
    }));

    fetch('https://us-central1-egg-models.cloudfunctions.net/getPickInsights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ games }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('insights fetch failed'))))
      .then((data) => {
        if (cancelled) return;
        const byKey: Record<string, PickInsight> = {};
        (data.insights || []).forEach((insight: PickInsight) => {
          byKey[`${insight.away}@${insight.home}`] = insight;
        });
        setInsights(byKey);
      })
      .catch(() => {
        // Non-essential enhancement — the schedule still renders without it.
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(weekGames.map((g) => g.id))]);

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
  const { season, setSeason, games, loading, stale } = useSeason();
  const [selectedWeek, setSelectedWeek] = useState<number>(() => currentWeek(games));

  useEffect(() => {
    setSelectedWeek(currentWeek(games));
  }, [season, games]);

  const weeks = uniqueWeeks(games);
  const weekGames = games.filter((g: NflGame) => g.Week === selectedWeek);
  const selectedWeekLabel = weekLabel(selectedWeek);
  const pickInsights = usePickInsights(weekGames);

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
