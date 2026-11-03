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
// A data source with no scores at all (e.g. a stale bundled fallback
// generated before the season started, never re-run since) can't tell
// "week 1 hasn't been played yet" apart from "we have no idea what's
// been played" — it would otherwise always say week 1, however far the
// season has actually progressed. In that case, fall back to each
// week's game dates instead, so the default still lands near "now".
export function currentWeek(games: NflGame[]): number {
  const weeks = uniqueWeeks(games);
  if (weeks.length === 0) return 1;

  const anyScored = games.some((g) => g.ScoreH != null || g.ScoreA != null);
  if (!anyScored) return currentWeekByDate(games, weeks);

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
