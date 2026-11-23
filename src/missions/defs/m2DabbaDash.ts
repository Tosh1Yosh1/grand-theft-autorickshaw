import * as THREE from 'three';
import { M2 } from '../../content/missions';
import { BLOCK, HALF, ROAD_W, SIDEWALK_W, roadCoord } from '../../world/city/layout';
import type { MissionDef } from '../types';
import { action, until } from '../steps';

/** Sidewalk drop points around the start, nearest-neighbour ordered. */
function dropPoints(from: THREE.Vector3, n: number): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  let guard = 0;
  while (pts.length < n && guard++ < 400) {
    const ix = Math.round((from.x + HALF) / BLOCK) + Math.floor(Math.random() * 7) - 3;
    const iz = Math.round((from.z + HALF) / BLOCK) + Math.floor(Math.random() * 7) - 3;
    if (ix < 0 || iz < 0 || ix > 10 || iz > 9) continue;
    const alongX = Math.random() < 0.5;
    const off = ROAD_W / 2 + SIDEWALK_W / 2;
    const t = 10 + Math.random() * (BLOCK - 20);
    const p = alongX ? new THREE.Vector3(roadCoord(ix) + t, 0, roadCoord(iz) + off) : new THREE.Vector3(roadCoord(ix) + off, 0, roadCoord(iz) + t);
    const d = p.distanceTo(from);
    if (d < 50 || d > 260 || Math.abs(p.x) > HALF - 5 || Math.abs(p.z) > HALF - 5) continue;
    if (pts.some((q) => q.distanceTo(p) < 35)) continue;
    pts.push(p);
  }
  // Order greedily so the route is drivable.
  const ordered: THREE.Vector3[] = [];
  let cur = from;
  while (pts.length) {
    pts.sort((a, b) => a.distanceTo(cur) - b.distanceTo(cur));
    cur = pts.shift()!;
    ordered.push(cur);
  }
  return ordered;
}

/** Mission 2: 10 tiffins before lunch ends; spilled dal costs reputation. */
export const DabbaDash: MissionDef = {
  id: 'm2',
  title: M2.title,
  tagline: M2.tagline,
  requires: ['m1'],
  start: ({ landmarks }) => landmarks.safehouse.clone().add(new THREE.Vector3(-30, 0, 0)),
  intro: M2.intro,
  outro: M2.outro,
  reward: { money: (run) => 2000 + Math.round((run.data.rep as number) * 300), respect: 50 },
  steps: (run) => {
    const start = run.playerPos.clone();
    const drops = dropPoints(start, 10);
    const dal = { label: 'Dal level 🍲', value: 1, color: '#f4a261' };
    let next = 0;
    let spillT = 0;
    run.data.rep = 0;
    return [
      until('Koi gaadi lo (auto, bike, kuch bhi). Dabbe tayyar hain.', (r) => !!r.services.vehicles?.current),
      action((r) => {
        r.timer = 240;
        r.meters.push(dal);
        const off1 = r.ctx.events.on('vehicle:pothole', () => {
          dal.value -= 0.07;
          r.say(M2.spill, 'Dabbe');
        });
        r.onCleanup(off1);
        r.data.hp = r.services.vehicles!.current!.health;
      }),
      until(
        () => `Dabba ${next + 1}/10 pahuncho (ruk ke deliver karo)`,
        (r, dt) => {
          if (r.timer === 0) return { fail: M2.timeout };
          const v = r.services.vehicles?.current;
          r.extraText = `Delivered: ${next}/10 · Reputation: ${(r.data.rep as number).toFixed(1)}`;
          if (!v) return false;
          const w = v.body.angvel();
          const lateral = Math.abs(w.y * v.speed);
          spillT -= dt;
          if (lateral > 5) {
            dal.value -= (lateral - 5) * 0.012 * dt;
            if (spillT <= 0) {
              spillT = 3;
              r.say(M2.spill, 'Dabbe');
            }
          }
          if (v.health < (r.data.hp as number) - 3) dal.value -= 0.1;
          r.data.hp = v.health;
          dal.value = Math.max(0, dal.value);
          if (dal.value <= 0) return { fail: M2.allSpilled };
          const target = drops[next]!;
          if (Math.hypot(v.position.x - target.x, v.position.z - target.z) < 7 && Math.abs(v.speed) < 3) {
            r.data.rep = (r.data.rep as number) + dal.value;
            r.say(M2.delivered, 'Office babu');
            next++;
            if (next >= drops.length) return true;
          }
          return false;
        },
        () => drops[next] ?? null,
      ),
    ];
  },
};
