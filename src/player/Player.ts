import type RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import type { GameContext, GameSystem } from '../core/System';
import { debugFolder } from '../ui/debugPanel';
import { PappuAnimator, type AnimState } from './PappuAnimator';
import { buildPappu, type PappuRig } from './PappuModel';
import type { CameraTarget } from './ThirdPersonCamera';

const HALF_HEIGHT = 0.5;
const RADIUS = 0.35;
/** Capsule centre sits this far above the feet. */
const CENTER_Y = HALF_HEIGHT + RADIUS;

/** Arcade tunables, all exposed in the debug panel under "Player". */
export const PLAYER_TUNING = {
  walkSpeed: 3.2,
  runSpeed: 5.5,
  sprintSpeed: 8.5,
  crouchSpeed: 1.8,
  accel: 45,
  decel: 35,
  airControl: 0.45,
  jumpHeight: 1.3,
  gravity: 28,
  fallGravityMultiplier: 1.6,
  coyoteTime: 0.14,
  jumpBuffer: 0.14,
  turnSpeed: 14,
  pushForce: 6,
};

export class Player implements GameSystem {
  readonly name = 'player';
  readonly tuning = PLAYER_TUNING;
  rig!: PappuRig;
  animator!: PappuAnimator;
  body!: RAPIER.RigidBody;
  collider!: RAPIER.Collider;

  /** False while driving: no movement, no collisions, hidden or seated. */
  active = true;
  readonly velocity = new THREE.Vector3();
  grounded = false;
  heading = Math.PI; // face away from the camera at spawn

  private ctx!: GameContext;
  private controller!: RAPIER.KinematicCharacterController;
  private coyote = 0;
  private bufferedJump = 0;
  private jumping = false;
  private readonly fwd = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly wish = new THREE.Vector3();
  private readonly prevPos = new THREE.Vector3();
  private readonly currPos = new THREE.Vector3();

  readonly cameraTarget: CameraTarget = {
    distance: 4.2,
    getPivot: (out) => out.copy(this.rig.root.position).add(new THREE.Vector3(0, 1.55, 0)),
    fovBoost: () => (this.ctx.input.isDown('sprint') && this.speed2D() > this.tuning.runSpeed ? 1 : 0),
  };

  init(ctx: GameContext): void {
    this.ctx = ctx;
    ctx.services.player = this;
    const R = ctx.physics.rapier;
    const world = ctx.physics.world;

    this.rig = buildPappu();
    ctx.scene.add(this.rig.root);
    this.animator = new PappuAnimator(this.rig);

    this.body = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(0, CENTER_Y + 0.5, 6));
    this.collider = world.createCollider(R.ColliderDesc.capsule(HALF_HEIGHT, RADIUS), this.body);
    this.cameraTarget.excludeBody = this.body;

    this.controller = world.createCharacterController(0.03);
    this.controller.setUp({ x: 0, y: 1, z: 0 });
    this.controller.setSlideEnabled(true);
    this.controller.enableAutostep(0.45, 0.2, true);
    this.controller.enableSnapToGround(0.4);
    this.controller.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
    this.controller.setMinSlopeSlideAngle((60 * Math.PI) / 180);
    this.controller.setApplyImpulsesToDynamicBodies(true);
    this.controller.setCharacterMass(80); // Pappu is not a light man.

    const t = this.body.translation();
    this.currPos.set(t.x, t.y, t.z);
    this.prevPos.copy(this.currPos);

    ctx.services.camera?.follow(this.cameraTarget, true);

    const f = debugFolder('Player', false);
    f.add(this.tuning, 'walkSpeed', 1, 10, 0.1);
    f.add(this.tuning, 'runSpeed', 1, 15, 0.1);
    f.add(this.tuning, 'sprintSpeed', 1, 25, 0.1);
    f.add(this.tuning, 'accel', 5, 120, 1);
    f.add(this.tuning, 'decel', 5, 120, 1);
    f.add(this.tuning, 'airControl', 0, 1, 0.05);
    f.add(this.tuning, 'jumpHeight', 0.2, 5, 0.05);
    f.add(this.tuning, 'gravity', 5, 60, 0.5);
    f.add(this.tuning, 'fallGravityMultiplier', 1, 3, 0.05);
    f.add(this.tuning, 'coyoteTime', 0, 0.4, 0.01);
    f.add(this.tuning, 'jumpBuffer', 0, 0.4, 0.01);
    f.add(this.tuning, 'turnSpeed', 2, 30, 0.5);
    f.add({ copy: () => navigator.clipboard?.writeText(JSON.stringify(this.tuning, null, 2)) }, 'copy').name('Copy tuning JSON');
    f.add({ respawn: () => this.teleport(new THREE.Vector3(0, 1, 6)) }, 'respawn').name('Respawn Pappu');
  }

  get position(): THREE.Vector3 {
    return this.rig.root.position;
  }

  speed2D(): number {
    return Math.hypot(this.velocity.x, this.velocity.z);
  }

  teleport(feet: THREE.Vector3): void {
    this.body.setNextKinematicTranslation({ x: feet.x, y: feet.y + CENTER_Y, z: feet.z });
    this.body.setTranslation({ x: feet.x, y: feet.y + CENTER_Y, z: feet.z }, true);
    this.currPos.set(feet.x, feet.y + CENTER_Y, feet.z);
    this.prevPos.copy(this.currPos);
    this.velocity.set(0, 0, 0);
  }

  /** Enter/leave "controlled by player" mode (vehicles call this). */
  setActive(active: boolean): void {
    this.active = active;
    this.collider.setEnabled(active);
    if (active) this.ctx.services.camera?.follow(this.cameraTarget);
  }

  fixedUpdate(dt: number): void {
    if (!this.active) return;
    const { input } = this.ctx;
    const t = this.tuning;

    // Wish direction relative to camera.
    const cam = this.ctx.services.camera;
    if (cam) cam.basis(this.fwd, this.right);
    else { this.fwd.set(0, 0, -1); this.right.set(1, 0, 0); }
    const ix = input.axis('moveLeft', 'moveRight');
    const iz = input.axis('moveBack', 'moveForward');
    this.wish.set(0, 0, 0).addScaledVector(this.right, ix).addScaledVector(this.fwd, iz);
    if (this.wish.lengthSq() > 1) this.wish.normalize();

    const crouch = input.isDown('crouch') && this.grounded;
    const maxSpeed = crouch ? t.crouchSpeed : input.isDown('sprint') ? t.sprintSpeed : t.runSpeed;
    const targetX = this.wish.x * maxSpeed;
    const targetZ = this.wish.z * maxSpeed;
    const hasInput = this.wish.lengthSq() > 0.001;
    const rate = (hasInput ? t.accel : t.decel) * (this.grounded ? 1 : t.airControl);
    this.velocity.x = approach(this.velocity.x, targetX, rate * dt);
    this.velocity.z = approach(this.velocity.z, targetZ, rate * dt);

    // Jump with coyote time + input buffering, so it always feels like it worked.
    this.coyote = this.grounded ? t.coyoteTime : this.coyote - dt;
    if (input.wasPressed('jump')) this.bufferedJump = t.jumpBuffer;
    else this.bufferedJump -= dt;
    if (this.bufferedJump > 0 && this.coyote > 0) {
      this.velocity.y = Math.sqrt(2 * t.gravity * t.jumpHeight);
      this.coyote = 0;
      this.bufferedJump = 0;
      this.jumping = true;
    }

    // Gravity: heavier on the way down = snappier arcs. Short hop if jump released early.
    const falling = this.velocity.y < 0;
    const g = t.gravity * (falling ? t.fallGravityMultiplier : !input.isDown('jump') && this.jumping ? 2 : 1);
    this.velocity.y -= g * dt;
    if (this.grounded && this.velocity.y < 0) this.velocity.y = -2;

    // Move via the character controller.
    const desired = { x: this.velocity.x * dt, y: this.velocity.y * dt, z: this.velocity.z * dt };
    this.controller.computeColliderMovement(this.collider, desired);
    const moved = this.controller.computedMovement();
    const p = this.body.translation();
    this.prevPos.copy(this.currPos);
    this.currPos.set(p.x + moved.x, p.y + moved.y, p.z + moved.z);
    this.body.setNextKinematicTranslation(this.currPos);

    const wasGrounded = this.grounded;
    this.grounded = this.controller.computedGrounded();
    if (this.grounded && !wasGrounded) this.jumping = false;
    // Bonked head on something: stop rising.
    if (this.velocity.y > 0 && moved.y < desired.y * 0.5) this.velocity.y = 0;

    // Fell off the world? Back to spawn, no questions asked.
    if (this.currPos.y < -30) this.teleport(new THREE.Vector3(0, 2, 6));
  }

  update(dt: number): void {
    const root = this.rig.root;
    if (!this.active) {
      this.animator.update(dt, 0, 0);
      return;
    }
    // Interpolate visual position between physics steps.
    root.position.lerpVectors(this.prevPos, this.currPos, this.ctx.physics.alpha);
    root.position.y -= CENTER_Y;

    const speed = this.speed2D();
    if (speed > 0.3) {
      const target = Math.atan2(this.velocity.x, this.velocity.z);
      const diff = Math.atan2(Math.sin(target - this.heading), Math.cos(target - this.heading));
      this.heading += diff * (1 - Math.exp(-this.tuning.turnSpeed * dt));
    }
    root.rotation.y = this.heading;

    this.animator.state = this.pickAnim(speed);
    this.animator.update(dt, speed, this.velocity.y);
  }

  private pickAnim(speed: number): AnimState {
    if (!this.grounded) return this.velocity.y > 0 ? 'jump' : 'fall';
    if (this.ctx.input.isDown('crouch')) return 'crouch';
    if (speed < 0.3) return 'idle';
    return speed > this.tuning.walkSpeed + 0.5 ? 'run' : 'walk';
  }
}

function approach(v: number, target: number, maxDelta: number): number {
  return v < target ? Math.min(v + maxDelta, target) : Math.max(v - maxDelta, target);
}
