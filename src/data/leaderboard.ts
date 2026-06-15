export interface LeaderboardEntry {
  pos: number;
  name: string;
  initials: string;
  points: number;
  result: number;
  score: number;
}

export const leaderboard: LeaderboardEntry[] = [
  { pos: 1, name: 'Martín López', initials: 'ML', points: 47, result: 12, score: 5 },
  { pos: 2, name: 'Camila Rivas', initials: 'CR', points: 42, result: 11, score: 4 },
  { pos: 3, name: 'Javier Mendoza', initials: 'JM', points: 38, result: 10, score: 3 },
  { pos: 4, name: 'Valentina Paz', initials: 'VP', points: 35, result: 10, score: 2 },
  { pos: 5, name: 'Andrés Torres', initials: 'AT', points: 33, result: 9, score: 2 },
  { pos: 6, name: 'Sofía Herrera', initials: 'SH', points: 29, result: 8, score: 1 },
  { pos: 7, name: 'Felipe Rojas', initials: 'FR', points: 26, result: 7, score: 1 },
  { pos: 8, name: 'Isabella Campos', initials: 'IC', points: 22, result: 6, score: 1 },
  { pos: 9, name: 'Diego Muñoz', initials: 'DM', points: 18, result: 5, score: 0 },
  { pos: 10, name: 'Laura Silva', initials: 'LS', points: 14, result: 4, score: 0 },
];
