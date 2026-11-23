import * as THREE from 'three';
import type { Ped } from '../../ai/peds/Pedestrians';
import { M1 } from '../../content/missions';
import { playDialogue } from '../../ui/dialogue';
import type { MissionDef } from '../types';
import { action, goTo, until } from '../steps';

/** Mission 1: drive a drunk Startup Bro to Club Pivot without him puking in the auto. */
export const MeterDown: MissionDef = {
  id: 'm1',
  title: M1.title,
  tagline: M1.tagline,
  requires: [],
  start: ({ landmarks }) => landmarks.safehouse.clone().add(new THREE.Vector3(-4, 0, 0)),
  intro: M1.intro,
  outro: M1.arrive,
  reward: { money: (run) => (run.data.fare as number) + 1500, respect: 40 },
  steps: (run) => {
    const lm = run.services.city!.landmarks;
    const pickup = lm.disruptxTower;
    const club = lm.studio7;
    const puke = { label: 'Ulti-meter 🤢', value: 0, color: '#8ac926' };
    let bro: Ped | null = null;
    let pitchT = 4;
    let warnT = 0;
    return [
      goTo(() => (run.services.vehicles?.current?.config.id === 'auto' ? 'DisruptX tower jao, Startup Bro ko uthao' : M1.needAuto), () => pickup, { inVehicle: 'auto', stop: true, radius: 9 }),
      action(async (r) => {
        const auto = r.services.vehicles!.current!;
        bro = r.ped('startupBro', pickup.clone().setY(0.15));
        if (bro) r.seat(bro, auto, auto.config.passengerSeats[2]!);
        await playDialogue(M1.pickup, r.ctx.input, r.ctx.clock);
        r.meters.push(puke);
        // Potholes and crashes are very bad for a pre-vomit founder.
        const off1 = r.ctx.events.on('vehicle:pothole', () => (puke.value += 0.09));
        r.onCleanup(off1);
        r.data.lastHealth = auto.health;
      }),
      until(
        () => (run.services.vehicles?.current ? `Club Pivot (Filmistan) le chalo. Meter down karo (M). Dheere chalao.` : 'Auto mein wapas baitho! Bro akela hai.'),
        (r, dt) => {
          const v = r.services.vehicles?.current;
          if (!v) return false;
          // Nausea from cornering, hard braking, speed and crashes.
          const w = v.body.angvel();
          const lateral = Math.abs(w.y * v.speed);
          const prev = (r.data.prevSpeed as number) ?? v.speed;
          const brake = Math.abs(v.speed - prev) / Math.max(dt, 1e-3);
          r.data.prevSpeed = v.speed;
          const hp = r.data.lastHealth as number;
          if (v.health < hp - 3) puke.value += 0.12;
          r.data.lastHealth = v.health;
          puke.value += (Math.max(0, lateral - 3.5) * 0.05 + Math.max(0, brake - 7) * 0.006 + (Math.abs(v.speed) > 14 ? 0.03 : 0)) * dt;
          puke.value = Math.max(0, puke.value - 0.025 * dt);
          puke.color = puke.value > 0.7 ? '#e63946' : puke.value > 0.4 ? '#ffb703' : '#8ac926';
          pitchT -= dt;
          warnT -= dt;
          if (puke.value > 0.7 && warnT <= 0) {
            warnT = 5;
            r.say(M1.warn, 'Startup Bro');
          } else if (pitchT <= 0) {
            pitchT = 9;
            r.say(M1.pitch, 'Startup Bro', 4);
          }
          if (puke.value >= 1) return { fail: M1.puked };
          const p = v.position;
          return Math.hypot(p.x - club.x, p.z - club.z) < 9 && Math.abs(v.speed) < 2;
        },
        () => club,
      ),
      action((r) => {
        const meter = r.services.vehicles!.meter;
        const tampered = meter.tampered;
        const fare = meter.running ? meter.stop() : 0;
        r.data.fare = fare === 0 ? 300 : tampered ? Math.round(fare * 0.6) : fare;
        r.extraText = fare === 0 ? 'Meter down nahi kiya. Bro ne flat ₹300 diye.' : tampered ? 'Bro ne tampered meter pakda: "Bro, scam?" (fare cut)' : `Fare: ₹${fare}`;
        if (bro) {
          r.unseat(bro);
          bro.pos.add(new THREE.Vector3(1.5, 0, 0));
          bro.anim = 'walk';
        }
      }),
    ];
  },
};
