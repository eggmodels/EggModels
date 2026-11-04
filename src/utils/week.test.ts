import { currentWeek, weekLabel } from './week';
import type { NflGame } from '../types/nfl';

// Helper function to create minimal NflGame fixtures
const createGame = (
  week: number,
  scoreH: number | null = null,
  scoreA: number | null = null,
): NflGame => ({
  Week: week,
  Day: 'Monday',
  Date: '2025-01-01',
  Time: '8:00',
  Home: 'HOME',
  Away: 'AWAY',
  ScoreH: scoreH,
  ScoreA: scoreA,
  ElopreH: 1500,
  ElopreA: 1500,
  ElopostH: null,
  ElopostA: null,
  probH: null,
  probA: null,
  eloSpread: null,
});

describe('weekLabel', () => {
  describe('regular season weeks', () => {
    it('returns "Week 1" for week 1', () => {
      expect(weekLabel(1)).toBe('Week 1');
    });

    it('returns "Week 5" for week 5', () => {
      expect(weekLabel(5)).toBe('Week 5');
    });

    it('returns "Week 18" for week 18', () => {
      expect(weekLabel(18)).toBe('Week 18');
    });
  });

  describe('playoff weeks', () => {
    it('returns "Wild Card" for week 19', () => {
      expect(weekLabel(19)).toBe('Wild Card');
    });

    it('returns "Divisional" for week 20', () => {
      expect(weekLabel(20)).toBe('Divisional');
    });

    it('returns "Conf. Championships" for week 21', () => {
      expect(weekLabel(21)).toBe('Conf. Championships');
    });

    it('returns "Super Bowl" for week 22', () => {
      expect(weekLabel(22)).toBe('Super Bowl');
    });
  });

  describe('edge cases', () => {
    it('handles decimal weeks by rounding', () => {
      // The function uses Math.round on the input
      expect(weekLabel(5.4)).toBe('Week 5');
      expect(weekLabel(5.5)).toBe('Week 6');
    });

    it('handles week 0', () => {
      expect(weekLabel(0)).toBe('Week 0');
    });
  });
});

describe('currentWeek', () => {
  describe('basic functionality', () => {
    it('returns first week with unplayed game', () => {
      const games: NflGame[] = [
        // Week 1: all games fully scored
        createGame(1, 20, 17),
        createGame(1, 24, 21),
        // Week 2: has unplayed game
        createGame(2, 30, 27),
        createGame(2, null, null), // This game hasn't been played
      ];

      expect(currentWeek(games)).toBe(2);
    });

    it('returns week 1 when it has unplayed games', () => {
      const games: NflGame[] = [
        createGame(1, 20, null), // Unplayed
        createGame(1, 24, 21),
      ];

      expect(currentWeek(games)).toBe(1);
    });

    it('skips multiple weeks with all games played', () => {
      const games: NflGame[] = [
        // Week 1: all played
        createGame(1, 20, 17),
        createGame(1, 24, 21),
        // Week 2: all played
        createGame(2, 30, 27),
        createGame(2, 35, 31),
        // Week 3: has unplayed game
        createGame(3, null, null),
        createGame(3, 14, 10),
      ];

      expect(currentWeek(games)).toBe(3);
    });
  });

  describe('edge cases', () => {
    it('returns last week when all games are played', () => {
      const games: NflGame[] = [
        // Week 1: all played
        createGame(1, 20, 17),
        // Week 2: all played
        createGame(2, 30, 27),
        // Week 3: all played (last week)
        createGame(3, 14, 10),
      ];

      expect(currentWeek(games)).toBe(3);
    });

    it('returns last week number even when unsorted', () => {
      const games: NflGame[] = [
        // Week 3 before week 1
        createGame(3, 14, 10),
        createGame(1, 20, 17),
        createGame(2, 30, 27),
      ];

      expect(currentWeek(games)).toBe(3);
    });

    it('returns 1 when schedule is empty', () => {
      const games: NflGame[] = [];

      expect(currentWeek(games)).toBe(1);
    });

    it('handles single game that is unplayed', () => {
      const games: NflGame[] = [
        createGame(1, null, null),
      ];

      expect(currentWeek(games)).toBe(1);
    });

    it('handles single game that is played', () => {
      const games: NflGame[] = [
        createGame(1, 20, 17),
      ];

      expect(currentWeek(games)).toBe(1);
    });
  });

  describe('partial scoring scenarios', () => {
    it('considers game unplayed if only scoreH is null', () => {
      const games: NflGame[] = [
        createGame(1, null, 17), // Unplayed (missing ScoreH)
        createGame(2, 30, 27),
      ];

      expect(currentWeek(games)).toBe(1);
    });

    it('considers game unplayed if only scoreA is null', () => {
      const games: NflGame[] = [
        createGame(1, 20, null), // Unplayed (missing ScoreA)
        createGame(2, 30, 27),
      ];

      expect(currentWeek(games)).toBe(1);
    });

    it('considers game unplayed if either score is null', () => {
      const games: NflGame[] = [
        // Week 1: all played
        createGame(1, 20, 17),
        // Week 2: one game has both scores, one doesn't
        createGame(2, 30, 27),
        createGame(2, 35, null), // Unplayed
      ];

      expect(currentWeek(games)).toBe(2);
    });
  });

  describe('trustScores: false (stale bundled fallback snapshot)', () => {
    const createDatedGame = (week: number, date: string): NflGame => ({
      ...createGame(week, null, null),
      Date: date,
    });

    it('falls back to game dates instead of defaulting to week 1', () => {
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;
      const iso = (offsetDays: number) => new Date(now + offsetDays * day).toISOString();

      const games: NflGame[] = [
        createDatedGame(1, iso(-60)), // long past
        createDatedGame(2, iso(-53)),
        // Week 9: Thursday game already happened, Sunday game hasn't yet —
        // the week counts as "current" as long as its last game is ahead.
        createDatedGame(9, iso(-3)),
        createDatedGame(9, iso(1)),
        createDatedGame(10, iso(8)), // upcoming
      ];

      expect(currentWeek(games, false)).toBe(9);
    });

    it('still returns the last week once every date has passed', () => {
      const games: NflGame[] = [
        createDatedGame(1, '2020-01-01'),
        createDatedGame(2, '2020-01-08'),
      ];

      expect(currentWeek(games, false)).toBe(2);
    });

    it('ignores scores entirely when trustScores is false, even if some games have one', () => {
      // Regression: the real bundled nflModel2026.json has a couple of
      // stray/incomplete ScoreH/ScoreA values (e.g. two week-1 primetime
      // games) despite the rest of the season being unplayed in it. A
      // "does anything have a score" heuristic would latch onto those
      // and use the by-score path, landing back on week 1 — trustScores
      // being explicit (set by the caller based on data source, not
      // inferred from the data itself) avoids that trap.
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;
      const iso = (offsetDays: number) => new Date(now + offsetDays * day).toISOString();

      const games: NflGame[] = [
        { ...createGame(1, 13, 10), Date: iso(-60) }, // stray scored game
        { ...createGame(1, 7, 27), Date: iso(-59) }, // stray scored game
        ...Array.from({ length: 13 }, (_, i) => createDatedGame(1, iso(-58))),
        createDatedGame(9, iso(1)),
      ];

      expect(currentWeek(games, false)).toBe(9);
    });
  });

  describe('trustScores: true (default — live or real historical data)', () => {
    it('uses the by-score logic even when every game is unplayed and dated in the past', () => {
      const games: NflGame[] = [
        { ...createGame(1, null, null), Date: '2020-01-01' },
      ];

      // Without an explicit false, trustScores defaults to true: this is
      // what authoritative (live Firestore / real historical) data looks
      // like, so the by-score logic — not the date fallback — applies.
      expect(currentWeek(games)).toBe(1);
    });
  });

  describe('playoff weeks', () => {
    it('returns correct week in playoff scheduling', () => {
      const games: NflGame[] = [
        // Regular season all played
        ...Array.from({ length: 18 }, (_, i) =>
          createGame(i + 1, 20, 17),
        ),
        // Playoff weeks: week 19 all played, week 20 has unplayed
        createGame(19, 31, 30),
        createGame(20, null, null),
      ];

      expect(currentWeek(games)).toBe(20);
    });

    it('returns last playoff week if all are played', () => {
      const games: NflGame[] = [
        // Just the last few weeks
        createGame(20, 28, 21),
        createGame(21, 35, 31),
        createGame(22, 25, 22), // Super Bowl all played
      ];

      expect(currentWeek(games)).toBe(22);
    });
  });
});
