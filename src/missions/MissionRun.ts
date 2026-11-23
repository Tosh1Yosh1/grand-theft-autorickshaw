import * as THREE from 'three';
import type { Ped } from '../ai/peds/Pedestrians';
import { pickLine, type Line } from '../content/lines';
import type { GameContext } from '../core/System';
import { showSubtitle } from '../ui/subtitles';
import type { Vehicle } from '../vehicles/Vehicle';
import type { MissionDef } from './types';

export interface Meter {
  label: string;
  value: number; // 0..1
  color: string;
}

/** Everything one attempt at a mission owns; cleaned up automatically on pass/fail. */
export class MissionRun {
  readonly data: Record<string, unknown> = {};
  readonly meters: Meter[] = [];
  /** Seconds left, shown in the HUD when set. */
  timer: number | null = null;
  extraText = '';
  private peds: Ped[] = [];
  private vehicles: Vehicle[] = [];
  private objects: THREE.Object3D[] = [];
  private seated: { ped: Ped; vehicle: Vehicle; seat: [number, number, number] }[] = [];
  private cleanups: (() => void)[] = [];

  constructor(
    readonly def: MissionDef,
    readonly ctx: GameContext,
  ) {}

  get services() {
    return this.ctx.services;
  }

  get playerPos(): THREE.Vector3 {
    const s = this.ctx.services;
    return s.vehicles?.current?.position ?? s.player?.position ?? new THREE.Vector3();
  }

  say(pool: readonly Line[] | Line, who: string, seconds = 3.2): void {
    const profanity = this.ctx.store.getState().settings.profanity;
    const text = Array.isArray(pool) ? pickLine(pool, profanity) : pickLine([pool as Line], profanity);
    showSubtitle(text, who, seconds);
  }

  ped(type: Parameters<NonNullable<GameContext['services']['peds']>['spawn']>[0], pos: THREE.Vector3, heading = 0): Ped | null {
    const p = this.ctx.services.peds?.spawn(type, pos, heading, true) ?? null;
    if (p) this.peds.push(p);
    return p;
  }

  vehicle(id: string, pos: THREE.Vector3, heading = 0): Vehicle | null {
    const v = this.ctx.services.vehicles?.spawn(id, pos, heading) ?? null;
    if (v) this.vehicles.push(v);
    return v;
  }

  /** Keep a vehicle after the mission (rewards, stolen cars). */
  keep(v: Vehicle): void {
    this.vehicles = this.vehicles.filter((x) => x !== v);
  }

  object(o: THREE.Object3D): THREE.Object3D {
    this.ctx.scene.add(o);
    this.objects.push(o);
    return o;
  }

  /** Put an NPC in a vehicle seat; MissionManager keeps them glued there. */
  seat(ped: Ped, vehicle: Vehicle, seat: [number, number, number]): void {
    this.unseat(ped);
    ped.anim = 'sitting';
    this.seated.push({ ped, vehicle, seat });
  }

  unseat(ped: Ped): void {
    this.seated = this.seated.filter((s) => s.ped !== ped);
  }

  onCleanup(fn: () => void): void {
    this.cleanups.push(fn);
  }

  updateSeated(): void {
    const q = new THREE.Quaternion();
    for (const s of this.seated) {
      const r = s.vehicle.body.rotation();
      q.set(r.x, r.y, r.z, r.w);
      s.ped.pos.copy(new THREE.Vector3(...s.seat).applyQuaternion(q).add(s.vehicle.position));
      s.ped.heading = s.vehicle.heading;
      s.ped.anim = 'sitting';
    }
  }

  cleanup(): void {
    for (const fn of this.cleanups) fn();
    const peds = this.ctx.services.peds;
    for (const p of this.peds) peds?.remove(p);
    const vm = this.ctx.services.vehicles;
    for (const v of this.vehicles) {
      if (vm?.current === v) vm.exit(true);
      if (vm?.vehicles.includes(v)) vm.remove(v);
    }
    for (const o of this.objects) o.removeFromParent();
    this.peds = [];
    this.vehicles = [];
    this.objects = [];
    this.seated = [];
  }
}
