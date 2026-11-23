import type RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { audio } from '../../audio/AudioManager';
import type { GameContext, GameSystem } from '../../core/System';
import { debugFolder } from '../../ui/debugPanel';
import { VEHICLES } from '../../vehicles/configs';
import { defaultWheel } from '../../vehicles/models/parts';
import type { VehicleConfig } from '../../vehicles/types';
import { LANE_W, ROAD_W, districtAt, roadGraph, type RoadNode } from '../../world/city/layout';
import { bark } from '../bark';
import type { Ped } from '../peds/Pedestrians';
import { ModelInstancer } from '../rig/ModelInstancer';

export interface TrafficCar {
  config: VehicleConfig;
  slot: number;
  pos: THREE.Vector3;
  heading: number;
  speed: number;
  cruise: number;
  waypoints: THREE.Vector3[];
  from: number;
  to: number;
  lane: number;
  wrongWay: boolean;
  overtake: number;
  stuck: number;
  honkCooldown: number;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  wrecked: boolean;
  rideHeight: number;
  driver: Ped | null;
  /** Extra riders (the whole family on a bike). */
  riders: { ped: Ped; seat: [number, number, number] }[];
  paint: string;
  /** Pulled over for a VIP (red beacon / bullock cart in Jugaadpur). */
  pulled: number;
}

/** Traffic mix: [config id, weight]. Autos rule the road. */
const MIX: [string, number][] = [
  ['auto', 9],
  ['maruti', 4],
  ['taxi', 3],
  ['bike', 4],
  ['tempo', 2],
  ['bus', 1],
  ['innova', 1],
  ['thar', 1],
];
const PAINTS: Record<string, string[]> = {
  maruti: ['#e9e3d5', '#c1121f', '#8d99ae', '#ffffff', '#2a9d8f', '#f4a261'],
  bike: ['#c1121f', '#111111', '#3a86ff', '#6a994e'],
  tempo: ['#2a9d8f', '#e9c46a', '#3a86ff', '#e76f51'],
  innova: ['#f1f1f1', '#d9d9d9', '#2b2b2b'],
  thar: ['#2b2b2b', '#c1121f', '#6b705c', '#ffffff'],
};
/** Vehicles whose driver is visible (open cabins). */
const OPEN = new Set(['auto', 'bike', 'cart']);

export class Traffic implements GameSystem {
  readonly name = 'traffic';
  readonly cars: TrafficCar[] = [];
  readonly tuning = { normal: 18, potato: 8, ultra: 28, wrongWayChance: 0.06 };
  private ctx!: GameContext;
  private graph: RoadNode[] = roadGraph();
  private instancers = new Map<string, ModelInstancer>();
  private byCollider = new Map<number, TrafficCar>();
  private time = 0;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly one = new THREE.Vector3(1, 1, 1);
  private readonly tmp = new THREE.Vector3();

  init(ctx: GameContext): void {
    this.ctx = ctx;
    ctx.services.traffic = this;
    for (const [id] of MIX) {
      const cfg = VEHICLES[id]!;
      const model = cfg.buildModel();
      for (const w of cfg.wheels) {
        const wheel = defaultWheel(w.radius);
        wheel.position.set(w.pos[0], w.pos[1] - cfg.suspension.restLength * 0.7, w.pos[2]);
        model.add(wheel);
      }
      const inst = new ModelInstancer(model, id === 'auto' ? 24 : 12);
      this.instancers.set(id, inst);
      ctx.scene.add(inst.group);
    }
    ctx.physics.onContactForce((a, b, force) => {
      const car = this.byCollider.get(a.handle) ?? this.byCollider.get(b.handle);
      if (!car || car.wrecked) return;
      const other = car.collider === a ? b : a;
      const pv = ctx.services.vehicles?.vehicleOf(other);
      if (pv && force > pv.config.mass * 30) this.wreck(car, pv === ctx.services.vehicles?.current);
    });
    const f = debugFolder('NPCs');
    f.add(this.tuning, 'normal', 0, 60, 1).name('Traffic (Normal)');
    f.add(this.tuning, 'wrongWayChance', 0, 1, 0.01).name('Wrong-way chance');
  }

  private count(): number {
    const g = this.ctx.store.getState().settings.graphics;
    return g === 'potato' ? this.tuning.potato : g === 'ultra' ? this.tuning.ultra : this.tuning.normal;
  }

  private focus(): THREE.Vector3 {
    const s = this.ctx.services;
    return s.vehicles?.current?.position ?? s.player?.position ?? this.ctx.camera.position;
  }

  private laneOffset(from: RoadNode, to: RoadNode, lane: number, wrongWay: boolean, out: THREE.Vector3): THREE.Vector3 {
    const dx = Math.sign(to.x - from.x);
    const dz = Math.sign(to.z - from.z);
    // Drive on the left: left of travel direction (x right, z forward) is (dz, -dx).
    const side = wrongWay ? -1 : 1;
    const off = LANE_W * (lane + 0.5) * side;
    return out.set(dz * off, 0, -dx * off);
  }

  /** Waypoints for driving along edge from -> to (plus the turn into the next edge). */
  private planEdge(car: TrafficCar, from: RoadNode, to: RoadNode): void {
    const dir = new THREE.Vector3(Math.sign(to.x - from.x), 0, Math.sign(to.z - from.z));
    const off = this.laneOffset(from, to, car.lane, car.wrongWay, new THREE.Vector3());
    const gap = ROAD_W / 2 + 1.5;
    const a = new THREE.Vector3(from.x, 0, from.z).addScaledVector(dir, gap).add(off);
    const b = new THREE.Vector3(to.x, 0, to.z).addScaledVector(dir, -gap).add(off);
    car.waypoints.push(a, b);
    car.from = from.id;
    car.to = to.id;
  }

  private chooseNext(car: TrafficCar): void {
    const to = this.graph[car.to]!;
    const options = to.links.filter((l) => l !== car.from);
    const next = this.graph[options[Math.floor(Math.random() * options.length)] ?? car.from]!;
    const from = this.graph[car.from]!;
    // Turn curve through the intersection: quadratic bezier between the two lane lines.
    const offIn = this.laneOffset(from, to, car.lane, car.wrongWay, new THREE.Vector3());
    const offOut = this.laneOffset(to, next, car.lane, car.wrongWay, new THREE.Vector3());
    const end = car.waypoints[car.waypoints.length - 1] ?? car.pos.clone();
    const dirOut = new THREE.Vector3(Math.sign(next.x - to.x), 0, Math.sign(next.z - to.z));
    const start = new THREE.Vector3(to.x, 0, to.z).addScaledVector(dirOut, ROAD_W / 2 + 1.5).add(offOut);
    const ctrl = new THREE.Vector3(to.x, 0, to.z).add(offIn).add(offOut);
    for (let i = 1; i <= 4; i++) {
      const t = i / 5;
      const p = new THREE.Vector3()
        .addScaledVector(end, (1 - t) * (1 - t))
        .addScaledVector(ctrl, 2 * (1 - t) * t)
        .addScaledVector(start, t * t);
      car.waypoints.push(p);
    }
    this.planEdge(car, to, next);
  }

  private spawnNear(center: THREE.Vector3): void {
    // Pick an edge 60-170 m away.
    for (let tries = 0; tries < 8; tries++) {
      const from = this.graph[Math.floor(Math.random() * this.graph.length)]!;
      const d = Math.hypot(from.x - center.x, from.z - center.z);
      if (d < 60 || d > 170) continue;
      const to = this.graph[from.links[Math.floor(Math.random() * from.links.length)]!]!;
      this.spawnOn(from, to, center);
      return;
    }
  }

  spawnOn(from: RoadNode, to: RoadNode, center: THREE.Vector3, id?: string): TrafficCar | null {
    const district = districtAt(from.x, from.z);
    let type = id ?? this.pickType();
    if (district === 'jugaadpur' && !id && Math.random() < 0.05) type = 'auto';
    const config = VEHICLES[type]!;
    const inst = this.instancers.get(type);
    if (!inst) return null;
    const paint = PAINTS[type]?.[Math.floor(Math.random() * PAINTS[type]!.length)] ?? '';
    const slot = inst.alloc(paint || undefined);
    if (slot < 0) return null;
    const w0 = config.wheels[0]!;
    const rideHeight = -w0.pos[1] + config.suspension.restLength * 0.7 + w0.radius;
    const R = this.ctx.physics.rapier;
    const body = this.ctx.physics.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(from.x, rideHeight, from.z));
    const [hx, hy, hz] = config.halfExtents;
    const collider = this.ctx.physics.world.createCollider(R.ColliderDesc.cuboid(hx, hy, hz).setMass(config.mass).setActiveEvents(R.ActiveEvents.CONTACT_FORCE_EVENTS), body);
    const car: TrafficCar = {
      config,
      slot,
      pos: new THREE.Vector3(from.x, rideHeight, from.z),
      heading: 0,
      speed: 0,
      cruise: (district === 'jugaadpur' ? 7 : 11) * (type === 'bus' || type === 'tempo' ? 0.8 : type === 'bike' ? 1.2 : 1),
      waypoints: [],
      from: from.id,
      to: to.id,
      lane: type === 'bus' || type === 'tempo' ? 1 : Math.random() < 0.6 ? 0 : 1,
      wrongWay: Math.random() < this.tuning.wrongWayChance,
      overtake: 0,
      stuck: 0,
      honkCooldown: Math.random() * 5,
      body,
      collider,
      wrecked: false,
      rideHeight,
      driver: null,
      riders: [],
      paint,
      pulled: 0,
    };
    this.planEdge(car, from, to);
    const start = car.waypoints.shift()!;
    car.pos.set(start.x, rideHeight, start.z);
    car.heading = Math.atan2(to.x - from.x, to.z - from.z);
    body.setTranslation(car.pos, true);
    this.byCollider.set(collider.handle, car);
    this.cars.push(car);
    if (OPEN.has(type)) car.driver = this.ctx.services.peds?.spawn(type === 'bike' ? 'commuter' : 'commuter', car.pos, car.heading, true) ?? null;
    if (type === 'bike') {
      // Splendour seats four. Plus the cylinder. Physics is a suggestion.
      const n = Math.floor(Math.random() * 4);
      const kinds = ['aunty', 'kid', 'kid'] as const;
      for (let i = 0; i < n; i++) {
        const ped = this.ctx.services.peds?.spawn(kinds[i]!, car.pos, car.heading, true);
        if (ped) car.riders.push({ ped, seat: config.passengerSeats[i]! });
      }
    }
    if (car.wrongWay && car.pos.distanceTo(center) < 90) bark('wrongWay', 'driver', car.pos, center);
    return car;
  }

  private pickType(): string {
    let r = Math.random() * MIX.reduce((s, [, w]) => s + w, 0);
    for (const [t, w] of MIX) if ((r -= w) <= 0) return t;
    return 'auto';
  }

  remove(car: TrafficCar): void {
    this.instancers.get(car.config.id)?.release(car.slot);
    this.byCollider.delete(car.collider.handle);
    this.ctx.physics.world.removeRigidBody(car.body);
    if (car.driver) this.ctx.services.peds?.remove(car.driver);
    for (const r of car.riders) this.ctx.services.peds?.remove(r.ped);
    this.cars.splice(this.cars.indexOf(car), 1);
  }

  /** Pappu takes this car. Returns its pose/paint so a drivable Vehicle can replace it. */
  hijack(car: TrafficCar): { id: string; pos: THREE.Vector3; heading: number; paint: string } {
    const out = { id: car.config.id, pos: car.pos.clone(), heading: car.heading, paint: car.paint };
    const peds = this.ctx.services.peds;
    const d = car.driver;
    car.driver = null;
    if (d && peds) {
      peds.release(d);
      peds.knock(d, new THREE.Vector3(Math.cos(car.heading) * 3, 0, -Math.sin(car.heading) * 3), 2.5, 'hitByCar');
    } else bark('roadRage', 'driver', car.pos, null, true);
    for (const r of car.riders) {
      peds?.release(r.ped);
      peds?.knock(r.ped, new THREE.Vector3(Math.random() * 2 - 1, 0, Math.random() * 2 - 1), 2, 'downed');
    }
    car.riders = [];
    this.remove(car);
    return out;
  }

  /** Rammed: becomes a physics object that can be shoved around. */
  wreck(car: TrafficCar, byPlayer: boolean): void {
    car.wrecked = true;
    car.body.setBodyType(this.ctx.physics.rapier.RigidBodyType.Dynamic, true);
    car.body.setLinearDamping(0.6);
    car.body.setAngularDamping(1.5);
    if (car.driver) {
      const peds = this.ctx.services.peds;
      const d = car.driver;
      car.driver = null;
      if (peds) {
        peds.release(d);
        peds.knock(d, new THREE.Vector3((Math.random() - 0.5) * 4, 0, (Math.random() - 0.5) * 4), 3, 'hitByCar');
      }
    } else {
      bark('roadRage', 'driver', car.pos, this.focus(), true);
    }
    if (byPlayer) this.ctx.events.emit('crime:carHit', { position: car.pos.clone() });
  }

  /** Nearest thing in front of this car (distance), or Infinity. */
  private obstacleAhead(car: TrafficCar): { dist: number; isPlayer: boolean } {
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    let best = Infinity;
    let isPlayer = false;
    const consider = (x: number, z: number, radius: number, player: boolean) => {
      const dx = x - car.pos.x;
      const dz = z - car.pos.z;
      const along = dx * fx + dz * fz;
      if (along <= 0 || along > 16) return;
      const lateral = Math.abs(dx * fz - dz * fx);
      if (lateral > 1.4 + radius) return;
      const d = along - car.config.halfExtents[2] - radius;
      if (d < best) {
        best = d;
        isPlayer = player;
      }
    };
    for (const o of this.cars) if (o !== car) consider(o.pos.x, o.pos.z, o.config.halfExtents[2], false);
    const s = this.ctx.services;
    if (s.vehicles?.current) consider(s.vehicles.current.position.x, s.vehicles.current.position.z, 1.5, true);
    else if (s.player) consider(s.player.position.x, s.player.position.z, 0.5, true);
    for (const v of s.vehicles?.vehicles ?? []) if (v !== s.vehicles?.current) consider(v.position.x, v.position.z, 1.4, false);
    for (const p of s.peds?.peds ?? []) if (p !== car.driver && p.state !== 'scripted') consider(p.pos.x, p.pos.z, 0.4, false);
    for (const c of s.animals?.cows ?? []) consider(c.pos.x, c.pos.z, 1.2, false);
    for (const b of s.events?.blockers ?? []) consider(b.x, b.z, b.r, false);
    return { dist: best, isPlayer };
  }

  fixedUpdate(dt: number): void {
    this.time += dt;
    const center = this.focus();
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const car = this.cars[i]!;
      if (car.pos.distanceTo(center) > 220) {
        this.remove(car);
        continue;
      }
      if (car.wrecked) {
        const t = car.body.translation();
        car.pos.set(t.x, t.y, t.z);
        car.speed = 0;
        continue;
      }
      this.drive(car, dt, center);
    }
    let want = this.count();
    while (this.cars.length < want && want-- > 0) this.spawnNear(center);
  }

  private drive(car: TrafficCar, dt: number, center: THREE.Vector3): void {
    if (car.waypoints.length < 3) this.chooseNext(car);
    const target = car.waypoints[0]!;
    this.tmp.set(target.x - car.pos.x, 0, target.z - car.pos.z);
    // Overtaking: briefly swerve to the other side of the road (the Mumbhai way).
    if (car.overtake > 0) {
      car.overtake -= dt;
      this.tmp.x += Math.cos(car.heading) * 3.2;
      this.tmp.z += -Math.sin(car.heading) * 3.2;
    }
    const dist = this.tmp.length();
    if (dist < 1.2) {
      car.waypoints.shift();
      return;
    }
    const want = Math.atan2(this.tmp.x, this.tmp.z);
    const diff = Math.atan2(Math.sin(want - car.heading), Math.cos(want - car.heading));
    car.heading += THREE.MathUtils.clamp(diff, -2.2 * dt, 2.2 * dt);

    // VIP behind us (red beacon, or the bullock cart in Jugaadpur): pull over to the kerb and wait.
    const vip = this.ctx.services.vehicles?.current;
    if (vip && (vip.config.id === 'innova' || (vip.config.id === 'cart' && districtAt(vip.position.x, vip.position.z) === 'jugaadpur'))) {
      const dx = vip.position.x - car.pos.x;
      const dz = vip.position.z - car.pos.z;
      const behind = dx * Math.sin(car.heading) + dz * Math.cos(car.heading) < 0;
      if (behind && dx * dx + dz * dz < 28 * 28) car.pulled = 2.5;
    }
    if (car.pulled > 0) {
      car.pulled -= dt;
      car.speed = Math.max(0, car.speed - 12 * dt);
      const shift = Math.min(1, dt * 2);
      car.pos.x += Math.cos(car.heading) * shift;
      car.pos.z += -Math.sin(car.heading) * shift;
      car.body.setNextKinematicTranslation(car.pos);
      return;
    }
    // Speed: cruise, slow for turns, brake for obstacles.
    const ob = this.obstacleAhead(car);
    let target_speed = car.cruise * (Math.abs(diff) > 0.4 ? 0.55 : 1);
    if (ob.dist < 10) target_speed = Math.min(target_speed, Math.max(0, (ob.dist - 2.5) * 1.6));
    const accel = target_speed > car.speed ? 3.5 : 9;
    car.speed += THREE.MathUtils.clamp(target_speed - car.speed, -accel * dt, accel * dt);

    // Stuck behind something: honk, swear, then overtake on the wrong side.
    if (car.speed < 0.5 && ob.dist < 6) {
      car.stuck += dt;
      car.honkCooldown -= dt;
      if (car.honkCooldown <= 0) {
        car.honkCooldown = 2 + Math.random() * 3;
        audio.honkAt(car.config.horn, car.pos.distanceTo(center), 0.2 + Math.random() * 0.4);
        if (ob.isPlayer && Math.random() < 0.5) bark('roadRage', 'driver', car.pos, center);
      }
      if (car.stuck > 4 && car.overtake <= 0) {
        car.overtake = 3;
        car.stuck = 0;
      }
    } else {
      car.stuck = 0;
      // Random ambient honking, because silence is suspicious.
      car.honkCooldown -= dt;
      if (car.honkCooldown <= 0) {
        car.honkCooldown = 4 + Math.random() * 10;
        if (Math.random() < 0.35) audio.honkAt(car.config.horn, car.pos.distanceTo(center), 0.12 + Math.random() * 0.2);
      }
    }

    car.pos.x += Math.sin(car.heading) * car.speed * dt;
    car.pos.z += Math.cos(car.heading) * car.speed * dt;
    car.pos.y = car.rideHeight;
    this.q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, car.heading);
    car.body.setNextKinematicTranslation(car.pos);
    car.body.setNextKinematicRotation(this.q);
  }

  update(): void {
    for (const car of this.cars) {
      const inst = this.instancers.get(car.config.id)!;
      if (car.wrecked) {
        const r = car.body.rotation();
        this.q.set(r.x, r.y, r.z, r.w);
      } else {
        // Tiny body roll on turns for character.
        this.q.setFromEuler(this.e.set(0, car.heading, 0));
      }
      this.m.compose(car.pos, this.q, this.one);
      inst.set(car.slot, this.m);
      for (const r of car.riders) {
        r.ped.pos.copy(this.tmp.set(...r.seat).applyQuaternion(this.q).add(car.pos));
        r.ped.heading = car.heading;
        r.ped.anim = 'sitting';
      }
      if (car.driver) {
        const seat = this.tmp.set(...car.config.seat).applyQuaternion(this.q).add(car.pos);
        car.driver.pos.copy(seat);
        car.driver.pos.y -= car.config.id === 'bike' ? 0.05 : 0.0;
        car.driver.heading = car.heading;
        car.driver.anim = 'sitting';
      }
    }
  }
}
