import * as THREE from 'three';
import { audio } from '../audio/AudioManager';
import { pickLine, type Line } from '../content/lines';
import { BRIBE_ACCEPT, BRIBE_OFFER, BRIBE_REFUSE, HIDE_LINES, MUMMY_CALL, NETA_LINES, RESPRAY_LINES } from '../content/wanted';
import type { GameContext, GameSystem } from '../core/System';
import { debugFolder } from '../ui/debugPanel';
import { formatRupees } from '../ui/format';
import { setPrompt } from '../ui/prompt';
import { showSubtitle } from '../ui/subtitles';

/** Bribe price per level. Level 4+: "ab bahut der ho gayi". */
const BRIBE = [0, 200, 600, 2500];
const RESPRAY_COST = 2000;
const NETA_COST_PER_LEVEL = 5000;

/**
 * The Challan system: 0-5 chappals. Crimes raise it, staying out of sight lowers it,
 * and Mumbhai offers many creative ways to make it go away.
 */
export class Wanted implements GameSystem {
  readonly name = 'wanted';
  /** True while a bribe/respray/neta deal can be made with F (VehicleManager yields F to us). */
  dealAvailable = false;
  private ctx!: GameContext;
  private cool = 0;
  private pedHits = 0;
  private mummyTimer = 10;
  private hideAnnounced = false;
  private dealAction: (() => void) | null = null;

  init(ctx: GameContext): void {
    this.ctx = ctx;
    ctx.services.wanted = this;
    const e = ctx.events;
    e.on('crime:pedHit', () => {
      this.pedHits++;
      this.raise(this.level === 0 ? 1 : this.pedHits % 3 === 0 ? this.level + 1 : this.level);
    });
    e.on('crime:cowHit', () => this.raise(Math.max(this.level, 3)));
    e.on('crime:carHit', ({ position }) => {
      if (this.copNear(position, 60) || Math.random() < 0.3) this.raise(Math.max(this.level, 1));
    });
    e.on('crime:assault', ({ position, cop }) => {
      if (cop) this.raise(Math.max(this.level + 1, 2));
      else if (this.copNear(position, 40) || Math.random() < 0.3) this.raise(Math.max(this.level, 1));
    });
    const f = debugFolder('Challan (wanted)');
    for (let i = 0; i <= 5; i++) f.add({ go: () => this.set(i) }, 'go').name(`Set ${i} chappals`);
  }

  get level(): number {
    return this.ctx.store.getState().player.wanted;
  }

  /** Any cop seeing Pappu right now? */
  get seen(): boolean {
    return this.level > 0 && this.copNear(this.focus(), 55);
  }

  private focus(): THREE.Vector3 {
    const s = this.ctx.services;
    return s.vehicles?.current?.position ?? s.player?.position ?? this.ctx.camera.position;
  }

  private copNear(p: THREE.Vector3, r: number): boolean {
    return (this.ctx.services.police?.nearest(p) ?? Infinity) < r;
  }

  set(level: number): void {
    const l = Math.max(0, Math.min(5, level));
    if (l === this.level) return;
    this.ctx.store.getState().setPlayer({ wanted: l });
    this.cool = 0;
    this.ctx.events.emit('wanted:change', { level: l });
  }

  raise(level: number): void {
    if (level > this.level) {
      this.set(level);
      audio.beep(440, 0.15, 0.15);
    }
    this.cool = 0;
  }

  fixedUpdate(dt: number): void {
    const level = this.level;
    if (level === 0) {
      this.pedHits = 0;
      return;
    }
    const s = this.ctx.services;
    const p = this.focus();
    // Hiding spots speed up cooling down.
    let rate = 1;
    const inBaraat = !s.vehicles?.current && !!s.events?.inBaraat(p);
    const jam = !!s.vehicles?.current && Math.abs(s.vehicles.current.speed) < 1 && (s.traffic?.cars.filter((c) => c.pos.distanceTo(p) < 14).length ?? 0) >= 3;
    if (inBaraat) rate = 5;
    else if (jam) rate = 2.5;
    if ((inBaraat || jam) && !this.hideAnnounced) {
      this.hideAnnounced = true;
      showSubtitle(pickLine(HIDE_LINES.slice(inBaraat ? 0 : 1), this.ctx.store.getState().settings.profanity), 'Pappu');
    }
    if (!inBaraat && !jam) this.hideAnnounced = false;

    if (this.seen && rate === 1) this.cool = 0;
    else this.cool += dt * rate;
    if (this.cool > 8 + level * 4) this.set(level - 1);

    if (level >= 5) {
      this.mummyTimer -= dt;
      if (this.mummyTimer <= 0) {
        this.mummyTimer = 35;
        audio.ring();
        setTimeout(() => showSubtitle(pickLine(MUMMY_CALL, false), 'Mummy (calling)', 5), 1500);
        this.ctx.events.emit('phone:call', { from: 'Mummy' });
      }
    }
  }

  update(): void {
    this.dealAvailable = false;
    this.dealAction = null;
    const level = this.level;
    const s = this.ctx.services;
    const st = this.ctx.store.getState();
    const money = st.player.money;
    const lm = s.city?.landmarks;
    const say = (pool: readonly Line[], who: string) => showSubtitle(pickLine(pool, st.settings.profanity), who, 3.5);
    let prompt: string | null = null;

    if (level > 0) {
      const p = this.focus();
      const v = s.vehicles?.current;
      const stopped = !v || Math.abs(v.speed) < 1.5;
      // 1) Bribe the hawaldar.
      const cop = s.police?.nearestFootCop(p);
      if (cop && cop.pos.distanceTo(p) < 3.2 && stopped) {
        const price = BRIBE[level];
        if (price === undefined) {
          prompt = '<kbd>F</kbd> Chai-paani? (Refused at this level)';
          this.dealAction = () => say(BRIBE_REFUSE, 'Hawaldar');
        } else {
          prompt = `<kbd>F</kbd> Chai-paani: ${formatRupees(price)}`;
          this.dealAction = () => {
            if (money < price) return say(BRIBE_REFUSE.slice(3), 'Hawaldar');
            st.setPlayer({ money: money - price });
            this.set(0);
            say(BRIBE_ACCEPT, 'Hawaldar');
          };
          if (Math.random() < 0.01) say(BRIBE_OFFER, 'Hawaldar');
        }
      }
      // 2) Denting-Painting respray (in a vehicle).
      if (!prompt && v && lm && v.position.distanceTo(lm.dentingPainting) < 7 && stopped) {
        if (level <= 4) {
          prompt = `<kbd>F</kbd> Respray: ${formatRupees(RESPRAY_COST)}`;
          this.dealAction = () => {
            if (money < RESPRAY_COST) return showSubtitle('Paise nahi hain? Pehle kamao.', 'Painter');
            st.setPlayer({ money: money - RESPRAY_COST });
            repaint(v.object);
            this.set(0);
            say(RESPRAY_LINES, 'Painter');
          };
        } else prompt = 'Painter: "Itna garam maal? Netaji ke paas jao."';
      }
      // 3) Pay off the neta (on foot).
      if (!prompt && !v && lm && s.player && s.player.position.distanceTo(lm.netaOffice) < 4) {
        const price = NETA_COST_PER_LEVEL * level;
        prompt = `<kbd>F</kbd> Netaji se setting: ${formatRupees(price)}`;
        this.dealAction = () => {
          if (money < price) return showSubtitle('Netaji free mein sirf bhashan dete hain.', 'PA');
          st.setPlayer({ money: money - price });
          this.set(0);
          say(NETA_LINES, 'Netaji ka PA');
        };
      }
    }
    if (prompt) {
      this.dealAvailable = true;
      setPrompt(prompt);
      if (this.ctx.input.wasPressed('interact')) {
        this.dealAction?.();
        audio.beep(880, 0.1);
      }
    }
  }
}

/** New colour, new identity. */
function repaint(obj: THREE.Object3D): void {
  const color = new THREE.Color().setHSL(Math.random(), 0.7, 0.5);
  obj.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (m && (m.name === 'paint' || m.color?.getHexString() === 'f2c12e' || m.color?.getHexString() === '1f8a4c')) {
      (o as THREE.Mesh).material = m.clone();
      ((o as THREE.Mesh).material as THREE.MeshStandardMaterial).color.copy(color);
    }
  });
}
