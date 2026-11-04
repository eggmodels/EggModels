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

// A distinct, catchable rejection reason so callers can tell "the fetch
// itself failed" apart from "the fetch never finished in time" if they
// need to, without this module depending on any particular Error subclass.
export const FETCH_TIMEOUT = Symbol('FETCH_TIMEOUT');

// Races a promise against a timeout, rejecting with FETCH_TIMEOUT if the
// promise hasn't settled in time. Used to stop a hung Firestore read
// (e.g. a blocked long-polling connection, which doesn't always reject on
// its own) from leaving the page silently showing stale data forever with
// no "Showing last saved data" banner to explain why.
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(FETCH_TIMEOUT), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

// Pulls the games array out of the live Firestore doc, or null if the doc
// is missing or doesn't have the shape we expect (e.g. the daily pipeline
// hasn't run yet, or wrote something unexpected). A null here isn't a
// thrown error, but it's just as much a reason to fall back to the
// bundled data and flag it as stale — not silently show the fallback with
// no indication anything's off.
export function parseLiveSeasonDoc(
  exists: boolean,
  data: Record<string, unknown> | undefined,
): NflGame[] | null {
  const matches = exists ? data?.matches : undefined;
  return Array.isArray(matches) ? (matches as NflGame[]) : null;
}
