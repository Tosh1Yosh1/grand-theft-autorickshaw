import type { DialogueLine } from '../content/missions';
import { resolveLine } from '../content/lines';
import { store } from '../core/store';
import { letterbox } from './bigScreen';

let box: HTMLDivElement | null = null;

/**
 * Bollywood-dramatic dialogue: letterbox, speaker name, line. F/Space/click advances,
 * Enter skips the lot. Resolves with { skipped }. Game time is frozen while it plays.
 */
export function playDialogue(lines: readonly DialogueLine[], _input: unknown, clock: { scale: number }, opts: { freeze?: boolean } = {}): Promise<{ skipped: boolean }> {
  if (!box) {
    box = document.createElement('div');
    box.className = 'dialogue';
    document.getElementById('overlay')!.append(box);
  }
  const el = box;
  const freeze = opts.freeze ?? true;
  if (freeze) clock.scale = 0;
  letterbox(true, '');
  el.classList.add('show');
  return new Promise((resolve) => {
    // Listen to raw keys: the game's Input clears edges every frame and we run on our own rAF.
    let advance = false;
    let skip = false;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'Enter' || e.code === 'Backspace') skip = true;
      else if (e.code === 'KeyF' || e.code === 'Space') advance = true;
    };
    const onClick = () => (advance = true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onClick);
    let i = -1;
    let t = 0;
    let duration = 0;
    let last = performance.now();
    const show = () => {
      i++;
      if (i >= lines.length) return finish(false);
      const l = lines[i]!;
      const text = resolveLine(l.line, store.getState().settings.profanity);
      duration = Math.max(2.4, text.length * 0.055);
      t = 0;
      el.innerHTML = `<div class="dl-who">${l.who}</div><div class="dl-text">${text}</div><div class="dl-hint">F: aage · Enter: skip</div>`;
    };
    const finish = (skipped: boolean) => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onClick);
      i = lines.length;
      el.classList.remove('show');
      letterbox(false);
      if (freeze) clock.scale = 1;
      resolve({ skipped });
    };
    const tick = () => {
      const now = performance.now();
      t += (now - last) / 1000;
      last = now;
      if (skip) return finish(true);
      if (advance || t > duration) {
        advance = false;
        show();
      }
      if (i < lines.length) requestAnimationFrame(tick);
    };
    show();
    requestAnimationFrame(tick);
  });
}
