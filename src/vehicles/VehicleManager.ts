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
import type { Ped } from '../ai/peds/Pedestrians';
import { M3 } from '../content/missions';
import { districtAt } from '../world/city/layout';

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
  /** Every Thaar comes with a Loud Boy. He does not leave. */
  private loudBoys = new Map<Vehicle, Ped>();
  private loudTimer = 6;

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
    const lb = this.loudBoys.get(v);
    if (lb) this.ctx.services.peds?.remove(lb);
    this.loudBoys.delete(v);
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
    const cur = this.current;
    if (cur?.config.id === 'cart') cur.boost = districtAt(cur.position.x, cur.position.z) === 'jugaadpur' ? 1.9 : 1;
    for (const v of this.vehicles) {
      if (v === this.current) {
        v.fixedUpdate(dt, {
          throttle: input.axis('moveBack', 'moveForward'),
          steer: input.axis('moveLeft', 'moveRight'),
          handbrake: input.isDown('jump'),
        });
        this.meter.tick(Math.abs(v.speed) * dt);
      } else if (v.ai) {
        v.fixedUpdate(dt, v.ai(dt));
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
    this.updateLoudBoys(dt);
    if (this.ctx.clock.scale === 0) return; // cutscene: dialogue owns the keyboard
    if (!player) return;

    if (this.current) {
      const v = this.current;
      if (input.wasPressed('interact') && !services.wanted?.dealAvailable) {
        if (Math.abs(v.speed) > 3) this.say(EXIT_MOVING_LINES);
        else this.exit();
      }
      if (input.wasPressed('horn')) {
        this.stopHorn = audio.horn(v.config.horn);
        this.ctx.services.peds?.honk(v.position, v.heading);
        this.ctx.events.emit('player:honk', { position: v.position.clone(), heading: v.heading });
      }
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
    if (services.wanted?.dealAvailable || services.missions?.markerNearby) return;
    // No parked vehicle? Traffic is fair game.
    let jack: import('../ai/traffic/Traffic').TrafficCar | null = null;
    if (!nearest && services.traffic) {
      let bj = 3.2;
      for (const c of services.traffic.cars) {
        const d = c.pos.distanceTo(player.position);
        if (!c.wrecked && d < bj) { bj = d; jack = c; }
      }
    }
    setPrompt(nearest ? `<kbd>F</kbd> ${nearest.config.hasMeter ? 'Auto chalao' : `Drive ${nearest.config.name}`}` : jack ? `<kbd>F</kbd> ${jack.config.name} chheeno` : null);
    if (nearest && input.wasPressed('interact')) this.enter(nearest);
    else if (jack && input.wasPressed('interact')) this.carjack(jack);
  }

  /** Pull the driver out of a traffic vehicle and take it. */
  carjack(car: import('../ai/traffic/Traffic').TrafficCar): void {
    const traffic = this.ctx.services.traffic!;
    const { id, pos, heading, paint } = traffic.hijack(car);
    const v = this.spawn(id, pos.clone().setY(pos.y + 0.3), heading);
    if (paint) {
      v.object.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (m?.name === 'paint') {
          (o as THREE.Mesh).material = m.clone();
          ((o as THREE.Mesh).material as THREE.MeshStandardMaterial).color.set(paint);
        }
      });
    }
    this.ctx.events.emit('crime:carHit', { position: pos.clone() });
    this.enter(v);
  }

  private updateLoudBoys(dt: number): void {
    const q = new THREE.Quaternion();
    for (const [v, ped] of this.loudBoys) {
      const r = v.body.rotation();
      q.set(r.x, r.y, r.z, r.w);
      ped.pos.copy(this.tmp.set(...v.config.passengerSeats[0]!).applyQuaternion(q).add(v.position));
      ped.heading = v.heading;
      ped.anim = 'sitting';
    }
    const cur = this.current;
    if (cur && this.loudBoys.has(cur) && !this.ctx.services.missions?.run) {
      this.loudTimer -= dt;
      if (this.loudTimer <= 0) {
        this.loudTimer = 14;
        this.say(M3.loudBoy);
      }
    }
  }

  enter(v: Vehicle): void {
    if (v.config.id === 'thar' && !this.loudBoys.has(v)) {
      const lb = this.ctx.services.peds?.spawn('gymBhai', v.position.clone(), v.heading, true);
      if (lb) this.loudBoys.set(v, lb);
    }
    const { services } = this.ctx;
    if (v.ai) {
      v.ai = null;
      services.wanted?.raise(Math.max(services.wanted.level, 2)); // stealing a cop car: bold
    }
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
    showSubtitle(pickLine(pool, this.ctx.store.getState().settings.profanity), pool === M3.loudBoy ? 'Loud Boy' : 'Pappu');
  }
}
