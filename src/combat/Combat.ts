import * as THREE from 'three';
import { audio } from '../audio/AudioManager';
import { pickLine } from '../content/lines';
import { SLAP_LINES } from '../content/wanted';
import type { WeaponId } from '../core/store';
import type { GameContext, GameSystem } from '../core/System';
import type { Ped } from '../ai/peds/Pedestrians';
import { letterbox } from '../ui/bigScreen';
import { debugFolder } from '../ui/debugPanel';
import { setPrompt } from '../ui/prompt';
import { showSubtitle } from '../ui/subtitles';
import { WEAPON_ORDER, WEAPONS } from './weapons';

interface Projectile {
  kind: 'chappal' | 'stone';
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  hit: Set<Ped>;
  returning: boolean;
}

interface Pickup {
  weapon: WeaponId;
  mesh: THREE.Group;
  pos: THREE.Vector3;
}

/**
 * Slapstick combat on foot. Left mouse attacks; hold with fists for a slow-mo TIGHT SLAP.
 * Q/E cycle weapons. No gore: people fly, lie down, sit up and swear.
 */
export class Combat implements GameSystem {
  readonly name = 'combat';
  private ctx!: GameContext;
  private cooldown = 0;
  private holdTime = 0;
  private slowmo = 0;
  private punchAnim = 0;
  private projectiles: Projectile[] = [];
  private pickups: Pickup[] = [];
  private readonly fwd = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();

  init(ctx: GameContext): void {
    this.ctx = ctx;
    ctx.services.combat = this;
    debugFolder('Combat').add({ all: () => this.give(['fists', 'chappal', 'bat', 'slingshot', 'belan']) }, 'all').name('Unlock all weapons');
  }

  give(weapons: WeaponId[]): void {
    const st = this.ctx.store.getState();
    const owned = new Set([...st.player.weapons, ...weapons]);
    st.setPlayer({ weapons: WEAPON_ORDER.filter((w) => owned.has(w)) });
  }

  /** A spinning weapon pickup in the world. */
  addPickup(weapon: WeaponId, pos: THREE.Vector3): void {
    const g = new THREE.Group();
    const color = { fists: '#fff', chappal: '#2f6fb5', bat: '#c9a227', slingshot: '#6b4423', belan: '#d4a373' }[weapon];
    const shape = weapon === 'bat' ? new THREE.BoxGeometry(0.12, 0.9, 0.06) : weapon === 'belan' ? new THREE.CylinderGeometry(0.06, 0.06, 0.7, 8) : new THREE.BoxGeometry(0.3, 0.3, 0.08);
    const m = new THREE.Mesh(shape, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4 }));
    if (weapon === 'belan') m.rotation.z = Math.PI / 2;
    g.add(m);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.04, 6, 24), new THREE.MeshBasicMaterial({ color: '#ffd60a' }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.8;
    g.add(ring);
    g.position.copy(pos).setY(1.1);
    this.ctx.scene.add(g);
    this.pickups.push({ weapon, mesh: g, pos: pos.clone() });
  }

  private cycle(dir: 1 | -1): void {
    const st = this.ctx.store.getState();
    const list = st.player.weapons;
    const i = list.indexOf(st.player.weapon);
    st.setPlayer({ weapon: list[(i + dir + list.length) % list.length]! });
    audio.beep(660, 0.05, 0.08);
  }

  update(dt: number): void {
    const { input, services, store, clock } = this.ctx;
    if (this.ctx.clock.scale === 0) return; // cutscene: dialogue owns the keyboard
    const player = services.player;
    const realDt = clock.scale > 0 ? dt / clock.scale : dt;

    // Slow-mo timer runs on real time.
    if (this.slowmo > 0) {
      this.slowmo -= realDt;
      if (this.slowmo <= 0) {
        clock.scale = 1;
        letterbox(false);
      }
    }
    this.updateProjectiles(dt);
    this.updatePickups(dt);
    if (!player?.active) return;

    if (input.wasPressed('weaponNext')) this.cycle(1);
    if (input.wasPressed('weaponPrev')) this.cycle(-1);

    this.cooldown -= dt;
    this.punchAnim = Math.max(0, this.punchAnim - dt * 4);
    player.animator.punch = Math.min(1, this.punchAnim * 2);
    const weapon = WEAPONS[store.getState().player.weapon];
    if (!input.pointerLocked) return; // first click just grabs the mouse

    if (weapon.id === 'fists') {
      // Tap = punch. Hold 0.5 s and release = TIGHT SLAP in Bollywood slow motion.
      if (input.isDown('attack')) this.holdTime += realDt;
      if (input.wasReleased('attack')) {
        const charged = this.holdTime > 0.5;
        this.holdTime = 0;
        if (this.cooldown <= 0) this.melee(weapon, charged);
      }
    } else if (input.wasPressed('attack') && this.cooldown <= 0) {
      if (weapon.ranged) this.shoot(weapon.ranged);
      else this.melee(weapon, false);
    }
  }

  private facing(out: THREE.Vector3): THREE.Vector3 {
    const cam = this.ctx.services.camera;
    if (cam) {
      const right = new THREE.Vector3();
      cam.basis(out, right);
    } else out.set(Math.sin(this.ctx.services.player!.heading), 0, Math.cos(this.ctx.services.player!.heading));
    return out;
  }

  private melee(w: (typeof WEAPONS)[WeaponId], tightSlap: boolean): void {
    const player = this.ctx.services.player!;
    this.cooldown = w.cooldown;
    this.punchAnim = 0.6;
    player.animator.punchSide = player.animator.punchSide === 1 ? -1 : 1;
    this.facing(this.fwd);
    player.heading = Math.atan2(this.fwd.x, this.fwd.z);
    const reach = w.reach * (tightSlap ? 1.3 : 1);
    let hits = 0;
    for (const p of this.ctx.services.peds?.peds ?? []) {
      if (p.state === 'airborne' || p.state === 'downed') continue;
      this.tmp.subVectors(p.pos, player.position).setY(0);
      const d = this.tmp.length();
      if (d > reach + 0.3 || d < 0.01) continue;
      if (this.tmp.dot(this.fwd) / d < Math.cos(w.cone)) continue;
      this.hitPed(p, this.tmp.normalize(), tightSlap ? 11 : w.force, w.oneHit || tightSlap ? 999 : w.damage);
      hits++;
    }
    // Animals: dogs run, cows... you really want to hit a cow? Fine. Mob it is.
    for (const c of this.ctx.services.animals?.cows ?? []) {
      if (c.pos.distanceTo(player.position) < reach + 0.8) {
        this.ctx.events.emit('crime:cowHit', { position: c.pos.clone() });
        this.ctx.services.peds?.startMob(c.pos);
        audio.moo(0, true);
        hits++;
        break;
      }
    }
    audio.thud(hits ? 0.6 : 0.15);
    if (tightSlap) {
      this.slowmo = 0.9;
      this.ctx.clock.scale = 0.2;
      letterbox(true, pickLine(SLAP_LINES, true));
      this.ctx.services.camera?.shake(0.8);
    }
  }

  /** Knock a ped. Downed NPCs sit up and swear (Pedestrians handles that). */
  hitPed(p: Ped, dir: THREE.Vector3, force: number, damage: number): void {
    const peds = this.ctx.services.peds!;
    p.health -= damage;
    const ko = p.health <= 0 || damage >= 999;
    peds.knock(p, dir.clone().multiplyScalar(force), ko ? 4 : 2.5, 'downed');
    if (ko) p.health = 100; // cartoon rules: they always get up
    this.ctx.events.emit('crime:assault', { position: p.pos.clone(), cop: p.type === 'cop' || p.type === 'squad' });
  }

  private shoot(kind: 'chappal' | 'stone'): void {
    const player = this.ctx.services.player!;
    this.cooldown = WEAPONS[kind === 'chappal' ? 'chappal' : 'slingshot'].cooldown;
    this.punchAnim = 0.6;
    this.facing(this.fwd);
    player.heading = Math.atan2(this.fwd.x, this.fwd.z);
    const geo = kind === 'chappal' ? new THREE.BoxGeometry(0.12, 0.03, 0.28) : new THREE.SphereGeometry(0.06, 6, 4);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: kind === 'chappal' ? '#2f6fb5' : '#777' }));
    const pos = player.position.clone().add(new THREE.Vector3(0, 1.3, 0)).addScaledVector(this.fwd, 0.6);
    mesh.position.copy(pos);
    this.ctx.scene.add(mesh);
    const speed = kind === 'chappal' ? 16 : 30;
    this.projectiles.push({ kind, mesh, pos, vel: this.fwd.clone().multiplyScalar(speed).setY(kind === 'chappal' ? 0.5 : 0.8), age: 0, hit: new Set(), returning: false });
    audio.beep(kind === 'chappal' ? 300 : 900, 0.06, 0.1);
  }

  private updateProjectiles(dt: number): void {
    const player = this.ctx.services.player;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i]!;
      pr.age += dt;
      if (pr.kind === 'chappal') {
        // Boomerang: fly out ~0.6 s, then home back to Pappu's hand.
        if (pr.age > 0.6 && player) {
          pr.returning = true;
          this.tmp.copy(player.position).setY(player.position.y + 1.3).sub(pr.pos);
          const d = this.tmp.length();
          pr.vel.lerp(this.tmp.multiplyScalar(18 / Math.max(d, 0.01)), Math.min(1, dt * 6));
          if (d < 0.8 || pr.age > 3) {
            this.removeProjectile(i);
            continue;
          }
        }
        pr.mesh.rotation.y += dt * 25;
      } else {
        pr.vel.y -= 4 * dt;
        if (pr.age > 1.5 || pr.pos.y < 0) {
          this.removeProjectile(i);
          continue;
        }
      }
      pr.pos.addScaledVector(pr.vel, dt);
      pr.mesh.position.copy(pr.pos);
      const w = WEAPONS[pr.kind === 'chappal' ? 'chappal' : 'slingshot'];
      for (const p of this.ctx.services.peds?.peds ?? []) {
        if (pr.hit.has(p) || p.state === 'airborne' || p.state === 'downed') continue;
        const dx = p.pos.x - pr.pos.x;
        const dz = p.pos.z - pr.pos.z;
        if (dx * dx + dz * dz < 0.5 && pr.pos.y < p.pos.y + 2) {
          pr.hit.add(p);
          this.hitPed(p, pr.vel.clone().setY(0).normalize(), w.force, w.damage);
          if (pr.kind === 'stone') {
            this.removeProjectile(i);
            break;
          }
        }
      }
      if (this.projectiles[i] === pr && pr.kind === 'stone') this.ctx.events.emit('combat:projectile', { position: pr.pos });
    }
  }

  private removeProjectile(i: number): void {
    const pr = this.projectiles[i]!;
    pr.mesh.removeFromParent();
    pr.mesh.geometry.dispose();
    this.projectiles.splice(i, 1);
  }

  /** Stone positions this frame, for things that can be shot down (the drone). */
  stonesNear(p: THREE.Vector3, r: number): boolean {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i]!;
      if (pr.kind === 'stone' && pr.pos.distanceTo(p) < r) {
        this.removeProjectile(i);
        return true;
      }
    }
    return false;
  }

  private updatePickups(dt: number): void {
    const player = this.ctx.services.player;
    let prompt: string | null = null;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i]!;
      pk.mesh.rotation.y += dt * 2;
      if (!player?.active || pk.pos.distanceTo(player.position) > 1.6) continue;
      const owned = this.ctx.store.getState().player.weapons.includes(pk.weapon);
      if (owned) {
        prompt = 'Yeh toh pehle se hai.';
        continue;
      }
      this.give([pk.weapon]);
      this.ctx.store.getState().setPlayer({ weapon: pk.weapon });
      showSubtitle(`Mil gaya: ${pk.weapon.toUpperCase()}! (Q/E se badlo)`, 'Pappu');
      audio.beep(1200, 0.12);
      pk.mesh.removeFromParent();
      this.pickups.splice(i, 1);
    }
    if (prompt) setPrompt(prompt);
  }
}
