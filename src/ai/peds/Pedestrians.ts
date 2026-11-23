import * as THREE from 'three';
import type { BarkSituation } from '../../content/barks';
import type { GameContext, GameSystem } from '../../core/System';
import { debugFolder } from '../../ui/debugPanel';
import { BLOCK, GRID, HALF, ROAD_W, SIDEWALK_W, blockIndex, districtOfBlock, onRoad, roadCoord } from '../../world/city/layout';
import { bark } from '../bark';
import { RigInstancer, type Pose } from '../rig/RigInstancer';
import { HUMANOID_PARTS, humanoidPose, rootMatrix, styleFor, type Anim, type PedStyle, type PedType } from './humanoid';

export type PedState = 'walk' | 'idle' | 'flee' | 'airborne' | 'downed' | 'sitting' | 'mob' | 'scripted';

export interface Ped {
  slot: number;
  type: PedType;
  style: PedStyle;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  heading: number;
  state: PedState;
  anim: Anim;
  phase: number;
  timer: number;
  target: THREE.Vector3;
  /** Sidewalk ring this ped walks around: block coords + direction. */
  bx: number;
  bz: number;
  dir: 1 | -1;
  corner: number;
  barked: boolean;
  health: number;
  /** Set by street events / missions: the AI leaves this ped alone. */
  scripted: boolean;
  spin: number;
}

const TYPES: [PedType, number][] = [
  ['commuter', 5],
  ['aunty', 2],
  ['uncle', 2],
  ['startupBro', 1],
  ['gymBhai', 1],
  ['deliveryBoy', 1.5],
  ['selfieCouple', 1],
];
const DISTRICT_BIAS: Record<string, Partial<Record<PedType, number>>> = {
  startup: { startupBro: 5, deliveryBoy: 3 },
  sarkari: { uncle: 4, aunty: 3 },
  jugaadpur: { aunty: 3, gymBhai: 2 },
  filmistan: { selfieCouple: 4, gymBhai: 2 },
  kachra: { commuter: 4, deliveryBoy: 2 },
};

const BARK_OF: Partial<Record<PedType, BarkSituation>> = {
  aunty: 'aunty',
  uncle: 'uncle',
  startupBro: 'startupBro',
  gymBhai: 'gymBhai',
  deliveryBoy: 'deliveryBoy',
  selfieCouple: 'selfieCouple',
};

export class Pedestrians implements GameSystem {
  readonly name = 'pedestrians';
  readonly peds: Ped[] = [];
  readonly tuning = { normal: 45, potato: 18, ultra: 70, spawnMin: 25, spawnMax: 110, despawn: 150 };
  private ctx!: GameContext;
  private rig!: RigInstancer;
  private time = 0;
  private mobUntil = 0;
  private readonly pose: Pose = {};
  private readonly m = new THREE.Matrix4();
  private readonly tmp = new THREE.Vector3();

  init(ctx: GameContext): void {
    this.ctx = ctx;
    ctx.services.peds = this;
    this.rig = new RigInstancer(HUMANOID_PARTS, 140);
    ctx.scene.add(this.rig.group);
    const f = debugFolder('NPCs');
    f.add(this.tuning, 'normal', 0, 120, 1).name('Peds (Normal)');
    f.add(this.tuning, 'potato', 0, 60, 1).name('Peds (Potato)');
    f.add({ mob: () => this.startMob(this.playerPos()) }, 'mob').name('Start angry mob');
  }

  private playerPos(): THREE.Vector3 {
    const s = this.ctx.services;
    return s.vehicles?.current?.position ?? s.player?.position ?? this.ctx.camera.position;
  }

  private targetCount(): number {
    const g = this.ctx.store.getState().settings.graphics;
    const base = g === 'potato' ? this.tuning.potato : g === 'ultra' ? this.tuning.ultra : this.tuning.normal;
    const night = this.ctx.services.dayNight?.night ?? 0;
    return Math.round(base * (1 - night * 0.5));
  }

  /** Create a ped. Scripted peds (events/missions) are positioned by their owner. */
  spawn(type: PedType, pos: THREE.Vector3, heading = 0, scripted = false): Ped | null {
    const slot = this.rig.alloc();
    if (slot < 0) return null;
    const style = styleFor(type);
    this.rig.style(slot, style.colors, style.show);
    const ped: Ped = {
      slot,
      type,
      style,
      pos: pos.clone(),
      vel: new THREE.Vector3(),
      heading,
      state: scripted ? 'scripted' : 'walk',
      anim: 'walk',
      phase: Math.random() * 10,
      timer: 0,
      target: pos.clone(),
      bx: blockIndex(pos.x),
      bz: blockIndex(pos.z),
      dir: Math.random() < 0.5 ? 1 : -1,
      corner: Math.floor(Math.random() * 4),
      barked: false,
      health: 100,
      scripted,
      spin: 0,
    };
    if (!scripted) this.nextTarget(ped);
    this.peds.push(ped);
    return ped;
  }

  remove(ped: Ped): void {
    this.rig.release(ped.slot);
    const i = this.peds.indexOf(ped);
    if (i >= 0) this.peds.splice(i, 1);
  }

  /** Hand a scripted ped back to normal AI. */
  release(ped: Ped): void {
    ped.scripted = false;
    ped.state = 'walk';
    ped.bx = blockIndex(ped.pos.x);
    ped.bz = blockIndex(ped.pos.z);
    this.nextTarget(ped);
  }

  /** Corner k (0..3) of the sidewalk ring around block (bx, bz). */
  private corner(bx: number, bz: number, k: number, out: THREE.Vector3): THREE.Vector3 {
    const inset = ROAD_W / 2 + SIDEWALK_W / 2;
    const x0 = roadCoord(bx) + inset;
    const z0 = roadCoord(bz) + inset;
    const x1 = roadCoord(bx) + BLOCK - inset;
    const z1 = roadCoord(bz) + BLOCK - inset;
    const c = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]][((k % 4) + 4) % 4]!;
    return out.set(c[0]!, 0.15, c[1]!);
  }

  private nextTarget(p: Ped): void {
    // Sometimes jaywalk across to the neighbouring block, Mumbhai style.
    if (Math.random() < 0.15) {
      const k = ((p.corner % 4) + 4) % 4;
      const across = [[-1, 0], [1, 0], [1, 0], [-1, 0]][k]!;
      const alongZ = Math.random() < 0.5;
      const nbx = Math.min(GRID - 1, Math.max(0, p.bx + (alongZ ? 0 : across[0]!)));
      const nbz = Math.min(GRID - 1, Math.max(0, p.bz + (alongZ ? (k < 2 ? -1 : 1) : 0)));
      if (nbx !== p.bx || nbz !== p.bz) {
        p.bx = nbx;
        p.bz = nbz;
        // Find the nearest corner on the new ring.
        let best = 0;
        let bd = Infinity;
        for (let c = 0; c < 4; c++) {
          const d = this.corner(nbx, nbz, c, this.tmp).distanceToSquared(p.pos);
          if (d < bd) { bd = d; best = c; }
        }
        p.corner = best;
        this.corner(p.bx, p.bz, best, p.target);
        return;
      }
    }
    p.corner += p.dir;
    this.corner(p.bx, p.bz, p.corner, p.target);
    // Wander a little off the exact line so crowds don't march single-file.
    p.target.x += (Math.random() - 0.5) * 1.5;
    p.target.z += (Math.random() - 0.5) * 1.5;
  }

  private maintainPopulation(center: THREE.Vector3): void {
    for (let i = this.peds.length - 1; i >= 0; i--) {
      const p = this.peds[i]!;
      if (!p.scripted && p.pos.distanceTo(center) > this.tuning.despawn) this.remove(p);
    }
    const want = this.targetCount();
    let free = this.peds.filter((p) => !p.scripted).length;
    let tries = 0;
    while (free < want && tries++ < 6) {
      const a = Math.random() * Math.PI * 2;
      const d = this.tuning.spawnMin + Math.random() * (this.tuning.spawnMax - this.tuning.spawnMin);
      const x = center.x + Math.cos(a) * d;
      const z = center.z + Math.sin(a) * d;
      if (Math.abs(x) > HALF - 5 || Math.abs(z) > HALF - 5) continue;
      const bx = blockIndex(x);
      const bz = blockIndex(z);
      const k = Math.floor(Math.random() * 4);
      const start = this.corner(bx, bz, k, new THREE.Vector3());
      const next = this.corner(bx, bz, k + 1, new THREE.Vector3());
      start.lerp(next, Math.random());
      const type = this.pickType(districtOfBlock(bx, bz));
      const ped = this.spawn(type, start);
      if (!ped) break;
      ped.bx = bx;
      ped.bz = bz;
      ped.corner = k;
      ped.dir = 1;
      this.nextTarget(ped);
      free++;
      if (type === 'selfieCouple') {
        const partner = this.spawn('selfieCouple', start.clone().add(new THREE.Vector3(0.6, 0, 0.3)));
        if (partner) {
          Object.assign(partner, { bx, bz, corner: ped.corner, dir: 1 });
          partner.target.copy(ped.target).add(new THREE.Vector3(0.6, 0, 0.3));
          free++;
        }
      }
    }
  }

  private pickType(district: string): PedType {
    const bias = DISTRICT_BIAS[district] ?? {};
    const weights = TYPES.map(([t, w]) => [t, w + (bias[t] ?? 0)] as const);
    let r = Math.random() * weights.reduce((s, [, w]) => s + w, 0);
    for (const [t, w] of weights) if ((r -= w) <= 0) return t;
    return 'commuter';
  }

  /** Knock a ped flying (vehicles, slaps, chappals). */
  knock(p: Ped, push: THREE.Vector3, upward = 4, situation: BarkSituation = 'hitByCar'): void {
    if (p.state === 'airborne' || p.state === 'downed') return;
    p.state = 'airborne';
    p.vel.copy(push).setY(upward);
    p.spin = (Math.random() - 0.5) * 12;
    p.health -= 34;
    bark(situation, BARK_OF[p.type] ?? 'commuter', p.pos, this.playerPos(), true);
  }

  /** Everyone nearby gets very, very upset. */
  startMob(center: THREE.Vector3, radius = 45, seconds = 25): void {
    this.mobUntil = this.time + seconds;
    for (const p of this.peds) {
      if (p.scripted || p.pos.distanceTo(center) > radius) continue;
      if (p.state === 'downed' || p.state === 'airborne') continue;
      p.state = 'mob';
    }
    bark('mob', 'mob', null, null, true);
  }

  get mobActive(): boolean {
    return this.time < this.mobUntil && this.peds.some((p) => p.state === 'mob');
  }

  fixedUpdate(dt: number): void {
    this.time += dt;
    const player = this.ctx.services.player;
    const vehicles = this.ctx.services.vehicles;
    const playerPos = this.playerPos();
    const driving = vehicles?.current ?? null;
    const traffic = this.ctx.services.traffic;

    for (const p of this.peds) {
      switch (p.state) {
        case 'walk':
        case 'flee':
        case 'mob': {
          const speed = (p.state === 'walk' ? 1.3 : 4.2) * p.style.speed;
          if (p.state === 'mob') {
            p.target.copy(playerPos);
            if (this.time > this.mobUntil || p.pos.distanceTo(playerPos) > 80) {
              p.state = 'walk';
              this.nextTarget(p);
            } else if (p.pos.distanceTo(playerPos) < 1.4 && !driving) {
              this.ctx.events.emit('mob:caught', { damage: 5 });
            }
          }
          this.tmp.subVectors(p.target, p.pos).setY(0);
          const dist = this.tmp.length();
          if (dist < 0.6 && p.state !== 'mob') {
            if (p.state === 'flee') p.state = 'walk';
            if (Math.random() < 0.15) {
              p.state = 'idle';
              p.timer = 2 + Math.random() * 4;
            }
            this.nextTarget(p);
          } else if (dist > 0.01) {
            this.tmp.multiplyScalar(Math.min(dist, speed * dt) / dist);
            p.pos.add(this.tmp);
            p.heading = Math.atan2(this.tmp.x, this.tmp.z);
          }
          p.anim = p.state === 'walk' ? 'walk' : 'run';
          break;
        }
        case 'idle':
          p.timer -= dt;
          p.anim = p.type === 'selfieCouple' ? 'selfie' : 'idle';
          if (p.timer <= 0) p.state = 'walk';
          break;
        case 'airborne':
          p.vel.y -= 20 * dt;
          p.pos.addScaledVector(p.vel, dt);
          p.anim = 'lying';
          if (p.pos.y <= this.groundY(p.pos) && p.vel.y < 0) {
            p.pos.y = this.groundY(p.pos);
            p.state = 'downed';
            p.timer = 2.2;
            p.spin = 0;
          }
          break;
        case 'downed':
          p.timer -= dt;
          p.anim = 'lying';
          if (p.timer <= 0) {
            // The classic: sit up and swear at you.
            p.state = 'sitting';
            p.timer = 2.5;
            bark('downed', BARK_OF[p.type] ?? 'commuter', p.pos, playerPos);
          }
          break;
        case 'sitting':
          p.timer -= dt;
          p.anim = 'sitting';
          if (p.timer <= 0) {
            p.state = 'flee';
            this.fleeFrom(p, playerPos);
          }
          break;
        case 'scripted':
          break;
      }
      if (p.state !== 'airborne' && p.state !== 'scripted') p.pos.y += (this.groundY(p.pos) - p.pos.y) * 0.3;
      if (p.state === 'airborne') p.heading += p.spin * dt;

      if (p.state === 'airborne' || p.state === 'downed') continue;
      if (p.state === 'scripted') {
        // Cops and event crowds can still be run over; seated drivers/riders can't.
        if (driving && p.anim !== 'sitting') this.checkVehicle(p, driving.position, driving.speed, driving.heading, true);
        continue;
      }

      // Pappu on foot shoves through crowds; peds sidestep.
      if (player?.active) {
        this.tmp.subVectors(p.pos, player.position).setY(0);
        const d = this.tmp.length();
        if (d < 0.7 && d > 0.001) {
          p.pos.addScaledVector(this.tmp, (0.7 - d) / d);
          if (!p.barked) {
            const kind = BARK_OF[p.type];
            if (kind && bark(kind, kind, p.pos, playerPos)) p.barked = true;
          }
        } else if (d < 3 && !p.barked && p.state === 'idle') {
          const kind = BARK_OF[p.type];
          if (kind && Math.random() < 0.02 && bark(kind, kind, p.pos, playerPos)) p.barked = true;
        }
      }

      // Vehicles: hits knock peds over; fast near-misses make them run.
      if (driving) this.checkVehicle(p, driving.position, driving.speed, driving.heading, true);
      if (traffic) for (const car of traffic.cars) this.checkVehicle(p, car.pos, car.speed, car.heading, false);
    }
  }

  private checkVehicle(p: Ped, vpos: THREE.Vector3, speed: number, heading: number, isPlayer: boolean): void {
    const dx = p.pos.x - vpos.x;
    const dz = p.pos.z - vpos.z;
    const d2 = dx * dx + dz * dz;
    const abs = Math.abs(speed);
    if (d2 < 1.6 * 1.6 && abs > 3) {
      const fx = Math.sin(heading) * Math.sign(speed);
      const fz = Math.cos(heading) * Math.sign(speed);
      this.knock(p, new THREE.Vector3(fx * abs * 0.7 + dx, 0, fz * abs * 0.7 + dz), 3 + abs * 0.25);
      if (isPlayer) this.ctx.events.emit('crime:pedHit', { position: p.pos.clone() });
    } else if (isPlayer && d2 < 16 && abs > 7 && p.state === 'walk') {
      p.state = 'flee';
      this.fleeFrom(p, vpos);
      bark('nearMiss', BARK_OF[p.type] ?? 'commuter', p.pos, vpos);
    }
  }

  private fleeFrom(p: Ped, from: THREE.Vector3): void {
    this.tmp.subVectors(p.pos, from).setY(0).normalize().multiplyScalar(8);
    p.target.copy(p.pos).add(this.tmp);
  }

  /** Horn near peds: they jump out of the way. */
  honk(at: THREE.Vector3, heading: number): void {
    for (const p of this.peds) {
      if (p.state !== 'walk' && p.state !== 'idle') continue;
      const dx = p.pos.x - at.x;
      const dz = p.pos.z - at.z;
      const d = Math.hypot(dx, dz);
      if (d > 12) continue;
      const ahead = (dx * Math.sin(heading) + dz * Math.cos(heading)) / (d || 1);
      if (ahead < 0.3) continue;
      p.state = 'flee';
      this.fleeFrom(p, at);
      if (Math.random() < 0.3) bark('roadRage', BARK_OF[p.type] ?? 'commuter', p.pos, at);
    }
  }

  private groundY(pos: THREE.Vector3): number {
    return onRoad(pos.x, pos.z) ? 0 : 0.15;
  }

  update(): void {
    this.maintainPopulation(this.playerPos());
    for (const p of this.peds) {
      humanoidPose(p.anim, this.time, p.phase, p.style.speed, this.pose);
      rootMatrix(this.m, p.pos.x, p.pos.y, p.pos.z, p.heading, p.style.scale, p.anim);
      this.rig.pose(p.slot, this.m, this.pose, p.style.partScale);
    }
    this.rig.markDirty();
  }
}
