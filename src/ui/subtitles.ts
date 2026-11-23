import './styles.css';

/** Bottom-centre Hinglish subtitles. Speaker is optional. Respects the subtitles setting via caller. */
let box: HTMLDivElement | null = null;
let timer = 0;

export function showSubtitle(text: string, speaker?: string, seconds = 3): void {
  if (!box) {
    box = document.createElement('div');
    box.className = 'subtitle-line';
    document.getElementById('overlay')!.append(box);
  }
  box.innerHTML = '';
  if (speaker) {
    const s = document.createElement('b');
    s.textContent = `${speaker}: `;
    box.append(s);
  }
  box.append(document.createTextNode(text));
  box.classList.add('show');
  window.clearTimeout(timer);
  timer = window.setTimeout(() => box?.classList.remove('show'), seconds * 1000);
}
