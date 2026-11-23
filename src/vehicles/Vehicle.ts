import type RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import type { Physics } from '../core/Physics';
import { defaultWheel } from './models/parts';
import type { VehicleConfig } from './types';

export interface DriveInput {
  throttle: number; // -1..1 (negative = brake / reverse)
  steer: number; // -1..1 (positive = right)
  handbrake: boolean;
}

const UP = new THREE.Vector3(0, 1, 0);

/** One drivable vehicle: Rapier raycast-vehicle + arcade assists + visuals. */
export class Vehicle {
  readonly object = new THREE.Group();
  readonly model: THREE.Group;
  readonly body: RAPIER.RigidBody;
  readonly collider: RAPIER.Collider;
  readonly controller: RAPIER.DynamicRayCastVehicleController;
  readonly wheels: THREE.Object3D[] = [];
  health: number;
  steer = 0;
  /** Set by the manager when the player drives it. AI traffic leaves it false. */
  playerDriven = false;
  /** Seconds spent upside down, for auto-righting. */
  private flippedTime = 0;
  private readonly tmpQ = new THREE.Quaternion();
  private readonly tmpV = new THREE.Vector3();

  constructor(
    readonly config: VehicleConfig,
    private readonly physics: Physics,
    position: THREE.Vector3,
    heading = 0,
  ) {
    const R = physics.rapier;
    const world = physics.world;
    this.health = config.maxHealth;

    const q = new THREE.Quaternion().setFromAxisAngle(UP, heading);
    this.body = world.createRigidBody(
      R.RigidBodyDesc.dynamic()
        .setTranslation(position.x, position.y, position.z)
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
        .setLinearDamping(0.05)
        .setAngularDamping(0.6)
        .setCanSleep(false),
    );
    const [hx, hy, hz] = config.halfExtents;
    const [cx, cy, cz] = config.centerOfMass;
    const inertia = config.mass / 12;
    this.collider = world.createCollider(
      R.ColliderDesc.cuboid(hx, hy, hz)
        .setMassProperties(
          config.mass,
          { x: cx, y: cy, z: cz },
          { x: inertia * (hy * hy + hz * hz) * 4, y: inertia * (hx * hx + hz * hz) * 4, z: inertia * (hx * hx + hy * hy) * 4 },
          { x: 0, y: 0, z: 0, w: 1 },
        )
        .setFriction(0.4)
        .setActiveEvents(R.ActiveEvents.CONTACT_FORCE_EVENTS)
        .setContactForceEventThreshold(config.mass * 25),
      this.body,
    );

    this.controller = world.createVehicleController(this.body);
    this.controller.indexUpAxis = 1;
    this.controller.setIndexForwardAxis = 2;
    const s = config.suspension;
    config.wheels.forEach((w, i) => {
      this.controller.addWheel({ x: w.pos[0], y: w.pos[1], z: w.pos[2] }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, s.restLength, w.radius);
      this.controller.setWheelSuspensionStiffness(i, s.stiffness);
      this.controller.setWheelSuspensionCompression(i, s.compression);
      this.controller.setWheelSuspensionRelaxation(i, s.relaxation);
      this.controller.setWheelMaxSuspensionTravel(i, s.travel);
      this.controller.setWheelFrictionSlip(i, config.frictionSlip);
      this.controller.setWheelSideFrictionStiffness(i, config.sideFriction);
      this.controller.setWheelMaxSuspensionForce(i, config.mass * 60);
      const mesh = config.buildWheel?.(w.radius) ?? defaultWheel(w.radius);
      this.wheels.push(mesh);
      this.object.add(mesh);
    });

    this.model = config.buildModel();
    this.object.add(this.model);
    physics.attach(this.object, this.body);
  }

  get position(): THREE.Vector3 {
    return this.object.position;
  }

  /** Signed forward speed in m/s. */
  get speed(): number {
    return this.controller.currentVehicleSpeed();
  }

  /** Yaw of the chassis (radians, 0 = +Z). */
  get heading(): number {
    const r = this.body.rotation();
    this.tmpQ.set(r.x, r.y, r.z, r.w);
    this.tmpV.set(0, 0, 1).applyQuaternion(this.tmpQ);
    return Math.atan2(this.tmpV.x, this.tmpV.z);
  }

  get wrecked(): boolean {
    return this.health <= 0;
  }

  damage(amount: number): void {
    this.health = Math.max(0, this.health - amount);
  }

  fixedUpdate(dt: number, input: DriveInput): void {
    const c = this.config;
    const speed = this.speed;
    const absSpeed = Math.abs(speed);
    const dead = this.wrecked;

    // Speed-sensitive steering, eased so keyboard input doesn't snap.
    const speedFactor = 1 - c.steerFalloff * Math.min(1, absSpeed / c.maxSpeed);
    const targetSteer = -input.steer * c.maxSteer * speedFactor;
    this.steer += THREE.MathUtils.clamp(targetSteer - this.steer, -c.steerSpeed * dt, c.steerSpeed * dt);

    // Throttle: forward drives; backward brakes first, then reverses.
    let engine = 0;
    let brake = 0;
    if (!dead) {
      if (input.throttle > 0) {
        engine = speed < -0.5 ? 0 : c.engineForce * input.throttle * (absSpeed < c.maxSpeed ? 1 : 0);
        if (speed < -0.5) brake = c.brakeForce;
      } else if (input.throttle < 0) {
        if (speed > 0.5) brake = c.brakeForce;
        else engine = -c.reverseForce * -input.throttle * (absSpeed < c.maxSpeed * 0.4 ? 1 : 0);
      } else {
        brake = c.brakeForce * 0.08; // engine braking
      }
    } else brake = c.brakeForce * 0.3;

    c.wheels.forEach((w, i) => {
      this.controller.setWheelSteering(i, w.steer ? this.steer : 0);
      const driveWheels = c.wheels.filter((x) => x.drive).length;
      this.controller.setWheelEngineForce(i, w.drive ? engine / driveWheels : 0);
      this.controller.setWheelBrake(i, brake + (input.handbrake && !w.steer ? c.brakeForce * 2 : 0));
      // Handbrake drift: rear wheels lose sideways grip.
      this.controller.setWheelSideFrictionStiffness(i, input.handbrake && !w.steer ? c.sideFriction * 0.3 : c.sideFriction);
    });
    this.controller.updateVehicle(dt);

    this.arcadeAssists(dt);
  }

  /** Partial anti-roll (keep it tippy but playable) and auto-righting when flipped. */
  private arcadeAssists(dt: number): void {
    const r = this.body.rotation();
    this.tmpQ.set(r.x, r.y, r.z, r.w);
    const up = this.tmpV.set(0, 1, 0).applyQuaternion(this.tmpQ);
    const angvel = this.body.angvel();
    // Torque that pushes "up" back toward world up, scaled by antiRoll.
    const axis = new THREE.Vector3().crossVectors(up, UP);
    const k = this.config.antiRoll * this.config.mass * 6;
    const d = this.config.antiRoll * this.config.mass * 1.2;
    this.body.applyTorqueImpulse(
      { x: (axis.x * k - angvel.x * d) * dt, y: 0, z: (axis.z * k - angvel.z * d) * dt },
      true,
    );

    if (up.y < 0.3) this.flippedTime += dt;
    else this.flippedTime = 0;
    if (this.flippedTime > 2.5) this.unflip();
  }

  unflip(): void {
    const p = this.body.translation();
    const q = new THREE.Quaternion().setFromAxisAngle(UP, this.heading);
    this.body.setTranslation({ x: p.x, y: p.y + 1.2, z: p.z }, true);
    this.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.flippedTime = 0;
  }

  /** Visual wheel placement (suspension + spin + steer). Call every frame. */
  updateVisuals(): void {
    this.config.wheels.forEach((w, i) => {
      const mesh = this.wheels[i]!;
      const len = this.controller.wheelSuspensionLength(i) ?? this.config.suspension.restLength;
      mesh.position.set(w.pos[0], w.pos[1] - len, w.pos[2]);
      mesh.rotation.set(this.controller.wheelRotation(i) ?? 0, this.controller.wheelSteering(i) ?? 0, 0, 'YXZ');
    });
  }

  dispose(): void {
    this.object.removeFromParent();
    this.physics.world.removeVehicleController(this.controller);
    this.physics.detach(this.body);
  }
}
