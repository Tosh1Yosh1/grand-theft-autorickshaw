import * as THREE from 'three';
import { audio } from '../../audio/AudioManager';
import type { GameContext, GameSystem } from '../../core/System';
import { debugFolder } from '../../ui/debugPanel';
import { BLOCK, HALF, ROAD_W, districtAt, onRoad, roadCoord } from '../../world/city/layout';
import { bark } from '../bark';
import { BOX, CONE, RigInstancer, type PartDef, type Pose } from '../rig/RigInstancer';

const COW_PARTS: PartDef[] = [
  { name: 'body', geo: BOX, color: 'hide', pivot: [0, 0.95, 0], offset: [0, 0, 0], scale: [0.7, 0.65, 1.5] },
  { name: 'hump', geo: BOX, color: 'hide', pivot: [0, 0.95, 0], offset: [0, 0.38, 0.45], scale: [0.4, 0.25, 0.35] },
  { name: 'patch', geo: BOX, color: 'patch', pivot: [0, 0.95, 0], offset: [0.36, 0.05, -0.2], scale: [0.02, 0.4, 0.6] },
  { name: 'head', geo: BOX, color: 'hide', pivot: [0, 1.15, 0.75], offset: [0, 0, 0.25], scale: [0.36, 0.38, 0.5], joint: 'head' },
  { name: 'snout', geo: BOX, color: 'snout', pivot: [0, 1.15, 0.75], offset: [0, -0.1, 0.52], scale: [0.3, 0.2, 0.12], joint: 'head' },
  { name: 'hornL', geo: CONE, color: 'horn', pivot: [0, 1.15, 0.75], offset: [0.16, 0.3, 0.2], scale: [0.07, 0.3, 0.07], joint: 'head' },
  { name: 'hornR', geo: CONE, color: 'horn', pivot: [0, 1.15, 0.75], offset: [-0.16, 0.3, 0.2], scale: [0.07, 0.3, 0.07], joint: 'head' },
  { name: 'legFL', geo: BOX, color: 'hide', pivot: [0.22, 0.65, 0.55], offset: [0, -0.32, 0], scale: [0.16, 0.66, 0.16], joint: 'legFL' },
  { name: 'legFR', geo: BOX, color: 'hide', pivot: [-0.22, 0.65, 0.55], offset: [0, -0.32, 0], scale: [0.16, 0.66, 0.16], joint: 'legFR' },
  { name: 'legBL', geo: BOX, color: 'hide', pivot: [0.22, 0.65, -0.55], offset: [0, -0.32, 0], scale: [0.16, 0.66, 0.16], joint: 'legBL' },
  { name: 'legBR', geo: BOX, color: 'hide', pivot: [-0.22, 0.65, -0.55], offset: [0, -0.32, 0], scale: [0.16, 0.66, 0.16], joint: 'legBR' },
  { name: 'tail', geo: BOX, color: 'hide', pivot: [0, 1.15, -0.75], offset: [0, -0.3, 0], scale: [0.05, 0.6, 0.05], joint: 'tail' },
];

const DOG_PARTS: PartDef[] = [
  { name: 'body', geo: BOX, color: 'fur', pivot: [0, 0.42, 0], offset: [0, 0, 0], scale: [0.26, 0.26, 0.62] },
  { name: 'head', geo: BOX, color: 'fur', pivot: [0, 0.55, 0.3], offset: [0, 0.05, 0.12], scale: [0.22, 0.22, 0.24], joint: 'head' },
  { name: 'snout', geo: BOX, color: 'dark', pivot: [0, 0.55, 0.3], offset: [0, -0.02, 0.28], scale: [0.12, 0.1, 0.12], joint: 'head' },
  { name: 'earL', geo: BOX, color: 'fur', pivot: [0, 0.55, 0.3], offset: [0.08, 0.2, 0.08], scale: [0.06, 0.12, 0.04], joint: 'head' },
  { name: 'earR', geo: BOX, color: 'fur', pivot: [0, 0.55, 0.3], offset: [-0.08, 0.2, 0.08], scale: [0.06, 0.12, 0.04], joint: 'head' },
  { name: 'legFL', geo: BOX, color: 'fur', pivot: [0.09, 0.3, 0.22], offset: [0, -0.15, 0], scale: [0.07, 0.3, 0.07], joint: 'legFL' },
  { name: 'legFR', geo: BOX, color: 'fur', pivot: [-0.09, 0.3, 0.22], offset: [0, -0.15, 0], scale: [0.07, 0.3, 0.07], joint: 'legFR' },
  { name: 'legBL', geo: BOX, color: 'fur', pivot: [0.09, 0.3, -0.22], offset: [0, -0.15, 0], scale: [0.07, 0.3, 0.07], joint: 'legBL' },
  { name: 'legBR', geo: BOX, color: 'fur', pivot: [-0.09, 0.3, -0.22], offset: [0, -0.15, 0], scale: [0.07, 0.3, 0.07], joint: 'legBR' },
  { name: 'tail', geo: BOX, color: 'fur', pivot: [0, 0.5, -0.3], offset: [0, 0.12, -0.05], scale: [0.05, 0.25, 0.05], joint: 'tail' },
];

type CowState = 'stand' | 'walk' | 'lie' | 'angry';
export interface Cow {
  slot: number;
  pos: THREE.Vector3;
  heading: number;
  state: CowState;
  timer: number;
  target: THREE.Vector3;
  phase: number;
  hitCooldown: number;
}

type DogState = 'sleep' | 'sit' | 'chase' | 'return' | 'flee';
export interface Dog {
  slot: number;
  pos: THREE.Vector3;
  home: THREE.Vector3;
  heading: number;
  state: DogState;
  timer: number;
  chasing: THREE.Vector3 | null;
  phase: number;
  barkTimer: number;
}

export class Animals implements GameSystem {
  readonly name = 'animals';
  readonly cows: Cow[] = [];
  readonly dogs: Dog[] = [];
  readonly tuning = { cows: 9, dogPacks: 4 };
  private ctx!: GameContext;
  private cowRig!: RigInstancer;
  private dogRig!: RigInstancer;
  private time = 0;
  private readonly pose: Pose = {};
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly s = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();

  init(ctx: GameContext): void {
    this.ctx = ctx;
    ctx.services.animals = this;
    this.cowRig = new RigInstancer(COW_PARTS, 24);
    this.dogRig = new RigInstancer(DOG_PARTS, 32);
    ctx.scene.add(this.cowRig.group, this.dogRig.group);
    const f = debugFolder('NPCs');
    f.add(this.tuning, 'cows', 0, 24, 1).name('Cows nearby');
    f.add(this.tuning, 'dogPacks', 0, 10, 1).name('Dog packs nearby');
    f.add({ cow: () => this.spawnCow(this.focus().clone().add(new THREE.Vector3(0, 0, -12))) }, 'cow').name('Cow in front of me');
  }

  private focus(): THREE.Vector3 {
    const s = this.ctx.services;
    return s.vehicles?.current?.position ?? s.player?.position ?? this.ctx.camera.position;
  }

  /** A random point on a road between 40 and 140 m from the focus. */
  private roadPointNear(center: THREE.Vector3): THREE.Vector3 | null {
    for (let i = 0; i < 10; i++) {
      const ix = Math.round((center.x + HALF) / BLOCK + (Math.random() - 0.5) * 5);
      const iz = Math.round((center.z + HALF) / BLOCK + (Math.random() - 0.5) * 5);
      const alongX = Math.random() < 0.5;
      const x = alongX ? roadCoord(ix) + Math.random() * BLOCK : roadCoord(ix) + (Math.random() - 0.5) * (ROAD_W - 2);
      const z = alongX ? roadCoord(iz) + (Math.random() - 0.5) * (ROAD_W - 2) : roadCoord(iz) + Math.random() * BLOCK;
      const d = Math.hypot(x - center.x, z - center.z);
      if (d < 40 || d > 140 || Math.abs(x) > HALF || Math.abs(z) > HALF) continue;
      return new THREE.Vector3(x, 0, z);
    }
    return null;
  }

  spawnCow(pos: THREE.Vector3): Cow | null {
    const slot = this.cowRig.alloc();
    if (slot < 0) return null;
    const white = Math.random() < 0.6;
    this.cowRig.style(slot, { hide: white ? '#ece6da' : '#8b6b4a', patch: white ? '#5a4632' : '#ece6da', snout: '#d9a09a', horn: '#3a2a1a' });
    const cow: Cow = { slot, pos: pos.clone(), heading: Math.random() * 6.28, state: Math.random() < 0.4 ? 'lie' : 'stand', timer: 3 + Math.random() * 8, target: pos.clone(), phase: Math.random() * 10, hitCooldown: 0 };
    this.cows.push(cow);
    return cow;
  }

  private spawnPack(center: THREE.Vector3): void {
    const p = this.roadPointNear(center);
    if (!p) return;
    // Dogs nap on the pavement edge next to the road.
    p.x += Math.sign(Math.random() - 0.5) * (ROAD_W / 2 + 1);
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const slot = this.dogRig.alloc();
      if (slot < 0) return;
      this.dogRig.style(slot, { fur: ['#c8a165', '#8b5a2b', '#e9d8a6', '#3d3d3d', '#a47148'][Math.floor(Math.random() * 5)]!, dark: '#1a1a1a' });
      const pos = p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, 0.15, (Math.random() - 0.5) * 3));
      this.dogs.push({ slot, pos, home: pos.clone(), heading: Math.random() * 6.28, state: Math.random() < 0.6 ? 'sleep' : 'sit', timer: 0, chasing: null, phase: Math.random() * 10, barkTimer: 0 });
    }
  }

  fixedUpdate(dt: number): void {
    this.time += dt;
    const center = this.focus();
    // Population.
    for (let i = this.cows.length - 1; i >= 0; i--) if (this.cows[i]!.pos.distanceTo(center) > 180) this.cowRig.release(this.cows.splice(i, 1)[0]!.slot);
    for (let i = this.dogs.length - 1; i >= 0; i--) if (this.dogs[i]!.home.distanceTo(center) > 180) this.dogRig.release(this.dogs.splice(i, 1)[0]!.slot);
    const district = districtAt(center.x, center.z);
    const cowTarget = this.tuning.cows * (district === 'startup' ? 0.3 : 1);
    if (this.cows.length < cowTarget) {
      const p = this.roadPointNear(center);
      if (p) this.spawnCow(p);
    }
    if (this.dogs.length < this.tuning.dogPacks * 3) this.spawnPack(center);

    this.updateCows(dt, center);
    this.updateDogs(dt, center);
  }

  private updateCows(dt: number, listener: THREE.Vector3): void {
    const driving = this.ctx.services.vehicles?.current;
    for (const c of this.cows) {
      c.timer -= dt;
      c.hitCooldown -= dt;
      if (c.state === 'walk') {
        this.tmp.subVectors(c.target, c.pos).setY(0);
        const d = this.tmp.length();
        if (d < 0.5 || c.timer <= 0) {
          c.state = Math.random() < 0.5 ? 'stand' : 'lie';
          c.timer = 5 + Math.random() * 12;
        } else {
          this.tmp.multiplyScalar((0.6 * dt) / d);
          c.pos.add(this.tmp);
          c.heading = Math.atan2(this.tmp.x, this.tmp.z);
        }
      } else if (c.timer <= 0) {
        // Cows choose the exact middle of the road. Always.
        c.state = 'walk';
        c.timer = 8;
        c.target.copy(c.pos).add(new THREE.Vector3((Math.random() - 0.5) * 10, 0, (Math.random() - 0.5) * 10));
        if (Math.random() < 0.2) audio.moo(c.pos.distanceTo(listener));
      }
      c.pos.y = onRoad(c.pos.x, c.pos.z) ? 0 : 0.15;

      // Getting hit by Pappu's vehicle: big trouble.
      if (driving && c.hitCooldown <= 0) {
        const dx = c.pos.x - driving.position.x;
        const dz = c.pos.z - driving.position.z;
        if (dx * dx + dz * dz < 2.2 * 2.2 && Math.abs(driving.speed) > 2.5) {
          c.hitCooldown = 4;
          c.state = 'angry';
          c.timer = 4;
          c.pos.x += Math.sign(dx || 1) * 1.5;
          c.pos.z += Math.sign(dz || 1) * 1.5;
          driving.body.applyImpulse({ x: -dx * driving.config.mass * 0.4, y: 0, z: -dz * driving.config.mass * 0.4 }, true);
          driving.damage(8);
          audio.moo(0, true);
          this.ctx.services.camera?.shake(0.6);
          bark('cowHit', 'mob', null, null, true);
          this.ctx.services.peds?.startMob(c.pos);
          this.ctx.events.emit('crime:cowHit', { position: c.pos.clone() });
        }
      }
    }
  }

  private updateDogs(dt: number, listener: THREE.Vector3): void {
    const s = this.ctx.services;
    // Two-wheelers are the natural enemy. Pappu on a bike counts. So do traffic bikes.
    const targets: THREE.Vector3[] = [];
    if (s.vehicles?.current?.config.id === 'bike') targets.push(s.vehicles.current.position);
    for (const car of s.traffic?.cars ?? []) if (car.config.id === 'bike' && !car.wrecked) targets.push(car.pos);
    for (const dog of this.dogs) {
      dog.barkTimer -= dt;
      if (dog.state === 'sleep' || dog.state === 'sit') {
        const t = targets.find((p) => p.distanceTo(dog.pos) < 18);
        if (t) {
          dog.state = 'chase';
          dog.chasing = t;
        } else if (s.player?.active && s.player.position.distanceTo(dog.pos) < 3 && dog.state === 'sleep') {
          dog.state = 'sit';
          audio.woof(dog.pos.distanceTo(listener));
        }
      } else if (dog.state === 'chase' && dog.chasing) {
        this.tmp.subVectors(dog.chasing, dog.pos).setY(0);
        const d = this.tmp.length();
        if (dog.pos.distanceTo(dog.home) > 45 || d > 30) {
          dog.state = 'return';
        } else if (d > 1.2) {
          this.tmp.multiplyScalar((9.5 * dt) / d);
          dog.pos.add(this.tmp);
          dog.heading = Math.atan2(this.tmp.x, this.tmp.z);
        }
        if (dog.barkTimer <= 0) {
          dog.barkTimer = 0.7 + Math.random() * 0.6;
          audio.woof(dog.pos.distanceTo(listener));
        }
      } else if (dog.state === 'return' || dog.state === 'flee') {
        this.tmp.subVectors(dog.home, dog.pos).setY(0);
        const d = this.tmp.length();
        if (d < 0.5) dog.state = 'sit';
        else {
          this.tmp.multiplyScalar((Math.min(d, 4 * dt)) / d);
          dog.pos.add(this.tmp);
          dog.heading = Math.atan2(this.tmp.x, this.tmp.z);
        }
      }
      // Vehicles hitting dogs: they yelp and bolt (no harm in this game).
      if (s.vehicles?.current && dog.state !== 'flee') {
        const v = s.vehicles.current;
        if (v.position.distanceTo(dog.pos) < 1.3 && Math.abs(v.speed) > 3) {
          dog.state = 'flee';
          dog.pos.add(new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).multiplyScalar(3));
          audio.woof(0);
        }
      }
      dog.pos.y = onRoad(dog.pos.x, dog.pos.z) ? 0 : 0.15;
    }
  }

  update(): void {
    const legs = (pose: Pose, swing: number) => {
      pose.legFL = [swing, 0, 0];
      pose.legBR = [swing, 0, 0];
      pose.legFR = [-swing, 0, 0];
      pose.legBL = [-swing, 0, 0];
    };
    for (const c of this.cows) {
      const walk = c.state === 'walk' ? Math.sin(this.time * 3 + c.phase) * 0.35 : 0;
      legs(this.pose, walk);
      const lie = c.state === 'lie';
      if (lie) legs(this.pose, 0);
      this.pose.head = [c.state === 'angry' ? -0.3 : lie ? 0.2 : Math.sin(this.time * 0.4 + c.phase) * 0.15, Math.sin(this.time * 0.3 + c.phase) * 0.4, 0];
      this.pose.tail = [Math.sin(this.time * 2 + c.phase) * 0.3, 0, Math.sin(this.time * 2.5 + c.phase) * 0.4];
      this.q.setFromEuler(this.e.set(0, c.heading, c.state === 'angry' ? Math.sin(this.time * 20) * 0.05 : 0));
      this.m.compose(this.s.set(c.pos.x, c.pos.y - (lie ? 0.55 : 0), c.pos.z), this.q, this.tmp.set(1, 1, 1));
      this.cowRig.pose(c.slot, this.m, this.pose, lie ? { legFL: 0.3, legFR: 0.3, legBL: 0.3, legBR: 0.3 } : undefined);
    }
    for (const dog of this.dogs) {
      const running = dog.state === 'chase' || dog.state === 'return' || dog.state === 'flee';
      legs(this.pose, running ? Math.sin(this.time * 14 + dog.phase) * 0.8 : 0);
      this.pose.head = [dog.state === 'sleep' ? 0.5 : running ? -0.2 : 0, 0, 0];
      this.pose.tail = [running ? -0.8 : -0.3, 0, Math.sin(this.time * (running ? 18 : 4) + dog.phase) * 0.5];
      this.q.setFromEuler(this.e.set(0, dog.heading, 0));
      this.m.compose(this.s.set(dog.pos.x, dog.pos.y - (dog.state === 'sleep' ? 0.25 : 0), dog.pos.z), this.q, this.tmp.set(1, 1, 1));
      this.dogRig.pose(dog.slot, this.m, this.pose);
    }
    this.cowRig.markDirty();
    this.dogRig.markDirty();
  }
}
