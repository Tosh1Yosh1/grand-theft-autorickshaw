import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Bakes a procedural vehicle model (many meshes) into one merged geometry per material,
 * then draws every copy of it with InstancedMeshes. Meshes using the material named
 * "paint" get a per-instance body colour.
 */
export class ModelInstancer {
  readonly group = new THREE.Group();
  private meshes: { mesh: THREE.InstancedMesh; paint: boolean; base: THREE.Color }[] = [];
  private free: number[] = [];
  private used = 0;
  private liveCount = 0;
  private static readonly ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

  constructor(model: THREE.Object3D, readonly capacity: number) {
    model.updateMatrixWorld(true);
    const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = m.material as THREE.Material;
      const geo = m.geometry.clone().applyMatrix4(m.matrixWorld);
      for (const name of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geo.deleteAttribute(name);
      const g = geo.index ? geo.toNonIndexed() : geo;
      (byMat.get(mat) ?? byMat.set(mat, []).get(mat)!).push(g);
    });
    let biggest: THREE.InstancedMesh | null = null;
    for (const [mat, geos] of byMat) {
      const merged = mergeGeometries(geos, false);
      if (!merged) continue;
      const paint = mat.name === 'paint';
      const material = paint ? (mat as THREE.MeshStandardMaterial).clone() : mat;
      const base = paint ? (mat as THREE.MeshStandardMaterial).color.clone() : new THREE.Color('#ffffff');
      if (paint) (material as THREE.MeshStandardMaterial).color.set('#ffffff');
      const mesh = new THREE.InstancedMesh(merged, material, capacity);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      if (!biggest || merged.attributes.position!.count > biggest.geometry.attributes.position!.count) biggest = mesh;
      for (let i = 0; i < capacity; i++) {
        mesh.setMatrixAt(i, ModelInstancer.ZERO);
        if (paint) mesh.setColorAt(i, base);
      }
      this.meshes.push({ mesh, paint, base });
      this.group.add(mesh);
    }
    // Only the main body casts a shadow.
    if (biggest) biggest.castShadow = true;
    this.sync();
  }

  private sync(): void {
    this.group.visible = this.liveCount > 0;
    for (const m of this.meshes) m.mesh.count = this.used;
  }

  alloc(color?: THREE.ColorRepresentation): number {
    const id = this.free.pop() ?? (this.used < this.capacity ? this.used++ : -1);
    if (id >= 0) {
      this.liveCount++;
      this.sync();
      for (const m of this.meshes) {
        if (!m.paint) continue;
        m.mesh.setColorAt(id, color !== undefined ? new THREE.Color(color) : m.base);
        m.mesh.instanceColor!.needsUpdate = true;
      }
    }
    return id;
  }

  release(id: number): void {
    if (id < 0) return;
    for (const m of this.meshes) {
      m.mesh.setMatrixAt(id, ModelInstancer.ZERO);
      m.mesh.instanceMatrix.needsUpdate = true;
    }
    this.free.push(id);
    this.liveCount--;
    this.sync();
  }

  set(id: number, matrix: THREE.Matrix4): void {
    for (const m of this.meshes) {
      m.mesh.setMatrixAt(id, matrix);
      m.mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
