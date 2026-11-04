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
import { isSeasonStale, parseLiveSeasonDoc, selectSeasonGames } from '../utils/liveSeason';
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
        if (cancelled) return;

        const matches = parseLiveSeasonDoc(docSnap.exists(), docSnap.exists() ? docSnap.data() : undefined);
        if (matches) {
          setLiveGames(matches);
        } else {
          console.error('Live NFL data doc missing or malformed:', docSnap.exists() ? docSnap.data() : 'not found');
          setLiveFetchFailed(true);
        }
      } catch (err) {
        // Falls back to the statically bundled season data below.
        console.error('Error fetching live NFL data:', err);
        if (!cancelled) setLiveFetchFailed(true);
      }
    };

    fetchLiveSeason();
    return () => {
      cancelled = true;
    };
  }, [season]);

  // The bundled season JSON (committed at build time) covers the live season
  // too, so it renders immediately; the Firestore read above only refreshes
  // it in the background instead of blocking the page on a network round trip.
  const loading = false;
  const isLiveSeason = season === LIVE_SEASON;
  const games = selectSeasonGames(isLiveSeason, liveGames, seasonData[season]);
  const stale = isSeasonStale(isLiveSeason, liveFetchFailed, liveGames);

  return { season, setSeason, games, loading, stale };
}
