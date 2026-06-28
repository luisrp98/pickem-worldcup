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
  group?: string | null;
  round?: string;
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

export const SCORING_VERSION = 2;

const GROUP_RESULT_POINTS = 2;
const EXACT_SCORE_BONUS = 5;

const KNOCKOUT_POINTS: Record<string, number> = {
  'Round of 32': 5,
  'Round of 16': 8,
  'Quarter-final': 12,
  'Semi-final': 18,
  'Match for third place': 20,
  Final: 25,
};

function isGroupRound(group: unknown, round: unknown): boolean {
  if (typeof group === 'string' && group.length > 0) return true;
  if (typeof round === 'string' && round.toLowerCase().startsWith('group')) return true;
  return false;
}

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

  const base = isGroupRound(match.group, match.round)
    ? GROUP_RESULT_POINTS
    : ((typeof match.round === 'string' ? KNOCKOUT_POINTS[match.round] : undefined) ?? 0);

  const points = (resultado ? base : 0) + (marcador ? EXACT_SCORE_BONUS : 0);
  return { points, resultado, marcador };
}
