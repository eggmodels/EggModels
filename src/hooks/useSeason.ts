import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  DEFAULT_SEASON,
  isSeason,
  seasonData,
} from '../data/nflSeasons';
import type { NflGame, Season } from '../types/nfl';

export interface UseSeasonResult {
  season: Season;
  setSeason: (season: Season) => void;
  games: NflGame[];
}

export function useSeason(): UseSeasonResult {
  const [searchParams, setSearchParams] = useSearchParams();

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

  const games = seasonData[season];

  return { season, setSeason, games };
}
