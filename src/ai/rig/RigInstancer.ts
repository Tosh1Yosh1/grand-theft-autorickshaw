import * as THREE from 'three';

/** One body part of an instanced character. */
export interface PartDef {
  name: string;
  geo: THREE.BufferGeometry;
  /** Which colour slot tints this part (skin, shirt, pants...). */
  color: string;
  /** Joint position relative to the character root. */
  pivot: [number, number, number];
  /** Mesh centre relative to the joint. */
  offset: [number, number, number];
  scale: [number, number, number];
  /** Name of the pose joint that rotates this part (omit = rigid with root). */
  joint?: string;
  /** Optional parts can be hidden per instance (accessories). */
  optional?: boolean;
  castShadow?: boolean;
}

/** Euler angles (x, y, z) per joint name. */
export type Pose = Record<string, [number, number, number]>;

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

/**
 * Renders many simple jointed characters with one InstancedMesh per part.
 * 80 pedestrians x 12 parts = 12 draw calls instead of ~1000.
 */
export class RigInstancer {
  readonly group = new THREE.Group();
  private meshes: THREE.InstancedMesh[] = [];
  private free: number[] = [];
  private used = 0;
  private visible: Uint8Array[]; // per part, per instance
  private live = new Set<number>();
  private readonly mJoint = new THREE.Matrix4();
  private readonly mPart = new THREE.Matrix4();
  private readonly mOut = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly v = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  private readonly one = new THREE.Vector3(1, 1, 1);

  constructor(
    readonly parts: PartDef[],
    readonly capacity: number,
    material: THREE.Material = new THREE.MeshStandardMaterial({ roughness: 0.85 }),
  ) {
    for (const p of parts) {
      const m = new THREE.InstancedMesh(p.geo, material, capacity);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      // Only big parts cast shadows: halves the shadow-pass draw calls for crowds.
      m.castShadow = p.castShadow ?? p.scale[1] >= 0.45;
      m.receiveShadow = false;
      for (let i = 0; i < capacity; i++) {
        m.setMatrixAt(i, ZERO);
        m.setColorAt(i, new THREE.Color('#ffffff'));
      }
      m.name = p.name;
      this.meshes.push(m);
      this.group.add(m);
    }
    this.visible = parts.map(() => new Uint8Array(capacity).fill(1));
  }

  alloc(): number {
    const id = this.free.pop() ?? (this.used < this.capacity ? this.used++ : -1);
    if (id >= 0) this.live.add(id);
    return id;
  }

  release(id: number): void {
    if (id < 0) return;
    for (const m of this.meshes) m.setMatrixAt(id, ZERO);
    this.live.delete(id);
    this.free.push(id);
    this.markDirty();
  }

  /** Colours by slot name, and which optional parts are shown. */
  style(id: number, colors: Record<string, THREE.ColorRepresentation>, show: ReadonlySet<string> = new Set()): void {
    const c = new THREE.Color();
    this.parts.forEach((p, k) => {
      c.set(colors[p.color] ?? '#ff00ff');
      this.meshes[k]!.setColorAt(id, c);
      this.visible[k]![id] = !p.optional || show.has(p.name) ? 1 : 0;
      this.meshes[k]!.instanceColor!.needsUpdate = true;
    });
  }

  /** Write every part's matrix for one character. scale = whole-body scale. */
  pose(id: number, root: THREE.Matrix4, pose: Pose, partScale?: Record<string, number>): void {
    this.parts.forEach((p, k) => {
      const mesh = this.meshes[k]!;
      if (!this.visible[k]![id]) {
        mesh.setMatrixAt(id, ZERO);
        return;
      }
      const a = p.joint ? pose[p.joint] : undefined;
      this.q.setFromEuler(this.e.set(a?.[0] ?? 0, a?.[1] ?? 0, a?.[2] ?? 0));
      this.mJoint.compose(this.v.set(...p.pivot), this.q, this.one);
      const ps = partScale?.[p.name] ?? 1;
      this.mPart.compose(this.v.set(p.offset[0], p.offset[1], p.offset[2]), this.q.identity(), this.s.set(p.scale[0] * ps, p.scale[1] * ps, p.scale[2] * ps));
      this.mOut.multiplyMatrices(root, this.mJoint).multiply(this.mPart);
      mesh.setMatrixAt(id, this.mOut);
    });
  }

  /** Upload matrices; skip parts nobody is wearing and unused tail slots. */
  markDirty(): void {
    this.meshes.forEach((m, k) => {
      m.count = this.used;
      let any = false;
      for (const id of this.live) if (this.visible[k]![id]) { any = true; break; }
      m.visible = any;
      m.instanceMatrix.needsUpdate = true;
    });
  }
}

export const BOX = new THREE.BoxGeometry(1, 1, 1);
export const SPHERE = new THREE.SphereGeometry(0.5, 8, 6);
export const CAPSULE = new THREE.CapsuleGeometry(0.5, 1, 3, 6);
export const CONE = new THREE.ConeGeometry(0.5, 1, 8);
export const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
