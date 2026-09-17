import React, { useState, useEffect, useMemo } from 'react';
import '../Parlay.css';
import { useSeason } from '../hooks/useSeason';
import { currentWeek, weekLabel } from '../utils/week';
import { calculateParlayOdds } from '../utils/parlay-odds';
import type { NflGame } from '../types/nfl';

// Re-export for external consumers
export { calculateParlayOdds };

interface WinnerSelection {
  gameId: string | undefined;
  team: string;
}

function Parlay() {
  const { season, games, loading } = useSeason();
  const [selectedWinners, setSelectedWinners] = useState<Array<WinnerSelection | null>>([]);
  const [week, setWeek] = useState<number>(() => currentWeek(games));

  useEffect(() => {
    setWeek(currentWeek(games));
    setSelectedWinners([]);
  }, [season, games]);

  const weekGames = useMemo(
    () => games.filter((g) => g.Week === week),
    [games, week],
  );

  const parlayOdds = useMemo(
    () => calculateParlayOdds(selectedWinners, week, games),
    [selectedWinners, week, games],
  );

  if (loading) {
    return (
      <div className="parley">
        <h1>Loading NFL data...</h1>
      </div>
    );
  }

  const handleWinnerSelection = (
    gameId: string | undefined,
    team: string,
    index: number,
  ) => {
    setSelectedWinners((prev) => {
      const updated = [...prev];
      updated[index] =
        updated[index]?.team === team ? null : { gameId, team };
      return updated;
    });
  };

  return (
    <div className="parley">
      <h1>{weekLabel(week)}</h1>
      <h3>Selected Winners:</h3>
      <ul className="selected-winners">
        {selectedWinners
          .filter((s): s is WinnerSelection => s != null)
          .map((selection, index) => (
            <li key={index}>{selection.team}</li>
          ))}
      </ul>
      <h3>Fair Odds: {parlayOdds}</h3>
      <div className="parley-container">
        <table className="games-table">
          <tbody>
            {weekGames.map((game, index) => (
              <tr key={index}>
                <td className="left-column">
                  <input
                    type="checkbox"
                    value={game.Away}
                    onChange={() => handleWinnerSelection(game.id, game.Away, index)}
                    checked={
                      !!(
                        selectedWinners[index] &&
                        selectedWinners[index]?.gameId === game.id &&
                        selectedWinners[index]?.team === game.Away
                      )
                    }
                  />
                  <img
                    className="team-logo"
                    src={require(`../logosnfl/${game.Away}.png`)}
                    alt={`${game.Away} Logo`}
                  />
                  {game.Away}
                </td>
                <td className="separator">@</td>
                <td className="right-column">
                  <img
                    className="team-logo"
                    src={require(`../logosnfl/${game.Home}.png`)}
                    alt={`${game.Home} Logo`}
                  />
                  {game.Home}
                  <input
                    type="checkbox"
                    value={game.Home}
                    onChange={() => handleWinnerSelection(game.id, game.Home, index)}
                    checked={
                      !!(
                        selectedWinners[index] &&
                        selectedWinners[index]?.gameId === game.id &&
                        selectedWinners[index]?.team === game.Home
                      )
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Parlay;
