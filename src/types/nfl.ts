export interface NflGame {
  Week: number;
  Day: string;
  Date: string;
  Time: string | number;
  Home: string;
  Away: string;
  ScoreH: number | null;
  ScoreA: number | null;
  ElopreH: number;
  ElopreA: number;
  ElopostH: number | null;
  ElopostA: number | null;
  probH: number | null;
  probA: number | null;
  eloSpread: number | null;
  id?: string;
}

export type Season = 2023 | 2024 | 2025;
