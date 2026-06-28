import data from './crystalBallQuestions.json';

export type CrystalBallInputType = 'team' | 'player' | 'text';

export interface CrystalBallQuestion {
  id: string;
  emoji: string;
  question: string;
  inputType: CrystalBallInputType;
  points: number;
}

export const crystalBallQuestions: CrystalBallQuestion[] = data as CrystalBallQuestion[];
