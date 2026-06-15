import { formatCountdown } from '../lib/dateFormat';
import { parseKickoff, type Match, type Tournament } from '../lib/matches';

const POLL_MS = 5 * 60 * 1000;
const COUNTDOWN_TICK_MS = 60 * 1000;
const SYNC_API = '/api/sync';

function tournamentFingerprint(matches: Match[]): string {
  return matches.map((m) => `${m.id}:${m.score?.ft?.[0] ?? '-'}-${m.score?.ft?.[1] ?? '-'}`).join('|');
}

function getNextKickoff(matches: Match[], now: Date): Date | null {
  const upcoming = matches
    .map((m) => parseKickoff(m))
    .filter((d): d is Date => d !== null && d.getTime() > now.getTime())
    .sort((a, b) => a.getTime() - b.getTime());
  return upcoming[0] ?? null;
}

function tickCountdown() {
  const el = document.querySelector<HTMLElement>('[data-countdown]');
  if (!el) return;
  const iso = el.dataset.nextKickoff;
  if (!iso) {
    el.textContent = '—';
    return;
  }
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) {
    el.textContent = '—';
    return;
  }
  el.textContent = formatCountdown(target, new Date());
}

async function poll() {
  try {
    const res = await fetch(SYNC_API, { cache: 'no-store' });
    if (!res.ok) return;
    const { tournament } = (await res.json()) as { tournament: Tournament };
    const fp = tournamentFingerprint(tournament.matches);
    if (lastFingerprint && fp !== lastFingerprint) {
      location.reload();
      return;
    }
    lastFingerprint = fp;

    const next = getNextKickoff(tournament.matches, new Date());
    const el = document.querySelector<HTMLElement>('[data-countdown]');
    if (el) {
      if (next) {
        el.dataset.nextKickoff = next.toISOString();
      } else {
        delete el.dataset.nextKickoff;
      }
    }
    tickCountdown();
  } catch (err) {
    console.error('home poll failed', err);
  }
}

let lastFingerprint = '';

export function mountHomeController() {
  tickCountdown();
  setInterval(tickCountdown, COUNTDOWN_TICK_MS);
  poll();
  setInterval(poll, POLL_MS);
}
