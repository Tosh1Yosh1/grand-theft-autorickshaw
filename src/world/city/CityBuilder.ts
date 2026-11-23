import type RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import type { Physics } from '../../core/Physics';
import { InstanceBatch, UNIT_BOX, UNIT_CYL } from './InstanceBatch';
import { HALF } from './layout';
import { facadeMaterial, neonMaterial, plain } from './materials';
import { SignAtlas } from './signAtlas';

export const CHUNK = 120;

/** Named batch kinds. Each chunk gets its own InstancedMesh per kind (for culling). */
function kinds() {
  const laundryTex = laundryTexture();
  const laundry = new THREE.MeshStandardMaterial({ map: laundryTex, side: THREE.DoubleSide, alphaTest: 0.5, roughness: 1 });
  const crown = new THREE.IcosahedronGeometry(1, 0).translate(0, 0, 0);
  const sphere = new THREE.SphereGeometry(0.5, 6, 4);
  return {
    jugaad: { geo: UNIT_BOX, mat: facadeMaterial({ shopBand: true, cellW: 2.8, floorH: 3, winW: 0.5, litRatio: 0.55 }), detail: false },
    sarkari: { geo: UNIT_BOX, mat: facadeMaterial({ cellW: 3.0, floorH: 3.2, winW: 0.55, winH: 0.45, litRatio: 0.3, glassColor: '#2a2f2a' }), detail: false },
    glass: { geo: UNIT_BOX, mat: facadeMaterial({ cellW: 2.0, floorH: 3.6, winW: 0.9, winH: 0.82, litRatio: 0.6, glassColor: '#24435c', roughness: 0.25, metalness: 0.5 }), detail: false },
    film: { geo: UNIT_BOX, mat: facadeMaterial({ cellW: 3.4, floorH: 3.4, winW: 0.4, litRatio: 0.4 }), detail: false },
    plain: { geo: UNIT_BOX, mat: plain('#ffffff', 0.9), detail: false },
    concrete: { geo: UNIT_BOX, mat: plain('#bdb5a6', 0.95), detail: false },
    balcony: { geo: UNIT_BOX, mat: plain('#cfc6b8', 0.9), detail: true },
    rail: { geo: UNIT_BOX, mat: plain('#3b3b3b', 0.6, 0.4), detail: true },
    ac: { geo: UNIT_BOX, mat: plain('#e8e8e2', 0.6), detail: true },
    tank: { geo: UNIT_CYL, mat: plain('#1d1d1d', 0.7), detail: true },
    laundry: { geo: new THREE.PlaneGeometry(1, 1).translate(0, -0.5, 0), mat: laundry, detail: true },
    bamboo: { geo: new THREE.CylinderGeometry(0.05, 0.05, 1, 5).translate(0, 0.5, 0), mat: plain('#c9a227', 0.9), detail: true },
    trunk: { geo: UNIT_CYL, mat: plain('#5a3d2b', 1), detail: true },
    crown: { geo: crown, mat: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true }), detail: false },
    pole: { geo: UNIT_CYL, mat: plain('#4a4a4a', 0.7, 0.3), detail: false },
    lamp: { geo: UNIT_BOX, mat: neonMaterial('#ffe3a3', 3), detail: false },
    bulbs: { geo: sphere, mat: neonMaterial('#ffffff', 4), detail: true },
    container: { geo: UNIT_BOX, mat: plain('#ffffff', 0.7, 0.3), detail: false },
    stall: { geo: UNIT_BOX, mat: plain('#ffffff', 0.8), detail: false },
  } satisfies Record<string, { geo: THREE.BufferGeometry; mat: THREE.Material; detail: boolean }>;
}

export type BatchKind = keyof ReturnType<typeof kinds>;

export interface Chunk {
  cx: number;
  cz: number;
  center: THREE.Vector3;
  group: THREE.Group;
  details: THREE.Group;
  batches: Map<BatchKind, InstanceBatch>;
}

export class CityBuilder {
  readonly chunks = new Map<string, Chunk>();
  readonly atlas = new SignAtlas();
  readonly root = new THREE.Group();
  /** Lines (overhead wires) merged into one LineSegments at build time. */
  readonly wirePoints: number[] = [];
  private readonly kinds = kinds();
  private readonly colliderDescs: RAPIER.ColliderDesc[] = [];
  /** Areas kept clear for landmarks: [x0, z0, x1, z1]. */
  readonly reserved: [number, number, number, number][] = [];

  isReserved(x: number, z: number, w: number, d: number): boolean {
    return this.reserved.some(([x0, z0, x1, z1]) => x + w / 2 > x0 && x - w / 2 < x1 && z + d / 2 > z0 && z - d / 2 < z1);
  }

  constructor(readonly physics: Physics) {
    this.root.name = 'Mumbhai';
  }

  private chunkAt(x: number, z: number): Chunk {
    const cx = Math.floor((x + HALF + 200) / CHUNK);
    const cz = Math.floor((z + HALF + 200) / CHUNK);
    const key = `${cx},${cz}`;
    let c = this.chunks.get(key);
    if (!c) {
      const group = new THREE.Group();
      const details = new THREE.Group();
      group.add(details);
      c = {
        cx,
        cz,
        center: new THREE.Vector3(cx * CHUNK - HALF - 200 + CHUNK / 2, 0, cz * CHUNK - HALF - 200 + CHUNK / 2),
        group,
        details,
        batches: new Map(),
      };
      this.chunks.set(key, c);
      this.root.add(group);
    }
    return c;
  }

  /** Add one instance of a kind. Position is the bottom centre (boxes/cylinders). */
  put(kind: BatchKind, x: number, y: number, z: number, sx: number, sy: number, sz: number, rotY = 0, color?: THREE.ColorRepresentation, rotX = 0, rotZ = 0): void {
    const c = this.chunkAt(x, z);
    let b = c.batches.get(kind);
    if (!b) {
      const k = this.kinds[kind];
      b = new InstanceBatch(k.geo, k.mat, { castShadow: kind !== 'laundry' && kind !== 'bulbs' });
      c.batches.set(kind, b);
    }
    b.add(x, y, z, sx, sy, sz, rotY, color, rotX, rotZ);
  }

  /** Static box collider (centre + half extents, optional yaw). */
  solid(x: number, y: number, z: number, hx: number, hy: number, hz: number, rotY = 0): void {
    const d = this.physics.rapier.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z);
    if (rotY) {
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
      d.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
    }
    this.colliderDescs.push(d);
  }

  /** A building/box that is both seen and solid. */
  block(kind: BatchKind, x: number, z: number, w: number, h: number, d: number, color: THREE.ColorRepresentation, rotY = 0, y = 0): void {
    this.put(kind, x, y, z, w, h, d, rotY, color);
    this.solid(x, y + h / 2, z, w / 2, h / 2, d / 2, rotY);
  }

  wire(a: THREE.Vector3, b: THREE.Vector3, sag: number, segments = 6): void {
    let prev = a.clone();
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const p = new THREE.Vector3().lerpVectors(a, b, t);
      p.y -= Math.sin(t * Math.PI) * sag;
      this.wirePoints.push(prev.x, prev.y, prev.z, p.x, p.y, p.z);
      prev = p;
    }
  }

  /** Add an arbitrary mesh to the chunk at its position (landmarks, flyover...). */
  addMesh(mesh: THREE.Object3D): void {
    this.chunkAt(mesh.position.x, mesh.position.z).group.add(mesh);
  }

  finish(scene: THREE.Scene): void {
    for (const c of this.chunks.values()) {
      for (const [kind, batch] of c.batches) {
        const mesh = batch.build();
        if (!mesh) continue;
        (this.kinds[kind].detail ? c.details : c.group).add(mesh);
      }
      c.batches.clear();
    }
    const signs = this.atlas.build();
    if (signs) this.root.add(signs);
    if (this.wirePoints.length) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(this.wirePoints, 3));
      const wires = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#1a1410', transparent: true, opacity: 0.85 }));
      wires.name = 'wires';
      this.root.add(wires);
    }
    for (const d of this.colliderDescs) this.physics.world.createCollider(d);
    this.colliderDescs.length = 0;
    scene.add(this.root);
  }
}

function laundryTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, 256, 64);
  g.fillStyle = '#222';
  g.fillRect(0, 0, 256, 3);
  const colors = ['#e63946', '#f1faee', '#457b9d', '#ffb703', '#8338ec', '#06d6a0', '#ff70a6', '#3a86ff'];
  let x = 4;
  let i = 0;
  while (x < 250) {
    const w = 18 + ((i * 37) % 22);
    const h = 26 + ((i * 53) % 34);
    g.fillStyle = colors[i % colors.length]!;
    if (i % 3 === 0) {
      // a shirt
      g.fillRect(x, 3, w, h * 0.7);
      g.fillRect(x - 5, 3, w + 10, 10);
    } else if (i % 3 === 1) {
      // a saree length / dupatta
      g.fillRect(x, 3, w * 1.6, Math.min(60, h + 10));
      x += w * 0.6;
    } else {
      // banyan, obviously
      g.fillRect(x, 3, w * 0.8, h * 0.8);
    }
    x += w + 6;
    i++;
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
