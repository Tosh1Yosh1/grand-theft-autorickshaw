import type RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import type { GameContext, GameSystem } from '../core/System';
import { debugFolder } from '../ui/debugPanel';

/** Something the camera can follow: the player on foot, a vehicle, a mission cutscene... */
export interface CameraTarget {
  /** World-space point the camera orbits around. */
  getPivot(out: THREE.Vector3): THREE.Vector3;
  distance: number;
  /** Rigid body to ignore when checking for walls (so we don't collide with ourselves). */
  excludeBody?: RAPIER.RigidBody;
  /** 0..1, widens the FOV (sprinting, nitro). */
  fovBoost?(): number;
  /** If set, the camera drifts behind this heading (radians) when the mouse is idle (vehicles). */
  autoYaw?(): number | null;
}

export class ThirdPersonCamera implements GameSystem {
  readonly name = 'thirdPersonCamera';
  readonly priority = 100;
  yaw = 0;
  pitch = -0.2;
  enabled = true;
  readonly tuning = {
    baseFov: 65,
    sprintFovBoost: 9,
    followSharpness: 18,
    minPitch: -1.2,
    maxPitch: 0.6,
    autoYawDelay: 1.2,
    autoYawSpeed: 2.5,
  };

  private ctx!: GameContext;
  private target: CameraTarget | null = null;
  private readonly pivot = new THREE.Vector3();
  private readonly smoothPivot = new THREE.Vector3();
  private readonly dir = new THREE.Vector3();
  private currentDistance = 4;
  private idleTime = 0;
  private snapNext = true;
  private shakeAmount = 0;

  init(ctx: GameContext): void {
    this.ctx = ctx;
    ctx.services.camera = this;
    ctx.renderer.domElement.addEventListener('click', () => ctx.input.requestPointerLock());
    const f = debugFolder('Camera');
    f.add(this.tuning, 'baseFov', 40, 100, 1);
    f.add(this.tuning, 'sprintFovBoost', 0, 25, 1);
    f.add(this.tuning, 'followSharpness', 2, 40, 1);
    f.add(this.tuning, 'autoYawSpeed', 0, 8, 0.1).name('vehicle auto-yaw');
  }

  /** Screen shake, e.g. potholes and crashes. Stacks, decays quickly. */
  shake(intensity: number): void {
    this.shakeAmount = Math.min(1, this.shakeAmount + intensity);
  }

  follow(target: CameraTarget, snap = false): void {
    this.target = target;
    this.currentDistance = target.distance;
    if (snap) this.snapNext = true;
  }

  update(dt: number): void {
    if (!this.enabled || !this.target) return;
    const { input, camera, store, physics } = this.ctx;
    const t = this.tuning;
    const realDt = Math.max(dt, 1 / 240);

    // Mouse look.
    const { mouseSensitivity, invertY } = store.getState().settings;
    const k = 0.0025 * mouseSensitivity;
    const mdx = input.mouseDelta.x, mdy = input.mouseDelta.y;
    this.yaw -= mdx * k;
    this.pitch -= mdy * k * (invertY ? -1 : 1);
    this.pitch = THREE.MathUtils.clamp(this.pitch, t.minPitch, t.maxPitch);

    // Vehicles: swing back behind the heading when the mouse is left alone.
    const auto = this.target.autoYaw?.() ?? null;
    if (Math.abs(mdx) + Math.abs(mdy) > 0.5) this.idleTime = 0;
    else this.idleTime += realDt;
    if (auto !== null && this.idleTime > t.autoYawDelay) {
      const diff = Math.atan2(Math.sin(auto - this.yaw), Math.cos(auto - this.yaw));
      this.yaw += diff * (1 - Math.exp(-t.autoYawSpeed * realDt));
      this.pitch += (-0.25 - this.pitch) * (1 - Math.exp(-2 * realDt));
    }

    this.target.getPivot(this.pivot);
    if (this.snapNext) {
      this.smoothPivot.copy(this.pivot);
      this.snapNext = false;
    } else {
      this.smoothPivot.lerp(this.pivot, 1 - Math.exp(-t.followSharpness * realDt));
    }

    // Direction from pivot to camera.
    this.dir.set(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      -Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch),
    );

    // Pull in if a wall is between pivot and camera.
    let want = this.target.distance;
    const ray = new physics.rapier.Ray(this.smoothPivot, this.dir);
    const hit = physics.world.castRay(ray, want, true, undefined, undefined, undefined, this.target.excludeBody);
    if (hit) want = Math.max(0.6, hit.timeOfImpact - 0.25);
    // Snap in fast, ease out slowly.
    const rate = want < this.currentDistance ? 30 : 4;
    this.currentDistance += (want - this.currentDistance) * (1 - Math.exp(-rate * realDt));

    camera.position.copy(this.smoothPivot).addScaledVector(this.dir, this.currentDistance);
    camera.position.y = Math.max(camera.position.y, 0.3);
    camera.lookAt(this.smoothPivot);
    if (this.shakeAmount > 0.001) {
      const a = this.shakeAmount * 0.06;
      camera.rotation.x += (Math.random() - 0.5) * a;
      camera.rotation.y += (Math.random() - 0.5) * a;
      this.shakeAmount *= Math.exp(-8 * realDt);
    }

    const fov = t.baseFov + (this.target.fovBoost?.() ?? 0) * t.sprintFovBoost;
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov += (fov - camera.fov) * (1 - Math.exp(-6 * realDt));
      camera.updateProjectionMatrix();
    }
  }

  /** Flat forward/right vectors for movement relative to the camera. */
  basis(forward: THREE.Vector3, right: THREE.Vector3): void {
    forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    right.set(-forward.z, 0, forward.x);
  }
}
