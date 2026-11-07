import type { NflGame, Season } from '../types/nfl';

export interface PerformanceStats {
  gamesGraded: number;
  picksCorrect: number;
  accuracy: number | null;
  brierScore: number | null;
  spreadMae: number | null;
  spreadGraded: number;
}

const EMPTY_STATS: PerformanceStats = {
  gamesGraded: 0,
  picksCorrect: 0,
  accuracy: null,
  brierScore: null,
  spreadMae: null,
  spreadGraded: 0,
};

// Only a finished game (both scores recorded) with a model pick can be
// graded against reality — future/in-progress games are excluded.
function isGraded(game: NflGame): boolean {
  return (
    game.ScoreH != null &&
    game.ScoreA != null &&
    game.probH != null &&
    game.probA != null
  );
}

export function computeNflPerformance(games: NflGame[]): PerformanceStats {
  const graded = games.filter(isGraded);
  if (graded.length === 0) return EMPTY_STATS;

  let picksCorrect = 0;
  let brierSum = 0;
  let spreadErrorSum = 0;
  let spreadGraded = 0;

  for (const game of graded) {
    const homeWon = (game.ScoreH as number) > (game.ScoreA as number);
    const homeFavored = (game.probH as number) >= (game.probA as number);
    if (homeFavored === homeWon) picksCorrect += 1;

    // Brier score against the home team's recorded win probability.
    const homeWinOutcome = homeWon ? 1 : 0;
    brierSum += ((game.probH as number) - homeWinOutcome) ** 2;

    if (game.eloSpread != null) {
      const actualMargin = (game.ScoreH as number) - (game.ScoreA as number);
      const predictedMargin = -game.eloSpread;
      spreadErrorSum += Math.abs(actualMargin - predictedMargin);
      spreadGraded += 1;
    }
  }

  return {
    gamesGraded: graded.length,
    picksCorrect,
    accuracy: picksCorrect / graded.length,
    brierScore: brierSum / graded.length,
    spreadMae: spreadGraded > 0 ? spreadErrorSum / spreadGraded : null,
    spreadGraded,
  };
}

export interface SeasonPerformance {
  season: Season;
  stats: PerformanceStats;
}

export function computeNflPerformanceBySeason(
  seasonGames: Record<Season, NflGame[]>,
  seasons: Season[],
): SeasonPerformance[] {
  return seasons.map((season) => ({
    season,
    stats: computeNflPerformance(seasonGames[season] ?? []),
  }));
}

export interface SpreadBucket {
  label: string;
  // Inclusive lower bound, exclusive upper bound, of the favorite's
  // |eloSpread| (points). `null` upper bound means "and up".
  min: number;
  max: number | null;
}

export const SPREAD_BUCKETS: SpreadBucket[] = [
  { label: '0-3', min: 0, max: 3 },
  { label: '3-7', min: 3, max: 7 },
  { label: '7-10', min: 7, max: 10 },
  { label: '10-14', min: 10, max: 14 },
  { label: '14+', min: 14, max: null },
];

export interface SpreadBucketPerformance {
  bucket: SpreadBucket;
  gamesGraded: number;
  picksCorrect: number;
  accuracy: number | null;
}

// Groups graded games by how big a favorite the model's spread made them,
// so Eugenio can see whether the model is more or less reliable on
// near-even games vs. lopsided ones.
export function computeNflPerformanceBySpreadBucket(games: NflGame[]): SpreadBucketPerformance[] {
  const graded = games.filter((g) => isGraded(g) && g.eloSpread != null);

  return SPREAD_BUCKETS.map((bucket) => {
    const inBucket = graded.filter((g) => {
      const magnitude = Math.abs(g.eloSpread as number);
      return magnitude >= bucket.min && (bucket.max == null || magnitude < bucket.max);
    });

    let picksCorrect = 0;
    for (const game of inBucket) {
      const homeWon = (game.ScoreH as number) > (game.ScoreA as number);
      const homeFavored = (game.probH as number) >= (game.probA as number);
      if (homeFavored === homeWon) picksCorrect += 1;
    }

    return {
      bucket,
      gamesGraded: inBucket.length,
      picksCorrect,
      accuracy: inBucket.length > 0 ? picksCorrect / inBucket.length : null,
    };
  });
}
