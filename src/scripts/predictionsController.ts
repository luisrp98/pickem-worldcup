import { mountAccordion } from './accordionController';
import type { Match, Prediction, Tournament } from '../lib/matches';

const POLL_MS = 5 * 60 * 1000;
const PREDICTIONS_API = '/api/predictions/day';
const SYNC_API = '/api/sync';

type PredictionsMap = Record<string, Prediction>;

interface PollResult {
  matches: Match[];
  predictions: PredictionsMap;
}

function fingerprint({ matches, predictions }: PollResult): string {
  const matchState = matches.map((m) => `${m.id}:${m.score?.ft?.[0] ?? '-'}-${m.score?.ft?.[1] ?? '-'}`).join('|');
  const predState = Object.entries(predictions)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, p]) => `${id}:${p.score1}-${p.score2}`)
    .join('|');
  return `${matchState}#${predState}`;
}

function readMatchInputsFromDom(item: HTMLElement): PredictionsMap {
  const out: PredictionsMap = {};
  const matches = item.querySelectorAll<HTMLElement>('[data-match-id]');
  for (const m of matches) {
    const id = m.dataset.matchId;
    if (!id) continue;
    const home = m.querySelector<HTMLInputElement>('[data-score-home]');
    const away = m.querySelector<HTMLInputElement>('[data-score-away]');
    if (!home || !away) continue;
    const score1 = parseInt(home.value, 10);
    const score2 = parseInt(away.value, 10);
    if (Number.isFinite(score1) && Number.isFinite(score2)) {
      out[id] = { score1, score2 };
    }
  }
  return out;
}

function markDayDirty(item: HTMLElement) {
  const btn = item.querySelector<HTMLButtonElement>('[data-save-day]');
  if (btn) btn.disabled = false;
  const status = item.querySelector<HTMLElement>('[data-save-status]');
  if (status) {
    status.textContent = 'Cambios sin guardar';
    status.classList.remove('hidden');
    status.classList.add('text-text-tertiary');
    status.classList.remove('text-arceus-accent-700');
  }
}

function markDayClean(item: HTMLElement, message: string, isError: boolean) {
  const btn = item.querySelector<HTMLButtonElement>('[data-save-day]');
  if (!isError && btn) btn.disabled = true;
  const status = item.querySelector<HTMLElement>('[data-save-status]');
  if (status) {
    status.textContent = message;
    status.classList.remove('hidden');
    status.classList.toggle('text-text-tertiary', isError);
    status.classList.toggle('text-arceus-accent-700', !isError);
    if (!isError) {
      setTimeout(() => status.classList.add('hidden'), 2000);
    }
  }
}

function attachSaveHandlers() {
  const items = document.querySelectorAll<HTMLElement>('[data-accordion-item]');
  items.forEach((item) => {
    const inputs = item.querySelectorAll<HTMLInputElement>('input[type="number"]');
    inputs.forEach((input) => {
      input.addEventListener('input', () => markDayDirty(item));
    });

    const btn = item.querySelector<HTMLButtonElement>('[data-save-day]');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      const date = item.dataset.dayDate;
      if (!date) return;
      const predictions = readMatchInputsFromDom(item);
      const arr = Object.entries(predictions).map(([matchId, p]) => ({
        matchId,
        score1: p.score1,
        score2: p.score2,
      }));
      btn.disabled = true;
      try {
        const res = await fetch(PREDICTIONS_API, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date, predictions: arr }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        markDayClean(item, 'Cambios guardados', false);
      } catch (err) {
        console.error('save day failed', err);
        markDayClean(item, 'Error al guardar', true);
        btn.disabled = false;
      }
    });
  });
}

async function fetchLatest(): Promise<PollResult | null> {
  try {
    const [tournamentRes, predictionsRes] = await Promise.all([
      fetch(SYNC_API, { cache: 'no-store' }),
      fetch(PREDICTIONS_API, { cache: 'no-store' }),
    ]);
    if (!tournamentRes.ok) return null;
    const { tournament } = (await tournamentRes.json()) as { tournament: Tournament };
    let predictions: PredictionsMap = {};
    if (predictionsRes.ok) {
      const data = (await predictionsRes.json()) as { predictions: Record<string, Prediction> };
      for (const [id, p] of Object.entries(data.predictions)) {
        if (typeof p.score1 === 'number' && typeof p.score2 === 'number') {
          predictions[id] = { score1: p.score1, score2: p.score2 };
        }
      }
    }
    return { matches: tournament.matches, predictions };
  } catch (err) {
    console.error('poll failed', err);
    return null;
  }
}

let lastFingerprint = '';

async function poll() {
  const latest = await fetchLatest();
  if (!latest) return;
  const fp = fingerprint(latest);
  if (lastFingerprint && fp !== lastFingerprint) {
    location.reload();
    return;
  }
  lastFingerprint = fp;
}

export function mountPredictionsController() {
  mountAccordion('[data-accordion]');

  const container = document.querySelector<HTMLElement>('[data-accordion]');
  const isReadOnly = container?.dataset.readonly === 'true';

  if (!isReadOnly) {
    attachSaveHandlers();
    poll();
    setInterval(poll, POLL_MS);
  }
}
