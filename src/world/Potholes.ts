import * as THREE from 'three';
import type { GameContext, GameSystem } from '../core/System';

interface Hole {
  x: number;
  z: number;
  r: number;
}

const CELL = 8;
const MAX = 2000;

/** Potholes: instanced decals + a spatial hash so vehicles can ask "am I in one?" cheaply. */
export class Potholes implements GameSystem {
  readonly name = 'potholes';
  private grid = new Map<string, Hole[]>();
  private mesh!: THREE.InstancedMesh;
  private count = 0;
  private readonly m = new THREE.Matrix4();

  init(ctx: GameContext): void {
    ctx.services.potholes = this;
    // Jagged dark blob with a lighter crumbly rim.
    const shape = new THREE.Shape();
    for (let i = 0; i <= 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const r = 1 + Math.sin(a * 3) * 0.12 + Math.cos(a * 5) * 0.08;
      if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({
      color: '#2b2219',
      roughness: 1,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX);
    this.mesh.count = 0;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    ctx.scene.add(this.mesh);
  }

  add(x: number, z: number, r: number, y = 0.02): void {
    if (this.count >= MAX) return;
    const hole = { x, z, r };
    const key = this.key(x, z);
    (this.grid.get(key) ?? this.grid.set(key, []).get(key)!).push(hole);
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI * 2);
    this.m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(r, 1, r * (0.7 + Math.random() * 0.3)));
    this.mesh.setMatrixAt(this.count++, this.m);
    this.mesh.count = this.count;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Returns the pothole under (x, z), if any. */
  at(x: number, z: number): Hole | null {
    const cx = Math.floor(x / CELL);
    const cz = Math.floor(z / CELL);
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++) {
        const list = this.grid.get(`${cx + dx},${cz + dz}`);
        if (!list) continue;
        for (const h of list) if ((h.x - x) ** 2 + (h.z - z) ** 2 < h.r * h.r) return h;
      }
    return null;
  }

  private key(x: number, z: number): string {
    return `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
  }
}
