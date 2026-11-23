import * as THREE from 'three';

/** Monsoon rain: streaks that follow the camera. Cheap: one Points/LineSegments draw call. */
export class Rain {
  private lines: THREE.LineSegments;
  private positions: Float32Array;
  private active = false;
  private intensity = 0;
  private readonly count = 2500;
  private readonly area = 40;

  constructor(scene: THREE.Scene) {
    this.positions = new Float32Array(this.count * 6);
    for (let i = 0; i < this.count; i++) this.reset(i, Math.random() * 30);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#b9c7d6', transparent: true, opacity: 0 }));
    this.lines.frustumCulled = false;
    this.lines.visible = false;
    scene.add(this.lines);
  }

  setActive(on: boolean): void {
    this.active = on;
  }

  private reset(i: number, y: number): void {
    const x = (Math.random() - 0.5) * this.area * 2;
    const z = (Math.random() - 0.5) * this.area * 2;
    const p = this.positions;
    p.set([x, y, z, x + 0.05, y + 0.7, z], i * 6);
  }

  update(dt: number, center: THREE.Vector3): void {
    this.intensity += ((this.active ? 1 : 0) - this.intensity) * Math.min(1, dt * 0.5);
    this.lines.visible = this.intensity > 0.01;
    if (!this.lines.visible) return;
    (this.lines.material as THREE.LineBasicMaterial).opacity = 0.45 * this.intensity;
    this.lines.position.set(center.x, 0, center.z);
    const p = this.positions;
    const fall = 28 * dt;
    for (let i = 0; i < this.count; i++) {
      const o = i * 6;
      p[o + 1]! -= fall;
      p[o + 4]! -= fall;
      if (p[o + 1]! < 0) this.reset(i, 25 + Math.random() * 5);
    }
    (this.lines.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }
}
