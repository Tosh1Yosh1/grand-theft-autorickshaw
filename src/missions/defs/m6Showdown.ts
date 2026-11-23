import * as THREE from 'three';
import type { Ped } from '../../ai/peds/Pedestrians';
import { audio } from '../../audio/AudioManager';
import { M6 } from '../../content/missions2';
import { playDialogue } from '../../ui/dialogue';
import type { MissionDef } from '../types';
import { action, goTo, until } from '../steps';
import { walkTo } from './helpers';

interface Bottle {
  mesh: THREE.Mesh;
  from: THREE.Vector3;
  to: THREE.Vector3;
  t: number;
}

/** Mission 6: Don Babloo Botalwala, his 3-minute 90s-villain monologue, and his bottles. */
export const Showdown: MissionDef = {
  id: 'm6',
  title: M6.title,
  tagline: M6.tagline,
  requires: ['m5'],
  start: ({ landmarks }) => landmarks.botalwalaGodown.clone().add(new THREE.Vector3(-15, 0, 0)),
  intro: M6.intro,
  outro: M6.outro,
  reward: { money: 50000, respect: 200 },
  steps: (run) => {
    const arena = run.services.city!.landmarks.botalwalaGodown.clone().add(new THREE.Vector3(0, 0, 12));
    let babloo: Ped | null = null;
    const goons: Ped[] = [];
    const bottles: Bottle[] = [];
    let angry = false;
    let hits = 0;
    let needed = 8;
    let throwT = 3;
    let lineT = 5;
    let ko = false;
    const hitT = new Map<Ped, number>();
    return [
      goTo('Kachra Ghat godown pahuncho. Akele. (Belan le jao.)', () => arena, { radius: 14 }),
      action(async (r) => {
        babloo = r.ped('boss', arena.clone().add(new THREE.Vector3(0, 0.15, 6)), Math.PI);
        for (let i = 0; i < 6; i++) {
          const g = r.ped('goon', arena.clone().add(new THREE.Vector3(-7 + i * 2.8, 0.15, 3 + (i % 2) * 2)), Math.PI);
          if (g) {
            g.anim = 'idle';
            goons.push(g);
          }
        }
        if (babloo) babloo.anim = 'wave';
        const res = await playDialogue(M6.monologue, r.ctx.input, r.ctx.clock);
        if (res.skipped) {
          // Skipping a villain's monologue has consequences.
          angry = true;
          needed = 12;
          await playDialogue(M6.skipped, r.ctx.input, r.ctx.clock);
          for (let i = 0; i < 3; i++) {
            const g = r.ped('goon', arena.clone().add(new THREE.Vector3(-4 + i * 4, 0.15, 9)), Math.PI);
            if (g) goons.push(g);
          }
        }
        // Count hits on Babloo via the combat system's assault events.
        const off = r.ctx.events.on('crime:assault', ({ position }) => {
          if (!babloo || ko || position.distanceTo(babloo.pos) > 0.6) return;
          const weapon = r.ctx.store.getState().player.weapon;
          hits += weapon === 'belan' ? needed : weapon === 'bat' ? 2 : 1;
          audio.thud(0.8);
        });
        r.onCleanup(off);
      }),
      until(
        () => `Babloo Botalwala ko haraao! ${angry ? '(Woh BAHUT gussa hai)' : ''}`,
        (r, dt) => {
          const player = r.services.player!;
          const p = player.position;
          if (!babloo) return true;
          r.meters.length = 0;
          r.meters.push({ label: `Babloo ${angry ? '😡' : '😎'}`, value: Math.max(0, 1 - hits / needed), color: '#e63946' });
          if (hits >= needed) {
            ko = true;
            return true;
          }
          // Goons rush in and swing.
          for (const g of goons) {
            if (g.state === 'flee' || g.state === 'walk' || g.state === 'idle') g.state = 'scripted';
            if (g.state !== 'scripted') continue;
            const d = walkTo(g, p, angry ? 4.6 : 3.8, dt, 'swing');
            const t = (hitT.get(g) ?? 0) - dt;
            hitT.set(g, t);
            if (d < 1.3 && t <= 0) {
              hitT.set(g, 1.3);
              r.ctx.events.emit('player:damage', { amount: angry ? 7 : 5, source: 'goon' });
            }
          }
          // Babloo keeps his distance and throws bottles.
          if (babloo.state === 'flee' || babloo.state === 'walk' || babloo.state === 'idle') babloo.state = 'scripted';
          if (babloo.state === 'scripted') {
            const away = babloo.pos.clone().sub(p).setY(0);
            const d = away.length();
            if (d < 5) walkTo(babloo, babloo.pos.clone().add(away.normalize().multiplyScalar(3)), 2.5, dt, 'walk');
            else {
              babloo.heading = Math.atan2(-away.x, -away.z);
              babloo.anim = 'idle';
            }
          }
          throwT -= dt;
          if (throwT <= 0 && babloo.state === 'scripted') {
            throwT = angry ? 1.6 : 2.4;
            const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.3, 8), new THREE.MeshStandardMaterial({ color: '#2a9d8f', transparent: true, opacity: 0.8 }));
            r.object(mesh);
            bottles.push({ mesh, from: babloo.pos.clone().setY(1.6), to: p.clone().setY(0.5), t: 0 });
          }
          for (let i = bottles.length - 1; i >= 0; i--) {
            const b = bottles[i]!;
            b.t += dt / 1.1;
            const pos = new THREE.Vector3().lerpVectors(b.from, b.to, b.t);
            pos.y += Math.sin(b.t * Math.PI) * 4;
            b.mesh.position.copy(pos);
            b.mesh.rotation.x += dt * 12;
            if (b.t >= 1) {
              audio.crack();
              if (p.distanceTo(b.to) < 1.6) r.ctx.events.emit('player:damage', { amount: 10, source: 'bottle' });
              b.mesh.removeFromParent();
              bottles.splice(i, 1);
            }
          }
          lineT -= dt;
          if (lineT <= 0) {
            lineT = 6;
            r.say(M6.fight, 'Babloo Botalwala');
          }
          return false;
        },
        () => babloo?.pos ?? null,
      ),
      action((r) => {
        r.meters.length = 0;
        if (babloo) {
          babloo.state = 'scripted';
          babloo.anim = 'lying';
        }
        for (const g of goons) {
          r.services.peds?.release(g);
          g.state = 'flee';
        }
      }),
    ];
  },
};
