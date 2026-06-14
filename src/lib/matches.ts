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

export const MATCHES_URL =
  'https://raw.githubusercontent.com/upbound-web/worldcup-live.json/master/2026/worldcup.json';

export async function fetchMatches(signal?: AbortSignal): Promise<Tournament> {
  const res = await fetch(MATCHES_URL, { cache: 'no-store', signal });
  if (!res.ok) throw new Error(`Failed to fetch matches: ${res.status}`);
  return (await res.json()) as Tournament;
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
  const utcMillis =
    Date.UTC(yyyy, mm - 1, dd, Number(h), Number(min)) - offsetHours * 3600 * 1000;
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

export const FLAGS: Record<string, string> = {
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
  'Curaçao': '🇨🇼',
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
  return FLAGS[team] ?? '🏳️';
}

export const TEAM_TO_ISO: Record<string, string> = {
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
  'Curaçao': 'cw',
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

const FLAG_FALLBACK_HTML = '<span aria-hidden="true">🏳️</span>';

export function flagImgHtml(team: string): string {
  const code = TEAM_TO_ISO[team];
  if (!code) return FLAG_FALLBACK_HTML;
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

const STATUS_LABEL: Record<MatchStatus, string> = {
  pending: 'PENDIENTE',
  live: 'EN JUEGO',
  closed: 'CERRADO',
};

const STATUS_CLASSES: Record<MatchStatus, string> = {
  pending: 'bg-muted text-text-tertiary border border-border',
  live: 'bg-arceus-accent-400 text-arceus-secondary-950 border border-arceus-accent-500',
  closed: 'bg-arceus-secondary-950 text-arceus-primary-50 border border-arceus-secondary-950',
};

const INPUT_CLASS =
  'w-9 h-10 text-center text-base font-semibold border border-border rounded-sm bg-muted text-text outline-none focus:border-text focus:bg-surface transition-[border-color,background] appearance-none [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none placeholder:text-text-tertiary disabled:opacity-50 disabled:cursor-not-allowed';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function matchId(match: Match): string {
  return `${match.date}|${match.team1}|${match.team2}`;
}

export function renderMatchday(dateISO: string, dayNumber: number, matches: Match[]): string {
  return `
    <section class="bg-surface border border-border rounded-md overflow-hidden hover:border-border-strong transition-colors" data-accordion-item>
      <button type="button" class="w-full flex items-center justify-between gap-4 px-5 py-4 text-left cursor-pointer" aria-expanded="false" aria-controls="day-panel-${dayNumber}" data-accordion-trigger>
        <div class="flex flex-col gap-0.5 min-w-0">
          <span class="text-xl md:text-2xl font-bold leading-tight tracking-wide truncate">${escapeHtml(formatMatchdayDate(dateISO))}</span>
          <span class="text-xs font-semibold tracking-widest uppercase text-text-tertiary">Día ${dayNumber} de la fase de grupos</span>
        </div>
        <span class="shrink-0 size-9 flex items-center justify-center rounded-sm bg-muted text-text-secondary transition-transform duration-300" data-accordion-icon aria-hidden="true">
          <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6" /></svg>
        </span>
      </button>
      <div id="day-panel-${dayNumber}" class="grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 ease-out" data-accordion-panel>
        <div class="overflow-hidden">
          <div class="px-5 pb-2 divide-y divide-border/60">
            ${matches.map(renderMatch).join('')}
          </div>
        </div>
      </div>
    </section>
  `;
}

export function renderMatch(match: Match): string {
  const status = getMatchStatus(match);
  const ft = match.score?.ft;
  const disabled = status === 'closed' ? 'disabled' : '';
  const valueAttr = (n?: number) => (typeof n === 'number' ? `value="${n}"` : '');
  const id = matchId(match);

  return `
    <div class="flex flex-col gap-2 py-3 first:pt-0 last:pb-0" data-match-id="${escapeHtml(id)}">
      <div class="flex items-center justify-between gap-2 w-full">
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <span class="shrink-0 inline-flex" aria-hidden="true">${flagImgHtml(match.team1)}</span>
          <span class="text-sm font-semibold text-text truncate">${escapeHtml(match.team1)}</span>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <input type="number" min="0" max="30" step="1" placeholder="-" ${disabled} ${valueAttr(ft?.[0])} aria-label="Goles de ${escapeHtml(match.team1)}" data-score-home class="${INPUT_CLASS}" />
          <span class="text-sm font-light text-text-tertiary">:</span>
          <input type="number" min="0" max="30" step="1" placeholder="-" ${disabled} ${valueAttr(ft?.[1])} aria-label="Goles de ${escapeHtml(match.team2)}" data-score-away class="${INPUT_CLASS}" />
        </div>
        <div class="flex items-center gap-2 flex-1 min-w-0 justify-end">
          <span class="text-sm font-semibold text-text truncate">${escapeHtml(match.team2)}</span>
          <span class="shrink-0 inline-flex" aria-hidden="true">${flagImgHtml(match.team2)}</span>
        </div>
      </div>
      <div class="flex items-center justify-between gap-2">
        <span class="text-xs text-text-tertiary tabular-nums tracking-wide">${escapeHtml(match.time)}</span>
        <span class="text-[0.625rem] font-semibold tracking-widest uppercase px-2 py-0.5 rounded-xs ${STATUS_CLASSES[status]}" data-status>${STATUS_LABEL[status]}</span>
      </div>
    </div>
  `;
}

export function renderUpcomingMatch(match: Match): string {
  const status = getMatchStatus(match);
  const ft = match.score?.ft;
  const homeScore = typeof ft?.[0] === 'number' ? String(ft[0]) : '-';
  const awayScore = typeof ft?.[1] === 'number' ? String(ft[1]) : '-';
  const opacity = status === 'closed' ? 'opacity-60' : '';

  return `
    <div class="flex items-center justify-between gap-2 w-full tabular-nums ${opacity}" data-match-id="${escapeHtml(matchId(match))}">
      <span class="shrink-0 inline-flex" aria-hidden="true">${flagImgHtml(match.team1)}</span>
      <span class="text-sm font-medium truncate flex-1 min-w-0">${escapeHtml(match.team1)}</span>
      <span class="w-6 text-center font-semibold tabular-nums" data-score-home>${homeScore}</span>
      <span class="text-text-tertiary">-</span>
      <span class="w-6 text-center font-semibold tabular-nums" data-score-away>${awayScore}</span>
      <span class="text-sm font-medium truncate flex-1 min-w-0 text-right">${escapeHtml(match.team2)}</span>
      <span class="shrink-0 inline-flex" aria-hidden="true">${flagImgHtml(match.team2)}</span>
    </div>
  `;
}

export function refreshMatchInDom(match: Match): void {
  const el = document.querySelector<HTMLElement>(
    `[data-match-id="${CSS.escape(matchId(match))}"]`
  );
  if (!el) return;

  const status = getMatchStatus(match);
  const ft = match.score?.ft;

  const badge = el.querySelector<HTMLElement>('[data-status]');
  if (badge) {
    badge.textContent = STATUS_LABEL[status];
    badge.className = `text-[0.625rem] font-semibold tracking-widest uppercase px-2 py-0.5 rounded-xs ${STATUS_CLASSES[status]}`;
  }

  const home = el.querySelector<HTMLInputElement>('[data-score-home]');
  const away = el.querySelector<HTMLInputElement>('[data-score-away]');
  if (home && away && ft) {
    if (document.activeElement !== home && home.value === '') home.value = String(ft[0]);
    if (document.activeElement !== away && away.value === '') away.value = String(ft[1]);
  }

  if (home) {
    if (status === 'closed') home.setAttribute('disabled', '');
    else home.removeAttribute('disabled');
  }
  if (away) {
    if (status === 'closed') away.setAttribute('disabled', '');
    else away.removeAttribute('disabled');
  }
}
