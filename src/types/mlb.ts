export interface MlbGame {
  date: string;
  season?: number;
  neutral?: number;
  playoff?: string | null;
  team1: string;
  team2: string;
  elo1_pre?: number | null;
  elo2_pre?: number | null;
  elo_prob1: number | null;
  elo_prob2: number | null;
  elo1_post?: number | null;
  elo2_post?: number | null;
  score1: number | null;
  score2: number | null;
}
