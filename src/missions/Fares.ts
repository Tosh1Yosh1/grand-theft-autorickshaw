import * as THREE from 'three';
import type { Ped } from '../ai/peds/Pedestrians';
import { audio } from '../audio/AudioManager';
import { FARE_LINES, RATINGS } from '../content/missions2';
import { pickLine } from '../content/lines';
import type { GameContext, GameSystem } from '../core/System';
import { setPrompt } from '../ui/prompt';
import { showSubtitle } from '../ui/subtitles';
import { BLOCK, HALF, ROAD_W, SIDEWALK_W, roadCoord } from '../world/city/layout';

type State = 'idle' | 'hailing' | 'riding';

/**
 * Auto side hustle: while driving the auto (and not on a mission), people hail you.
 * Stop next to them, take them where they want, collect the meter fare + a fake rating.
 */
export class Fares implements GameSystem {
  readonly name = 'fares';
  private ctx!: GameContext;
  private state: State = 'idle';
  private timer = 15;
  private fare: Ped | null = null;
  private dest = new THREE.Vector3();
  private beam!: THREE.Mesh;
  private ratings: number[] = [];

  init(ctx: GameContext): void {
    this.ctx = ctx;
    this.beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.2, 50, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: '#4cc9f0', transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
    );
    this.beam.visible = false;
    ctx.scene.add(this.beam);
  }

  private sidewalkNear(p: THREE.Vector3, min: number, max: number): THREE.Vector3 | null {
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = min + Math.random() * (max - min);
      const x = p.x + Math.cos(a) * d;
      const z = p.z + Math.sin(a) * d;
      if (Math.abs(x) > HALF - 10 || Math.abs(z) > HALF - 10) continue;
      const ix = Math.round((x + HALF) / BLOCK);
      const rx = roadCoord(ix) + Math.sign(x - roadCoord(ix) || 1) * (ROAD_W / 2 + SIDEWALK_W / 2);
      return new THREE.Vector3(rx, 0.15, z);
    }
    return null;
  }

  update(dt: number): void {
    const s = this.ctx.services;
    const v = s.vehicles?.current;
    const inAuto = v?.config.id === 'auto' && !s.missions?.run;
    if (!inAuto && this.state !== 'riding') {
      this.reset();
      return;
    }
    if (this.ctx.clock.scale === 0) return;
    switch (this.state) {
      case 'idle':
        this.timer -= dt;
        if (this.timer <= 0 && v) {
          const spot = this.sidewalkNear(v.position, 30, 70);
          const ped = spot ? s.peds?.spawn(['commuter', 'aunty', 'uncle', 'startupBro'][Math.floor(Math.random() * 4)] as 'commuter', spot, 0, true) : null;
          if (ped) {
            ped.anim = 'wave';
            this.fare = ped;
            this.state = 'hailing';
            showSubtitle(pickLine(FARE_LINES.hail, false), 'Sawari', 3);
          } else this.timer = 5;
        }
        break;
      case 'hailing': {
        const ped = this.fare!;
        this.beam.visible = true;
        this.beam.position.set(ped.pos.x, 25, ped.pos.z);
        if (!v) return;
        const d = v.position.distanceTo(ped.pos);
        if (d > 120) return this.reset();
        ped.heading = Math.atan2(v.position.x - ped.pos.x, v.position.z - ped.pos.z);
        if (d < 6 && Math.abs(v.speed) < 1.5) {
          setPrompt('<kbd>F</kbd> Sawari bithao');
          if (this.ctx.input.wasPressed('interact')) {
            this.state = 'riding';
            const dest = this.sidewalkNear(v.position, 150, 380);
            if (!dest) return this.reset();
            this.dest.copy(dest);
            const meter = s.vehicles!.meter;
            if (!meter.running) meter.flagDown();
            showSubtitle(pickLine(FARE_LINES.board, false), 'Sawari', 3.5);
          }
        }
        break;
      }
      case 'riding': {
        const ped = this.fare!;
        if (!v || v.config.id !== 'auto') {
          // Passenger left behind: they walk off, no fare.
          showSubtitle('Sawari utar gayi. "1 star!"', 'Sawari');
          return this.reset();
        }
        const q = new THREE.Quaternion();
        const r = v.body.rotation();
        q.set(r.x, r.y, r.z, r.w);
        ped.pos.copy(new THREE.Vector3(...v.config.passengerSeats[2]!).applyQuaternion(q).add(v.position));
        ped.heading = v.heading;
        ped.anim = 'sitting';
        this.beam.visible = true;
        this.beam.position.set(this.dest.x, 25, this.dest.z);
        this.timer -= dt;
        if (s.vehicles!.meter.tampered && this.timer <= 0) {
          this.timer = 12;
          showSubtitle(pickLine(FARE_LINES.tampered, false), 'Sawari');
        }
        if (v.position.distanceTo(this.dest) < 8 && Math.abs(v.speed) < 1.5) this.dropOff();
        break;
      }
    }
  }

  private dropOff(): void {
    const s = this.ctx.services;
    const meter = s.vehicles!.meter;
    const tampered = meter.tampered;
    const fare = Math.max(30, meter.stop());
    // Ratings: random, absurd, and worse if the meter was "fast".
    const pool = tampered ? RATINGS.filter((r) => r.stars <= 3) : RATINGS;
    const rating = pool[Math.floor(Math.random() * pool.length)]!;
    this.ratings.push(rating.stars);
    const avg = this.ratings.reduce((a, b) => a + b, 0) / this.ratings.length;
    const st = this.ctx.store.getState();
    st.setPlayer({ money: st.player.money + fare, respect: st.player.respect + 3 });
    st.setProgress({ stats: { ...st.progress.stats, fares: (st.progress.stats.fares ?? 0) + 1 } });
    audio.beep(1320, 0.1);
    showSubtitle(`₹${fare} · ${'★'.repeat(rating.stars)}${'☆'.repeat(5 - rating.stars)} "${rating.text}" · Avg ${avg.toFixed(1)}`, 'Rating', 5);
    if (tampered && Math.random() < 0.3) {
      s.wanted?.raise(1);
      showSubtitle('Sawari ne complaint kar di: "meter tez tha!"', 'Rating', 4);
    }
    const ped = this.fare;
    if (ped) {
      s.peds?.release(ped);
      ped.pos.add(new THREE.Vector3(1.5, 0, 0));
    }
    this.fare = null;
    this.state = 'idle';
    this.timer = 10 + Math.random() * 15;
    this.beam.visible = false;
  }

  private reset(): void {
    if (this.fare) this.ctx.services.peds?.release(this.fare);
    this.fare = null;
    this.state = 'idle';
    this.timer = 12 + Math.random() * 10;
    this.beam.visible = false;
  }
}
