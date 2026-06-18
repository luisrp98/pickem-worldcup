export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  currentPosition: number;
  previousPosition: number | null;
  points: number;
  correctResults: number;
  correctScores: number;
}

export const leaderboard: LeaderboardEntry[] = [];
