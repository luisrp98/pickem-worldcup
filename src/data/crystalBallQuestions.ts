export type CrystalBallInputType = 'team' | 'player' | 'text';

export interface CrystalBallQuestion {
  id: string;
  emoji: string;
  question: string;
  inputType: CrystalBallInputType;
}

export const crystalBallQuestions: CrystalBallQuestion[] = [
  { id: 'champion', emoji: '🏆', question: '¿Quién va a ser el campeón?', inputType: 'team' },
  { id: 'top-scorer', emoji: '⚽', question: '¿Quién va a ser el máximo goleador?', inputType: 'player' },
  { id: 'best-player', emoji: '🌟', question: '¿Quién va a ser el mejor jugador?', inputType: 'player' },
];
