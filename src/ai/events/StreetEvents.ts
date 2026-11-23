import type RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { audio } from '../../audio/AudioManager';
import { EVENT_LINES } from '../../content/barks';
import type { GameContext, GameSystem } from '../../core/System';
import { debugFolder } from '../../ui/debugPanel';
import { showSubtitle } from '../../ui/subtitles';
import { BLOCK, HALF, roadCoord } from '../../world/city/layout';
import { bark } from '../bark';
import type { Ped } from '../peds/Pedestrians';
import { Rain } from './Rain';

export type EventKind = 'baraat' | 'cricket' | 'waterlog' | 'digging' | 'rally';

export interface Blocker {
  x: number;
  z: number;
  r: number;
}

interface ActiveEvent {
  kind: EventKind;
  pos: THREE.Vector3;
  /** Unit vector along the road. */
  along: THREE.Vector3;
  timer: number;
  peds: Ped[];
  group: THREE.Group;
  colliders: RAPIER.Collider[];
  blocker: Blocker;
  extra: Record<string, number>;
  ball?: { mesh: THREE.Mesh; from: THREE.Vector3; to: THREE.Vector3; t: number } | null;
}

const ANNOUNCE: Record<EventKind, string> = {
  baraat: 'Aage baraat hai! Raasta band, dance chalu.',
  cricket: 'Gully cricket match chal raha hai. Windshield sambhaal ke.',
  waterlog: 'Baarish! Monsoon aa gaya. Gaadiyan tairne lagi.',
  digging: 'Aage road khudai. Inconvenience regretted.',
  rally: 'Netaji ki rally! Poora road unka.',
};

export class StreetEvents implements GameSystem {
  readonly name = 'streetEvents';
  readonly blockers: Blocker[] = [];
  readonly active: ActiveEvent[] = [];
  readonly tuning = { minGap: 70, maxGap: 140, enabled: true };
  private ctx!: GameContext;
  private next = 40;
  private time = 0;
  private beat = 0;
  private rain!: Rain;

  init(ctx: GameContext): void {
    this.ctx = ctx;
    ctx.services.events = this;
    this.rain = new Rain(ctx.scene);
    const f = debugFolder('Street events');
    f.add(this.tuning, 'enabled').name('Random events');
    for (const k of ['baraat', 'cricket', 'waterlog', 'digging', 'rally'] as EventKind[]) f.add({ go: () => this.start(k) }, 'go').name(`Start ${k}`);
    f.add({ end: () => [...this.active].forEach((e) => this.end(e)) }, 'end').name('End all events');
  }

  private focus(): THREE.Vector3 {
    const s = this.ctx.services;
    return s.vehicles?.current?.position ?? s.player?.position ?? this.ctx.camera.position;
  }

  /** Is (x, z) inside an active baraat? (Wanted system: hide in the crowd.) */
  inBaraat(p: THREE.Vector3): boolean {
    return this.active.some((e) => e.kind === 'baraat' && e.pos.distanceTo(p) < 7);
  }

  /** Waterlogged zones, for floating vehicles. */
  waterAt(p: THREE.Vector3): boolean {
    return this.active.some((e) => e.kind === 'waterlog' && Math.hypot(p.x - e.pos.x, p.z - e.pos.z) < e.blocker.r);
  }

  /** Road segment midpoint 50-110 m ahead-ish of the focus. */
  private site(): { pos: THREE.Vector3; along: THREE.Vector3 } {
    const c = this.focus();
    const cam = this.ctx.camera;
    const fwd = new THREE.Vector3();
    cam.getWorldDirection(fwd);
    for (let i = 0; i < 20; i++) {
      const ix = Math.round((c.x + fwd.x * 70 + HALF) / BLOCK + (Math.random() - 0.5) * 2);
      const iz = Math.round((c.z + fwd.z * 70 + HALF) / BLOCK + (Math.random() - 0.5) * 2);
      const alongX = Math.random() < 0.5;
      const pos = alongX ? new THREE.Vector3(roadCoord(ix) + BLOCK / 2, 0, roadCoord(iz)) : new THREE.Vector3(roadCoord(ix), 0, roadCoord(iz) + BLOCK / 2);
      const d = pos.distanceTo(c);
      if (Math.abs(pos.x) > HALF || Math.abs(pos.z) > HALF || d < 40 || d > 130) continue;
      return { pos, along: alongX ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1) };
    }
    return { pos: new THREE.Vector3(roadCoord(5) + BLOCK / 2, 0, roadCoord(5)), along: new THREE.Vector3(1, 0, 0) };
  }

  start(kind: EventKind): void {
    if (this.active.some((e) => e.kind === kind)) return;
    const { pos, along } = this.site();
    const e: ActiveEvent = { kind, pos, along, timer: kind === 'waterlog' ? 180 : 150, peds: [], group: new THREE.Group(), colliders: [], blocker: { x: pos.x, z: pos.z, r: 6 }, extra: {} };
    const peds = this.ctx.services.peds;
    const side = new THREE.Vector3(-along.z, 0, along.x);
    const spawn = (type: Parameters<NonNullable<typeof peds>['spawn']>[0], p: THREE.Vector3, heading = 0) => {
      const ped = peds?.spawn(type, p, heading, true);
      if (ped) e.peds.push(ped);
      return ped;
    };
    switch (kind) {
      case 'baraat': {
        for (let i = 0; i < 14; i++) {
          const p = pos.clone().addScaledVector(along, (Math.random() - 0.5) * 10).addScaledVector(side, (Math.random() - 0.5) * 6);
          const ped = spawn('dancer', p, Math.random() * 6);
          if (ped) ped.anim = 'dance';
        }
        // The groom, on the "ghodi" (a very patient white cow).
        const cow = this.ctx.services.animals?.spawnCow(pos.clone().addScaledVector(along, -6));
        if (cow) {
          cow.state = 'stand';
          cow.timer = 9999;
          e.extra.cow = this.ctx.services.animals!.cows.indexOf(cow);
        }
        const groom = spawn('uncle', pos.clone().addScaledVector(along, -6).setY(1.4));
        if (groom) groom.anim = 'wave';
        e.blocker.r = 8;
        break;
      }
      case 'cricket': {
        const stumps = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.7, 0.05), new THREE.MeshStandardMaterial({ color: '#e9c46a' }));
        stumps.position.copy(pos).addScaledVector(along, -6).setY(0.35);
        e.group.add(stumps);
        const batsman = spawn('kid', pos.clone().addScaledVector(along, -5.3));
        if (batsman) batsman.anim = 'bat';
        for (let i = 0; i < 5; i++) {
          const p = pos.clone().addScaledVector(along, 2 + Math.random() * 8).addScaledVector(side, (Math.random() - 0.5) * 8);
          const kid = spawn('kid', p, Math.atan2(-along.x, -along.z));
          if (kid) kid.anim = 'idle';
        }
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshStandardMaterial({ color: '#c1121f' }));
        ball.visible = false;
        e.group.add(ball);
        e.ball = { mesh: ball, from: new THREE.Vector3(), to: new THREE.Vector3(), t: -1 };
        e.extra.cooldown = 4;
        break;
      }
      case 'waterlog': {
        const water = new THREE.Mesh(new THREE.CircleGeometry(16, 28), new THREE.MeshStandardMaterial({ color: '#4d5f53', roughness: 0.1, metalness: 0.4, transparent: true, opacity: 0.85 }));
        water.rotation.x = -Math.PI / 2;
        water.position.copy(pos).setY(0.25);
        e.group.add(water);
        e.blocker.r = 16;
        this.rain.setActive(true);
        break;
      }
      case 'digging': {
        const off = side.clone().multiplyScalar(-3);
        const center = pos.clone().add(off);
        const pit = new THREE.Mesh(new THREE.BoxGeometry(along.x ? 14 : 5, 0.3, along.z ? 14 : 5), new THREE.MeshStandardMaterial({ color: '#5c4033' }));
        pit.position.copy(center).setY(0.1);
        e.group.add(pit);
        const stripe = new THREE.MeshStandardMaterial({ color: '#ffd60a' });
        for (let k = -3; k <= 3; k++) {
          for (const s of [-1, 1]) {
            const b = new THREE.Mesh(new THREE.BoxGeometry(along.x ? 1.8 : 0.2, 1, along.z ? 1.8 : 0.2), stripe);
            b.position.copy(center).addScaledVector(along, k * 2).addScaledVector(side, s * 2.7).setY(0.5);
            b.castShadow = true;
            e.group.add(b);
          }
        }
        const R = this.ctx.physics.rapier;
        e.colliders.push(this.ctx.physics.world.createCollider(R.ColliderDesc.cuboid(along.x ? 7 : 2.7, 0.6, along.z ? 7 : 2.7).setTranslation(center.x, 0.6, center.z)));
        for (let i = 0; i < 2; i++) {
          const w = spawn('commuter', center.clone().addScaledVector(side, 3.5).addScaledVector(along, i * 3 - 1.5).setY(0.15));
          if (w) w.anim = 'sitting';
        }
        e.blocker = { x: center.x, z: center.z, r: 6 };
        break;
      }
      case 'rally': {
        for (let i = 0; i < 16; i++) {
          const p = pos.clone().addScaledVector(along, (Math.random() - 0.5) * 12).addScaledVector(side, (Math.random() - 0.5) * 8);
          const ped = spawn('supporter', p, Math.atan2(along.x, along.z));
          if (ped) ped.anim = 'chant';
        }
        // The loudspeaker tempo: parked, and stealable.
        const tempo = this.ctx.services.vehicles?.spawn('tempo', pos.clone().addScaledVector(along, 8).setY(1), Math.atan2(along.x, along.z));
        if (tempo) e.extra.tempo = this.ctx.services.vehicles!.vehicles.indexOf(tempo);
        e.blocker.r = 10;
        break;
      }
    }
    this.ctx.scene.add(e.group);
    this.active.push(e);
    this.blockers.push(e.blocker);
    showSubtitle(ANNOUNCE[kind], 'Bhaukaal FM traffic update', 4);
    this.ctx.events.emit('event:start', { kind, position: pos.clone() });
  }

  end(e: ActiveEvent): void {
    const peds = this.ctx.services.peds;
    for (const p of e.peds) {
      if (!peds) continue;
      p.pos.y = 0.15;
      peds.release(p);
    }
    for (const c of e.colliders) this.ctx.physics.world.removeCollider(c, false);
    e.group.removeFromParent();
    if (e.kind === 'waterlog') this.rain.setActive(false);
    if (e.extra.cow !== undefined) {
      const cow = this.ctx.services.animals?.cows[e.extra.cow];
      if (cow) cow.timer = 2;
    }
    if (e.extra.tempo !== undefined) {
      const vm = this.ctx.services.vehicles;
      const t = vm?.vehicles[e.extra.tempo];
      if (vm && t && t !== vm.current) vm.remove(t);
    }
    this.active.splice(this.active.indexOf(e), 1);
    this.blockers.splice(this.blockers.indexOf(e.blocker), 1);
    this.ctx.events.emit('event:end', { kind: e.kind });
  }

  fixedUpdate(dt: number): void {
    this.time += dt;
    const focus = this.focus();
    if (this.tuning.enabled && this.time > this.next) {
      this.next = this.time + this.tuning.minGap + Math.random() * (this.tuning.maxGap - this.tuning.minGap);
      const kinds: EventKind[] = ['baraat', 'cricket', 'waterlog', 'digging', 'rally'];
      this.start(kinds[Math.floor(Math.random() * kinds.length)]!);
    }
    for (const e of [...this.active]) {
      e.timer -= dt;
      if (e.timer <= 0 || e.pos.distanceTo(focus) > 260) {
        this.end(e);
        continue;
      }
      const near = e.pos.distanceTo(focus) < 25;
      if (near && Math.random() < dt * 0.25) bark(EVENT_LINES[e.kind], e.kind === 'cricket' ? 'kid' : e.kind === 'rally' ? 'Rally' : e.kind === 'baraat' ? 'Baraati' : 'Raahgir', null, null);
      if (e.kind === 'baraat') this.updateBaraat(e, dt, focus);
      if (e.kind === 'rally') {
        for (const p of e.peds) p.pos.addScaledVector(e.along, 0.4 * dt);
        e.pos.addScaledVector(e.along, 0.4 * dt);
        e.blocker.x = e.pos.x;
        e.blocker.z = e.pos.z;
      }
      if (e.kind === 'cricket') this.updateCricket(e, dt, focus);
      if (e.kind === 'waterlog') this.updateWater(e, dt);
    }
  }

  private updateBaraat(e: ActiveEvent, dt: number, focus: THREE.Vector3): void {
    const step = e.along.clone().multiplyScalar(0.6 * dt);
    e.pos.add(step);
    e.blocker.x = e.pos.x;
    e.blocker.z = e.pos.z;
    for (const p of e.peds) {
      p.pos.add(step);
      if (p.anim === 'dance') p.heading += dt * (Math.sin(this.time + p.phase) * 2);
    }
    const cow = e.extra.cow !== undefined ? this.ctx.services.animals?.cows[e.extra.cow] : undefined;
    if (cow) {
      cow.pos.add(step);
      cow.heading = Math.atan2(e.along.x, e.along.z);
    }
    // Dhol: dha-dhin-dhin-dha.
    this.beat += dt;
    if (this.beat > 0.22) {
      this.beat = 0;
      const n = Math.floor(this.time / 0.22) % 4;
      audio.dhol(e.pos.distanceTo(focus), n === 0);
    }
  }

  private updateCricket(e: ActiveEvent, dt: number, focus: THREE.Vector3): void {
    const v = this.ctx.services.vehicles?.current;
    const b = e.ball!;
    e.extra.cooldown! -= dt;
    if (b.t < 0 && v && e.extra.cooldown! <= 0 && v.position.distanceTo(e.pos) < 22 && Math.abs(v.speed) > 1) {
      // Six! Straight at your windshield.
      b.t = 0;
      b.from.copy(e.pos).addScaledVector(e.along, -5).setY(1);
      b.to.copy(v.position).setY(v.position.y + 0.8);
      b.mesh.visible = true;
      e.extra.cooldown = 10;
    }
    if (b.t >= 0) {
      b.t += dt / 0.9;
      const p = new THREE.Vector3().lerpVectors(b.from, b.to, b.t);
      p.y += Math.sin(b.t * Math.PI) * 4;
      b.mesh.position.copy(p);
      if (b.t >= 1) {
        b.t = -1;
        b.mesh.visible = false;
        if (v && v.position.distanceTo(b.to) < 4) {
          audio.crack();
          v.damage(5);
          this.ctx.services.camera?.shake(0.4);
          this.ctx.events.emit('vehicle:windshield', { by: 'cricket' });
          bark(EVENT_LINES.cricket, 'kid', null, null, true);
        }
      }
    }
    void focus;
  }

  private updateWater(e: ActiveEvent, dt: number): void {
    // Vehicles in the flood float: lighter, slidey, and drifting with the "current".
    const vm = this.ctx.services.vehicles;
    for (const v of vm?.vehicles ?? []) {
      const p = v.position;
      if (Math.hypot(p.x - e.pos.x, p.z - e.pos.z) > e.blocker.r) continue;
      const lv = v.body.linvel();
      const m = v.config.mass;
      v.body.applyImpulse({ x: (-lv.x * 0.6 + Math.sin(this.time * 0.7) * 1.5) * m * dt, y: m * 9.81 * 0.75 * dt, z: (-lv.z * 0.6 + Math.cos(this.time * 0.5) * 1.5) * m * dt }, true);
    }
    for (const car of this.ctx.services.traffic?.cars ?? []) {
      if (Math.hypot(car.pos.x - e.pos.x, car.pos.z - e.pos.z) < e.blocker.r) car.speed = Math.min(car.speed, 2);
    }
  }

  update(dt: number): void {
    this.rain.update(dt, this.ctx.camera.position);
  }
}
