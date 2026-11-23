import { ERROR_QUIPS, ERROR_TITLE } from '../content/errors';
import { pickLine } from '../content/lines';
import { LOADING_TIPS } from '../content/loadingTips';
import { store } from '../core/store';
import './styles.css';

const root = document.getElementById('overlay')!;
const profanity = () => store.getState().settings.profanity;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text) e.textContent = text;
  return e;
}

export function showLoading(): { hide: () => void } {
  const screen = el('div', 'screen');
  screen.append(
    el('div', 'title', 'Grand Theft Auto-Rickshaw'),
    el('div', 'subtitle', 'Mumbhai Bhaukaal'),
    el('div', 'spinner'),
  );
  const tip = el('div', 'tip', pickLine(LOADING_TIPS, profanity()));
  screen.append(tip);
  root.append(screen);
  const timer = window.setInterval(() => (tip.textContent = pickLine(LOADING_TIPS, profanity())), 3500);
  return {
    hide() {
      window.clearInterval(timer);
      screen.classList.add('hidden');
      window.setTimeout(() => screen.remove(), 500);
    },
  };
}

let errorShown = false;
export function showError(err: unknown, message?: string): void {
  if (errorShown) return;
  errorShown = true;
  const screen = el('div', 'screen error interactive');
  const details = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err);
  const btn = el('button', 'btn', 'Phir se try karo');
  btn.onclick = () => location.reload();
  screen.append(
    el('div', 'title', ERROR_TITLE),
    el('div', 'subtitle', message ?? pickLine(ERROR_QUIPS, profanity())),
    el('pre', '', details),
    btn,
  );
  root.append(screen);
}

export function showHint(): void {
  const hint = el('div', 'hint');
  hint.innerHTML =
    '<b>Phase 2: Auto time</b> · <kbd>F</kbd> get in/out · <kbd>W S</kbd> gas/brake · <kbd>A D</kbd> steer · <kbd>Space</kbd> handbrake<br>' +
    '<kbd>H</kbd> horn · <kbd>M</kbd> meter · <kbd>T</kbd> tamper meter · on foot: <kbd>Shift</kbd> sprint <kbd>Space</kbd> jump · <kbd>`</kbd> debug';
  root.append(hint);
}

/** Live list of held actions, so input bindings are easy to verify. */
export function createActionReadout(): (actions: string[]) => void {
  const box = el('div', 'actions', 'actions: -');
  root.append(box);
  let last = '';
  return (actions) => {
    const text = `actions: ${actions.length ? actions.join(', ') : '-'}`;
    if (text !== last) box.textContent = last = text;
  };
}
