import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import {
  DEFAULT_SEASON,
  LIVE_SEASON,
  isSeason,
  seasonData,
} from '../data/nflSeasons';
import type { NflGame, Season } from '../types/nfl';

export interface UseSeasonResult {
  season: Season;
  setSeason: (season: Season) => void;
  games: NflGame[];
  loading: boolean;
  stale: boolean;
}

export function useSeason(): UseSeasonResult {
  const [searchParams, setSearchParams] = useSearchParams();
  const [liveGames, setLiveGames] = useState<NflGame[] | null>(null);
  const [liveFetchDone, setLiveFetchDone] = useState(false);
  const [liveFetchFailed, setLiveFetchFailed] = useState(false);

  const season: Season = useMemo(() => {
    const raw = searchParams.get('season');
    if (raw == null) return DEFAULT_SEASON;
    const parsed = Number(raw);
    return isSeason(parsed) ? parsed : DEFAULT_SEASON;
  }, [searchParams]);

  const setSeason = useCallback(
    (next: Season) => {
      const params = new URLSearchParams(searchParams);
      params.set('season', String(next));
      setSearchParams(params, { replace: false });
    },
    [searchParams, setSearchParams],
  );

  useEffect(() => {
    if (season !== LIVE_SEASON) return;

    let cancelled = false;
    setLiveFetchFailed(false);

    const fetchLiveSeason = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'nfl_2026', 'current'));
        if (!cancelled && docSnap.exists()) {
          const data = docSnap.data();
          if (Array.isArray(data.matches)) {
            setLiveGames(data.matches as NflGame[]);
          }
        }
      } catch (err) {
        // Falls back to the statically bundled season data below.
        console.error('Error fetching live NFL data:', err);
        if (!cancelled) setLiveFetchFailed(true);
      } finally {
        if (!cancelled) setLiveFetchDone(true);
      }
    };

    fetchLiveSeason();
    return () => {
      cancelled = true;
    };
  }, [season]);

  const loading = season === LIVE_SEASON && !liveFetchDone;
  const games =
    season === LIVE_SEASON && liveGames ? liveGames : seasonData[season];
  const stale = season === LIVE_SEASON && liveFetchFailed;

  return { season, setSeason, games, loading, stale };
}
