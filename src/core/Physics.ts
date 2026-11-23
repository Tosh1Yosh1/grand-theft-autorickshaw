import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

export const FIXED_DT = 1 / 60;

interface Synced {
  body: RAPIER.RigidBody;
  object: THREE.Object3D;
  prevPos: THREE.Vector3;
  prevRot: THREE.Quaternion;
  currPos: THREE.Vector3;
  currRot: THREE.Quaternion;
}

/** Rapier world + interpolated sync of rigid bodies onto Three.js objects. */
export class Physics {
  readonly world: RAPIER.World;
  private synced: Synced[] = [];
  /** Interpolation factor between the last two steps, updated every frame. */
  alpha = 1;
  private debugLines: THREE.LineSegments | null = null;

  private readonly events: RAPIER.EventQueue;
  private forceHandlers: ((a: RAPIER.Collider, b: RAPIER.Collider, force: number) => void)[] = [];

  private constructor(readonly rapier: typeof RAPIER) {
    this.world = new rapier.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = FIXED_DT;
    this.events = new rapier.EventQueue(true);
  }

  /** Big impacts on colliders that enabled CONTACT_FORCE_EVENTS (vehicles, mostly). */
  onContactForce(handler: (a: RAPIER.Collider, b: RAPIER.Collider, force: number) => void): void {
    this.forceHandlers.push(handler);
  }

  static async create(): Promise<Physics> {
    await RAPIER.init();
    return new Physics(RAPIER);
  }

  get bodyCount(): number {
    return this.world.bodies.len();
  }

  /** Make `object` follow `body` every frame (with interpolation). */
  attach(object: THREE.Object3D, body: RAPIER.RigidBody): void {
    const t = body.translation();
    const r = body.rotation();
    const pos = new THREE.Vector3(t.x, t.y, t.z);
    const rot = new THREE.Quaternion(r.x, r.y, r.z, r.w);
    this.synced.push({ body, object, prevPos: pos.clone(), prevRot: rot.clone(), currPos: pos, currRot: rot });
  }

  /** Remove the body (and its colliders) and stop syncing the object. */
  detach(body: RAPIER.RigidBody): void {
    this.synced = this.synced.filter((s) => s.body !== body);
    this.world.removeRigidBody(body);
  }

  step(): void {
    for (const s of this.synced) {
      s.prevPos.copy(s.currPos);
      s.prevRot.copy(s.currRot);
    }
    this.world.step(this.events);
    if (this.forceHandlers.length) {
      this.events.drainContactForceEvents((e) => {
        const a = this.world.getCollider(e.collider1());
        const b = this.world.getCollider(e.collider2());
        if (a && b) for (const h of this.forceHandlers) h(a, b, e.totalForceMagnitude());
      });
    } else this.events.clear();
    for (const s of this.synced) {
      const t = s.body.translation();
      const r = s.body.rotation();
      s.currPos.set(t.x, t.y, t.z);
      s.currRot.set(r.x, r.y, r.z, r.w);
    }
  }

  /** alpha = how far we are between the last two physics steps (0..1). */
  sync(alpha: number): void {
    this.alpha = alpha;
    for (const s of this.synced) {
      s.object.position.lerpVectors(s.prevPos, s.currPos, alpha);
      s.object.quaternion.slerpQuaternions(s.prevRot, s.currRot, alpha);
    }
  }

  /** Collider wireframes, for the debug panel. */
  updateDebug(scene: THREE.Scene, enabled: boolean): void {
    if (!enabled) {
      if (this.debugLines) this.debugLines.visible = false;
      return;
    }
    if (!this.debugLines) {
      const mat = new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false });
      this.debugLines = new THREE.LineSegments(new THREE.BufferGeometry(), mat);
      this.debugLines.renderOrder = 999;
      this.debugLines.frustumCulled = false;
      scene.add(this.debugLines);
    }
    const { vertices, colors } = this.world.debugRender();
    const g = this.debugLines.geometry;
    g.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    g.setAttribute('color', new THREE.BufferAttribute(colors, 4));
    this.debugLines.visible = true;
  }
}
