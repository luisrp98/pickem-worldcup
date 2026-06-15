export interface Prediction {
  score1: number;
  score2: number;
}

export interface MatchPoints {
  points: number;
  resultado: boolean;
  marcador: boolean;
}

export interface ScorableMatch {
  score?: { ft?: [number, number] | null } | null;
}

export interface StoredPrediction extends Prediction {
  matchId: string;
  round: string;
  group: string | null;
  team1: string;
  team2: string;
  kickoffAt: string;
  createdAt: string;
  updatedAt: string;
  points: number | null;
  resultado: boolean | null;
  marcador: boolean | null;
  scoredAt: string | null;
  scoringVersion: number;
}

export const SCORING_VERSION = 1;

export function calculateMatchPoints(
  match: ScorableMatch,
  prediction: Prediction | null | undefined,
): MatchPoints | null {
  if (!match.score?.ft) return null;
  const [real1, real2] = match.score.ft;
  const result = real1 === real2 ? 'draw' : real1 > real2 ? 'home' : 'away';

  if (!prediction) {
    return { points: 0, resultado: false, marcador: false };
  }

  const predResult =
    prediction.score1 === prediction.score2 ? 'draw' : prediction.score1 > prediction.score2 ? 'home' : 'away';

  const resultado = result === predResult;
  const marcador = prediction.score1 === real1 && prediction.score2 === real2;
  const points = (resultado ? 2 : 0) + (marcador ? 5 : 0);
  return { points, resultado, marcador };
}
