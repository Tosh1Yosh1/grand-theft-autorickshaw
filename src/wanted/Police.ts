import * as THREE from 'three';
import type { Ped } from '../ai/peds/Pedestrians';
import { audio } from '../audio/AudioManager';
import { pickLine } from '../content/lines';
import { COP_CHASE, NEWS_ANCHOR } from '../content/wanted';
import type { GameContext, GameSystem } from '../core/System';
import { buildDrone } from '../vehicles/models/police';
import type { Vehicle } from '../vehicles/Vehicle';
import { PursuitAI } from '../vehicles/VehicleAI';
import { BLOCK, HALF, ROAD_W, roadCoord } from '../world/city/layout';
import { showSubtitle } from '../ui/subtitles';

interface FootCop {
  ped: Ped;
  swing: number;
}
interface CopCar {
  v: Vehicle;
  riders: Ped[];
  kind: 'bike' | 'jeep' | 'squad' | 'news' | 'block';
}

/** Force composition per chappal level. */
const FORCE: Record<number, { foot: number; bikes: number; jeeps: number; news: boolean; drone: boolean; blocks: number }> = {
  0: { foot: 0, bikes: 0, jeeps: 0, news: false, drone: false, blocks: 0 },
  1: { foot: 1, bikes: 0, jeeps: 0, news: false, drone: false, blocks: 0 },
  2: { foot: 2, bikes: 1, jeeps: 0, news: false, drone: false, blocks: 0 },
  3: { foot: 2, bikes: 1, jeeps: 1, news: false, drone: false, blocks: 0 },
  4: { foot: 3, bikes: 1, jeeps: 2, news: true, drone: false, blocks: 0 },
  5: { foot: 3, bikes: 1, jeeps: 2, news: true, drone: true, blocks: 2 },
};

/** Spawns and drives the cops: hawaldars, bike pairs, jeeps, squad, news van, roadblocks, drone. */
export class Police implements GameSystem {
  readonly name = 'police';
  private ctx!: GameContext;
  private foot: FootCop[] = [];
  private cars: CopCar[] = [];
  private drone: { mesh: THREE.Group; hp: number; light: THREE.SpotLight } | null = null;
  private blocks: THREE.Group[] = [];
  private blockColliders: import('@dimforge/rapier3d-compat').Collider[] = [];
  private siren: ReturnType<typeof audio.siren> | null = null;
  private time = 0;
  private arrest = 0;
  private lineTimer = 0;
  private anchorTimer = 3;
  private flash = 0;

  init(ctx: GameContext): void {
    this.ctx = ctx;
    ctx.services.police = this;
    ctx.events.on('wanted:change', ({ level }) => {
      if (level === 0) this.standDown();
      if (level < 5) this.clearBlocks();
    });
  }

  private focus(): THREE.Vector3 {
    const s = this.ctx.services;
    return s.vehicles?.current?.position ?? s.player?.position ?? this.ctx.camera.position;
  }

  /** Distance from p to the nearest cop of any kind. */
  nearest(p: THREE.Vector3): number {
    let best = Infinity;
    for (const c of this.foot) best = Math.min(best, c.ped.pos.distanceTo(p));
    for (const c of this.cars) if (c.kind !== 'news') best = Math.min(best, c.v.position.distanceTo(p));
    if (this.drone) best = Math.min(best, this.drone.mesh.position.distanceTo(p) - 10);
    return best;
  }

  nearestFootCop(p: THREE.Vector3): Ped | null {
    let best: Ped | null = null;
    let bd = Infinity;
    for (const c of this.foot) {
      if (c.ped.state !== 'scripted') continue;
      const d = c.ped.pos.distanceTo(p);
      if (d < bd) { bd = d; best = c.ped; }
    }
    return best;
  }

  /** A point on a road `min..max` metres from p (behind the camera if possible). */
  private roadPoint(p: THREE.Vector3, min: number, max: number): THREE.Vector3 {
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = min + Math.random() * (max - min);
      const x = p.x + Math.cos(a) * d;
      const z = p.z + Math.sin(a) * d;
      if (Math.abs(x) > HALF || Math.abs(z) > HALF) continue;
      // Snap to the nearest road line.
      const rx = roadCoord(Math.round((x + HALF) / BLOCK));
      const rz = roadCoord(Math.round((z + HALF) / BLOCK));
      return Math.abs(x - rx) < Math.abs(z - rz) ? new THREE.Vector3(rx + (Math.random() - 0.5) * 4, 0, z) : new THREE.Vector3(x, 0, rz + (Math.random() - 0.5) * 4);
    }
    return p.clone().add(new THREE.Vector3(min, 0, 0));
  }

  private spawnFoot(squad: boolean): void {
    const peds = this.ctx.services.peds;
    const p = this.roadPoint(this.focus(), 30, 55);
    const ped = peds?.spawn(squad ? 'squad' : 'cop', p.setY(0.15), 0, true);
    if (ped) this.foot.push({ ped, swing: 0 });
  }

  private spawnCar(kind: CopCar['kind']): void {
    const vm = this.ctx.services.vehicles;
    if (!vm) return;
    const id = kind === 'bike' ? 'policeBike' : kind === 'news' ? 'newsVan' : 'policeJeep';
    const p = this.roadPoint(this.focus(), 70, 100).setY(1.2);
    const toPlayer = this.focus().clone().sub(p);
    const v = vm.spawn(id, p, Math.atan2(toPlayer.x, toPlayer.z));
    v.ai = new PursuitAI(v, () => this.focus(), kind === 'news' ? 0.55 : kind === 'squad' ? 1.1 : 1).drive;
    const riders: Ped[] = [];
    const peds = this.ctx.services.peds;
    const seats = kind === 'bike' ? [v.config.seat, v.config.passengerSeats[0]!] : [v.config.seat];
    for (const seat of seats) {
      if (kind === 'news') break;
      const r = peds?.spawn(kind === 'squad' ? 'squad' : 'cop', p, 0, true);
      if (r) {
        r.anim = 'sitting';
        (r as Ped & { seat?: [number, number, number] }).seat = seat;
        riders.push(r);
      }
    }
    this.cars.push({ v, riders, kind });
  }

  private spawnBlocks(): void {
    const p = this.focus();
    const vm = this.ctx.services.vehicles;
    const heading = vm?.current?.heading ?? this.ctx.services.player?.heading ?? 0;
    for (let k = 0; k < 2; k++) {
      // Next intersections roughly ahead of Pappu.
      const ahead = p.clone().add(new THREE.Vector3(Math.sin(heading + (k - 0.5) * 1.2), 0, Math.cos(heading + (k - 0.5) * 1.2)).multiplyScalar(85));
      const ix = roadCoord(Math.round((ahead.x + HALF) / BLOCK));
      const iz = roadCoord(Math.round((ahead.z + HALF) / BLOCK));
      if (Math.abs(ix) > HALF || Math.abs(iz) > HALF) continue;
      const g = new THREE.Group();
      const stripe = new THREE.MeshStandardMaterial({ color: '#f2f2f2', emissive: '#ff2a2a', emissiveIntensity: 0.3 });
      for (let s = -2; s <= 2; s++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 0.3), stripe);
        b.position.set(ix + s * 2.3, 0.5, iz + ROAD_W / 2 + 2);
        b.castShadow = true;
        g.add(b);
      }
      this.ctx.scene.add(g);
      this.blocks.push(g);
      const R = this.ctx.physics.rapier;
      this.blockColliders.push(this.ctx.physics.world.createCollider(R.ColliderDesc.cuboid(5.8, 0.5, 0.2).setTranslation(ix, 0.5, iz + ROAD_W / 2 + 2)));
      if (vm) {
        const jeep = vm.spawn('policeJeep', new THREE.Vector3(ix, 1.2, iz + ROAD_W / 2 + 4.5), Math.PI / 2);
        this.cars.push({ v: jeep, riders: [], kind: 'block' });
      }
    }
  }

  private clearBlocks(): void {
    for (const g of this.blocks) g.removeFromParent();
    for (const c of this.blockColliders) this.ctx.physics.world.removeCollider(c, false);
    this.blocks = [];
    this.blockColliders = [];
    for (const c of this.cars.filter((c) => c.kind === 'block')) this.removeCar(c);
  }

  private removeCar(c: CopCar): void {
    const vm = this.ctx.services.vehicles;
    if (vm && c.v !== vm.current && vm.vehicles.includes(c.v)) vm.remove(c.v);
    for (const r of c.riders) this.ctx.services.peds?.remove(r);
    this.cars.splice(this.cars.indexOf(c), 1);
  }

  /** Level dropped to zero: cops lose interest and wander off. */
  private standDown(): void {
    const peds = this.ctx.services.peds;
    for (const c of this.foot) if (c.ped.state === 'scripted') peds?.release(c.ped);
    this.foot = [];
    for (const c of [...this.cars]) {
      if (c.v.ai) c.v.ai = null;
      setTimeout(() => this.cars.includes(c) && this.removeCar(c), 15000);
    }
    if (this.drone) {
      this.drone.mesh.removeFromParent();
      this.drone.light.removeFromParent();
      this.drone = null;
    }
    this.arrest = 0;
  }

  fixedUpdate(dt: number): void {
    this.time += dt;
    const level = this.ctx.services.wanted?.level ?? 0;
    const want = FORCE[level]!;
    const p = this.focus();
    const peds = this.ctx.services.peds;

    // Keep the force topped up.
    this.foot = this.foot.filter((c) => peds?.peds.includes(c.ped));
    if (level > 0) {
      if (this.foot.length < want.foot) this.spawnFoot(level >= 4);
      const count = (k: CopCar['kind']) => this.cars.filter((c) => c.kind === k).length;
      if (count('bike') < want.bikes) this.spawnCar('bike');
      if (count('jeep') + count('squad') < want.jeeps) this.spawnCar(level >= 4 && count('squad') === 0 ? 'squad' : 'jeep');
      if (want.news && count('news') === 0) this.spawnCar('news');
      if (want.blocks && this.blocks.length === 0) this.spawnBlocks();
      if (want.drone && !this.drone) this.spawnDrone();
    }

    // Foot cops: run at Pappu, swing lathis, try to arrest.
    const player = this.ctx.services.player;
    const driving = this.ctx.services.vehicles?.current;
    let arrestingNow = false;
    for (const c of this.foot) {
      const ped = c.ped;
      if (ped.state === 'flee' || ped.state === 'walk' || ped.state === 'idle') ped.state = 'scripted';
      if (ped.state !== 'scripted') continue;
      const to = p.clone().sub(ped.pos).setY(0);
      const d = to.length();
      const speed = (ped.type === 'squad' ? 5.6 : 4.4) * (level ? 1 : 0);
      if (d > 1.2) {
        ped.pos.addScaledVector(to.normalize(), Math.min(d - 1.1, speed * dt));
        ped.heading = Math.atan2(to.x, to.z);
        ped.anim = 'swing';
      } else {
        ped.anim = 'swing';
        c.swing -= dt;
        if (c.swing <= 0 && player?.active) {
          c.swing = 1.2;
          this.ctx.events.emit('player:damage', { amount: 7, source: 'lathi' });
          audio.thud(0.4);
        }
      }
      ped.pos.y = 0.15;
      if (d < 3.5 && (driving ? Math.abs(driving.speed) < 1.5 : (player?.speed2D() ?? 0) < 1.5)) arrestingNow = true;
    }
    // Cop cars boxing in a stopped vehicle also arrests.
    for (const c of this.cars) if (c.kind !== 'news' && driving && c.v.position.distanceTo(driving.position) < 5 && Math.abs(driving.speed) < 1) arrestingNow = true;
    this.arrest = arrestingNow && level > 0 ? this.arrest + dt : Math.max(0, this.arrest - dt * 2);
    if (this.arrest > (driving ? 2.5 : 1.6)) {
      this.arrest = 0;
      this.ctx.events.emit('player:busted', { fine: 1000 * level });
    }

    // Cop chatter and the news anchor.
    this.lineTimer -= dt;
    if (level > 0 && this.lineTimer <= 0 && this.nearest(p) < 30) {
      this.lineTimer = 6;
      showSubtitle(pickLine(COP_CHASE, this.ctx.store.getState().settings.profanity), 'Hawaldar');
    }
    const news = this.cars.find((c) => c.kind === 'news');
    this.anchorTimer -= dt;
    if (news && this.anchorTimer <= 0 && news.v.position.distanceTo(p) < 70) {
      this.anchorTimer = 8;
      showSubtitle(pickLine(NEWS_ANCHOR, false), 'Cheekh TV anchor', 4);
    }

    // Despawn cars left far behind.
    for (const c of [...this.cars]) if (c.v.position.distanceTo(p) > 220) this.removeCar(c);
    this.updateDrone(dt, p);
  }

  private spawnDrone(): void {
    const mesh = buildDrone();
    mesh.position.copy(this.focus()).add(new THREE.Vector3(10, 20, 10));
    this.ctx.scene.add(mesh);
    const light = new THREE.SpotLight('#ffffff', 0, 40, 0.35, 0.5);
    this.ctx.scene.add(light, light.target);
    this.drone = { mesh, hp: 3, light };
    showSubtitle('Drone aa gaya! Gulel se girao (3 hits).', 'Pappu');
  }

  private updateDrone(dt: number, p: THREE.Vector3): void {
    const d = this.drone;
    if (!d) return;
    const target = p.clone().add(new THREE.Vector3(Math.sin(this.time) * 3, 14, Math.cos(this.time) * 3));
    d.mesh.position.lerp(target, Math.min(1, dt * 1.2));
    d.mesh.traverse((o) => o.name === 'rotor' && (o.rotation.y += dt * 40));
    d.light.position.copy(d.mesh.position);
    d.light.target.position.copy(p);
    d.light.intensity = (this.ctx.services.dayNight?.night ?? 0) * 400;
    if (this.ctx.services.combat?.stonesNear(d.mesh.position, 1.5)) {
      d.hp--;
      audio.crack();
      if (d.hp <= 0) {
        showSubtitle('Drone gir gaya! Taaliyaan!', 'Pappu');
        d.mesh.removeFromParent();
        d.light.removeFromParent();
        this.drone = null;
        const w = this.ctx.services.wanted;
        if (w) w.set(w.level - 1);
      }
    }
  }

  update(dt: number): void {
    // Riders follow their vehicles; light bars flash; one siren for the nearest cop car.
    this.flash += dt * 8;
    const on = Math.sin(this.flash) > 0;
    let nearestCar = Infinity;
    const p = this.focus();
    const q = new THREE.Quaternion();
    for (const c of this.cars) {
      const r = c.v.body.rotation();
      q.set(r.x, r.y, r.z, r.w);
      for (const rider of c.riders) {
        const seat = (rider as Ped & { seat?: [number, number, number] }).seat ?? c.v.config.seat;
        rider.pos.copy(new THREE.Vector3(...seat).applyQuaternion(q).add(c.v.position));
        rider.heading = c.v.heading;
        rider.anim = 'sitting';
      }
      c.v.object.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (m?.name === 'sirenRed') m.emissiveIntensity = on ? 3 : 0.1;
        if (m?.name === 'sirenBlue') m.emissiveIntensity = on ? 0.1 : 3;
      });
      if (c.kind !== 'news' && c.kind !== 'block' && c.v.ai) nearestCar = Math.min(nearestCar, c.v.position.distanceTo(p));
    }
    if (nearestCar < 90) {
      this.siren ??= audio.siren();
      this.siren.set(1 - nearestCar / 90);
    } else if (this.siren) {
      this.siren.stop();
      this.siren = null;
    }
  }
}
