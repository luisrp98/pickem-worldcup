import {
  calculateMatchPoints,
  type MatchPoints,
  type Prediction,
  SCORING_VERSION,
  type StoredPrediction,
} from './scoring';

export interface Goal {
  name: string;
  minute: number;
  offset?: number;
  penalty?: boolean;
  owngoal?: boolean;
}

export interface Score {
  ft?: [number, number];
  ht?: [number, number];
  et?: [number, number];
  p?: [number, number];
}

export interface Match {
  id: string;
  num?: number;
  round: string;
  date: string;
  time: string;
  team1: string;
  team2: string;
  group?: string;
  ground?: string;
  score?: Score;
  goals1?: Goal[];
  goals2?: Goal[];
}

export interface Tournament {
  name: string;
  matches: Match[];
}

export type MatchStatus = 'pending' | 'live' | 'closed';

export const SYNC_API_URL = '/api/sync';

export async function fetchMatches(signal?: AbortSignal): Promise<Tournament> {
  const res = await fetch(SYNC_API_URL, { cache: 'no-store', signal });
  if (!res.ok) throw new Error(`Failed to sync matches: ${res.status}`);
  const payload = (await res.json()) as { tournament: Tournament };
  return payload.tournament;
}

export function parseKickoff(match: Match): Date | null {
  const timeStr = (match.time ?? '').trim();
  const timePart = timeStr.split(/\s+/)[0] ?? '';
  const m = timePart.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;

  const offsetMatch = timeStr.match(/UTC\s*([+-]?\d+)/i);
  const offsetHours = offsetMatch ? parseInt(offsetMatch[1], 10) : 0;

  const [, h, min] = m;
  const [yyyy, mm, dd] = match.date.split('-').map(Number);
  const utcMillis = Date.UTC(yyyy, mm - 1, dd, Number(h), Number(min)) - offsetHours * 3600 * 1000;
  return new Date(utcMillis);
}

export function getMatchStatus(match: Match, now: Date = new Date()): MatchStatus {
  if (match.score?.ft) return 'closed';
  const kickoff = parseKickoff(match);
  if (!kickoff) return 'pending';
  const end = new Date(kickoff.getTime() + 2 * 60 * 60 * 1000);
  if (now < kickoff) return 'pending';
  if (now >= kickoff && now <= end) return 'live';
  return 'closed';
}

export function groupByDate(matches: Match[]): Map<string, Match[]> {
  const map = new Map<string, Match[]>();
  for (const match of matches) {
    const arr = map.get(match.date) ?? [];
    arr.push(match);
    map.set(match.date, arr);
  }
  return map;
}

export const flags: Record<string, string> = {
  Mexico: '🇲🇽',
  'South Africa': '🇿🇦',
  'South Korea': '🇰🇷',
  'Czech Republic': '🇨🇿',
  Canada: '🇨🇦',
  'Bosnia & Herzegovina': '🇧🇦',
  Qatar: '🇶🇦',
  Switzerland: '🇨🇭',
  Brazil: '🇧🇷',
  Morocco: '🇲🇦',
  Haiti: '🇭🇹',
  Scotland: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  USA: '🇺🇸',
  Paraguay: '🇵🇾',
  Australia: '🇦🇺',
  Turkey: '🇹🇷',
  Germany: '🇩🇪',
  Curaçao: '🇨🇼',
  'Ivory Coast': '🇨🇮',
  Ecuador: '🇪🇨',
  Netherlands: '🇳🇱',
  Japan: '🇯🇵',
  Sweden: '🇸🇪',
  Tunisia: '🇹🇳',
  Belgium: '🇧🇪',
  Egypt: '🇪🇬',
  Iran: '🇮🇷',
  'New Zealand': '🇳🇿',
  Spain: '🇪🇸',
  'Cape Verde': '🇨🇻',
  'Saudi Arabia': '🇸🇦',
  Uruguay: '🇺🇾',
  France: '🇫🇷',
  Senegal: '🇸🇳',
  Iraq: '🇮🇶',
  Norway: '🇳🇴',
  Argentina: '🇦🇷',
  Algeria: '🇩🇿',
  Austria: '🇦🇹',
  Jordan: '🇯🇴',
  Portugal: '🇵🇹',
  'DR Congo': '🇨🇩',
  Uzbekistan: '🇺🇿',
  Colombia: '🇨🇴',
  England: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  Croatia: '🇭🇷',
  Ghana: '🇬🇭',
  Panama: '🇵🇦',
};

export function flagOf(team: string): string {
  return flags[team] ?? '🏳️';
}

export const teamToIso: Record<string, string> = {
  Mexico: 'mx',
  'South Africa': 'za',
  'South Korea': 'kr',
  'Czech Republic': 'cz',
  Canada: 'ca',
  'Bosnia & Herzegovina': 'ba',
  Qatar: 'qa',
  Switzerland: 'ch',
  Brazil: 'br',
  Morocco: 'ma',
  Haiti: 'ht',
  Scotland: 'gb-sct',
  USA: 'us',
  Paraguay: 'py',
  Australia: 'au',
  Turkey: 'tr',
  Germany: 'de',
  Curaçao: 'cw',
  'Ivory Coast': 'ci',
  Ecuador: 'ec',
  Netherlands: 'nl',
  Japan: 'jp',
  Sweden: 'se',
  Tunisia: 'tn',
  Belgium: 'be',
  Egypt: 'eg',
  Iran: 'ir',
  'New Zealand': 'nz',
  Spain: 'es',
  'Cape Verde': 'cv',
  'Saudi Arabia': 'sa',
  Uruguay: 'uy',
  France: 'fr',
  Senegal: 'sn',
  Iraq: 'iq',
  Norway: 'no',
  Argentina: 'ar',
  Algeria: 'dz',
  Austria: 'at',
  Jordan: 'jo',
  Portugal: 'pt',
  'DR Congo': 'cd',
  Uzbekistan: 'uz',
  Colombia: 'co',
  England: 'gb-eng',
  Croatia: 'hr',
  Ghana: 'gh',
  Panama: 'pa',
};

export function flagImgHtml(team: string): string {
  const code = teamToIso[team];
  if (!code) return '<span aria-hidden="true">🏳️</span>';
  return `<img src="https://flagcdn.com/w40/${code}.png" alt="" width="24" height="18" loading="lazy" decoding="async" referrerpolicy="no-referrer" class="inline-block align-middle rounded-xs" />`;
}

export function formatMatchdayDate(dateISO: string): string {
  const [yyyy, mm, dd] = dateISO.split('-').map(Number);
  const d = new Date(Date.UTC(yyyy, mm - 1, dd));
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const months = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ];
  return `${days[d.getUTCDay()]} ${dd} ${months[mm - 1]}`;
}

export { calculateMatchPoints, SCORING_VERSION, type Prediction, type MatchPoints, type StoredPrediction };
