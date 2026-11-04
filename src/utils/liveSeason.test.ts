import { isSeasonStale, parseLiveSeasonDoc, selectSeasonGames } from './liveSeason';
import type { NflGame } from '../types/nfl';

const fallback: NflGame[] = [
  { Week: 1, Home: 'KC', Away: 'SF' } as NflGame,
];
const live: NflGame[] = [
  { Week: 1, Home: 'BUF', Away: 'MIA' } as NflGame,
];

describe('selectSeasonGames', () => {
  it('uses the bundled fallback before the live fetch resolves, so the page never has to wait on it', () => {
    expect(selectSeasonGames(true, null, fallback)).toBe(fallback);
  });

  it('swaps in live games once they arrive', () => {
    expect(selectSeasonGames(true, live, fallback)).toBe(live);
  });

  it('always uses the bundled data for a non-live season', () => {
    expect(selectSeasonGames(false, live, fallback)).toBe(fallback);
  });
});

describe('isSeasonStale', () => {
  it('is not stale while the live fetch is still pending', () => {
    expect(isSeasonStale(true, false, null)).toBe(false);
  });

  it('is stale once the live fetch fails and no live data has ever arrived', () => {
    expect(isSeasonStale(true, true, null)).toBe(true);
  });

  it('is not stale if a previous fetch failure is now followed by live data', () => {
    expect(isSeasonStale(true, true, live)).toBe(false);
  });

  it('is never stale for a non-live season', () => {
    expect(isSeasonStale(false, true, null)).toBe(false);
  });
});

describe('parseLiveSeasonDoc', () => {
  it('returns the matches array from a well-formed doc', () => {
    expect(parseLiveSeasonDoc(true, { matches: live })).toEqual(live);
  });

  it('returns null when the doc does not exist', () => {
    expect(parseLiveSeasonDoc(false, undefined)).toBeNull();
  });

  it('returns null when the doc exists but has no matches field', () => {
    expect(parseLiveSeasonDoc(true, {})).toBeNull();
  });

  it('returns null when matches is not an array (e.g. malformed write)', () => {
    expect(parseLiveSeasonDoc(true, { matches: 'not-an-array' })).toBeNull();
  });
});
