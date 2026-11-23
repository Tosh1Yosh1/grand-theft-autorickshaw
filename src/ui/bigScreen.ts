/** Full-screen WASTED/BUSTED-style card ("KHATAM. TATA. BYE BYE." / "CHALLAN KAT GAYA"). */
export function showBigScreen(title: string, sub: string, color: string, seconds = 4): Promise<void> {
  const el = document.createElement('div');
  el.className = 'big-screen';
  el.innerHTML = `<div class="bs-title" style="color:${color}">${title}</div><div class="bs-sub">${sub}</div>`;
  document.getElementById('overlay')!.append(el);
  requestAnimationFrame(() => el.classList.add('show'));
  return new Promise((resolve) =>
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 600);
      resolve();
    }, seconds * 1000),
  );
}

/** Black letterbox bars + caption for Bollywood slow-mo moments. */
let bars: HTMLDivElement | null = null;
export function letterbox(on: boolean, caption = ''): void {
  if (!bars) {
    bars = document.createElement('div');
    bars.className = 'letterbox';
    bars.innerHTML = '<div class="lb-top"></div><div class="lb-cap"></div><div class="lb-bot"></div>';
    document.getElementById('overlay')!.append(bars);
  }
  bars.classList.toggle('show', on);
  (bars.querySelector('.lb-cap') as HTMLDivElement).textContent = caption;
}

/** Cracked-windshield overlay for gully cricket sixes. */
export function windshieldCrack(): void {
  const el = document.createElement('div');
  el.className = 'crack';
  el.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><g stroke="rgba(255,255,255,0.8)" stroke-width="0.3" fill="none">
    <path d="M50 45 L20 10 M50 45 L80 5 M50 45 L95 40 M50 45 L85 90 M50 45 L40 95 M50 45 L5 70 M50 45 L10 35"/>
    <circle cx="50" cy="45" r="4"/><circle cx="50" cy="45" r="9"/></g></svg>`;
  document.getElementById('overlay')!.append(el);
  setTimeout(() => el.classList.add('fade'), 2500);
  setTimeout(() => el.remove(), 4000);
}
