import type { CrystalBallQuestion } from '../data/crystalBallQuestions';

export type CrystalBallAnswers = Record<string, string>;

export interface CrystalBallStore {
  state: CrystalBallAnswers;
  refresh: () => void;
  isComplete: () => boolean;
}

export function createCrystalBallStore(
  fields: Array<HTMLInputElement | HTMLSelectElement>,
): CrystalBallStore {
  const state: CrystalBallAnswers = {};
  for (const f of fields) {
    const id = f.name.replace(/^cb-/, '');
    state[id] = f.value;
  }
  function refresh() {
    for (const f of fields) {
      const id = f.name.replace(/^cb-/, '');
      state[id] = f.value;
    }
  }
  function isComplete(): boolean {
    return fields.every((f) => f.value.trim() !== '');
  }
  return { state, refresh, isComplete };
}

const CRYSTAL_BALL_API = '/api/crystal-ball';

export async function submitCrystalBallAnswers(state: CrystalBallAnswers): Promise<void> {
  const res = await fetch(CRYSTAL_BALL_API, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers: state }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string; details?: unknown };
    const message = data.error ? `${data.error}` : `HTTP ${res.status}`;
    throw new Error(message);
  }
}

function readConfig(): CrystalBallQuestion[] | null {
  const tag = document.querySelector<HTMLScriptElement>(
    'script[type="application/json"][data-cb-config]',
  );
  if (!tag) return null;
  try {
    const parsed = JSON.parse(tag.textContent ?? '[]');
    return Array.isArray(parsed) ? (parsed as CrystalBallQuestion[]) : null;
  } catch {
    return null;
  }
}

export function mountCrystalBallController(): void {
  const form = document.querySelector<HTMLFormElement>('[data-crystal-ball-form]');
  if (!form) return;

  const config = readConfig();
  if (!config) {
    console.warn('crystalBallController: data-cb-config not found or invalid');
    return;
  }

  const fields = Array.from(
    form.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
      'input[name^="cb-"], select[name^="cb-"]',
    ),
  );
  if (fields.length === 0) return;

  const store = createCrystalBallStore(fields);
  const status = form.querySelector<HTMLElement>('[data-cb-save-status]');
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const submitDefaultLabel = submit?.textContent?.trim() ?? 'Guardar';

  function refreshSubmitState(): void {
    if (submit) submit.disabled = !store.isComplete();
  }

  function showStatus(message: string, kind: 'success' | 'error'): void {
    if (!status) return;
    status.textContent = message;
    status.classList.remove('hidden', 'text-text-tertiary', 'text-arceus-accent-700');
    status.classList.add(kind === 'success' ? 'text-arceus-accent-700' : 'text-text-tertiary');
    if (kind === 'success') {
      setTimeout(() => {
        status.classList.add('hidden');
      }, 2000);
    }
  }

  function setSubmitting(isSubmitting: boolean): void {
    if (!submit) return;
    submit.disabled = isSubmitting;
    submit.textContent = isSubmitting ? 'Guardando...' : submitDefaultLabel;
  }

  refreshSubmitState();

  form.addEventListener('input', () => {
    store.refresh();
    refreshSubmitState();
  });
  form.addEventListener('change', () => {
    store.refresh();
    refreshSubmitState();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    store.refresh();
    if (!store.isComplete()) {
      showStatus('Completa todas las preguntas', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await submitCrystalBallAnswers({ ...store.state });
      showStatus('Predicciones guardadas', 'success');
    } catch (err) {
      console.error('crystal ball submit failed', err);
      const message = err instanceof Error && err.message === 'crystal-ball-closed'
        ? 'Las predicciones están cerradas'
        : 'Error al guardar';
      showStatus(message, 'error');
    } finally {
      setSubmitting(false);
      refreshSubmitState();
    }
  });
}
