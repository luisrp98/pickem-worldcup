import { mountPredictionsController } from './predictionsController';
import { formatCountdown } from '../lib/dateFormat';

const COUNTDOWN_TICK_MS = 60 * 1000;

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

export function mountHomeController() {
  mountPredictionsController();
  tickCountdown();
  setInterval(tickCountdown, COUNTDOWN_TICK_MS);
}
