import data from './crystalBallQuestions.json';

export type CrystalBallInputType = 'team' | 'player' | 'select';

export interface CrystalBallOption {
  value: string;
  label: string;
}

export interface CrystalBallQuestion {
  id: string;
  emoji: string;
  question: string;
  inputType: CrystalBallInputType;
  points: number;
  bgClass: string;
  circleBgClass: string;
  options?: CrystalBallOption[];
  pointsByValue?: Record<string, number>;
}

export const crystalBallQuestions: CrystalBallQuestion[] = data as CrystalBallQuestion[];
