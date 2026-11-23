/** "Press F to ..." contextual prompt. Call setPrompt(null) to hide. */
let el: HTMLDivElement | null = null;
let last: string | null = null;

export function setPrompt(html: string | null): void {
  if (html === last) return;
  last = html;
  if (!el) {
    el = document.createElement('div');
    el.className = 'prompt';
    document.getElementById('overlay')!.append(el);
  }
  el.innerHTML = html ?? '';
  el.style.display = html ? 'block' : 'none';
}
