import * as THREE from 'three';
import { audio } from '../../audio/AudioManager';
import { pickLine } from '../../content/lines';
import { MENU, MENU_TAGLINES } from '../../content/menu';
import { deleteSave, hasSave, loadGame, saveInfo } from '../../core/save';
import { safeStorage } from '../../core/storage';
import type { GameContext, GameSystem } from '../../core/System';
import { SPAWN } from '../../world/city/layout';
import type { PauseMenu } from './PauseMenu';

const GATE_KEY = 'gtar.gate.v1';

/**
 * Title screen over a slow cinematic orbit of Mumbhai at golden hour.
 * First visit shows the 18+ gate (profanity on/off). Continue / New game / Settings / Credits.
 */
export class MainMenu implements GameSystem {
  readonly name = 'mainMenu';
  readonly priority = 105; // after the gameplay camera, so we can override it
  open = true;
  private ctx!: GameContext;
  private el!: HTMLDivElement;
  private t = 0;
  private confirming = false;
  private screen: 'gate' | 'main' | 'credits' = 'main';

  constructor(private readonly pause: PauseMenu) {}

  init(ctx: GameContext): void {
    this.ctx = ctx;
    this.el = document.createElement('div');
    this.el.className = 'main-menu interactive';
    this.el.addEventListener('click', (e) => this.onClick(e));
    document.getElementById('overlay')!.append(this.el);
    if (!safeStorage.get(GATE_KEY, false)) this.screen = 'gate';
    if (ctx.services.dayNight) ctx.services.dayNight.hour = 17.6;
    this.setOpen(true);
  }

  private setOpen(on: boolean): void {
    this.open = on;
    this.el.classList.toggle('show', on);
    document.getElementById('overlay')!.classList.toggle('in-menu', on);
    const s = this.ctx.services;
    if (s.camera) s.camera.enabled = !on;
    if (s.player) s.player.active = !on;
    this.ctx.clock.scale = 1;
    if (on) this.render();
  }

  private render(): void {
    const profanity = this.ctx.store.getState().settings.profanity;
    let body: string;
    if (this.screen === 'gate') {
      body = `<div class="mm-gate"><h2>${MENU.gateTitle}</h2><p>${MENU.gateText}</p>
        <button data-gate="dirty">${MENU.gateDirty}</button><button data-gate="clean" class="alt">${MENU.gateClean}</button></div>`;
    } else if (this.screen === 'credits') {
      body = `<div class="mm-gate"><h2>${MENU.credits}</h2><p>${MENU.credits_text}</p><button data-back>‹ Back</button></div>`;
    } else {
      const save = hasSave();
      body = `<div class="mm-title">${MENU.title}</div><div class="mm-sub">${MENU.subtitle}</div>
        <div class="mm-tag">"${pickLine(MENU_TAGLINES, profanity)}"</div>
        <div class="mm-buttons">
          ${save ? `<button data-act="continue">${MENU.continue}<small>${saveInfo()}</small></button>` : ''}
          <button data-act="new" class="${save ? 'alt' : ''}">${this.confirming ? MENU.confirmNew : MENU.newGame}</button>
          <button data-act="settings" class="alt">${MENU.settings} / ${MENU.controls}</button>
          <button data-act="credits" class="alt">${MENU.credits}</button>
        </div>
        <div class="mm-foot">Click to play · WASD · F · Esc pause · Fan-made parody, all original</div>`;
    }
    this.el.innerHTML = body;
  }

  private onClick(e: MouseEvent): void {
    const b = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null;
    if (!b) return;
    audio.unlock();
    audio.beep(880, 0.04, 0.06);
    const d = b.dataset;
    const st = this.ctx.store.getState();
    if (d.gate) {
      st.setSettings({ profanity: d.gate === 'dirty' });
      safeStorage.set(GATE_KEY, true);
      this.screen = 'main';
    }
    if (d.back !== undefined) this.screen = 'main';
    if (d.act === 'credits') this.screen = 'credits';
    if (d.act === 'settings') {
      this.pause.show(true);
      this.pause.openTab('settings');
      return;
    }
    if (d.act === 'continue') {
      loadGame(this.ctx);
      return this.start();
    }
    if (d.act === 'new') {
      if (hasSave() && !this.confirming) {
        this.confirming = true;
        return this.render();
      }
      deleteSave();
      st.setPlayer({ money: 4200, health: 100, wanted: 0, weapons: ['fists', 'chappal'], weapon: 'fists', respect: 0 });
      st.setProgress({ completed: [], unlockedVehicles: ['auto'], stats: {} });
      this.ctx.services.player?.teleport(new THREE.Vector3(SPAWN.x, 0.3, SPAWN.z));
      if (this.ctx.services.dayNight) this.ctx.services.dayNight.hour = 16.5;
      return this.start();
    }
    this.render();
  }

  private start(): void {
    this.setOpen(false);
    const s = this.ctx.services;
    if (s.player) s.camera?.follow(s.player.cameraTarget, true);
    this.ctx.input.requestPointerLock();
    this.ctx.events.emit('game:start');
  }

  update(dt: number): void {
    if (!this.open) return;
    // Slow cinematic orbit over Jugaadpur toward the half-built flyover.
    this.t += dt * 0.05;
    const cam = this.ctx.camera;
    const cx = 0;
    const cz = -40;
    cam.position.set(cx + Math.cos(this.t) * 140, 55 + Math.sin(this.t * 0.7) * 10, cz + Math.sin(this.t) * 140);
    cam.lookAt(cx, 8, cz);
    if (Math.abs(cam.fov - 55) > 0.1) {
      cam.fov = 55;
      cam.updateProjectionMatrix();
    }
  }
}
