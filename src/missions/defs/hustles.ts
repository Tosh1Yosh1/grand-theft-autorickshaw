import * as THREE from 'three';
import { audio } from '../../audio/AudioManager';
import { DELIVERY, GODMAN, RACE } from '../../content/missions2';
import { pickLine } from '../../content/lines';
import type { Vehicle } from '../../vehicles/Vehicle';
import { roadCoord } from '../../world/city/layout';
import type { MissionDef } from '../types';
import { action, until } from '../steps';
import { counter, sidewalk, walkTo } from './helpers';
import type { Ped } from '../../ai/peds/Pedestrians';

// ---------------- Flyover race ----------------
const FLY_Z = roadCoord(4);
const RACE_START = new THREE.Vector3(roadCoord(1) - 80, 0, FLY_Z + 3);
const CHECKPOINTS = [
  new THREE.Vector3(roadCoord(1) - 25, 4, FLY_Z),
  new THREE.Vector3(roadCoord(3), 7.5, FLY_Z),
  new THREE.Vector3(roadCoord(6) - 22, 7.5, FLY_Z),
  new THREE.Vector3(roadCoord(7) + 20, 0.5, FLY_Z), // after the jump: finish on the road below
];

export const FlyoverRace: MissionDef = {
  id: 'race',
  title: RACE.title,
  tagline: RACE.tagline,
  requires: ['m1'],
  repeatable: true,
  start: () => RACE_START.clone().add(new THREE.Vector3(-8, 0, 0)),
  intro: RACE.intro,
  outro: [],
  reward: { money: (r) => [3000, 1000, 300, 0][(r.data.place as number) - 1] ?? 0, respect: 20 },
  steps: (run) => {
    const racers: { v: Vehicle; cp: number }[] = [];
    let myCp = 0;
    let countdown = 3.5;
    const finished: string[] = [];
    return [
      until('Kisi gaadi mein baitho (start line pe)', (r) => !!r.services.vehicles?.current, () => RACE_START),
      action((r) => {
        const me = r.services.vehicles!.current!;
        me.body.setTranslation({ x: RACE_START.x, y: 1.2, z: RACE_START.z }, true);
        me.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
        me.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
        ['maruti', 'thar', 'taxi'].forEach((id, i) => {
          const v = r.vehicle(id, RACE_START.clone().add(new THREE.Vector3(-2 - (i % 2) * 6, 1.2, -6 + i * 3.5)), Math.PI / 2);
          if (!v) return;
          const entry = { v, cp: 0 };
          v.ai = () => {
            if (countdown > 0) return { throttle: 0, steer: 0, handbrake: true };
            const cp = CHECKPOINTS[entry.cp];
            if (!cp) return { throttle: 0.2, steer: 0, handbrake: false };
            const desired = Math.atan2(cp.x - v.position.x, cp.z - v.position.z);
            const diff = Math.atan2(Math.sin(desired - v.heading), Math.cos(desired - v.heading));
            return { throttle: 0.92 + Math.random() * 0.08, steer: THREE.MathUtils.clamp(-diff * 2, -1, 1), handbrake: false };
          };
          racers.push(entry);
        });
      }),
      until(
        () => (countdown > 0 ? `Ready... ${Math.ceil(countdown)}` : `Checkpoint ${Math.min(myCp + 1, CHECKPOINTS.length)}/${CHECKPOINTS.length} · Position: ${position()}`),
        (r, dt) => {
          const me = r.services.vehicles?.current;
          if (countdown > 0) {
            const before = Math.ceil(countdown);
            countdown -= dt;
            if (Math.ceil(countdown) !== before) audio.beep(countdown <= 0 ? 1320 : 660, 0.15);
            if (me) me.body.setLinvel({ x: 0, y: me.body.linvel().y, z: 0 }, true);
            return false;
          }
          for (const rc of racers) {
            const cp = CHECKPOINTS[rc.cp];
            if (cp && rc.v.position.distanceTo(cp) < 9) {
              rc.cp++;
              if (rc.cp === CHECKPOINTS.length) finished.push('ai');
            }
          }
          if (me) {
            const cp = CHECKPOINTS[myCp];
            if (cp && me.position.distanceTo(cp) < 9) {
              myCp++;
              audio.beep(990, 0.08);
              if (myCp === CHECKPOINTS.length) {
                finished.push('me');
                r.data.place = finished.indexOf('me') + 1;
                r.say([r.data.place === 1 ? RACE.win : RACE.lose], 'Rocket Raju', 4);
                return true;
              }
            }
          }
          if (finished.length >= racers.length && !finished.includes('me')) return { fail: RACE.lose };
          return false;
        },
        () => CHECKPOINTS[myCp] ?? null,
      ),
      action((r) => {
        for (const rc of racers) rc.v.ai = null;
        if ((r.data.place as number) > 1) r.extraText = `Position: ${r.data.place}`;
      }),
    ];
    function position(): number {
      const me = run.services.vehicles?.current;
      if (!me) return racers.length + 1;
      const score = (cp: number, p: THREE.Vector3) => cp * 1000 - (CHECKPOINTS[cp] ? p.distanceTo(CHECKPOINTS[cp]!) : 0);
      const mine = score(myCp, me.position);
      return 1 + racers.filter((r) => score(r.cp, r.v.position) > mine).length;
    }
  },
};

// ---------------- Amazin Pandey Delivery ----------------
export const FoodDelivery: MissionDef = {
  id: 'delivery',
  title: DELIVERY.title,
  tagline: DELIVERY.tagline,
  requires: ['m2'],
  repeatable: true,
  start: ({ landmarks }) => landmarks.disruptxTower.clone().add(new THREE.Vector3(8, 0, 0)),
  intro: DELIVERY.intro,
  outro: [],
  reward: { money: (r) => r.data.earned as number, respect: 10 },
  steps: (run) => {
    const start = run.playerPos.clone();
    const drops = [sidewalk(6 + Math.floor(Math.random() * 3), 1 + Math.floor(Math.random() * 3), Math.random()), sidewalk(5 + Math.floor(Math.random() * 4), 3 + Math.floor(Math.random() * 3), Math.random()), start.clone()];
    let i = 0;
    run.data.earned = 0;
    return [
      until('Koi gaadi lo, order garam hai', (r) => !!r.services.vehicles?.current),
      until(
        () => (i < 2 ? `Order ${i + 1}/2 deliver karo` : 'Hub pe wapas aao'),
        (r) => {
          if (r.timer === null) r.timer = 150;
          if (r.timer === 0) return { fail: 'Khana thanda, customer garam. Order cancel.' };
          const v = r.services.vehicles?.current;
          if (!v) return false;
          if (v.position.distanceTo(drops[i]!) < 7 && Math.abs(v.speed) < 3) {
            if (i < 2) {
              const tip = r.timer > 90 ? 50 : 0;
              r.data.earned = (r.data.earned as number) + 400 + tip;
              r.say(DELIVERY.done, 'Customer');
            }
            i++;
            r.timer += 40;
            return i >= drops.length;
          }
          return false;
        },
        () => drops[i] ?? null,
      ),
    ];
  },
};

// ---------------- Pappu Baba ka Darbar (fake godman scam) ----------------
const KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD'] as const;
export const Godman: MissionDef = {
  id: 'godman',
  title: GODMAN.title,
  tagline: GODMAN.tagline,
  requires: ['m3'],
  repeatable: true,
  start: () => sidewalk(3, 5, 0.6),
  intro: GODMAN.intro,
  outro: [],
  reward: { money: (r) => r.data.donations as number, respect: 15 },
  steps: (run) => {
    const spot = sidewalk(3, 5, 0.6);
    const devotees: Ped[] = [];
    let round = 0;
    let suspicion = 0;
    let want: string | null = null;
    let windowT = 0;
    let pressed: string | null = null;
    run.data.donations = 0;
    const onKey = (e: KeyboardEvent) => (pressed = e.code);
    return [
      action((r) => {
        counter(r, spot.clone().add(new THREE.Vector3(0, -0.15, 1.5)), 'PAPPU BABA · CHAMATKAR ₹', '#fff3b0');
        for (let i = 0; i < 6; i++) {
          const d = r.ped(i % 2 ? 'aunty' : 'uncle', spot.clone().add(new THREE.Vector3(-4 + i * 1.6, 0, -3 - (i % 2))), 0);
          if (d) {
            d.anim = 'sitting';
            devotees.push(d);
          }
        }
        window.addEventListener('keydown', onKey);
        r.onCleanup(() => window.removeEventListener('keydown', onKey));
        r.services.player?.teleport(spot.clone().add(new THREE.Vector3(0, 0, 2.2)));
      }),
      until(
        () => (want ? `Chamatkar! Dabao: ${want.replace('Key', '')}` : `Agla bhakt... (Suspicion ${'👀'.repeat(suspicion)})`),
        (r, dt) => {
          if (!want) {
            windowT -= dt;
            if (windowT <= 0) {
              want = KEYS[Math.floor(Math.random() * KEYS.length)]!;
              windowT = 1.6 - Math.min(0.8, round * 0.1);
              pressed = null;
              r.say(GODMAN.devotee, 'Bhakt');
            }
            return false;
          }
          windowT -= dt;
          if (pressed === want) {
            const amt = 100 + Math.floor(Math.random() * 400);
            r.data.donations = (r.data.donations as number) + amt;
            r.say(GODMAN.blessing, 'Pappu Baba');
            audio.beep(1200, 0.1);
            round++;
            want = null;
            windowT = 1.2;
          } else if (pressed && KEYS.includes(pressed as (typeof KEYS)[number]) || windowT <= 0) {
            suspicion++;
            audio.beep(200, 0.2);
            want = null;
            windowT = 1.2;
          }
          pressed = null;
          r.extraText = `Chanda: ₹${r.data.donations}`;
          if (suspicion >= 3) {
            r.say([GODMAN.busted], 'Bhakt', 4);
            r.services.peds?.startMob(spot);
            r.services.wanted?.raise(2);
            for (const d of devotees) {
              r.services.peds?.release(d);
              d.state = 'mob';
            }
            return { fail: pickLine([GODMAN.busted], false) };
          }
          return round >= 6;
        },
      ),
      action(() => {
        for (const d of devotees) walkTo(d, d.pos.clone().add(new THREE.Vector3(0, 0, -6)), 2, 0.5, 'walk');
      }),
    ];
  },
};
