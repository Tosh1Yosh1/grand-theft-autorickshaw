import * as THREE from 'three';
import type { Ped } from '../../ai/peds/Pedestrians';
import type { MissionRun } from '../MissionRun';

/** A small counter/desk with a sign: sarkari offices, film sets, baba darbars. */
export function counter(run: MissionRun, pos: THREE.Vector3, title: string, color = '#fdf0d5'): void {
  const g = new THREE.Group();
  const desk = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 0.8), new THREE.MeshStandardMaterial({ color: '#6d4c41' }));
  desk.position.y = 0.5;
  desk.castShadow = true;
  g.add(desk);
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const x = c.getContext('2d')!;
  x.fillStyle = color;
  x.fillRect(0, 0, 512, 128);
  x.fillStyle = '#7b2c00';
  x.font = 'bold 54px "Arial Black", sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(title, 256, 66, 490);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
  sign.position.set(0, 2.2, 0);
  g.add(sign);
  for (const s of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2), new THREE.MeshStandardMaterial({ color: '#444' }));
    pole.position.set(s * 1.1, 1.1, 0);
    g.add(pole);
  }
  g.position.copy(pos);
  run.object(g);
}

/** Move a scripted ped toward a point; returns remaining distance. */
export function walkTo(p: Ped, target: THREE.Vector3, speed: number, dt: number, anim: Ped['anim'] = 'run'): number {
  const to = target.clone().sub(p.pos).setY(0);
  const d = to.length();
  if (d > 0.05) {
    p.pos.addScaledVector(to.normalize(), Math.min(d, speed * dt));
    p.heading = Math.atan2(to.x, to.z);
    p.anim = anim;
  }
  return d;
}

/** Sidewalk point on the north edge of block (bx, bz), facing the road. */
export function sidewalk(bx: number, bz: number, along = 0.5): THREE.Vector3 {
  const BLOCK = 60;
  const HALF = 300;
  return new THREE.Vector3(-HALF + bx * BLOCK + 9 + along * 42, 0.15, -HALF + bz * BLOCK + 7.5);
}
