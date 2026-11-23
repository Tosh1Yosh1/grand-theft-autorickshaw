import * as THREE from 'three';
import { pickLine } from '../content/lines';
import { BUSTED_SUBS, BUSTED_TITLE, WASTED_SUBS, WASTED_TITLE } from '../content/wanted';
import type { GameContext, GameSystem } from '../core/System';
import { showBigScreen, windshieldCrack } from '../ui/bigScreen';
import { debugFolder } from '../ui/debugPanel';

/** Chai-cup health, "KHATAM. TATA. BYE BYE." and "CHALLAN KAT GAYA". */
export class PlayerHealth implements GameSystem {
  readonly name = 'playerHealth';
  private ctx!: GameContext;
  private sinceDamage = 0;
  private busy = false;

  init(ctx: GameContext): void {
    this.ctx = ctx;
    const e = ctx.events;
    e.on('player:damage', ({ amount }) => this.damage(amount));
    e.on('mob:caught', ({ damage }) => this.damage(damage));
    e.on('player:busted', ({ fine }) => void this.busted(fine));
    e.on('vehicle:windshield', () => windshieldCrack());
    const f = debugFolder('Player');
    f.add({ hurt: () => this.damage(30) }, 'hurt').name('Take 30 damage');
    f.add({ rich: () => ctx.store.getState().setPlayer({ money: ctx.store.getState().player.money + 100000 }) }, 'rich').name('+₹1 lakh');
  }

  damage(amount: number): void {
    if (this.busy) return;
    const st = this.ctx.store.getState();
    const health = Math.max(0, st.player.health - amount);
    st.setPlayer({ health });
    this.sinceDamage = 0;
    this.ctx.services.camera?.shake(Math.min(0.5, amount / 30));
    if (health <= 0) void this.wasted();
  }

  fixedUpdate(dt: number): void {
    this.sinceDamage += dt;
    const st = this.ctx.store.getState();
    // Slow regen up to 3 cups when left alone (a cutting chai's worth).
    if (this.sinceDamage > 8 && st.player.health < 60) st.setPlayer({ health: Math.min(60, st.player.health + dt * 2) });
  }

  private async wasted(): Promise<void> {
    this.busy = true;
    this.ctx.events.emit('player:wasted');
    this.ctx.clock.scale = 0.3;
    await showBigScreen(WASTED_TITLE, pickLine(WASTED_SUBS, this.ctx.store.getState().settings.profanity), '#ff3b30', 3.5);
    this.respawn(this.ctx.services.city?.landmarks.safehouse, 500);
  }

  private async busted(fine: number): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.ctx.clock.scale = 0.3;
    await showBigScreen(BUSTED_TITLE, `Fine: ₹${fine}. ${pickLine(BUSTED_SUBS, this.ctx.store.getState().settings.profanity)}`, '#4cc9f0', 3.5);
    this.respawn(this.ctx.services.city?.landmarks.sarkariDaftar, fine);
  }

  private respawn(at: THREE.Vector3 | undefined, cost: number): void {
    const { services, store, clock } = this.ctx;
    clock.scale = 1;
    services.vehicles?.exit(true);
    services.wanted?.set(0);
    const st = store.getState();
    st.setPlayer({ health: 100, money: st.player.money - cost });
    if (at) services.player?.teleport(at.clone().setY(0.3));
    this.busy = false;
  }
}
