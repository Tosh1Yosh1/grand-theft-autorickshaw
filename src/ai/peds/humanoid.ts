import * as THREE from 'three';
import { BOX, CAPSULE, CONE, SPHERE, type PartDef, type Pose } from '../rig/RigInstancer';

/** Low-poly NPC humanoid: ~12 instanced parts, all tinted per ped. Feet at origin, +Z forward. */
export const HUMANOID_PARTS: PartDef[] = [
  { name: 'torso', geo: BOX, color: 'shirt', pivot: [0, 1.0, 0], offset: [0, 0.25, 0], scale: [0.42, 0.55, 0.26], joint: 'spine' },
  { name: 'belly', geo: SPHERE, color: 'shirt', pivot: [0, 1.0, 0], offset: [0, 0.12, 0.08], scale: [0.4, 0.42, 0.32], joint: 'spine', optional: true },
  { name: 'head', geo: SPHERE, color: 'skin', pivot: [0, 1.55, 0], offset: [0, 0.14, 0], scale: [0.26, 0.3, 0.27], joint: 'head' },
  { name: 'hair', geo: SPHERE, color: 'hair', pivot: [0, 1.55, 0], offset: [0, 0.22, -0.02], scale: [0.28, 0.18, 0.29], joint: 'head' },
  { name: 'cap', geo: BOX, color: 'cap', pivot: [0, 1.55, 0], offset: [0, 0.3, 0.02], scale: [0.3, 0.1, 0.32], joint: 'head', optional: true },
  { name: 'bun', geo: SPHERE, color: 'hair', pivot: [0, 1.55, 0], offset: [0, 0.2, -0.16], scale: [0.14, 0.14, 0.14], joint: 'head', optional: true },
  { name: 'glasses', geo: BOX, color: 'dark', pivot: [0, 1.55, 0], offset: [0, 0.16, 0.13], scale: [0.22, 0.05, 0.03], joint: 'head', optional: true, castShadow: false },
  { name: 'legL', geo: CAPSULE, color: 'pants', pivot: [0.1, 0.95, 0], offset: [0, -0.46, 0], scale: [0.15, 0.48, 0.15], joint: 'legL' },
  { name: 'legR', geo: CAPSULE, color: 'pants', pivot: [-0.1, 0.95, 0], offset: [0, -0.46, 0], scale: [0.15, 0.48, 0.15], joint: 'legR' },
  { name: 'armL', geo: CAPSULE, color: 'arms', pivot: [0.27, 1.45, 0], offset: [0, -0.3, 0], scale: [0.12, 0.38, 0.12], joint: 'armL' },
  { name: 'armR', geo: CAPSULE, color: 'arms', pivot: [-0.27, 1.45, 0], offset: [0, -0.3, 0], scale: [0.12, 0.38, 0.12], joint: 'armR' },
  { name: 'saree', geo: CONE, color: 'saree', pivot: [0, 1.0, 0], offset: [0, -0.48, 0], scale: [0.62, 1.0, 0.5], joint: 'hips', optional: true },
  { name: 'backpack', geo: BOX, color: 'pack', pivot: [0, 1.0, 0], offset: [0, 0.28, -0.22], scale: [0.34, 0.42, 0.2], joint: 'spine', optional: true },
  { name: 'deliveryBox', geo: BOX, color: 'pack', pivot: [0, 1.0, 0], offset: [0, 0.35, -0.36], scale: [0.5, 0.5, 0.45], joint: 'spine', optional: true },
  { name: 'phone', geo: BOX, color: 'dark', pivot: [-0.27, 1.45, 0], offset: [0, -0.64, 0.06], scale: [0.07, 0.12, 0.02], joint: 'armR', optional: true, castShadow: false },
  { name: 'flag', geo: BOX, color: 'pack', pivot: [0.27, 1.45, 0], offset: [0, 0.2, 0.05], scale: [0.03, 1.4, 0.03], joint: 'armL', optional: true },
  { name: 'flagCloth', geo: BOX, color: 'saree', pivot: [0.27, 1.45, 0], offset: [0, 0.75, 0.3], scale: [0.02, 0.35, 0.55], joint: 'armL', optional: true },
  { name: 'bat', geo: BOX, color: 'pack', pivot: [-0.27, 1.45, 0], offset: [0, -0.75, 0.25], scale: [0.08, 0.7, 0.04], joint: 'armR', optional: true },
];

export type PedType = 'aunty' | 'uncle' | 'startupBro' | 'gymBhai' | 'deliveryBoy' | 'selfieCouple' | 'commuter' | 'kid' | 'dancer' | 'supporter' | 'cop' | 'squad' | 'anchor' | 'boss' | 'goon' | 'clerk';

export interface PedStyle {
  colors: Record<string, string>;
  show: Set<string>;
  partScale?: Record<string, number>;
  scale: number;
  speed: number;
}

const r = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)]!;
const SKIN = ['#8d5524', '#a0673f', '#b97a50', '#c68642', '#7a4a2a'];
const HAIR = ['#120c08', '#1f1510', '#2b1d14', '#6b6b6b'];

export function styleFor(type: PedType): PedStyle {
  const skin = r(SKIN);
  const base = { skin, arms: skin, hair: r(HAIR), dark: '#111111', pack: '#333333', saree: '#e63946', cap: '#111111' };
  switch (type) {
    case 'aunty':
      return { colors: { ...base, shirt: r(['#e63946', '#ff7f50', '#9b5de5', '#f15bb5', '#00bbf9']), pants: '#7a1f3d', saree: r(['#e63946', '#ff006e', '#fb5607', '#8338ec', '#06d6a0', '#ffbe0b']), hair: '#120c08' }, show: new Set(['saree', 'bun', 'belly']), scale: 0.95, speed: 1.0 };
    case 'uncle':
      return { colors: { ...base, shirt: '#f4f1e8', pants: '#f4f1e8', arms: '#f4f1e8', hair: '#9a9a9a' }, show: new Set(['glasses', 'phone', 'belly']), scale: 1, speed: 1.0 };
    case 'startupBro':
      return { colors: { ...base, shirt: r(['#2b2d42', '#3d405b', '#6c757d', '#111111']), arms: r(['#2b2d42', '#3d405b']), pants: '#4a6fa5', pack: '#e0e1dd' }, show: new Set(['backpack', 'phone']), scale: 1, speed: 1.4 };
    case 'gymBhai':
      return { colors: { ...base, shirt: r(['#d00000', '#000000', '#ffba08']), pants: '#1b1b1b' }, show: new Set(), partScale: { armL: 1.45, armR: 1.45, torso: 1.2 }, scale: 1.05, speed: 1.3 };
    case 'deliveryBoy':
      return { colors: { ...base, shirt: r(['#e63946', '#ff7b00']), arms: r(['#e63946', '#ff7b00']), pants: '#222222', pack: r(['#e63946', '#ff7b00', '#ffd60a']) }, show: new Set(['deliveryBox']), scale: 0.95, speed: 1.9 };
    case 'selfieCouple':
      return { colors: { ...base, shirt: r(['#ffafcc', '#a2d2ff', '#cdb4db', '#ffffff']), pants: r(['#023047', '#bde0fe', '#000000']) }, show: new Set(['phone']), scale: 0.97, speed: 0.9 };
    case 'kid':
      return { colors: { ...base, shirt: r(['#ffffff', '#ffbe0b', '#3a86ff', '#8ac926']), pants: r(['#023047', '#6c757d']), pack: '#c9a227' }, show: new Set(['bat']), scale: 0.62, speed: 1.6 };
    case 'dancer':
      return { colors: { ...base, shirt: r(['#ffd60a', '#ff006e', '#8338ec', '#f72585', '#ffffff']), pants: r(['#f1faee', '#ffd60a', '#e63946']), saree: r(['#ff006e', '#ffbe0b', '#e63946']) }, show: new Set(Math.random() < 0.4 ? ['saree', 'bun'] : []), scale: 1, speed: 0.6 };
    case 'cop':
      return { colors: { ...base, shirt: '#b49a5e', arms: '#b49a5e', pants: '#a88f55', cap: '#a88f55', pack: '#6b4423' }, show: new Set(['cap', 'bat', 'belly']), scale: 1, speed: 1.5 };
    case 'squad':
      return { colors: { ...base, shirt: '#2b2d42', arms: '#2b2d42', pants: '#2b2d42', cap: '#111111', pack: '#111111', dark: '#111111' }, show: new Set(['cap', 'bat', 'glasses']), scale: 1.05, speed: 1.9 };
    case 'anchor':
      return { colors: { ...base, shirt: '#d00000', arms: '#d00000', pants: '#111111', dark: '#111111' }, show: new Set(['phone', 'glasses']), scale: 1, speed: 1.2 };
    case 'boss':
      return { colors: { ...base, shirt: '#f8f9fa', arms: '#f8f9fa', pants: '#f8f9fa', dark: '#111111', hair: '#111111' }, show: new Set(['glasses', 'belly']), scale: 1.18, speed: 1.2 };
    case 'goon':
      return { colors: { ...base, shirt: '#1b1b1b', pants: '#3d405b', pack: '#5a3d2b', cap: '#c1121f' }, show: new Set(['bat', 'cap']), partScale: { armL: 1.3, armR: 1.3 }, scale: 1.05, speed: 1.5 };
    case 'clerk':
      return { colors: { ...base, shirt: '#e9ecef', pants: '#6c757d', hair: '#555555' }, show: new Set(['glasses', 'belly']), scale: 1, speed: 0.8 };
    case 'supporter':
      return { colors: { ...base, shirt: '#ffffff', pants: '#f4f1e8', arms: '#ffffff', pack: '#5a3d2b', saree: r(['#ff6d00', '#2a9d8f', '#3a86ff', '#e63946']) }, show: new Set(['flag', 'flagCloth']), scale: 1, speed: 0.8 };
    default:
      return { colors: { ...base, shirt: r(['#4361ee', '#f72585', '#4cc9f0', '#f8961e', '#90be6d', '#e9c46a', '#ffffff']), pants: r(['#2b2d42', '#6c584c', '#3d405b', '#1d3557']) }, show: new Set(), scale: r(['1', '0.95', '1.05']) === '1' ? 1 : 0.97, speed: 1.2 };
  }
}

export type Anim = 'walk' | 'run' | 'idle' | 'selfie' | 'dance' | 'lying' | 'sitting' | 'wave' | 'bat' | 'chant' | 'swing';

/** Procedural pose for an NPC. t = seconds, phase = per-ped offset. */
export function humanoidPose(anim: Anim, t: number, phase: number, speed: number, out: Pose): Pose {
  const s = Math.sin(t * (4 + speed * 2.5) + phase);
  const z = (k: string, x = 0, y = 0, zz = 0) => {
    const v = out[k] ?? (out[k] = [0, 0, 0]);
    v[0] = x;
    v[1] = y;
    v[2] = zz;
  };
  z('spine'); z('head'); z('hips'); z('legL'); z('legR'); z('armL', 0, 0, 0.1); z('armR', 0, 0, -0.1);
  switch (anim) {
    case 'walk':
    case 'run': {
      const a = anim === 'run' ? 0.9 : 0.5;
      z('legL', s * a); z('legR', -s * a);
      z('armL', -s * a * 0.8, 0, 0.1); z('armR', s * a * 0.8, 0, -0.1);
      z('spine', anim === 'run' ? 0.2 : 0.03);
      break;
    }
    case 'idle':
      z('head', 0, Math.sin(t * 0.5 + phase) * 0.4, 0);
      break;
    case 'selfie':
      z('armR', -2.6, 0, -0.3); z('head', -0.15, 0.2, 0);
      break;
    case 'dance': {
      const b = Math.sin(t * 6 + phase);
      z('armL', -2.8 + b * 0.4, 0, 0.4 + b * 0.3); z('armR', -2.8 - b * 0.4, 0, -0.4 + b * 0.3);
      z('legL', Math.max(0, b) * 0.6); z('legR', Math.max(0, -b) * 0.6);
      z('spine', 0, b * 0.3, b * 0.15); z('head', 0, -b * 0.3, 0);
      break;
    }
    case 'chant': {
      const b = Math.sin(t * 3 + phase);
      z('armL', -2.9 + b * 0.25, 0, 0.2); z('armR', s * 0.2, 0, -0.1);
      break;
    }
    case 'wave':
      z('armR', -2.7, 0, -0.5 + Math.sin(t * 10) * 0.4);
      break;
    case 'bat':
      z('armR', -1.2 + Math.sin(t * 2 + phase) * 0.6, 0.5, -0.4); z('armL', -1.2, 0, 0.3); z('spine', 0.2, -0.4, 0);
      break;
    case 'swing': {
      const k = (Math.sin(t * 9 + phase) + 1) / 2;
      const a = speed > 1.6 ? 0.9 : 0.5;
      z('legL', s * a); z('legR', -s * a);
      z('armR', -2.6 + k * 2.4, 0, -0.2); z('armL', -s * a * 0.6, 0, 0.1);
      break;
    }
    case 'sitting':
      z('legL', -1.5); z('legR', -1.5); z('armL', -0.4, 0, 0.3); z('armR', -0.4, 0, -0.3); z('spine', -0.1);
      break;
    case 'lying':
      break;
  }
  return out;
}

const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpV = new THREE.Vector3();
const tmpS = new THREE.Vector3();

/** Root matrix for a humanoid at a position/heading, with whole-body lie-down / sit offsets. */
export function rootMatrix(out: THREE.Matrix4, x: number, y: number, z: number, heading: number, scale: number, anim: Anim, tilt = 0): THREE.Matrix4 {
  let lift = 0;
  let pitch = tilt;
  if (anim === 'lying') {
    pitch = -Math.PI / 2;
    lift = 0.15;
  } else if (anim === 'sitting') {
    lift = -0.5 * scale;
  }
  tmpQ.setFromEuler(tmpE.set(pitch, heading, 0, 'YXZ'));
  return out.compose(tmpV.set(x, y + lift, z), tmpQ, tmpS.setScalar(scale));
}
