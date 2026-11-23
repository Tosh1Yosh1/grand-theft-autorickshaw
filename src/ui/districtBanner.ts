let el: HTMLDivElement | null = null;
let timer = 0;

/** Big "WELCOME TO ..." card when Pappu enters a district. */
export function showDistrictBanner(name: string, tagline: string, color: string): void {
  if (!el) {
    el = document.createElement('div');
    el.className = 'district-banner';
    document.getElementById('overlay')!.append(el);
  }
  el.innerHTML = `<div class="db-name" style="color:${color}">${name}</div><div class="db-tag">${tagline}</div>`;
  el.classList.add('show');
  window.clearTimeout(timer);
  timer = window.setTimeout(() => el?.classList.remove('show'), 3500);
}
