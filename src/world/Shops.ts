import * as THREE from 'three';
import { audio } from '../audio/AudioManager';
import { saveGame } from '../core/save';
import type { GameContext, GameSystem } from '../core/System';
import { setPrompt } from '../ui/prompt';
import { showSubtitle } from '../ui/subtitles';

/** Chai tapris heal (₹10 a cup); sleeping at Pandey Niwas saves and skips to morning. */
export class Shops implements GameSystem {
  readonly name = 'shops';
  private ctx!: GameContext;

  init(ctx: GameContext): void {
    this.ctx = ctx;
  }

  update(): void {
    const s = this.ctx.services;
    const p = s.player;
    if (!p?.active || this.ctx.clock.scale === 0 || s.wanted?.dealAvailable || s.missions?.markerNearby) return;
    const st = this.ctx.store.getState();
    const stall = s.city?.stalls.find((x) => x.position.distanceTo(p.position) < 2.6 && x.chai);
    if (stall) {
      const full = st.player.health >= 100;
      setPrompt(full ? 'Pet bhara hai. Chai baad mein.' : '<kbd>F</kbd> Cutting chai ₹10 (+1 cup)');
      if (!full && this.ctx.input.wasPressed('interact')) {
        if (st.player.money < 10) return showSubtitle('Udhaar kal milega. Aaj nahi.', 'Chaiwala');
        st.setPlayer({ money: st.player.money - 10, health: Math.min(100, st.player.health + 20) });
        audio.beep(700, 0.08);
        showSubtitle(['Garam chai, thanda dimaag.', 'Adrak extra daala hai.', 'Cutting! Ek dum kadak.'][Math.floor(Math.random() * 3)]!, 'Chaiwala');
      }
      return;
    }
    const home = s.city?.landmarks.safehouse;
    if (home && p.position.distanceTo(home) < 2.5 && !s.missions?.run) {
      setPrompt('<kbd>F</kbd> So jao (save + subah 7 baje)');
      if (this.ctx.input.wasPressed('interact')) {
        if ((s.wanted?.level ?? 0) > 0) return showSubtitle('Police peeche hai aur tum sona chahte ho?', 'Mummy');
        if (s.dayNight) s.dayNight.hour = 7;
        st.setPlayer({ health: 100 });
        const ok = saveGame(this.ctx);
        showSubtitle(ok ? 'Neend poori. Game save. Mummy ne chai bana di.' : 'Neend poori. (Save nahi hua: storage band hai.)', 'Pandey Niwas', 4);
      }
    }
  }
}

export type Stall = { position: THREE.Vector3; chai: boolean };
