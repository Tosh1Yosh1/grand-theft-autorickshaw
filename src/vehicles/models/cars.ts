import * as THREE from 'three';
import { box, cyl, decal, paint, textTexture } from './parts';

/**
 * Procedural parody vehicles. All local +Z forward, origin at chassis centre.
 * Any mesh using the material named "paint" gets recoloured per traffic instance.
 */
function bodyPaint(color: string): THREE.MeshStandardMaterial {
  const m = paint(color, 0.45, 0.25).clone();
  m.name = 'paint';
  return m;
}

const glassMat = () => paint('#3d5468', 0.15, 0.6);
const blackMat = () => paint('#161616', 0.8);
const chromeMat = () => paint('#c9c9c9', 0.3, 0.9);
const lightMat = () => paint('#fff6d0', 0.2, 0, '#ffe9a8');
const tailMat = () => paint('#c1121f', 0.3, 0, '#c1121f');

interface CarShape {
  len: number;
  wid: number;
  bodyH: number;
  cabinH: number;
  cabinLen: number;
  cabinOffset: number;
  color: string;
  boxy?: number;
}

/** Two-box hatch/sedan/SUV body: lower body + glasshouse, bumpers, lights. */
function carBody(s: CarShape): THREE.Group {
  const g = new THREE.Group();
  const p = bodyPaint(s.color);
  box(g, s.wid, s.bodyH, s.len, 0, 0, 0, p);
  box(g, s.wid * 0.96, s.cabinH, s.cabinLen, 0, s.bodyH / 2 + s.cabinH / 2, s.cabinOffset, p);
  // Windows as slightly inset dark boxes.
  box(g, s.wid * 0.98, s.cabinH * 0.7, s.cabinLen * 0.92, 0, s.bodyH / 2 + s.cabinH * 0.5, s.cabinOffset, glassMat());
  box(g, s.wid * 1.02, 0.16, 0.12, 0, -s.bodyH / 2 + 0.1, s.len / 2 + 0.04, chromeMat());
  box(g, s.wid * 1.02, 0.16, 0.12, 0, -s.bodyH / 2 + 0.1, -s.len / 2 - 0.04, blackMat());
  for (const x of [-1, 1]) {
    box(g, 0.25, 0.12, 0.05, x * (s.wid / 2 - 0.2), 0.05, s.len / 2 + 0.01, lightMat());
    box(g, 0.22, 0.12, 0.05, x * (s.wid / 2 - 0.2), 0.05, -s.len / 2 - 0.01, tailMat());
  }
  return g;
}

/** "Maaruti 8OO": the small hatch every family once had. */
export function buildMaruti(color = '#e9e3d5'): THREE.Group {
  return carBody({ len: 3.3, wid: 1.4, bodyH: 0.6, cabinH: 0.6, cabinLen: 1.9, cabinOffset: -0.25, color });
}

/** Kaali-peeli taxi: black body, yellow roof, a roof sign. */
export function buildTaxi(): THREE.Group {
  const g = carBody({ len: 4.0, wid: 1.6, bodyH: 0.65, cabinH: 0.6, cabinLen: 2.0, cabinOffset: -0.2, color: '#111111' });
  box(g, 1.5, 0.05, 1.95, 0, 0.95, -0.2, paint('#f5c518', 0.4));
  const sign = textTexture(256, 64, '#f5c518', [['TAXI · METER BROKEN', 'bold 26px Arial, sans-serif', '#111']]);
  decal(g, sign, 0.8, 0.2, 0, 1.08, -0.2, 0);
  return g;
}

/** "Innocent-a" MPV with the very official red beacon. */
export function buildInnova(color = '#f1f1f1', beacon = true): THREE.Group {
  const g = carBody({ len: 4.6, wid: 1.8, bodyH: 0.85, cabinH: 0.75, cabinLen: 3.2, cabinOffset: -0.35, color });
  if (beacon) {
    const b = cyl(g, 0.12, 0.14, 0.16, 0.3, 1.32, 0.4, paint('#ff1f1f', 0.2, 0, '#ff1f1f'), 10);
    b.name = 'beacon';
  }
  const plate = textTexture(256, 64, '#ffffff', [['VIP · DONT ASK', 'bold 30px Arial, sans-serif', '#c1121f']]);
  decal(g, plate, 0.6, 0.15, 0, -0.25, -2.36, Math.PI);
  return g;
}

/** "Thaar" boxy 4x4 with a soft top. */
export function buildThar(color = '#2b2b2b'): THREE.Group {
  const g = new THREE.Group();
  const p = bodyPaint(color);
  box(g, 1.75, 0.8, 3.9, 0, 0.1, 0, p);
  box(g, 1.7, 0.75, 2.1, 0, 0.88, -0.55, paint('#1a1a1a', 0.9)); // soft top
  box(g, 1.6, 0.5, 0.06, 0, 0.75, 0.5, glassMat()); // windshield
  for (const x of [-1, 1]) {
    cyl(g, 0.15, 0.15, 0.05, x * 0.6, 0.25, 1.96, lightMat(), 12).rotation.x = Math.PI / 2;
    box(g, 0.3, 0.12, 0.6, x * 0.95, -0.15, 1.45, blackMat()); // flared arches
    box(g, 0.3, 0.12, 0.6, x * 0.95, -0.15, -1.3, blackMat());
  }
  const spare = cyl(g, 0.36, 0.36, 0.22, 0, 0.35, -2.06, blackMat(), 14);
  spare.rotation.x = Math.PI / 2;
  const back = textTexture(256, 128, '#1a1a1a', [['BHAI KI', 'bold 40px Impact, sans-serif', '#ffd60a'], ['THAAR', 'bold 54px Impact, sans-serif', '#ff4d6d']]);
  decal(g, back, 0.7, 0.35, 0, 0.35, -2.18, Math.PI);
  return g;
}

/** Tempo: cab + open goods bed with "HORN OK PLEASE". */
export function buildTempo(color = '#2a9d8f'): THREE.Group {
  const g = new THREE.Group();
  const p = bodyPaint(color);
  box(g, 1.6, 1.3, 1.3, 0, 0.45, 1.5, p); // cab
  box(g, 1.55, 0.5, 0.05, 0, 0.85, 2.16, glassMat());
  box(g, 1.8, 0.2, 3.3, 0, -0.15, -0.7, blackMat()); // bed floor
  for (const x of [-1, 1]) box(g, 0.08, 0.7, 3.3, x * 0.88, 0.3, -0.7, paint('#e9c46a', 0.8));
  box(g, 1.8, 0.7, 0.08, 0, 0.3, -2.33, paint('#e9c46a', 0.8));
  const back = textTexture(512, 192, '#ffd166', [['HORN OK', 'bold 70px Impact, sans-serif', '#9d0208'], ['PLEASE', 'bold 64px Impact, sans-serif', '#023e8a']]);
  decal(g, back, 1.5, 0.56, 0, 0.3, -2.38, Math.PI);
  for (const x of [-1, 1]) box(g, 0.22, 0.14, 0.05, x * 0.6, 0.1, 2.16, lightMat());
  return g;
}

/** City bus, the red-and-cream kind (any resemblance is to every bus ever). */
export function buildBus(): THREE.Group {
  const g = new THREE.Group();
  const red = bodyPaint('#b5121b');
  const cream = paint('#f2e8cf', 0.6);
  box(g, 2.5, 1.4, 10, 0, 0.3, 0, red);
  box(g, 2.5, 1.0, 10, 0, 1.5, 0, cream);
  box(g, 2.55, 0.65, 9.4, 0, 1.55, 0, glassMat());
  box(g, 2.5, 0.25, 10, 0, 2.12, 0, red);
  const board = textTexture(512, 96, '#111', [['ROUTE 420 · KAHIN BHI', 'bold 44px monospace', '#ffb703']]);
  decal(g, board, 1.8, 0.32, 0, 1.9, 5.01, 0);
  const ad = textTexture(512, 128, '#fdf0d5', [['INSTANT LOAN', 'bold 56px Impact, sans-serif', '#c1121f'], ['interest: yes', 'italic 34px Georgia, serif', '#003049']]);
  decal(g, ad, 3.4, 0.85, 1.26, 0.35, -1, Math.PI / 2);
  decal(g, ad, 3.4, 0.85, -1.26, 0.35, -1, -Math.PI / 2);
  for (const x of [-1, 1]) box(g, 0.3, 0.18, 0.05, x * 0.9, -0.1, 5.01, lightMat());
  return g;
}

/** Splendour-type bike with a slot for up to four riders and a gas cylinder. */
export function buildBike(color = '#c1121f'): THREE.Group {
  const g = new THREE.Group();
  const p = bodyPaint(color);
  box(g, 0.28, 0.32, 0.6, 0, 0.25, 0.25, p); // tank
  box(g, 0.3, 0.12, 0.8, 0, 0.32, -0.35, blackMat()); // seat
  box(g, 0.16, 0.3, 1.5, 0, 0.0, 0, chromeMat()); // frame
  box(g, 0.7, 0.04, 0.04, 0, 0.62, 0.62, chromeMat()); // handlebar
  cyl(g, 0.11, 0.11, 0.08, 0, 0.45, 0.78, lightMat(), 10).rotation.x = Math.PI / 2;
  // The family gas cylinder, strapped on the back for maximum safety.
  const cylinder = cyl(g, 0.17, 0.17, 0.6, 0, 0.42, -0.95, paint('#d62828', 0.5), 10);
  cylinder.name = 'cylinder';
  return g;
}

/** Bullock cart: secretly the fastest thing in Jugaadpur. */
export function buildBullockCart(): THREE.Group {
  const g = new THREE.Group();
  const wood = paint('#8b5a2b', 0.9);
  box(g, 1.5, 0.15, 2.2, 0, 0.2, -0.6, wood);
  for (const x of [-1, 1]) box(g, 0.08, 0.4, 2.2, x * 0.72, 0.45, -0.6, wood);
  box(g, 0.12, 0.12, 2.4, 0, 0.25, 1.3, wood); // yoke pole
  // Two bullocks (cartoon boxes with horns).
  for (const x of [-0.45, 0.45]) {
    const bull = new THREE.Group();
    const hide = paint('#e9e1d3', 0.9);
    box(bull, 0.55, 0.6, 1.3, 0, 0.55, 0, hide);
    box(bull, 0.35, 0.35, 0.45, 0, 0.75, 0.8, hide);
    for (const s of [-1, 1]) {
      const horn = cyl(bull, 0.02, 0.05, 0.35, s * 0.15, 1.05, 0.85, paint('#3a2a1a', 0.6), 6);
      horn.rotation.z = s * -0.5;
    }
    box(bull, 0.5, 0.15, 0.3, 0, 0.95, 0.15, paint('#e85d04', 0.7)); // painted hump cloth
    for (const [lx, lz] of [[-0.2, 0.45], [0.2, 0.45], [-0.2, -0.45], [0.2, -0.45]]) box(bull, 0.12, 0.5, 0.12, lx!, 0.0, lz!, hide);
    bull.position.set(x, -0.15, 2.0);
    g.add(bull);
  }
  return g;
}
