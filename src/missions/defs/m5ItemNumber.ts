import * as THREE from 'three';
import type { Ped } from '../../ai/peds/Pedestrians';
import { audio } from '../../audio/AudioManager';
import { M5 } from '../../content/missions2';
import { playDialogue } from '../../ui/dialogue';
import type { Vehicle } from '../../vehicles/Vehicle';
import { PursuitAI } from '../../vehicles/VehicleAI';
import type { MissionDef } from '../types';
import { action, goTo, until } from '../steps';
import { counter, sidewalk, walkTo } from './helpers';

/** Mission 5: red-light/green-light through a film shoot; "CUT!" freezes everyone. Don't move. */
export const ItemNumber: MissionDef = {
  id: 'm5',
  title: M5.title,
  tagline: M5.tagline,
  requires: ['m4'],
  start: ({ landmarks }) => landmarks.safehouse.clone().add(new THREE.Vector3(6, 0, 0)),
  intro: M5.intro,
  outro: M5.outro,
  reward: { money: 7000, respect: 70 },
  steps: (run) => {
    const lm = run.services.city!.landmarks;
    const set = lm.studio7.clone().add(new THREE.Vector3(0, 0, 8)); // on the road outside Studio 7
    const pinkyPos = set.clone().add(new THREE.Vector3(18, 0.1, 0));
    const home = sidewalk(9, 6, 0.5);
    let pinky: Ped | null = null;
    let director: Ped | null = null;
    const bouncers: Ped[] = [];
    const dancers: Ped[] = [];
    let phase: 'action' | 'cut' = 'action';
    let phaseT = 5;
    let alert = 0;
    let hitT = 0;
    let chaseCar: Vehicle | null = null;
    let chaseT = 4;
    return [
      action((r) => {
        director = r.ped('anchor', set.clone().add(new THREE.Vector3(-6, 0.1, 5)), Math.PI / 2);
        counter(r, set.clone().add(new THREE.Vector3(-6, 0, 6.5)), 'DIRECTOR BHANSODE', '#111');
        pinky = r.ped('dancer', pinkyPos, -Math.PI / 2);
        for (let i = 0; i < 4; i++) {
          const b = r.ped('goon', pinkyPos.clone().add(new THREE.Vector3(-6 - i * 2, 0, (i % 2 ? 1 : -1) * 3)), -Math.PI / 2);
          if (b) bouncers.push(b);
        }
        for (let i = 0; i < 6; i++) {
          const d = r.ped('dancer', pinkyPos.clone().add(new THREE.Vector3(-2 - (i % 3) * 1.5, 0, (i < 3 ? 1 : -1) * 2)), -Math.PI / 2);
          if (d) dancers.push(d);
        }
        // Film lights on stands.
        for (const z of [-5, 5]) {
          const light = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.4), new THREE.MeshStandardMaterial({ color: '#222', emissive: '#fff3c4', emissiveIntensity: 1.5 }));
          light.position.copy(set).add(new THREE.Vector3(8, 3.5, z));
          r.object(light);
        }
      }),
      goTo('Studio 7 ki shooting pe pahuncho (Filmistan)', () => set, { radius: 30 }),
      until(
        () => (phase === 'cut' ? '🎬 CUT! HILNA MAT!' : '🎬 ACTION! Pinky tak pahuncho, phir F'),
        (r, dt) => {
          const player = r.services.player!;
          phaseT -= dt;
          if (phaseT <= 0) {
            phase = phase === 'action' ? 'cut' : 'action';
            phaseT = phase === 'cut' ? 2.6 : 3 + Math.random() * 3;
            r.say(phase === 'cut' ? M5.cut : M5.action, 'Director Bhansode', 2);
            audio.beep(phase === 'cut' ? 300 : 900, 0.2, 0.2);
          }
          // CUT: everyone freezes. Moving gets you spotted.
          if (phase === 'cut') {
            const moving = r.services.vehicles?.current ? Math.abs(r.services.vehicles.current.speed) > 0.6 : player.speed2D() > 0.6;
            if (moving && phaseT < 2.3) {
              alert = Math.min(3, alert + dt * 2);
              if (Math.random() < dt * 2) r.say(M5.spotted, 'Director Bhansode', 2);
            }
            for (const d of dancers) d.anim = 'idle';
          } else {
            for (const d of dancers) {
              d.anim = 'dance';
              d.heading += dt * 2;
            }
            // Bouncers: patrol around Pinky, chase if alerted.
            const p = r.playerPos;
            bouncers.forEach((b, i) => {
              if (b.state !== 'scripted') {
                if (b.state === 'flee' || b.state === 'walk') b.state = 'scripted';
                return;
              }
              const chase = alert > 0.5 || p.distanceTo(pinkyPos) < 9;
              const target = chase ? p : pinkyPos.clone().add(new THREE.Vector3(Math.cos(i + r.ctx.clock.scale * 0 + performance.now() / 2000) * 7, 0, Math.sin(i + performance.now() / 2000) * 7));
              const d = walkTo(b, target, chase ? 3.8 + alert : 1.6, dt, chase ? 'swing' : 'walk');
              if (chase && d < 1.3 && (hitT -= dt) <= 0) {
                hitT = 1;
                r.ctx.events.emit('player:damage', { amount: 6, source: 'bouncer' });
              }
            });
            alert = Math.max(0, alert - dt * 0.15);
          }
          r.extraText = alert > 0.5 ? `⚠ Bouncers alert! (${'!'.repeat(Math.ceil(alert))})` : '';
          if (director) director.anim = phase === 'cut' ? 'wave' : 'idle';
          return !!pinky && player.position.distanceTo(pinky.pos) < 2.2 && r.consumeInteract();
        },
        () => pinky?.pos ?? null,
      ),
      action(async (r) => {
        await playDialogue(M5.reached, r.ctx.input, r.ctx.clock);
        for (const d of dancers) d.anim = 'idle';
      }),
      until(
        'Pinky ke saath kisi gaadi mein baitho',
        (r, dt) => {
          const v = r.services.vehicles?.current;
          if (pinky && !v) walkTo(pinky, r.services.player!.position.clone().add(new THREE.Vector3(1, 0, 1)), 5, dt);
          if (v && pinky) {
            const seat = v.config.passengerSeats[0] ?? v.config.seat;
            r.seat(pinky, v, seat);
            return true;
          }
          return false;
        },
      ),
      action((r) => {
        chaseCar = r.vehicle('thar', set.clone().add(new THREE.Vector3(-25, 1.2, 0)), Math.PI / 2);
        if (chaseCar) chaseCar.ai = new PursuitAI(chaseCar, () => r.playerPos, 1).drive;
      }),
      until(
        'Pinky ko ghar chhodo (Sarkari Colony). Bouncers peeche hain!',
        (r, dt) => {
          const v = r.services.vehicles?.current;
          chaseT -= dt;
          if (chaseT <= 0) {
            chaseT = 9;
            r.say(M5.chase, 'Pinky');
          }
          if (!v) return false;
          return v.position.distanceTo(home) < 8 && Math.abs(v.speed) < 2;
        },
        () => home,
      ),
      action((r) => {
        if (pinky) r.unseat(pinky);
        if (chaseCar) chaseCar.ai = null;
      }),
    ];
  },
};
