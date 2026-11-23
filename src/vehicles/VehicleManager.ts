import type RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { audio } from '../audio/AudioManager';
import { pickLine, type Line } from '../content/lines';
import { CRASH_LINES, EXIT_MOVING_LINES, POTHOLE_LINES, TAMPER_LINES, UNTAMPER_LINES, WRECKED_LINES } from '../content/vehicleLines';
import type { GameContext, GameSystem } from '../core/System';
import type { CameraTarget } from '../player/ThirdPersonCamera';
import { setPrompt } from '../ui/prompt';
import { showSubtitle } from '../ui/subtitles';
import { updateVehicleHud } from '../ui/vehicleHud';
import { VEHICLES } from './configs';
import { FareMeter } from './FareMeter';
import { Vehicle, type DriveInput } from './Vehicle';

const ENTER_DISTANCE = 2.6;
const IDLE_INPUT: DriveInput = { throttle: 0, steer: 0, handbrake: true };

/** Owns all vehicles; handles enter/exit (F), driving input, horn (H), meter (M/T), potholes, crash damage. */
export class VehicleManager implements GameSystem {
  readonly name = 'vehicles';
  readonly vehicles: Vehicle[] = [];
  current: Vehicle | null = null;
  readonly meter = new FareMeter();

  private ctx!: GameContext;
  private byCollider = new Map<number, Vehicle>();
  private stopHorn: (() => void) | null = null;
  private engine: ReturnType<typeof audio.engine> | null = null;
  private wheelCooldown = new Map<string, number>();
  private lastLine = 0;
  private time = 0;
  private readonly tmp = new THREE.Vector3();

  private readonly cameraTarget: CameraTarget = {
    distance: 6,
    getPivot: (out) => out.copy(this.current!.position).add(new THREE.Vector3(0, 1.3, 0)),
    fovBoost: () => (this.current ? Math.min(1, Math.abs(this.current.speed) / this.current.config.maxSpeed) : 0),
    autoYaw: () => (this.current && Math.abs(this.current.speed) > 1.5 ? this.current.heading + Math.PI : null),
  };

  init(ctx: GameContext): void {
    this.ctx = ctx;
    ctx.services.vehicles = this;
    ctx.physics.onContactForce((a, b, force) => this.onImpact(a, b, force));
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  spawn(id: string, position: THREE.Vector3, heading = 0): Vehicle {
    const config = VEHICLES[id];
    if (!config) throw new Error(`Unknown vehicle "${id}". Gaadi ka naam galat hai.`);
    const v = new Vehicle(config, this.ctx.physics, position, heading);
    this.ctx.scene.add(v.object);
    this.vehicles.push(v);
    this.byCollider.set(v.collider.handle, v);
    return v;
  }

  remove(v: Vehicle): void {
    if (v === this.current) this.exit(true);
    this.byCollider.delete(v.collider.handle);
    this.vehicles.splice(this.vehicles.indexOf(v), 1);
    v.dispose();
  }

  vehicleOf(collider: RAPIER.Collider): Vehicle | undefined {
    return this.byCollider.get(collider.handle);
  }

  fixedUpdate(dt: number): void {
    this.time += dt;
    const { input } = this.ctx;
    for (const v of this.vehicles) {
      if (v === this.current) {
        v.fixedUpdate(dt, {
          throttle: input.axis('moveBack', 'moveForward'),
          steer: input.axis('moveLeft', 'moveRight'),
          handbrake: input.isDown('jump'),
        });
        this.meter.tick(Math.abs(v.speed) * dt);
      } else if (!v.playerDriven) {
        // Parked / AI-less vehicles just sit there with the handbrake on. AI traffic overrides this later.
        v.fixedUpdate(dt, IDLE_INPUT);
      }
      this.checkPotholes(v);
    }
  }

  update(dt: number): void {
    const { input, services } = this.ctx;
    const player = services.player;
    for (const v of this.vehicles) v.updateVisuals();
    if (!player) return;

    if (this.current) {
      const v = this.current;
      if (input.wasPressed('interact')) {
        if (Math.abs(v.speed) > 3) this.say(EXIT_MOVING_LINES);
        else this.exit();
      }
      if (input.wasPressed('horn')) this.stopHorn = audio.horn(v.config.horn);
      if (input.wasReleased('horn')) {
        this.stopHorn?.();
        this.stopHorn = null;
      }
      if (v.config.hasMeter) {
        if (input.wasPressed('meter')) {
          audio.beep(this.meter.running ? 440 : 990);
          if (this.meter.running) showSubtitle(`Meter up. Fare: ₹${this.meter.stop()}`, 'Meter');
          else this.meter.flagDown();
        }
        if (input.wasPressed('tamperMeter')) {
          this.meter.tampered = !this.meter.tampered;
          this.say(this.meter.tampered ? TAMPER_LINES : UNTAMPER_LINES, true);
        }
      }
      const rpm = Math.min(1, Math.abs(v.speed) / v.config.maxSpeed);
      this.engine?.set(rpm, v.wrecked ? 0 : Math.abs(input.axis('moveBack', 'moveForward')));
      updateVehicleHud({
        name: v.config.name,
        kmh: Math.abs(v.speed) * 3.6,
        health: v.health / v.config.maxHealth,
        meter: v.config.hasMeter ? { running: this.meter.running, tampered: this.meter.tampered, fare: this.meter.fare } : undefined,
      });
      void dt;
      return;
    }

    // On foot: look for the nearest vehicle to get into.
    let nearest: Vehicle | null = null;
    let best = ENTER_DISTANCE;
    for (const v of this.vehicles) {
      const d = v.position.distanceTo(player.position);
      if (d < best) { best = d; nearest = v; }
    }
    setPrompt(nearest ? `<kbd>F</kbd> ${nearest.config.hasMeter ? 'Auto chalao' : `Drive ${nearest.config.name}`}` : null);
    if (nearest && input.wasPressed('interact')) this.enter(nearest);
  }

  enter(v: Vehicle): void {
    const { services } = this.ctx;
    const player = services.player!;
    player.setActive(false);
    const rig = player.rig.root;
    v.object.add(rig);
    rig.position.set(...v.config.seat);
    rig.rotation.set(0, 0, 0);
    player.animator.state = 'sit';
    this.current = v;
    v.playerDriven = true;
    this.cameraTarget.distance = v.config.cameraDistance;
    this.cameraTarget.excludeBody = v.body;
    services.camera?.follow(this.cameraTarget);
    if (services.camera) services.camera.yaw = v.heading + Math.PI;
    this.engine = audio.engine(v.config.engineSound);
    setPrompt(null);
    this.ctx.events.emit('vehicle:enter', { id: v.config.id });
  }

  exit(force = false): void {
    const v = this.current;
    const player = this.ctx.services.player;
    if (!v || !player) return;
    // Step out on the left side (or anywhere, if forced).
    const side = new THREE.Vector3(-(v.config.halfExtents[0] + 0.7), 0, 0).applyQuaternion(v.object.quaternion);
    const pos = this.tmp.copy(v.position).add(side);
    pos.y = Math.max(pos.y - 0.3, 0.05);
    this.ctx.scene.add(player.rig.root);
    player.teleport(pos);
    player.rig.root.position.copy(pos);
    player.heading = v.heading;
    player.setActive(true);
    v.playerDriven = false;
    this.current = null;
    this.stopHorn?.();
    this.stopHorn = null;
    this.engine?.stop();
    this.engine = null;
    updateVehicleHud(null);
    if (!force) this.ctx.events.emit('vehicle:exit', { id: v.config.id });
  }

  private checkPotholes(v: Vehicle): void {
    const holes = this.ctx.services.potholes;
    if (!holes) return;
    const speed = Math.abs(v.speed);
    if (speed < 2) return;
    for (let i = 0; i < v.config.wheels.length; i++) {
      if (!v.controller.wheelIsInContact(i)) continue;
      const p = v.controller.wheelContactPoint(i);
      if (!p || !holes.at(p.x, p.z)) continue;
      const key = `${v.collider.handle}:${i}`;
      if ((this.wheelCooldown.get(key) ?? 0) > this.time) continue;
      this.wheelCooldown.set(key, this.time + 0.6);
      // Jolt the chassis at that wheel, eat some health.
      v.body.applyImpulseAtPoint({ x: 0, y: v.config.mass * (0.6 + speed * 0.08), z: 0 }, p, true);
      const dmg = 2 + speed * 0.4;
      v.damage(dmg);
      if (v === this.current) {
        audio.thud(Math.min(1, speed / 15));
        this.ctx.services.camera?.shake(0.3 + speed * 0.03);
        this.say(POTHOLE_LINES);
        this.ctx.events.emit('vehicle:pothole', { damage: dmg });
      }
    }
  }

  private onImpact(a: RAPIER.Collider, b: RAPIER.Collider, force: number): void {
    const v = this.vehicleOf(a) ?? this.vehicleOf(b);
    if (!v) return;
    const dmg = Math.min(40, force / (v.config.mass * 40));
    if (dmg < 1) return;
    const wasAlive = !v.wrecked;
    v.damage(dmg);
    if (v === this.current) {
      audio.thud(Math.min(1, dmg / 15));
      this.ctx.services.camera?.shake(Math.min(1, dmg / 10));
      if (wasAlive && v.wrecked) this.say(WRECKED_LINES, true);
      else if (dmg > 4) this.say(CRASH_LINES);
    }
  }

  /** Pappu talks to himself. Rate-limited so potholes don't turn into a podcast. */
  private say(pool: readonly Line[], force = false): void {
    if (!force && this.time - this.lastLine < 2.5) return;
    this.lastLine = this.time;
    if (!this.ctx.store.getState().settings.subtitles) return;
    showSubtitle(pickLine(pool, this.ctx.store.getState().settings.profanity), 'Pappu');
  }
}
