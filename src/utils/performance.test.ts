import {
  computeNflPerformance,
  computeNflPerformanceBySeason,
  computeNflPerformanceBySpreadBucket,
} from './performance';
import type { NflGame, Season } from '../types/nfl';

const game = (overrides: Partial<NflGame> = {}): NflGame =>
  ({
    Week: 1,
    Day: 'Sunday',
    Date: '2026-09-07',
    Time: '1:00',
    Home: 'KC',
    Away: 'SF',
    ScoreH: null,
    ScoreA: null,
    ElopreH: 1500,
    ElopreA: 1500,
    ElopostH: null,
    ElopostA: null,
    probH: 0.6,
    probA: 0.4,
    eloSpread: -2.5,
    ...overrides,
  }) as NflGame;

describe('computeNflPerformance', () => {
  it('returns null/zero stats when no games are graded yet', () => {
    const stats = computeNflPerformance([game()]);
    expect(stats.gamesGraded).toBe(0);
    expect(stats.accuracy).toBeNull();
  });

  it('counts a pick correct when the favored team (higher prob) wins', () => {
    const stats = computeNflPerformance([
      game({ probH: 0.7, probA: 0.3, ScoreH: 24, ScoreA: 10 }),
    ]);
    expect(stats.gamesGraded).toBe(1);
    expect(stats.picksCorrect).toBe(1);
    expect(stats.accuracy).toBe(1);
  });

  it('counts a pick wrong when the underdog wins', () => {
    const stats = computeNflPerformance([
      game({ probH: 0.7, probA: 0.3, ScoreH: 10, ScoreA: 24 }),
    ]);
    expect(stats.picksCorrect).toBe(0);
    expect(stats.accuracy).toBe(0);
  });

  it('computes the Brier score against the home win probability', () => {
    const stats = computeNflPerformance([
      game({ probH: 0.8, probA: 0.2, ScoreH: 20, ScoreA: 10 }),
    ]);
    expect(stats.brierScore).toBeCloseTo((0.8 - 1) ** 2, 5);
  });

  it('computes spread mean absolute error against the actual margin', () => {
    // eloSpread -10 means home favored by 10; actual home margin is 24-20=4.
    const stats = computeNflPerformance([
      game({ probH: 0.8, probA: 0.2, ScoreH: 24, ScoreA: 20, eloSpread: -10 }),
    ]);
    expect(stats.spreadMae).toBeCloseTo(6, 5);
  });

  it('skips games missing a score or probability', () => {
    const stats = computeNflPerformance([
      game({ ScoreH: null, ScoreA: null }),
      game({ probH: 0.6, probA: 0.4, ScoreH: 10, ScoreA: 7 }),
    ]);
    expect(stats.gamesGraded).toBe(1);
  });
});

describe('computeNflPerformanceBySeason', () => {
  it('grades each season independently', () => {
    const seasons: Season[] = [2025, 2026];
    const seasonGames: Record<Season, NflGame[]> = {
      2023: [],
      2024: [],
      2025: [game({ probH: 0.7, probA: 0.3, ScoreH: 20, ScoreA: 10 })],
      2026: [],
    };

    const result = computeNflPerformanceBySeason(seasonGames, seasons);
    expect(result).toEqual([
      { season: 2025, stats: expect.objectContaining({ gamesGraded: 1, picksCorrect: 1 }) },
      { season: 2026, stats: expect.objectContaining({ gamesGraded: 0 }) },
    ]);
  });
});

describe('computeNflPerformanceBySpreadBucket', () => {
  it('buckets games by the magnitude of the favorite spread and grades each bucket', () => {
    const result = computeNflPerformanceBySpreadBucket([
      // 2-point favorite (home), home wins -> correct, falls in "0-3"
      game({ probH: 0.55, probA: 0.45, eloSpread: -2, ScoreH: 20, ScoreA: 17 }),
      // 12-point favorite (home), home loses -> wrong, falls in "10-14"
      game({ probH: 0.85, probA: 0.15, eloSpread: -12, ScoreH: 10, ScoreA: 24 }),
    ]);

    const small = result.find((r) => r.bucket.label === '0-3');
    const large = result.find((r) => r.bucket.label === '10-14');
    expect(small).toMatchObject({ gamesGraded: 1, picksCorrect: 1, accuracy: 1 });
    expect(large).toMatchObject({ gamesGraded: 1, picksCorrect: 0, accuracy: 0 });

    const untouched = result.find((r) => r.bucket.label === '3-7');
    expect(untouched).toMatchObject({ gamesGraded: 0, accuracy: null });
  });

  it('excludes ungraded games and games with no spread', () => {
    const result = computeNflPerformanceBySpreadBucket([
      game({ ScoreH: null, ScoreA: null }),
      game({ probH: 0.6, probA: 0.4, ScoreH: 20, ScoreA: 10, eloSpread: null }),
    ]);
    expect(result.every((r) => r.gamesGraded === 0)).toBe(true);
  });
});
