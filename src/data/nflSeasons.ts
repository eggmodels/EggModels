import s2023 from '../python/nfl_2023/nflModel.json';
import s2024 from '../python/nfl_2024/nflModel2024.json';
import s2025 from '../python/nfl_2025/nflModel2025.json';
import type { NflGame, Season } from '../types/nfl';

export const SEASONS: Season[] = [2023, 2024, 2025];
export const DEFAULT_SEASON: Season = 2025;

export const seasonData: Record<Season, NflGame[]> = {
  2023: s2023 as unknown as NflGame[],
  2024: s2024 as unknown as NflGame[],
  2025: s2025 as unknown as NflGame[],
};

export function isSeason(value: unknown): value is Season {
  return (
    typeof value === 'number' &&
    (SEASONS as number[]).includes(value)
  );
}
