import * as THREE from 'three';

/** Collect transforms + colours, then emit one InstancedMesh. Keeps draw calls low. */
export class InstanceBatch {
  private matrices: THREE.Matrix4[] = [];
  private colors: THREE.Color[] = [];
  private static readonly q = new THREE.Quaternion();
  private static readonly e = new THREE.Euler();
  private static readonly up = new THREE.Vector3(0, 1, 0);

  constructor(
    readonly geometry: THREE.BufferGeometry,
    readonly material: THREE.Material,
    readonly opts: { castShadow?: boolean; receiveShadow?: boolean } = {},
  ) {}

  get size(): number {
    return this.matrices.length;
  }

  add(x: number, y: number, z: number, sx: number, sy: number, sz: number, rotY = 0, color?: THREE.ColorRepresentation, rotX = 0, rotZ = 0): void {
    const q = rotX || rotZ ? InstanceBatch.q.setFromEuler(InstanceBatch.e.set(rotX, rotY, rotZ, 'YXZ')) : InstanceBatch.q.setFromAxisAngle(InstanceBatch.up, rotY);
    this.matrices.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz)));
    this.colors.push(new THREE.Color(color ?? '#ffffff'));
  }

  build(): THREE.InstancedMesh | null {
    if (!this.matrices.length) return null;
    const mesh = new THREE.InstancedMesh(this.geometry, this.material, this.matrices.length);
    this.matrices.forEach((m, i) => {
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, this.colors[i]!);
    });
    mesh.castShadow = this.opts.castShadow ?? true;
    mesh.receiveShadow = this.opts.receiveShadow ?? true;
    mesh.computeBoundingSphere();
    mesh.computeBoundingBox();
    return mesh;
  }
}

/** Unit box with its origin at the bottom centre, so scale.y = height. */
export const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
export const UNIT_CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 10).translate(0, 0.5, 0);
