import type { NflGame } from '../types/nfl';

// Note: Due to Jest's module resolution limitations with react-router-dom in react-scripts v5,
// we import from the utility file. The function is re-exported from './Parlay' for normal
// usage, but tests can safely import from the utility to avoid dependency loading issues.
// In actual application code, users would: import { calculateParlayOdds } from './Parlay';
import { calculateParlayOdds } from '../utils/parlay-odds';

// Helper function to create minimal NflGame fixtures
const createGame = (
  week: number,
  away: string,
  home: string,
  probA: number | null = null,
  probH: number | null = null,
  id?: string,
): NflGame => ({
  Week: week,
  Day: 'Monday',
  Date: '2025-01-01',
  Time: '8:00',
  Home: home,
  Away: away,
  ScoreH: null,
  ScoreA: null,
  ElopreH: 1500,
  ElopreA: 1500,
  ElopostH: null,
  ElopostA: null,
  probH,
  probA,
  eloSpread: null,
  id: id || `${week}_${away}_${home}`,
});

describe('calculateParlayOdds', () => {
  describe('no selections', () => {
    it('returns null when selectedWinners is empty', () => {
      const schedule: NflGame[] = [
        createGame(1, 'KC', 'SF', 0.55, 0.45),
      ];
      const result = calculateParlayOdds([], 1, schedule);
      expect(result).toBeNull();
    });

    it('returns null when selectedWinners contains only null', () => {
      const schedule: NflGame[] = [
        createGame(1, 'KC', 'SF', 0.55, 0.45),
      ];
      const result = calculateParlayOdds([null, null], 1, schedule);
      expect(result).toBeNull();
    });
  });

  describe('single selection with known probabilities', () => {
    it('calculates correct American odds for away team (probA = 0.55)', () => {
      const schedule: NflGame[] = [
        createGame(1, 'KC', 'SF', 0.55, 0.45),
      ];
      const selections = [
        { gameId: '1_KC_SF', team: 'KC' },
      ];
      const result = calculateParlayOdds(selections, 1, schedule);
      // odds = 0.55, odds > 0.5 so: americanOdds = -(0.55 * 100) / (1 - 0.55) = -55 / 0.45 ≈ -122.222
      // Math.round(-122.222) = -122
      expect(result).toBe('-122');
    });

    it('calculates correct American odds for home team (probH = 0.60)', () => {
      const schedule: NflGame[] = [
        createGame(1, 'KC', 'SF', 0.40, 0.60),
      ];
      const selections = [
        { gameId: '1_KC_SF', team: 'SF' },
      ];
      const result = calculateParlayOdds(selections, 1, schedule);
      // odds = 0.60, odds > 0.5 so: americanOdds = -(0.60 * 100) / (1 - 0.60) = -60 / 0.40 = -150
      // Math.round(-150) = -150
      expect(result).toBe('-150');
    });

    it('calculates correct American odds for underdog (probA = 0.35)', () => {
      const schedule: NflGame[] = [
        createGame(1, 'JAX', 'NE', 0.35, 0.65),
      ];
      const selections = [
        { gameId: '1_JAX_NE', team: 'JAX' },
      ];
      const result = calculateParlayOdds(selections, 1, schedule);
      // odds = 0.35, odds <= 0.5 so: americanOdds = (100 / 0.35) - 100 = 285.714... - 100 = 185.714...
      // Math.round(185.714) = 186
      expect(result).toBe('+186');
    });
  });

  describe('selection with non-matching team', () => {
    it('treats non-matching selection as odds = 1 (ignored)', () => {
      const schedule: NflGame[] = [
        createGame(1, 'KC', 'SF', 0.55, 0.45),
      ];
      const selections = [
        { gameId: '1_XXX', team: 'BAD' },
      ];
      const result = calculateParlayOdds(selections, 1, schedule);
      // No game found for 'BAD', odds stays 1, returns null
      expect(result).toBeNull();
    });

    it('finds game by team name even if gameId does not match', () => {
      const schedule: NflGame[] = [
        createGame(1, 'KC', 'SF', 0.55, 0.45, 'game_123'),
      ];
      const selections = [
        { gameId: 'wrong_id', team: 'KC' },
      ];
      const result = calculateParlayOdds(selections, 1, schedule);
      // Game is found by week and team name (KC), gameId is not checked in the function
      // odds = 0.55
      expect(result).toBe('-122');
    });

    it('returns null when game is in different week', () => {
      const schedule: NflGame[] = [
        createGame(1, 'KC', 'SF', 0.55, 0.45),
      ];
      const selections = [
        { gameId: '1_KC_SF', team: 'KC' },
      ];
      // Looking for week 2, but game is in week 1
      const result = calculateParlayOdds(selections, 2, schedule);
      expect(result).toBeNull();
    });
  });

  describe('multiple selections - odds multiplication', () => {
    it('multiplies odds for two selections (0.6 * 0.7)', () => {
      const schedule: NflGame[] = [
        createGame(1, 'KC', 'SF', 0.6, 0.4),
        createGame(1, 'TB', 'DAL', 0.3, 0.7),
      ];
      const selections = [
        { gameId: '1_KC_SF', team: 'KC' },
        { gameId: '1_TB_DAL', team: 'DAL' },
      ];
      const result = calculateParlayOdds(selections, 1, schedule);
      // odds = 0.6 * 0.7 = 0.42
      // odds <= 0.5 so: americanOdds = (100 / 0.42) - 100 = 238.095... - 100 = 138.095...
      // Math.round(138.095) = 138
      expect(result).toBe('+138');
    });

    it('multiplies odds for three selections (0.5 * 0.5 * 0.5)', () => {
      const schedule: NflGame[] = [
        createGame(1, 'KC', 'SF', 0.5, 0.5),
        createGame(1, 'TB', 'DAL', 0.5, 0.5),
        createGame(1, 'LV', 'PHI', 0.5, 0.5),
      ];
      const selections = [
        { gameId: '1_KC_SF', team: 'KC' },
        { gameId: '1_TB_DAL', team: 'TB' },
        { gameId: '1_LV_PHI', team: 'LV' },
      ];
      const result = calculateParlayOdds(selections, 1, schedule);
      // odds = 0.5 * 0.5 * 0.5 = 0.125
      // odds <= 0.5 so: americanOdds = (100 / 0.125) - 100 = 800 - 100 = 700
      expect(result).toBe('+700');
    });

    it('handles mix of null and non-null selections', () => {
      const schedule: NflGame[] = [
        createGame(1, 'KC', 'SF', 0.6, 0.4),
        createGame(1, 'TB', 'DAL', 0.3, 0.7),
      ];
      const selections = [
        { gameId: '1_KC_SF', team: 'KC' },
        null,
        { gameId: '1_TB_DAL', team: 'DAL' },
      ];
      const result = calculateParlayOdds(selections, 1, schedule);
      // odds = 0.6 * 0.7 = 0.42
      expect(result).toBe('+138');
    });

    it('returns null when one selection is unmatched (treated as 1)', () => {
      const schedule: NflGame[] = [
        createGame(1, 'KC', 'SF', 0.6, 0.4),
        createGame(1, 'TB', 'DAL', 0.3, 0.7),
      ];
      const selections = [
        { gameId: '1_KC_SF', team: 'KC' },
        { gameId: 'bad', team: 'BADTEAM' },
      ];
      const result = calculateParlayOdds(selections, 1, schedule);
      // BADTEAM not found, treated as multiplying by 1
      // odds = 0.6 * 1 = 0.6
      // odds > 0.5 so: americanOdds = -(0.6 * 100) / (1 - 0.6) = -60 / 0.4 = -150
      expect(result).toBe('-150');
    });
  });

  describe('edge cases with null probabilities', () => {
    it('skips game if probA is null', () => {
      const schedule: NflGame[] = [
        createGame(1, 'KC', 'SF', null, 0.45),
      ];
      const selections = [
        { gameId: '1_KC_SF', team: 'KC' },
      ];
      const result = calculateParlayOdds(selections, 1, schedule);
      // probA is null, so odds stays 1
      expect(result).toBeNull();
    });

    it('skips game if probH is null', () => {
      const schedule: NflGame[] = [
        createGame(1, 'KC', 'SF', 0.55, null),
      ];
      const selections = [
        { gameId: '1_KC_SF', team: 'SF' },
      ];
      const result = calculateParlayOdds(selections, 1, schedule);
      // probH is null, so odds stays 1
      expect(result).toBeNull();
    });

    it('handles schedule with no games', () => {
      const schedule: NflGame[] = [];
      const selections = [
        { gameId: '1_KC_SF', team: 'KC' },
      ];
      const result = calculateParlayOdds(selections, 1, schedule);
      // No game found, odds stays 1
      expect(result).toBeNull();
    });
  });

  describe('American odds formatting', () => {
    it('includes + sign for positive (underdog) odds', () => {
      const schedule: NflGame[] = [
        createGame(1, 'KC', 'SF', 0.30, 0.70),
      ];
      const selections = [
        { gameId: '1_KC_SF', team: 'KC' },
      ];
      const result = calculateParlayOdds(selections, 1, schedule);
      // odds = 0.30, odds <= 0.5 so: americanOdds = (100 / 0.30) - 100 = 333.333... - 100 = 233.333...
      // Math.round(233.333) = 233
      expect(result).toMatch(/^\+/);
      expect(result).toBe('+233');
    });

    it('does not include sign for negative (favorite) odds', () => {
      const schedule: NflGame[] = [
        createGame(1, 'KC', 'SF', 0.70, 0.30),
      ];
      const selections = [
        { gameId: '1_KC_SF', team: 'KC' },
      ];
      const result = calculateParlayOdds(selections, 1, schedule);
      // odds = 0.70, odds > 0.5 so: americanOdds = -(0.70 * 100) / (1 - 0.70) = -70 / 0.30 = -233.333...
      // Math.round(-233.333) = -233
      expect(result).not.toMatch(/^\+/);
      expect(result).toBe('-233');
    });
  });
});
