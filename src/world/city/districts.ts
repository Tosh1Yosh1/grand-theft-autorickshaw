import * as THREE from 'three';
import { HOARDINGS, STARTUP_LOGOS, STUDIO_SIGNS } from '../../content/hoardings';
import type { CityBuilder } from './CityBuilder';
import type { Block } from './layout';
import { chance, int, pick, range, type Rng } from './rng';

const PALETTE = {
  jugaad: ['#f4a261', '#e76f51', '#2a9d8f', '#e9c46a', '#f28482', '#84a59d', '#b5838d', '#ffcad4', '#cdb4db', '#a3c4f3', '#fec89a', '#90be6d', '#ffd166', '#06d6a0'],
  sarkari: ['#e9dcc9', '#d6ccc2', '#cfc4b0', '#d8cfb6'],
  glass: ['#5fa8d3', '#62b6cb', '#7fc8f8', '#8d99ae', '#48cae4', '#90a8c3'],
  film: ['#f8edeb', '#ffd6a5', '#cdb4db', '#bde0fe', '#fcd5ce'],
  warehouse: ['#8d6e63', '#457b9d', '#a8dadc', '#6d597a', '#b56576', '#7f5539'],
  container: ['#d62828', '#f77f00', '#003049', '#2a9d8f', '#6a994e', '#bc6c25', '#3a86ff'],
  canopy: ['#e63946', '#2a9d8f', '#f4a261', '#3a86ff', '#ffb703'],
  bulbs: ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#ff70a6'],
};

export interface Landmarks {
  safehouse: THREE.Vector3;
  sarkariDaftar: THREE.Vector3;
  studio7: THREE.Vector3;
  botalwalaGodown: THREE.Vector3;
  disruptxTower: THREE.Vector3;
  dentingPainting: THREE.Vector3;
  netaOffice: THREE.Vector3;
}

/** Facing yaw for each side of a rectangle (sign/balcony looks outward). */
const SIDES = [
  { nx: 0, nz: 1, yaw: 0 },
  { nx: 0, nz: -1, yaw: Math.PI },
  { nx: 1, nz: 0, yaw: Math.PI / 2 },
  { nx: -1, nz: 0, yaw: -Math.PI / 2 },
] as const;

interface Lot {
  x: number;
  z: number;
  w: number;
  d: number;
}

/** Split a rectangle into roughly `target`-sized lots in a grid. */
function lots(r: Rng, x0: number, z0: number, x1: number, z1: number, minSize: number, maxSize: number): Lot[] {
  const cut = (a: number, b: number) => {
    const out: number[] = [a];
    let p = a;
    while (b - p > maxSize) {
      p += range(r, minSize, maxSize);
      if (b - p < minSize) break;
      out.push(p);
    }
    out.push(b);
    return out;
  };
  const xs = cut(x0, x1);
  const zs = cut(z0, z1);
  const res: Lot[] = [];
  for (let i = 0; i < xs.length - 1; i++)
    for (let j = 0; j < zs.length - 1; j++) {
      const w = xs[i + 1]! - xs[i]!;
      const d = zs[j + 1]! - zs[j]!;
      res.push({ x: xs[i]! + w / 2, z: zs[j]! + d / 2, w, d });
    }
  return res;
}

/** A residential building with all the Indian-city trimmings. */
function residential(b: CityBuilder, r: Rng, lot: Lot, floors: number, kind: 'jugaad' | 'sarkari' | 'film', color: string, opts: { balconies: number; ac: number; tanks: number; laundry: number; scaffold: number; hoarding: number }) {
  if (b.isReserved(lot.x, lot.z, lot.w, lot.d)) return;
  const floorH = kind === 'sarkari' ? 3.2 : 3;
  const w = lot.w - 0.6;
  const d = lot.d - 0.6;
  const h = floors * floorH + 0.6;
  b.block(kind, lot.x, lot.z, w, h, d, color);
  // Roof parapet in a darker shade.
  const roofColor = new THREE.Color(color).multiplyScalar(0.8);
  b.put('plain', lot.x, h, lot.z, w + 0.1, 0.5, d + 0.1, 0, roofColor);

  for (const side of SIDES) {
    const faceW = side.nx ? d : w;
    const fx = lot.x + (side.nx * w) / 2;
    const fz = lot.z + (side.nz * d) / 2;
    // Balconies, one per floor above ground, on a random subset of faces.
    if (floors > 1 && chance(r, opts.balconies)) {
      const bw = Math.min(faceW * 0.6, 5);
      const laundry = chance(r, opts.laundry);
      for (let f = 1; f < floors; f++) {
        const y = f * floorH;
        const ox = fx + side.nx * 0.5;
        const oz = fz + side.nz * 0.5;
        b.put('balcony', ox, y, oz, side.nx ? 1 : bw, 0.15, side.nz ? 1 : bw, 0);
        b.put('rail', fx + side.nx * 1.0, y + 0.15, fz + side.nz * 1.0, side.nx ? 0.05 : bw, 0.9, side.nz ? 0.05 : bw);
        if (laundry && chance(r, 0.6)) b.put('laundry', fx + side.nx * 0.9, y + 2.2, fz + side.nz * 0.9, bw * 0.9, 0.9, 1, side.yaw);
      }
    }
    // AC units bolted wherever they fit.
    const acs = int(r, 0, opts.ac);
    for (let k = 0; k < acs && floors > 1; k++) {
      const along = range(r, -faceW / 2 + 1, faceW / 2 - 1);
      const y = int(r, 1, floors - 1) * floorH + range(r, 0.6, 1.8);
      const ax = fx + side.nx * 0.25 + (side.nz ? along : 0);
      const az = fz + side.nz * 0.25 + (side.nx ? along : 0);
      b.put('ac', ax, y, az, side.nx ? 0.45 : 0.8, 0.55, side.nz ? 0.45 : 0.8);
    }
  }
  // Water tanks on the roof: the black plastic kind.
  const tanks = int(r, 0, opts.tanks);
  for (let k = 0; k < tanks; k++) b.put('tank', lot.x + range(r, -w / 3, w / 3), h + 0.5, lot.z + range(r, -d / 3, d / 3), 1.3, 1.5, 1.3);
  // Bamboo scaffolding on one face: forever "under construction".
  if (chance(r, opts.scaffold)) {
    const side = pick(r, SIDES);
    const faceW = side.nx ? d : w;
    const fx = lot.x + (side.nx * w) / 2 + side.nx * 0.6;
    const fz = lot.z + (side.nz * d) / 2 + side.nz * 0.6;
    for (let a = -faceW / 2; a <= faceW / 2; a += 1.6) {
      b.put('bamboo', fx + (side.nz ? a : 0), 0, fz + (side.nx ? a : 0), 1, h + 1, 1);
    }
    // Horizontal poles: a Y-cylinder rolled onto its side runs toward -X (or +Z after the yaw).
    for (let y = 2; y < h; y += 2) {
      if (side.nz) b.put('bamboo', fx + faceW / 2, y, fz, 1, faceW, 1, 0, undefined, 0, Math.PI / 2);
      else b.put('bamboo', fx, y, fz - faceW / 2, 1, faceW, 1, Math.PI / 2, undefined, 0, Math.PI / 2);
    }
  }
  // Rooftop hoarding.
  if (chance(r, opts.hoarding)) rooftopHoarding(b, r, lot.x, h, lot.z, Math.min(w, 10));
}

export function rooftopHoarding(b: CityBuilder, r: Rng, x: number, y: number, z: number, width: number) {
  const ad = pick(r, HOARDINGS);
  const slot = b.atlas.slot(ad[0], { title: ad[0], sub: ad[1], bg: ad[2], fg: ad[3] });
  const facing = pick(r, SIDES).yaw;
  const w = Math.max(6, width);
  b.put('pole', x - w / 3, y, z, 0.25, 3, 0.25);
  b.put('pole', x + w / 3, y, z, 0.25, 3, 0.25);
  b.atlas.place(slot, x, y + 4.5, z, w, w / 2, facing);
}

export function buildJugaadpur(b: CityBuilder, r: Rng, blk: Block) {
  // Narrow lanes: a 4m gali splits the block both ways.
  const mx = (blk.x0 + blk.x1) / 2;
  const mz = (blk.z0 + blk.z1) / 2;
  const g = 2;
  const subs: [number, number, number, number][] = [
    [blk.x0, blk.z0, mx - g, mz - g],
    [mx + g, blk.z0, blk.x1, mz - g],
    [blk.x0, mz + g, mx - g, blk.z1],
    [mx + g, mz + g, blk.x1, blk.z1],
  ];
  for (const [x0, z0, x1, z1] of subs) {
    for (const lot of lots(r, x0, z0, x1, z1, 5.5, 9.5)) {
      if (chance(r, 0.07)) continue; // empty plot: dust and possibility
      residential(b, r, lot, int(r, 2, 6), 'jugaad', pick(r, PALETTE.jugaad), { balconies: 0.5, ac: 2, tanks: 2, laundry: 0.6, scaffold: 0.08, hoarding: 0.05 });
    }
  }
  // String lights criss-crossing the galis (they glow at night).
  for (let k = 0; k < 6; k++) {
    const alongX = k % 2 === 0;
    const t = range(r, 0.1, 0.9);
    const a = alongX ? new THREE.Vector3(blk.x0 + (blk.x1 - blk.x0) * t, 7, mz - g) : new THREE.Vector3(mx - g, 7, blk.z0 + (blk.z1 - blk.z0) * t);
    const c = alongX ? new THREE.Vector3(a.x + range(r, -3, 3), 7, mz + g) : new THREE.Vector3(mx + g, 7, a.z + range(r, -3, 3));
    stringLights(b, r, a, c);
  }
}

export function stringLights(b: CityBuilder, r: Rng, a: THREE.Vector3, c: THREE.Vector3) {
  b.wire(a, c, 0.6);
  const n = Math.max(4, Math.round(a.distanceTo(c) / 0.7));
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const p = new THREE.Vector3().lerpVectors(a, c, t);
    p.y -= Math.sin(t * Math.PI) * 0.6 + 0.1;
    b.put('bulbs', p.x, p.y, p.z, 0.16, 0.16, 0.16, 0, pick(r, PALETTE.bulbs));
  }
}

export function buildSarkari(b: CityBuilder, r: Rng, blk: Block, landmarks: Partial<Landmarks>) {
  const w = blk.x1 - blk.x0;
  const d = blk.z1 - blk.z0;
  if (!landmarks.sarkariDaftar && blk.bx === 7 && blk.bz === 5) {
    // The Sarkari Daftar: everything needs a form from here.
    const cx = blk.x0 + w / 2;
    const cz = blk.z0 + d / 2;
    b.block('sarkari', cx, cz, w - 6, 16, d - 14, '#e0c98f');
    b.put('plain', cx, 16, cz, w - 5, 0.8, d - 13, 0, '#b08d57');
    const slot = b.atlas.slot('daftar', { title: 'SARKARI DAFTAR', sub: 'Lunch 1-2. Phir 2-5 bhi lunch.', bg: '#fdf0d5', fg: '#7b2c00' });
    b.atlas.place(slot, cx, 12, cz + (d - 14) / 2 + 0.05, 14, 3.5, 0);
    landmarks.sarkariDaftar = new THREE.Vector3(cx, 0, blk.z1 + 1.5);
    return;
  }
  // Identical colony blocks in neat rows. Uniformity is a government policy.
  const color = pick(r, PALETTE.sarkari);
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < 3; j++) {
      const lot = { x: blk.x0 + w * (0.25 + i * 0.5), z: blk.z0 + d * (1 / 6 + j / 3), w: w * 0.42, d: d * 0.26 };
      residential(b, r, lot, 4, 'sarkari', color, { balconies: 0.5, ac: 1, tanks: 3, laundry: 0.5, scaffold: 0, hoarding: 0.04 });
    }
  // Neem trees along the edge.
  for (let k = 0; k < 4; k++) tree(b, r, blk.x0 + range(r, 1, w - 1), blk.z0 + (k % 2 ? d - 1 : 1));
}

export function buildStartup(b: CityBuilder, r: Rng, blk: Block, landmarks: Partial<Landmarks>) {
  const w = blk.x1 - blk.x0;
  const d = blk.z1 - blk.z0;
  const towers = chance(r, 0.5) ? 1 : 2;
  for (let t = 0; t < towers; t++) {
    const tw = towers === 1 ? range(r, 20, 30) : range(r, 14, 18);
    const td = towers === 1 ? range(r, 20, 30) : range(r, 14, 18);
    const x = towers === 1 ? blk.x0 + w / 2 : blk.x0 + (t === 0 ? tw / 2 + 2 : w - tw / 2 - 2);
    const z = towers === 1 ? blk.z0 + d / 2 : blk.z0 + (t === 0 ? td / 2 + 2 : d - td / 2 - 2);
    const h = int(r, 10, 32) * 3.6;
    const color = pick(r, PALETTE.glass);
    b.block('glass', x, z, tw, h, td, color);
    // Stepped crown + a rooftop logo that glows at night.
    b.put('glass', x, h, z, tw * 0.7, 3.6, td * 0.7, 0, color);
    const logo = pick(r, STARTUP_LOGOS);
    const slot = b.atlas.slot(`logo:${logo}`, { title: logo, sub: 'Series Z funded', bg: '#0b132b', fg: '#5bc0be' });
    b.atlas.place(slot, x, h + 6, z + (td * 0.7) / 2 + 0.1, tw * 0.6, tw * 0.3, 0);
    if (!landmarks.disruptxTower && logo === 'DisruptX') landmarks.disruptxTower = new THREE.Vector3(x, 0, blk.z1 + 1.5);
  }
  for (let k = 0; k < 6; k++) tree(b, r, blk.x0 + range(r, 1, w - 1), blk.z0 + (k % 2 ? d - 1.5 : 1.5));
  if (!landmarks.disruptxTower && blk.bx === 7 && blk.bz === 1) landmarks.disruptxTower = new THREE.Vector3(blk.x0 + w / 2, 0, blk.z1 + 1.5);
}

export function buildFilmistan(b: CityBuilder, r: Rng, blk: Block, landmarks: Partial<Landmarks>) {
  const w = blk.x1 - blk.x0;
  const d = blk.z1 - blk.z0;
  // A big studio shed with a sign.
  const sx = blk.x0 + w * 0.35;
  const sz = blk.z0 + d * 0.4;
  const sw = w * 0.6;
  const sd = d * 0.65;
  b.block('plain', sx, sz, sw, 11, sd, pick(r, ['#d4c5a9', '#c9ada7', '#b8c0c8']));
  b.put('plain', sx, 11, sz, sw + 0.4, 1.2, sd + 0.4, 0, '#6c757d');
  const name = pick(r, STUDIO_SIGNS);
  const slot = b.atlas.slot(`studio:${name}`, { title: name, sub: 'No entry. Hero ka mood off hai.', bg: '#111', fg: '#ffd60a' });
  b.atlas.place(slot, sx, 8, sz + sd / 2 + 0.05, sw * 0.6, sw * 0.3, 0);
  if (!landmarks.studio7 && name.startsWith('STUDIO 7')) landmarks.studio7 = new THREE.Vector3(sx, 0, blk.z1 + 1.5);
  // Mid-rise film offices along the other edge.
  for (const lot of lots(r, blk.x0 + w * 0.7, blk.z0, blk.x1, blk.z1, 7, 12)) {
    residential(b, r, lot, int(r, 3, 7), 'film', pick(r, PALETTE.film), { balconies: 0.3, ac: 2, tanks: 1, laundry: 0.1, scaffold: 0.05, hoarding: 0.15 });
  }
  // A fake palace facade (just a front, very Bollywood).
  if (chance(r, 0.4)) {
    const fz = blk.z1 - 4;
    b.block('film', sx, fz, sw * 0.8, 9, 0.6, '#f4d58d');
    for (let k = -2; k <= 2; k++) b.put('pole', sx + k * sw * 0.15, 0, fz + 0.8, 0.8, 7, 0.8, 0, '#fff3d6');
    b.put('plain', sx, 9, fz, sw * 0.3, 3, 0.6, 0, '#e9c46a');
  }
  if (!landmarks.studio7 && blk.bx === 2 && blk.bz === 2) landmarks.studio7 = new THREE.Vector3(sx, 0, blk.z1 + 1.5);
}

export function buildKachra(b: CityBuilder, r: Rng, blk: Block, landmarks: Partial<Landmarks>) {
  const w = blk.x1 - blk.x0;
  const d = blk.z1 - blk.z0;
  // Godowns with corrugated colours.
  const gw = w * 0.45;
  for (let i = 0; i < 2; i++) {
    const x = blk.x0 + gw / 2 + i * (w - gw);
    const z = blk.z0 + d * 0.3;
    b.block('plain', x, z, gw - 1, 8, d * 0.5, pick(r, PALETTE.warehouse));
    b.put('plain', x, 8, z, gw - 0.6, 0.6, d * 0.5 + 0.4, 0, '#5c5c5c');
  }
  if (!landmarks.botalwalaGodown && blk.bx === 4) {
    const slot = b.atlas.slot('botalwala', { title: 'BOTALWALA GODOWN', sub: 'Import-Export (dono illegal)', bg: '#2b2d42', fg: '#ef233c' });
    b.atlas.place(slot, blk.x0 + gw / 2, 6, blk.z0 + d * 0.55 + 0.05, gw * 0.8, gw * 0.4, 0);
    landmarks.botalwalaGodown = new THREE.Vector3(blk.x0 + gw / 2, 0, blk.z1 + 1.5);
  }
  // Container stacks.
  for (let k = 0; k < 6; k++) containerStack(b, r, blk.x0 + range(r, 4, w - 4), blk.z0 + d * range(r, 0.65, 0.92));
}

export function containerStack(b: CityBuilder, r: Rng, x: number, z: number) {
  const rot = chance(r, 0.5) ? 0 : Math.PI / 2;
  const n = int(r, 1, 3);
  for (let s = 0; s < n; s++) b.block('container', x, z, 2.4, 2.6, 6, pick(r, PALETTE.container), rot, s * 2.6);
}

export function tree(b: CityBuilder, r: Rng, x: number, z: number) {
  const h = range(r, 2.5, 4);
  b.put('trunk', x, 0, z, 0.35, h, 0.35);
  b.solid(x, h / 2, z, 0.2, h / 2, 0.2);
  const s = range(r, 1.8, 2.8);
  b.put('crown', x, h + s * 0.5, z, s, s * 0.85, s, r() * 6, pick(r, ['#2d6a4f', '#40916c', '#52b788', '#386641']));
}

export { PALETTE };
