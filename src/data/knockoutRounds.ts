export type KnockoutGroup = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j' | 'k' | 'l';

export interface KnockoutRoundConfig {
  id: string;
  matchRound: string;
  label: string;
  group: KnockoutGroup;
  order: number;
}

export const knockoutRounds: KnockoutRoundConfig[] = [
  {
    id: 'dieciseisavos',
    matchRound: 'Round of 32',
    label: 'Dieciseisavos de final',
    group: 'a',
    order: 1,
  },
  {
    id: 'octavos',
    matchRound: 'Round of 16',
    label: 'Octavos de final',
    group: 'b',
    order: 2,
  },
  {
    id: 'cuartos',
    matchRound: 'Quarter-final',
    label: 'Cuartos de final',
    group: 'c',
    order: 3,
  },
  {
    id: 'semifinales',
    matchRound: 'Semi-final',
    label: 'Semifinales',
    group: 'd',
    order: 4,
  },
  {
    id: 'tercer-puesto',
    matchRound: 'Match for third place',
    label: 'Tercer puesto',
    group: 'e',
    order: 5,
  },
  {
    id: 'final',
    matchRound: 'Final',
    label: 'Final',
    group: 'f',
    order: 6,
  },
];

export function getRoundById(id: string): KnockoutRoundConfig | undefined {
  return knockoutRounds.find((r) => r.id === id);
}

export function getRoundByMatchRound(matchRound: string): KnockoutRoundConfig | undefined {
  return knockoutRounds.find((r) => r.matchRound === matchRound);
}

export const knockoutPastBg: Record<KnockoutGroup, string> = {
  a: 'bg-group-a-secondary border border-group-a-primary',
  b: 'bg-group-b-secondary border border-group-b-primary',
  c: 'bg-group-c-secondary border border-group-c-primary',
  d: 'bg-group-d-secondary border border-group-d-primary',
  e: 'bg-group-e-secondary border border-group-e-primary',
  f: 'bg-group-f-secondary border border-group-f-primary',
  g: 'bg-group-g-secondary border border-group-g-primary',
  h: 'bg-group-h-secondary border border-group-h-primary',
  i: 'bg-group-i-secondary border border-group-i-primary',
  j: 'bg-group-j-secondary border border-group-j-primary',
  k: 'bg-group-k-secondary border border-group-k-primary',
  l: 'bg-group-l-secondary border border-group-l-primary',
};

export const knockoutUpcomingBg: Record<KnockoutGroup, string> = {
  a: 'bg-group-a-primary border border-group-a-secondary',
  b: 'bg-group-b-primary border border-group-b-secondary',
  c: 'bg-group-c-primary border border-group-c-secondary',
  d: 'bg-group-d-primary border border-group-d-secondary',
  e: 'bg-group-e-primary border border-group-e-secondary',
  f: 'bg-group-f-primary border border-group-f-secondary',
  g: 'bg-group-g-primary border border-group-g-secondary',
  h: 'bg-group-h-primary border border-group-h-secondary',
  i: 'bg-group-i-primary border border-group-i-secondary',
  j: 'bg-group-j-primary border border-group-j-secondary',
  k: 'bg-group-k-primary border border-group-k-secondary',
  l: 'bg-group-l-primary border border-group-l-secondary',
};

export const knockoutUnderline: Record<KnockoutGroup, string> = {
  a: 'bg-group-a-primary',
  b: 'bg-group-b-primary',
  c: 'bg-group-c-primary',
  d: 'bg-group-d-primary',
  e: 'bg-group-e-primary',
  f: 'bg-group-f-primary',
  g: 'bg-group-g-primary',
  h: 'bg-group-h-primary',
  i: 'bg-group-i-primary',
  j: 'bg-group-j-primary',
  k: 'bg-group-k-primary',
  l: 'bg-group-l-primary',
};
