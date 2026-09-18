import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import mlbScheduleData from '../python/mlb_2024/csv/mlb-elo-2024.json';
import type { MlbGame } from '../types/mlb';

export interface UseMlbScheduleResult {
  games: MlbGame[];
  loading: boolean;
  stale: boolean;
}

const fallbackGames = mlbScheduleData as MlbGame[];

export function useMlbSchedule(): UseMlbScheduleResult {
  const [liveGames, setLiveGames] = useState<MlbGame[] | null>(null);
  const [liveFetchDone, setLiveFetchDone] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchLiveSchedule = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'mlb_2026', 'current'));
        if (!cancelled && docSnap.exists()) {
          const data = docSnap.data();
          if (Array.isArray(data.matches) && data.matches.length > 0) {
            setLiveGames(data.matches as MlbGame[]);
          }
        }
      } catch (err) {
        // Falls back to the bundled 2024 season data below.
        console.error('Error fetching live MLB data:', err);
      } finally {
        if (!cancelled) setLiveFetchDone(true);
      }
    };

    fetchLiveSchedule();
    return () => {
      cancelled = true;
    };
  }, []);

  const loading = !liveFetchDone;
  const usingLive = liveGames != null && liveGames.length > 0;

  return {
    games: usingLive ? (liveGames as MlbGame[]) : fallbackGames,
    loading,
    stale: liveFetchDone && !usingLive,
  };
}
