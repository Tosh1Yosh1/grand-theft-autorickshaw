import * as THREE from 'three';
import { signMaterial } from './materials';

const CELL_W = 384;
const CELL_H = 192;
const COLS = 6;
const ROWS = 7;

export type SignStyle = { title: string; sub?: string; bg: string; fg: string; border?: string };

/**
 * One canvas holding every sign in the city (hoardings, truck backs, shop boards).
 * All sign quads are merged into a single mesh = one draw call.
 */
export class SignAtlas {
  private canvas = document.createElement('canvas');
  private g: CanvasRenderingContext2D;
  private slots = new Map<string, number>();
  private quads: THREE.BufferGeometry[] = [];
  private texture: THREE.CanvasTexture;

  constructor() {
    this.canvas.width = CELL_W * COLS;
    this.canvas.height = CELL_H * ROWS;
    this.g = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
  }

  /** Draws the sign once; later calls with the same key reuse the slot. */
  slot(key: string, style: SignStyle): number {
    const existing = this.slots.get(key);
    if (existing !== undefined) return existing;
    const i = this.slots.size;
    if (i >= COLS * ROWS) return 0; // atlas full: reuse the first sign rather than crash
    this.slots.set(key, i);
    const x = (i % COLS) * CELL_W;
    const y = Math.floor(i / COLS) * CELL_H;
    const g = this.g;
    g.fillStyle = style.bg;
    g.fillRect(x, y, CELL_W, CELL_H);
    g.strokeStyle = style.border ?? style.fg;
    g.lineWidth = 8;
    g.strokeRect(x + 6, y + 6, CELL_W - 12, CELL_H - 12);
    g.fillStyle = style.fg;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    fitText(g, style.title, x + CELL_W / 2, y + (style.sub ? CELL_H * 0.4 : CELL_H / 2), CELL_W - 30, 64, 'bold', '"Arial Black", Impact, sans-serif');
    if (style.sub) fitText(g, style.sub, x + CELL_W / 2, y + CELL_H * 0.72, CELL_W - 30, 26, 'italic bold', 'Georgia, serif');
    this.texture.needsUpdate = true;
    return i;
  }

  /** Place a sign quad in the world. Facing = yaw the front of the sign looks toward. */
  place(slot: number, x: number, y: number, z: number, w: number, h: number, facing: number): void {
    const geo = new THREE.PlaneGeometry(w, h);
    const u0 = (slot % COLS) / COLS;
    const v1 = 1 - Math.floor(slot / COLS) / ROWS;
    const u1 = u0 + 1 / COLS;
    const v0 = v1 - 1 / ROWS;
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) ? u1 : u0, uv.getY(k) ? v1 : v0);
    geo.rotateY(facing);
    geo.translate(x, y, z);
    this.quads.push(geo);
  }

  build(): THREE.Mesh | null {
    if (!this.quads.length) return null;
    const merged = mergeQuads(this.quads);
    const mesh = new THREE.Mesh(merged, signMaterial(this.texture));
    mesh.material.side = THREE.DoubleSide;
    mesh.receiveShadow = true;
    return mesh;
  }
}

function fitText(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, size: number, weight: string, family: string) {
  let s = size;
  do {
    g.font = `${weight} ${s}px ${family}`;
    s -= 2;
  } while (g.measureText(text).width > maxW && s > 10);
  g.fillText(text, x, y);
}

/** Minimal merge for non-indexed-compatible PlaneGeometries (position/normal/uv + index). */
export function mergeQuads(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let vCount = 0;
  let iCount = 0;
  for (const g of geos) {
    vCount += g.attributes.position!.count;
    iCount += g.index!.count;
  }
  const pos = new Float32Array(vCount * 3);
  const nrm = new Float32Array(vCount * 3);
  const uv = new Float32Array(vCount * 2);
  const idx = new Uint32Array(iCount);
  let vo = 0;
  let io = 0;
  for (const g of geos) {
    pos.set(g.attributes.position!.array as Float32Array, vo * 3);
    nrm.set(g.attributes.normal!.array as Float32Array, vo * 3);
    uv.set(g.attributes.uv!.array as Float32Array, vo * 2);
    const src = g.index!.array;
    for (let k = 0; k < src.length; k++) idx[io + k] = src[k]! + vo;
    vo += g.attributes.position!.count;
    io += src.length;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}
