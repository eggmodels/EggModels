import React, { useState, useEffect, useMemo } from 'react';
import '../Parlay.css';
import { useSeason } from '../hooks/useSeason';
import { latestPlayedWeek, weekLabel } from '../utils/week';
import type { NflGame } from '../types/nfl';

interface WinnerSelection {
  gameId: string | undefined;
  team: string;
}

function calculateParlayOdds(
  selectedWinners: Array<WinnerSelection | null>,
  week: number,
  schedule: NflGame[],
): string | null {
  let odds = 1;

  for (const selection of selectedWinners) {
    if (!selection) continue;
    const { team } = selection;
    const game = schedule.find(
      (g) => g.Week === week && (team === g.Away || team === g.Home),
    );
    if (game) {
      const prob = team === game.Away ? game.probA : game.probH;
      if (prob != null) odds *= prob;
    }
  }

  if (odds === 1) return null;

  const americanOdds =
    odds <= 0.5 ? (100 / odds) - 100 : -(odds * 100) / (1 - odds);

  const sign = americanOdds >= 0 ? '+' : '-';
  return sign === '-'
    ? String(Math.round(americanOdds))
    : `${sign}${Math.round(americanOdds)}`;
}

function Parlay() {
  const { season, games } = useSeason();
  const [selectedWinners, setSelectedWinners] = useState<Array<WinnerSelection | null>>([]);
  const [week, setWeek] = useState<number>(() => latestPlayedWeek(games));

  useEffect(() => {
    setWeek(latestPlayedWeek(games));
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
