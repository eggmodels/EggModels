import s2023 from '../python/nfl_2023/nflModel.json';
import s2024 from '../python/nfl_2024/nflModel2024.json';
import s2025 from '../python/nfl_2025/nflModel2025.json';
import s2026 from '../python/nfl_2026/nflModel2026.json';
import type { NflGame, Season } from '../types/nfl';

export const SEASONS: Season[] = [2023, 2024, 2025, 2026];

// The season still being played. Its data comes live from the
// nfl_pipeline Cloud Function (Firestore doc nfl_2026/current) via
// useSeason, with the statically bundled JSON below only as a fallback
// while that fetch is loading or if it fails.
export const LIVE_SEASON: Season = 2026;
export const DEFAULT_SEASON: Season = LIVE_SEASON;

export const seasonData: Record<Season, NflGame[]> = {
  2023: s2023 as unknown as NflGame[],
  2024: s2024 as unknown as NflGame[],
  2025: s2025 as unknown as NflGame[],
  2026: s2026 as unknown as NflGame[],
};

export function isSeason(value: unknown): value is Season {
  return (
    typeof value === 'number' &&
    (SEASONS as number[]).includes(value)
  );
}
