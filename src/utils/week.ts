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
//
// `trustScores` should be false for a data source that isn't kept in
// sync with the real season (e.g. the bundled fallback JSON, generated
// once and never re-run with results) — its ScoreH/ScoreA can't be
// trusted to reflect what's actually been played, even where a few
// happen to be non-null (a stray/incomplete write is enough to fool a
// "does anything have a score" check: the earliest week with a gap
// then wins, which can be week 1 even deep into the season). In that
// case, fall back to each week's game dates instead, so the default
// still lands near "now".
export function currentWeek(games: NflGame[], trustScores = true): number {
  const weeks = uniqueWeeks(games);
  if (weeks.length === 0) return 1;

  if (!trustScores) return currentWeekByDate(games, weeks);

  for (const week of weeks) {
    const weekGames = games.filter((g) => g.Week === week);
    const allPlayed = weekGames.every(
      (g) => g.ScoreH != null && g.ScoreA != null,
    );
    if (!allPlayed) return week;
  }
  return weeks[weeks.length - 1];
}

function currentWeekByDate(games: NflGame[], weeks: number[]): number {
  const now = Date.now();
  for (const week of weeks) {
    const weekGames = games.filter((g) => g.Week === week);
    const latestKickoff = Math.max(
      ...weekGames.map((g) => new Date(g.Date).getTime()),
    );
    if (Number.isNaN(latestKickoff) || latestKickoff >= now) return week;
  }
  return weeks[weeks.length - 1];
}

export function uniqueWeeks(games: NflGame[]): number[] {
  return Array.from(new Set(games.map((g) => g.Week)))
    .filter((w): w is number => Number.isFinite(w) && w >= 1)
    .sort((a, b) => a - b);
}
