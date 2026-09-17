import type { NflGame } from '../types/nfl';

const PLAYOFF_LABELS: Record<number, string> = {
  19: 'Wild Card',
  20: 'Divisional',
  21: 'Conf. Championships',
  22: 'Super Bowl',
};

export function weekLabel(week: number): string {
  return PLAYOFF_LABELS[week] ?? `Week ${Math.round(week)}`;
}

// The week to default to: the earliest week that still has an unplayed
// game, so the view only advances once every game in a week is final
// (not as soon as a single Thursday-night game finishes).
export function currentWeek(games: NflGame[]): number {
  const weeks = uniqueWeeks(games);
  for (const week of weeks) {
    const weekGames = games.filter((g) => g.Week === week);
    const allPlayed = weekGames.every(
      (g) => g.ScoreH != null && g.ScoreA != null,
    );
    if (!allPlayed) return week;
  }
  return weeks.length > 0 ? weeks[weeks.length - 1] : 1;
}

export function uniqueWeeks(games: NflGame[]): number[] {
  return Array.from(new Set(games.map((g) => g.Week)))
    .filter((w): w is number => Number.isFinite(w) && w >= 1)
    .sort((a, b) => a - b);
}
