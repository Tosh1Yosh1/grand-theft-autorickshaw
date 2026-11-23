import * as THREE from 'three';
import { audio } from '../audio/AudioManager';
import { MISSION_TEXT, RANKS } from '../content/missions';
import type { GameContext, GameSystem } from '../core/System';
import { showBigScreen } from '../ui/bigScreen';
import { debugFolder } from '../ui/debugPanel';
import { playDialogue } from '../ui/dialogue';
import { formatRupees } from '../ui/format';
import { setPrompt } from '../ui/prompt';
import { showSubtitle } from '../ui/subtitles';
import { MissionRun } from './MissionRun';
import type { MissionDef, Step } from './types';

/** Saffron light pillar used for mission starts and objectives. */
function beam(color: string, height = 40, radius = 1.2): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, 16, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
  );
  m.position.y = height / 2;
  m.renderOrder = 5;
  return m;
}

function labelSprite(text: string, color: string): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(20,10,0,0.75)';
  g.fillRect(0, 0, 512, 128);
  g.strokeStyle = color;
  g.lineWidth = 6;
  g.strokeRect(3, 3, 506, 122);
  g.fillStyle = color;
  g.font = 'bold 52px "Arial Black", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 66);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  s.scale.set(6, 1.5, 1);
  s.position.y = 4;
  return s;
}

/**
 * Mission markers, the active mission's step machine, objective HUD, target beam,
 * guide arrow, pass/fail screens and rewards.
 */
export class MissionManager implements GameSystem {
  readonly name = 'missions';
  run: MissionRun | null = null;
  /** True when Pappu stands at a start marker (F starts the mission instead of entering a vehicle). */
  markerNearby = false;
  private ctx!: GameContext;
  private markers = new Map<string, THREE.Group>();
  private steps: Step[] = [];
  private stepIndex = 0;
  private stepStarted = false;
  private busy = false;
  private targetBeam!: THREE.Mesh;
  private arrow!: THREE.Mesh;
  private hud!: HTMLDivElement;

  constructor(private readonly defs: MissionDef[]) {}

  init(ctx: GameContext): void {
    this.ctx = ctx;
    ctx.services.missions = this;
    this.targetBeam = beam('#ffd60a', 60, 2);
    this.targetBeam.visible = false;
    ctx.scene.add(this.targetBeam);
    this.arrow = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1, 8).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffd60a', depthTest: false }));
    this.arrow.renderOrder = 10;
    this.arrow.visible = false;
    ctx.scene.add(this.arrow);
    this.hud = document.createElement('div');
    this.hud.className = 'objective';
    document.getElementById('overlay')!.append(this.hud);
    ctx.events.on('player:wasted', () => this.fail('Pappu khud hi khatam ho gaya.'));
    ctx.events.on('player:busted', () => this.fail('Challan kat gaya, mission bhi kat gaya.'));
    const f = debugFolder('Missions');
    for (const d of this.defs) f.add({ go: () => void this.start(d) }, 'go').name(`Start: ${d.title}`);
    f.add({ pass: () => this.pass() }, 'pass').name('Pass current');
    f.add({ fail: () => this.fail('Debug ne fail kiya.') }, 'fail').name('Fail current');
    f.add({ reset: () => ctx.store.getState().setProgress({ completed: [] }) }, 'reset').name('Reset progress');
  }

  /** Current objective target (for the minimap). */
  currentTarget(): THREE.Vector3 | null {
    return this.run ? (this.steps[this.stepIndex]?.target?.() ?? null) : null;
  }

  available(): MissionDef[] {
    const done = new Set(this.ctx.store.getState().progress.completed);
    return this.defs.filter((d) => !done.has(d.id) && d.requires.every((r) => done.has(r)));
  }

  private syncMarkers(): void {
    const lm = this.ctx.services.city?.landmarks;
    if (!lm) return;
    const avail = new Set(this.available().map((d) => d.id));
    for (const [id, g] of this.markers) {
      if (!avail.has(id) || this.run) {
        g.removeFromParent();
        this.markers.delete(id);
      }
    }
    if (this.run) return;
    for (const d of this.available()) {
      if (this.markers.has(d.id)) continue;
      const g = new THREE.Group();
      g.add(beam('#ff9f1c'), labelSprite(d.title, '#ff9f1c'));
      g.position.copy(d.start({ landmarks: lm })).setY(0);
      this.ctx.scene.add(g);
      this.markers.set(d.id, g);
    }
  }

  async start(def: MissionDef): Promise<void> {
    if (this.run || this.busy) return;
    this.busy = true;
    this.run = new MissionRun(def, this.ctx);
    this.syncMarkers();
    this.ctx.services.wanted?.set(0);
    await showBigScreen(def.title.toUpperCase(), def.tagline, '#ff9f1c', 2.2);
    await playDialogue(def.intro, this.ctx.input, this.ctx.clock);
    this.steps = def.steps(this.run);
    this.stepIndex = 0;
    this.stepStarted = false;
    this.busy = false;
  }

  private async pass(): Promise<void> {
    const run = this.run;
    if (!run || this.busy) return;
    this.busy = true;
    await playDialogue(run.def.outro, this.ctx.input, this.ctx.clock);
    const st = this.ctx.store.getState();
    const money = typeof run.def.reward.money === 'function' ? run.def.reward.money(run) : run.def.reward.money;
    const oldRank = rankOf(st.player.respect);
    st.setPlayer({ money: st.player.money + money, respect: st.player.respect + run.def.reward.respect });
    st.setProgress({ completed: [...st.progress.completed, run.def.id] });
    if (run.def.reward.weapon) this.ctx.services.combat?.give([run.def.reward.weapon]);
    if (run.def.reward.vehicle) st.setProgress({ unlockedVehicles: [...new Set([...st.progress.unlockedVehicles, run.def.reward.vehicle])] });
    audio.beep(988, 0.15);
    setTimeout(() => audio.beep(1318, 0.25), 150);
    this.finish();
    await showBigScreen(MISSION_TEXT.passed, `+${formatRupees(money)} · Respect +${run.def.reward.respect}`, '#ffd60a', 3);
    const newRank = rankOf(st.player.respect + run.def.reward.respect);
    if (newRank !== oldRank) await showBigScreen(`RANK: ${newRank.toUpperCase()}`, 'Mumbhai mein naam ho raha hai.', '#ff9f1c', 3);
    this.ctx.events.emit('mission:passed', { id: run.def.id });
    this.busy = false;
  }

  fail(reason: string): void {
    if (!this.run || this.busy) return;
    this.busy = true;
    const id = this.run.def.id;
    this.finish();
    void showBigScreen(MISSION_TEXT.failed, `${reason}<br><small>${MISSION_TEXT.retry}</small>`, '#ff3b30', 4).then(() => {
      this.busy = false;
      this.ctx.events.emit('mission:failed', { id });
    });
  }

  private finish(): void {
    this.run?.cleanup();
    this.run = null;
    this.steps = [];
    this.targetBeam.visible = false;
    this.arrow.visible = false;
    this.hud.classList.remove('show');
  }

  fixedUpdate(dt: number): void {
    const run = this.run;
    if (!run || this.busy || !this.steps.length) return;
    const step = this.steps[this.stepIndex];
    if (!step) {
      void this.pass();
      return;
    }
    if (!this.stepStarted) {
      this.stepStarted = true;
      const r = step.start?.(run);
      if (r instanceof Promise) {
        this.busy = true;
        void r.then(() => (this.busy = false));
        return;
      }
    }
    if (run.timer !== null) {
      run.timer -= dt;
      if (run.timer <= 0) run.timer = 0;
    }
    const res = step.update(run, dt);
    if (res === 'done') {
      this.stepIndex++;
      this.stepStarted = false;
      audio.beep(880, 0.06, 0.1);
    } else if (res !== 'running') this.fail(res.fail);
    // Wasted or busted mid-mission = fail.
  }

  update(dt: number): void {
    if (this.ctx.clock.scale === 0) return; // cutscene: dialogue owns the keyboard
    this.syncMarkers();
    for (const g of this.markers.values()) (g.children[1] as THREE.Sprite).position.y = 4 + Math.sin(performance.now() / 400) * 0.3;
    const run = this.run;
    this.markerNearby = false;
    if (!run) {
      // Near a marker? Offer to start.
      const p = this.ctx.services.vehicles?.current?.position ?? this.ctx.services.player?.position;
      if (!p || this.busy) return;
      for (const d of this.available()) {
        const m = this.markers.get(d.id);
        if (m && Math.hypot(m.position.x - p.x, m.position.z - p.z) < 5) {
          this.markerNearby = true;
          setPrompt(`<kbd>F</kbd> Mission: ${d.title}`);
          if (this.ctx.input.wasPressed('interact')) void this.start(d);
          return;
        }
      }
      return;
    }
    run.updateSeated();
    const step = this.steps[this.stepIndex];
    const target = step?.target?.() ?? null;
    this.targetBeam.visible = !!target;
    if (target) this.targetBeam.position.set(target.x, 30, target.z);
    // Guide arrow above Pappu pointing at the objective.
    const p = run.playerPos;
    this.arrow.visible = !!target && Math.hypot(target.x - p.x, target.z - p.z) > 8;
    if (target) {
      this.arrow.position.copy(p).add(new THREE.Vector3(0, this.ctx.services.vehicles?.current ? 3.2 : 2.6, 0));
      this.arrow.lookAt(target.x, this.arrow.position.y, target.z);
    }
    // Objective panel.
    if (step && !this.busy) {
      const text = typeof step.objective === 'function' ? step.objective() : step.objective;
      const dist = target ? ` · ${Math.round(Math.hypot(target.x - p.x, target.z - p.z))} m` : '';
      const timer = run.timer !== null ? ` · ⏱ ${Math.floor(run.timer / 60)}:${String(Math.floor(run.timer % 60)).padStart(2, '0')}` : '';
      const meters = run.meters.map((m) => `<div class="ob-extra">${m.label}<div class="ob-bar"><div style="width:${Math.round(m.value * 100)}%;background:${m.color}"></div></div></div>`).join('');
      this.hud.innerHTML = `<div class="ob-title">${run.def.title}${timer}</div><div class="ob-text">${text}${dist}</div>${run.extraText ? `<div class="ob-extra">${run.extraText}</div>` : ''}${meters}`;
      this.hud.classList.toggle('show', !!text);
    }
    void dt;
  }

  /** Helper for missions: a subtitle line. */
  say(text: string, who: string): void {
    showSubtitle(text, who);
  }
}

export function rankOf(respect: number): string {
  let name = RANKS[0]!.name;
  for (const r of RANKS) if (respect >= r.respect) name = r.name;
  return name;
}
