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

export function latestPlayedWeek(games: NflGame[]): number {
  const played = games.filter(
    (g) => g.ScoreH != null && g.ScoreA != null && Number.isFinite(g.Week),
  );
  if (played.length > 0) {
    return Math.max(...played.map((g) => g.Week));
  }
  const finite = games.filter((g) => Number.isFinite(g.Week));
  return finite.length > 0 ? Math.max(...finite.map((g) => g.Week)) : 1;
}

export function uniqueWeeks(games: NflGame[]): number[] {
  return Array.from(new Set(games.map((g) => g.Week)))
    .filter((w): w is number => Number.isFinite(w) && w >= 1)
    .sort((a, b) => a - b);
}
