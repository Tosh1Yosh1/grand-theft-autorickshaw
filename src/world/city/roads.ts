import * as THREE from 'three';
import { TRUCK_BACKS } from '../../content/hoardings';
import type { Potholes } from '../Potholes';
import type { CityBuilder } from './CityBuilder';
import { stringLights } from './districts';
import { BLOCK, GRID, HALF, LANE_W, ROAD_W, SIDEWALK_W, roadCoord, type Block } from './layout';
import { mergeQuads } from './signAtlas';
import { chance, int, pick, range, type Rng } from './rng';

/** Flat quad on the ground (y up), merged later. */
function groundQuad(x: number, z: number, w: number, d: number, y: number): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  g.translate(x, y, z);
  return g;
}

/** Asphalt, lane markings, sidewalks, zebra crossings. Returns meshes (merged per material). */
export function buildRoads(b: CityBuilder, r: Rng, blockList: Block[], potholes: Potholes | undefined): THREE.Object3D[] {
  const asphalt: THREE.BufferGeometry[] = [];
  const white: THREE.BufferGeometry[] = [];
  const yellow: THREE.BufferGeometry[] = [];
  const L = GRID * BLOCK + ROAD_W;
  for (let i = 0; i <= GRID; i++) {
    const c = roadCoord(i);
    asphalt.push(groundQuad(c, 0, ROAD_W, L, 0.02)); // north-south road
    asphalt.push(groundQuad(0, c, L, ROAD_W, 0.021)); // east-west road
    // Markings between intersections only.
    for (let j = 0; j < GRID; j++) {
      const a = roadCoord(j) + ROAD_W / 2 + 1;
      const e = roadCoord(j + 1) - ROAD_W / 2 - 1;
      const mid = (a + e) / 2;
      const len = e - a;
      for (const off of [-0.12, 0.12]) {
        yellow.push(groundQuad(c + off, mid, 0.1, len, 0.03));
        yellow.push(groundQuad(mid, c + off, len, 0.1, 0.03));
      }
      for (let s = a; s < e - 3; s += 6) {
        for (const lane of [-LANE_W, LANE_W]) {
          white.push(groundQuad(c + lane, s + 1.5, 0.12, 3, 0.03));
          white.push(groundQuad(s + 1.5, c + lane, 3, 0.12, 0.03));
        }
      }
      // Potholes: the true residents of every road.
      if (potholes) {
        for (let k = int(r, 1, 3); k > 0; k--) {
          const t = range(r, a, e);
          const lat = range(r, -ROAD_W / 2 + 1, ROAD_W / 2 - 1);
          const rad = range(r, 0.5, 1.1);
          potholes.add(c + lat, t, rad, 0.035);
          if (chance(r, 0.7)) potholes.add(t, c + lat, rad, 0.036);
        }
      }
    }
  }
  // Zebra crossings at a third of intersections (ignored by everyone, as tradition demands).
  for (let i = 0; i <= GRID; i++)
    for (let j = 0; j <= GRID; j++) {
      if (!chance(r, 0.33)) continue;
      const x = roadCoord(i);
      const z = roadCoord(j);
      for (let s = -ROAD_W / 2 + 0.8; s < ROAD_W / 2; s += 1.2) white.push(groundQuad(x + s, z - ROAD_W / 2 - 1.2, 0.6, 2, 0.032));
    }

  // Sidewalk slabs: one per block, raised 15 cm with a collider.
  for (const blk of blockList) {
    const x = (blk.x0 + blk.x1) / 2;
    const z = (blk.z0 + blk.z1) / 2;
    const w = blk.x1 - blk.x0 + SIDEWALK_W * 2;
    b.put('concrete', x, 0, z, w, 0.15, w, 0, blk.district === 'startup' ? '#d9d4cc' : '#b9ad99');
    b.solid(x, 0.075, z, w / 2, 0.075, w / 2);
  }

  const out: THREE.Object3D[] = [];
  const mk = (geos: THREE.BufferGeometry[], color: string, rough: number, offset: number) => {
    const m = new THREE.Mesh(mergeQuads(geos), new THREE.MeshStandardMaterial({ color, roughness: rough, polygonOffset: true, polygonOffsetFactor: offset }));
    m.receiveShadow = true;
    out.push(m);
  };
  mk(asphalt, '#2b2a2a', 0.9, 0);
  mk(white, '#e8e4da', 0.8, -1);
  mk(yellow, '#e9b824', 0.8, -1);
  return out;
}

/** Electric poles with street lamps and the legendary tangle of overhead wires. */
export function buildPolesAndWires(b: CityBuilder, r: Rng) {
  const edge = ROAD_W / 2 + 0.6;
  for (let i = 0; i <= GRID; i++) {
    const c = roadCoord(i);
    for (const side of [-1, 1]) {
      let prevNS: THREE.Vector3 | null = null;
      let prevEW: THREE.Vector3 | null = null;
      for (let s = -HALF + 10; s <= HALF - 10; s += 20) {
        // Skip poles inside intersections.
        const off = ((s + HALF) % BLOCK + BLOCK) % BLOCK;
        if (off < ROAD_W / 2 + 2 || off > BLOCK - ROAD_W / 2 - 2) {
          prevNS = prevEW = null;
          continue;
        }
        const ns = new THREE.Vector3(c + side * edge, 0, s);
        const ew = new THREE.Vector3(s, 0, c + side * edge);
        for (const p of [ns, ew]) {
          b.put('pole', p.x, 0.15, p.z, 0.22, 7.5, 0.22);
          b.solid(p.x, 3.9, p.z, 0.12, 3.75, 0.12);
          // Lamp arm reaching over the road.
          const ax = p === ns ? -side : 0;
          const az = p === ew ? -side : 0;
          b.put('lamp', p.x + ax * 1.2, 7.3, p.z + az * 1.2, ax ? 1.2 : 0.35, 0.18, az ? 1.2 : 0.35);
        }
        // Wires: 3 per span, sagging at different depths. Sometimes a few extra for drama.
        for (const [prev, cur] of [[prevNS, ns], [prevEW, ew]] as const) {
          if (!prev) continue;
          for (let w = 0; w < 3 + (chance(r, 0.3) ? int(r, 1, 4) : 0); w++) {
            b.wire(new THREE.Vector3(prev.x, 6.6 + w * 0.25, prev.z), new THREE.Vector3(cur.x, 6.6 + w * 0.25, cur.z), range(r, 0.4, 1.4));
          }
        }
        // Random cross-road wire (the tangle).
        if (chance(r, 0.25)) {
          const other = new THREE.Vector3(c - side * edge, 6.8, s + range(r, -6, 6));
          b.wire(new THREE.Vector3(ns.x, 7, ns.z), other, range(r, 0.8, 2));
        }
        prevNS = ns;
        prevEW = ew;
      }
    }
  }
}

/** Parked "Horn OK Please" trucks along the kerb. */
export function buildTrucks(b: CityBuilder, r: Rng, count: number) {
  for (let k = 0; k < count; k++) {
    const i = int(r, 1, GRID - 1);
    const along = roadCoord(int(r, 0, GRID - 1)) + range(r, 15, BLOCK - 15);
    const ns = chance(r, 0.5);
    const lat = roadCoord(i) + (chance(r, 0.5) ? 1 : -1) * (ROAD_W / 2 - 1.4);
    const x = ns ? lat : along;
    const z = ns ? along : lat;
    const yaw = ns ? 0 : Math.PI / 2;
    const color = pick(r, ['#d62828', '#f77f00', '#2a9d8f', '#e9c46a', '#3a86ff']);
    // Cab + cargo bed, as two boxes aligned with the road.
    const fx = ns ? 0 : 1;
    const fz = ns ? 1 : 0;
    b.block('plain', x + fx * 2.6, z + fz * 2.6, ns ? 2.3 : 1.8, 2.6, ns ? 1.8 : 2.3, color, 0, 0.5);
    b.block('plain', x - fx * 0.8, z - fz * 0.8, ns ? 2.4 : 5, 2.8, ns ? 5 : 2.4, '#8d6e63', 0, 0.5);
    const text = pick(r, TRUCK_BACKS);
    const slot = b.atlas.slot(`truck:${text}`, { title: text, sub: 'Mummy ka aashirwad · 9876X XXXX', bg: '#ffd166', fg: '#9d0208', border: '#06d6a0' });
    b.atlas.place(slot, x - fx * 3.32, 1.8, z - fz * 3.32, 2.2, 1.1, yaw + Math.PI);
  }
}

/** The half-built flyover: rises, runs, and stops in mid-air. Very on brand. */
export function buildFlyover(b: CityBuilder) {
  const z = roadCoord(4);
  const deckY = 7;
  const xStart = roadCoord(1);
  const xEnd = roadCoord(6) - 18;
  const rampLen = 45;
  const deckMat = new THREE.MeshStandardMaterial({ color: '#a39e93', roughness: 0.95 });
  // Ramp.
  const angle = Math.atan2(deckY, rampLen);
  const rampL = Math.hypot(deckY, rampLen);
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(rampL, 0.6, 9), deckMat);
  ramp.position.set(xStart - rampLen / 2, deckY / 2, z);
  ramp.rotation.z = angle;
  ramp.castShadow = ramp.receiveShadow = true;
  b.addMesh(ramp);
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, angle));
  const rd = b.physics.rapier.ColliderDesc.cuboid(rampL / 2, 0.3, 4.5).setTranslation(ramp.position.x, ramp.position.y, z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
  b.physics.world.createCollider(rd);
  // Deck in segments (one per block so chunks cull it).
  for (let x = xStart; x < xEnd; x += 30) {
    const len = Math.min(30, xEnd - x);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(len, 0.8, 10), deckMat);
    deck.position.set(x + len / 2, deckY - 0.1, z);
    deck.castShadow = deck.receiveShadow = true;
    b.addMesh(deck);
    b.solid(x + len / 2, deckY - 0.1, z, len / 2, 0.4, 5);
    // Crash barriers.
    for (const s of [-1, 1]) b.block('concrete', x + len / 2, z + s * 4.8, len, 0.9, 0.3, '#d7d2c8', 0, deckY + 0.3);
    // Pillar in the median.
    b.block('concrete', x + len / 2, z, 1.4, deckY - 0.5, 1.4, '#a39e93');
  }
  // Rebar sticking out of the end: the "Phase 2 will start soon" monument.
  for (let k = -4; k <= 4; k++) b.put('rail', xEnd + 0.8, deckY - 0.2, z + k, 1.6, 0.08, 0.08, 0, '#7f4f24', 0, 0.2);
  const slot = b.atlas.slot('flyover', { title: 'FLYOVER UNDER CONSTRUCTION', sub: 'Since 2009. Inconvenience regretted.', bg: '#ffd60a', fg: '#000' });
  b.atlas.place(slot, xEnd - 1, deckY + 2, z, 8, 4, Math.PI / 2);
}

/** Chai tapris, paan shops and vada pav stalls on the pavement. */
export function buildStalls(b: CityBuilder, r: Rng, blk: Block, count: number, startup: boolean, out?: { position: THREE.Vector3; chai: boolean }[]) {
  const kinds = startup
    ? [['ARTISANAL VADA PAV', '₹400. Gluten-free pav extra.']]
    : [['PAPPU CHAI', 'Cutting ₹10. Udhaar kal.'], ['PAAN CORNER', 'Meetha, saada, aur "special"'], ['VADA PAV', '₹15. Chutney free.'], ['JUICE CENTRE', 'Mausambi. Hygiene: optional.']];
  for (let k = 0; k < count; k++) {
    const side = int(r, 0, 3);
    const t = range(r, 0.15, 0.85);
    const off = 1.6;
    const x = side < 2 ? blk.x0 + (blk.x1 - blk.x0) * t : side === 2 ? blk.x0 - off : blk.x1 + off;
    const z = side >= 2 ? blk.z0 + (blk.z1 - blk.z0) * t : side === 0 ? blk.z0 - off : blk.z1 + off;
    const yaw = side === 0 ? Math.PI : side === 1 ? 0 : side === 2 ? -Math.PI / 2 : Math.PI / 2;
    if (b.isReserved(x, z, 4, 4)) continue;
    b.block('stall', x, z, 1.8, 1.1, 1.8, '#6d4c41', 0, 0.15);
    b.put('stall', x, 2.3, z, 2.4, 0.12, 2.4, yaw, pick(r, ['#e63946', '#2a9d8f', '#f4a261', '#3a86ff', '#ffb703']));
    for (const [px, pz] of [[-1, -1], [1, 1], [-1, 1], [1, -1]] as const) b.put('pole', x + px * 1.05, 0.15, z + pz * 1.05, 0.06, 2.2, 0.06);
    const [title, sub] = pick(r, kinds);
    out?.push({ position: new THREE.Vector3(x, 0, z), chai: title === 'PAPPU CHAI' || title === 'VADA PAV' || startup });
    const slot = b.atlas.slot(`stall:${title}`, { title: title!, sub, bg: '#ffd23f', fg: '#7a1f12' });
    const fx = Math.sin(yaw) * 1.25;
    const fz = Math.cos(yaw) * 1.25;
    b.atlas.place(slot, x + fx, 2.7, z + fz, 2.2, 0.75, yaw);
    if (!startup && chance(r, 0.4)) stringLights(b, r, new THREE.Vector3(x - 1.2, 2.3, z), new THREE.Vector3(x + 1.2, 2.3, z));
  }
}

export { HALF };
