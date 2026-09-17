import type { NflGame } from '../types/nfl';

interface WinnerSelection {
  gameId: string | undefined;
  team: string;
}

export function calculateParlayOdds(
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
