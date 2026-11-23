/**
 * Mumbhai's street grid. Pure data, no Three.js: traffic, peds, minimap and missions all read this.
 * Roads run along x and z at every multiple of BLOCK; blocks sit between them.
 */
export const BLOCK = 60; // road centre to road centre
export const ROAD_W = 12; // asphalt width (2 lanes each way)
export const LANE_W = 3;
export const SIDEWALK_W = 3;
export const GRID = 10; // blocks per side
export const HALF = (GRID * BLOCK) / 2; // city spans -HALF..HALF
export const SEA_Z = HALF + 40; // Kachra Ghat waterfront

export type DistrictId = 'jugaadpur' | 'startup' | 'filmistan' | 'kachra' | 'sarkari';

export function districtOfBlock(bx: number, bz: number): DistrictId {
  if (bz >= GRID - 2) return 'kachra';
  if (bx <= 3 && bz <= 3) return 'filmistan';
  if (bx >= 6 && bz <= 3) return 'startup';
  if (bx >= 6) return 'sarkari';
  return 'jugaadpur';
}

export function blockIndex(v: number): number {
  return Math.min(GRID - 1, Math.max(0, Math.floor((v + HALF) / BLOCK)));
}

export function districtAt(x: number, z: number): DistrictId {
  if (z > HALF) return 'kachra';
  return districtOfBlock(blockIndex(x), blockIndex(z));
}

/** Road centre-line coordinate for road index i (0..GRID). */
export const roadCoord = (i: number) => -HALF + i * BLOCK;

export interface Block {
  bx: number;
  bz: number;
  district: DistrictId;
  /** Buildable area (inside sidewalks). */
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

export function blocks(): Block[] {
  const out: Block[] = [];
  const inset = ROAD_W / 2 + SIDEWALK_W;
  for (let bx = 0; bx < GRID; bx++)
    for (let bz = 0; bz < GRID; bz++) {
      const x = roadCoord(bx);
      const z = roadCoord(bz);
      out.push({ bx, bz, district: districtOfBlock(bx, bz), x0: x + inset, z0: z + inset, x1: x + BLOCK - inset, z1: z + BLOCK - inset });
    }
  return out;
}

/** Intersection graph for traffic: node id = i * (GRID+1) + j at (roadCoord(i), roadCoord(j)). */
export interface RoadNode {
  id: number;
  x: number;
  z: number;
  links: number[];
}

export function roadGraph(): RoadNode[] {
  const n = GRID + 1;
  const nodes: RoadNode[] = [];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const links: number[] = [];
      if (i > 0) links.push((i - 1) * n + j);
      if (i < n - 1) links.push((i + 1) * n + j);
      if (j > 0) links.push(i * n + j - 1);
      if (j < n - 1) links.push(i * n + j + 1);
      nodes.push({ id: i * n + j, x: roadCoord(i), z: roadCoord(j), links });
    }
  return nodes;
}

/** Is (x, z) on asphalt? */
export function onRoad(x: number, z: number): boolean {
  if (Math.abs(x) > HALF + ROAD_W / 2 || Math.abs(z) > HALF + ROAD_W / 2) return false;
  const dx = Math.abs(((x + HALF) % BLOCK + BLOCK) % BLOCK);
  const dz = Math.abs(((z + HALF) % BLOCK + BLOCK) % BLOCK);
  const h = ROAD_W / 2;
  return dx < h || dx > BLOCK - h || dz < h || dz > BLOCK - h;
}

/** Landmark plots kept free of generated buildings: [centreX, centreZ, width, depth] (front faces -Z). */
export const LANDMARK_PLOTS = {
  safehouse: [14, 14, 7, 7],
  dentingPainting: [-90, 14, 9, 7],
  netaOffice: [210, 14, 9, 7],
} as const;

/** Pappu wakes up on the pavement outside Pandey Niwas. */
export const SPAWN = { x: 14, z: 7.2 };
