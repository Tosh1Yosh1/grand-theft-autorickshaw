import { audio } from '../../audio/AudioManager';
import { ACTIONS, DEFAULT_BINDINGS, type Action, type Bindings } from '../../core/input/bindings';
import { hasSave, loadGame, saveGame, saveInfo } from '../../core/save';
import { safeStorage } from '../../core/storage';
import type { GraphicsPreset, Settings } from '../../core/store';
import type { GameContext, GameSystem } from '../../core/System';

const BIND_KEY = 'gtar.bindings.v1';
const HIDDEN: Action[] = ['toggleDebug', 'debugSpawnBoxes', 'debugReset'];
const LABELS: Partial<Record<Action, string>> = {
  moveForward: 'Aage', moveBack: 'Peeche', moveLeft: 'Left', moveRight: 'Right', jump: 'Jump / handbrake', sprint: 'Sprint',
  crouch: 'Crouch', interact: 'Interact (F)', horn: 'Horn', meter: 'Meter', tamperMeter: 'Tamper meter', attack: 'Attack',
  weaponNext: 'Next weapon', weaponPrev: 'Prev weapon', skip: 'Skip dialogue', phone: 'Phone', radio: 'Radio station',
};

export function loadBindings(): Bindings {
  return { ...DEFAULT_BINDINGS, ...safeStorage.get<Partial<Bindings>>(BIND_KEY, {}) };
}

/**
 * Pause menu (Esc / losing mouse lock): Resume, Settings, Controls (rebinding), Save, Load.
 * Settings: profanity, graphics preset, Retro 2004, volumes (horn separate), radio voice,
 * subtitles, mouse sensitivity, invert Y.
 */
export class PauseMenu implements GameSystem {
  readonly name = 'pauseMenu';
  open = false;
  private ctx!: GameContext;
  private el!: HTMLDivElement;
  private tab: 'main' | 'settings' | 'controls' = 'main';
  private bindings: Bindings = loadBindings();
  private rebinding: Action | null = null;
  private msg = '';
  private wasLocked = false;

  init(ctx: GameContext): void {
    this.ctx = ctx;
    ctx.input.setBindings(this.bindings);
    this.el = document.createElement('div');
    this.el.className = 'pause interactive';
    document.getElementById('overlay')!.append(this.el);
    this.el.addEventListener('click', (e) => this.onClick(e));
    this.el.addEventListener('input', (e) => this.onInput(e));
    document.addEventListener('pointerlockchange', () => {
      const locked = !!document.pointerLockElement;
      // Esc while playing releases the mouse: treat that as "pause".
      if (this.wasLocked && !locked && !ctx.services.phone?.open && ctx.clock.scale !== 0 && ctx.services.camera?.enabled !== false) this.show(true);
      this.wasLocked = locked;
    });
    window.addEventListener('keydown', (e) => {
      if (this.rebinding) {
        e.preventDefault();
        this.bind(this.rebinding, e.code);
      } else if (e.code === 'Escape' && !document.pointerLockElement && ctx.services.camera?.enabled !== false) {
        if (ctx.services.phone?.open) ctx.services.phone.toggle(false);
        else this.show(!this.open);
      }
    });
    window.addEventListener('mousedown', (e) => {
      if (this.rebinding && e.button !== 0) this.bind(this.rebinding, `Mouse${e.button}`);
    });
  }

  show(on: boolean): void {
    this.open = on;
    this.tab = 'main';
    this.msg = '';
    this.ctx.clock.scale = on ? 0 : 1;
    this.el.classList.toggle('show', on);
    if (on) this.render();
  }

  openTab(tab: 'main' | 'settings' | 'controls'): void {
    this.tab = tab;
    this.render();
  }

  private bind(action: Action, code: string): void {
    this.bindings = { ...this.bindings, [action]: [code] };
    safeStorage.set(BIND_KEY, this.bindings);
    this.ctx.input.setBindings(this.bindings);
    this.rebinding = null;
    audio.beep(990, 0.05);
    this.render();
  }

  private render(): void {
    const s = this.ctx.store.getState().settings;
    let body: string;
    if (this.tab === 'main') {
      body = `<div class="pm-title">RUKO ZARA, SABAR KARO</div>
        <button data-act="resume">Resume</button>
        <button data-tab="settings">Settings</button>
        <button data-tab="controls">Controls</button>
        <button data-act="save">Save game</button>
        <button data-act="load" ${hasSave() ? '' : 'disabled'}>Load game ${saveInfo() ? `<small>(${saveInfo()})</small>` : ''}</button>
        <div class="pm-msg">${this.msg}</div>`;
    } else if (this.tab === 'settings') {
      const check = (k: keyof Settings, label: string) => `<label><input type="checkbox" data-set="${k}" ${s[k] ? 'checked' : ''}> ${label}</label>`;
      const slider = (k: keyof Settings, label: string, min: number, max: number, step: number) =>
        `<label>${label} <input type="range" data-set="${k}" min="${min}" max="${max}" step="${step}" value="${s[k]}"></label>`;
      body = `<div class="pm-title">Settings</div><div class="pm-grid">
        ${check('profanity', 'Profanity (gaali) ON')}
        ${check('subtitles', 'Subtitles')}
        <label>Graphics <select data-set="graphics">${(['potato', 'normal', 'ultra'] as GraphicsPreset[]).map((g) => `<option value="${g}" ${s.graphics === g ? 'selected' : ''}>${g === 'potato' ? 'Potato' : g === 'normal' ? 'Normal' : 'Ultra Bhaukaal'}</option>`).join('')}</select></label>
        ${check('retro', 'Retro 2004 look')}
        ${slider('masterVolume', 'Master volume', 0, 1, 0.05)}
        ${slider('hornVolume', 'Horn volume', 0, 1, 0.05)}
        ${slider('radioVolume', 'Radio volume', 0, 1, 0.05)}
        ${check('radioVoice', 'Radio host voice (browser TTS)')}
        ${slider('mouseSensitivity', 'Mouse sensitivity', 0.1, 3, 0.05)}
        ${check('invertY', 'Invert Y')}
      </div><button data-tab="main">‹ Back</button>`;
    } else {
      body = `<div class="pm-title">Controls</div><div class="pm-binds">` +
        ACTIONS.filter((a) => !HIDDEN.includes(a)).map((a) => `<div><span>${LABELS[a] ?? a}</span><button data-bind="${a}">${this.rebinding === a ? 'Press a key…' : this.bindings[a].join(' / ')}</button></div>`).join('') +
        `</div><button data-act="resetBinds">Reset to defaults</button><button data-tab="main">‹ Back</button>`;
    }
    this.el.innerHTML = `<div class="pm-box">${body}</div>`;
  }

  private onClick(e: MouseEvent): void {
    const b = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null;
    if (!b) return;
    const d = b.dataset;
    if (d.tab) this.tab = d.tab as typeof this.tab;
    if (d.bind) this.rebinding = d.bind as Action;
    if (d.act === 'resume') {
      this.show(false);
      this.ctx.input.requestPointerLock();
      return;
    }
    if (d.act === 'save') this.msg = this.ctx.services.missions?.run ? 'Mission ke beech save nahi hota.' : saveGame(this.ctx) ? 'Save ho gaya!' : 'Save nahi hua (storage band hai?).';
    if (d.act === 'load') this.msg = loadGame(this.ctx) ? 'Load ho gaya. Pandey Niwas mein uthe.' : 'Koi save nahi mila.';
    if (d.act === 'resetBinds') {
      this.bindings = { ...DEFAULT_BINDINGS };
      safeStorage.remove(BIND_KEY);
      this.ctx.input.setBindings(this.bindings);
    }
    audio.beep(880, 0.04, 0.06);
    this.render();
  }

  private onInput(e: Event): void {
    const t = e.target as HTMLInputElement | HTMLSelectElement;
    const key = t.dataset.set as keyof Settings | undefined;
    if (!key) return;
    const value = t instanceof HTMLInputElement ? (t.type === 'checkbox' ? t.checked : Number(t.value)) : t.value;
    this.ctx.store.getState().setSettings({ [key]: value } as Partial<Settings>);
  }
}
