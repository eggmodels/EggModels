import type { NflGame } from '../types/nfl';

// Pure selection logic for useSeason, split out so it can be unit tested
// without pulling react-router-dom into the test (see Parlay.test.tsx for
// the same workaround — importing it directly fails to resolve under
// react-scripts v5's Jest config).
export function selectSeasonGames(
  isLiveSeason: boolean,
  liveGames: NflGame[] | null,
  fallbackGames: NflGame[],
): NflGame[] {
  return isLiveSeason && liveGames ? liveGames : fallbackGames;
}

export function isSeasonStale(
  isLiveSeason: boolean,
  liveFetchFailed: boolean,
  liveGames: NflGame[] | null,
): boolean {
  return isLiveSeason && liveFetchFailed && !liveGames;
}
