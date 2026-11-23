import * as THREE from 'three';
import { ROAD_W, roadCoord, BLOCK, HALF } from '../world/city/layout';
import type { DriveInput, Vehicle } from './Vehicle';

/** Snap a coordinate to the nearest road line, if within the asphalt. */
function nearRoad(v: number): number | null {
  const i = Math.round((v + HALF) / BLOCK);
  const c = roadCoord(i);
  return Math.abs(v - c) < ROAD_W / 2 ? c : null;
}

/**
 * Pursuit driver: Manhattan routing along the grid (so cops don't drive into buildings),
 * direct chase when close, reverse-and-retry when stuck. Ramming is a feature.
 */
export class PursuitAI {
  private stuck = 0;
  private reverse = 0;
  private readonly wp = new THREE.Vector3();

  constructor(
    private readonly v: Vehicle,
    private readonly target: () => THREE.Vector3 | null,
    private readonly aggression = 1,
  ) {}

  drive = (dt: number): DriveInput => {
    const t = this.target();
    if (!t) return { throttle: 0, steer: 0, handbrake: true };
    const p = this.v.position;
    const dist = Math.hypot(t.x - p.x, t.z - p.z);
    this.waypoint(p, t, dist);
    const desired = Math.atan2(this.wp.x - p.x, this.wp.z - p.z);
    const diff = Math.atan2(Math.sin(desired - this.v.heading), Math.cos(desired - this.v.heading));
    const speed = this.v.speed;

    if (this.reverse > 0) {
      this.reverse -= dt;
      return { throttle: -1, steer: diff > 0 ? 1 : -1, handbrake: false };
    }
    if (Math.abs(speed) < 0.6) this.stuck += dt;
    else this.stuck = 0;
    if (this.stuck > 1.6) {
      this.stuck = 0;
      this.reverse = 1.1;
    }
    const steer = THREE.MathUtils.clamp(-diff * 2.2, -1, 1);
    let throttle = Math.abs(diff) > 1.6 ? 0.4 : 1;
    // Slow down a bit when very close unless we're in "ram" mode.
    if (dist < 7 && this.aggression < 1) throttle = 0.3;
    return { throttle: throttle * this.aggression, steer, handbrake: Math.abs(diff) > 1.2 && speed > 10 };
  };

  private waypoint(p: THREE.Vector3, t: THREE.Vector3, dist: number): void {
    if (dist < 35) {
      this.wp.copy(t);
      return;
    }
    const onX = nearRoad(p.x); // on a north-south road
    const onZ = nearRoad(p.z); // on an east-west road
    const tx = Math.round((t.x + HALF) / BLOCK);
    const tz = Math.round((t.z + HALF) / BLOCK);
    if (onX !== null && (onZ === null || Math.abs(t.z - p.z) > Math.abs(t.x - p.x))) {
      // Drive along z to the target's road row, then turn.
      this.wp.set(onX, 0, Math.abs(roadCoord(tz) - p.z) < 4 ? t.z : roadCoord(tz));
      if (Math.abs(roadCoord(tz) - p.z) < 4) this.wp.set(t.x, 0, roadCoord(tz));
    } else if (onZ !== null) {
      this.wp.set(Math.abs(roadCoord(tx) - p.x) < 4 ? t.x : roadCoord(tx), 0, onZ);
      if (Math.abs(roadCoord(tx) - p.x) < 4) this.wp.set(roadCoord(tx), 0, t.z);
    } else {
      this.wp.copy(t);
    }
  }
}
