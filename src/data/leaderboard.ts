export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  currentPosition: number;
  previousPosition: number | null;
  points: number;
  correctResults: number;
  correctScores: number;
  totalPoints: number;
  groupPoints: number;
  groupCorrectResults: number;
  groupCorrectScores: number;
  groupCurrentPosition: number;
  groupPreviousPosition: number | null;
  knockoutPoints: number;
  knockoutCorrectResults: number;
  knockoutCorrectScores: number;
  knockoutCurrentPosition: number;
  knockoutPreviousPosition: number | null;
  crystalBallPoints: number;
  crystalBallCorrectCount: number;
  crystalBallCurrentPosition: number;
}

export const leaderboard: LeaderboardEntry[] = [];
