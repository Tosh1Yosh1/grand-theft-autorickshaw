import { store } from '../core/store';
import { WEAPON_NAMES } from '../content/wanted';
import { formatRupees } from './format';

/** Top-right HUD: money, chai-cup health, chappal (wanted) meter, weapon. Rebuilt only on change. */
const CHAPPAL = (on: boolean, flash: boolean) =>
  `<svg viewBox="0 0 20 40" class="chappal ${on ? 'on' : ''} ${on && flash ? 'flash' : ''}"><path d="M10 2c5 0 7 6 7 12s-2 12-2 18-2 6-5 6-5-1-5-6S3 20 3 14 5 2 10 2z"/><path d="M4 13c3-1 9-1 12 0" stroke-width="2.5" fill="none" class="strap"/></svg>`;
const CUP = (fill: number) =>
  `<svg viewBox="0 0 24 28" class="cup"><defs><clipPath id="c${Math.round(fill * 100)}"><rect x="0" y="${26 - 20 * fill}" width="24" height="28"/></clipPath></defs><path d="M3 6h15l-2 18H5z" class="glass"/><path d="M3 6h15l-2 18H5z" class="tea" clip-path="url(#c${Math.round(fill * 100)})"/><path d="M18 9c4 0 4 7 0 7" class="handle"/></svg>`;

let root: HTMLDivElement | null = null;
let last = '';
let lastMoney: number | null = null;

/** Floating "+₹1,500" / "-₹200" next to the money counter. */
function moneyPopup(delta: number): void {
  const el = document.createElement('div');
  el.className = `money-pop ${delta > 0 ? 'up' : 'down'}`;
  el.textContent = `${delta > 0 ? '+' : '-'}${formatRupees(Math.abs(delta))}`;
  root?.append(el);
  setTimeout(() => el.remove(), 1600);
}

export function updateHud(opts: { seen: boolean; clock: string; district: string; rank: string }): void {
  if (!root) {
    root = document.createElement('div');
    root.className = 'hud';
    document.getElementById('overlay')!.append(root);
  }
  const p = store.getState().player;
  const key = `${p.money}|${Math.ceil(p.health)}|${p.wanted}|${opts.seen}|${p.weapon}|${opts.clock}|${opts.district}|${opts.rank}`;
  if (lastMoney !== null && p.money !== lastMoney) moneyPopup(p.money - lastMoney);
  lastMoney = p.money;
  if (key === last) return;
  last = key;
  const cups = Array.from({ length: 5 }, (_, i) => CUP(Math.max(0, Math.min(1, (p.health - i * 20) / 20)))).join('');
  const chappals = Array.from({ length: 5 }, (_, i) => CHAPPAL(i < p.wanted, opts.seen)).join('');
  root.innerHTML = `
    <div class="hud-row hud-time">${opts.clock} · ${opts.district} · <b>${opts.rank}</b></div>
    <div class="hud-row hud-money">${formatRupees(p.money)}</div>
    <div class="hud-row hud-cups" title="Health">${cups}</div>
    <div class="hud-row hud-chappals" title="Challan level">${chappals}</div>
    <div class="hud-row hud-weapon">${WEAPON_NAMES[p.weapon] ?? p.weapon}</div>`;
}
