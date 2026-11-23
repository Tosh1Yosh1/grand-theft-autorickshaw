import * as THREE from 'three';
import type { Ped } from '../../ai/peds/Pedestrians';
import { audio } from '../../audio/AudioManager';
import { M3 } from '../../content/missions';
import type { Vehicle } from '../../vehicles/Vehicle';
import { PursuitAI } from '../../vehicles/VehicleAI';
import { BLOCK, roadCoord } from '../../world/city/layout';
import type { MissionDef } from '../types';
import { action, goTo, until } from '../steps';

/** Mission 3: steal the groom's Thaar; the baraat chases you, dancing. */
export const Shaadi: MissionDef = {
  id: 'm3',
  title: M3.title,
  tagline: M3.tagline,
  requires: ['m2'],
  start: ({ landmarks }) => landmarks.dentingPainting.clone().add(new THREE.Vector3(5, 0, 0)),
  intro: M3.intro,
  outro: M3.outro,
  reward: { money: 8000, respect: 80, weapon: 'belan', vehicle: 'thar' },
  steps: (run) => {
    const lm = run.services.city!.landmarks;
    // The wedding venue: a Jugaadpur road two blocks from the denting shop.
    const venue = new THREE.Vector3(roadCoord(2) + BLOCK / 2, 0, roadCoord(7));
    const godown = lm.botalwalaGodown;
    const dancers: Ped[] = [];
    const cars: Vehicle[] = [];
    let thar: Vehicle | null = null;
    let loudT = 3;
    let chaseTime = 0;
    let mummyDone = false;
    let farTime = 0;
    return [
      action((r) => {
        thar = r.vehicle('thar', venue.clone().add(new THREE.Vector3(10, 1.2, 3)), Math.PI / 2);
        if (thar) {
          // Wedding decoration: marigold garlands.
          const garland = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.08, 6, 20), new THREE.MeshStandardMaterial({ color: '#ff9f1c', emissive: '#ff6d00', emissiveIntensity: 0.3 }));
          garland.rotation.x = Math.PI / 2;
          garland.position.set(0, 0.55, 1.6);
          thar.object.add(garland);
          const loud = r.ped('gymBhai', venue.clone());
          if (loud) r.seat(loud, thar, thar.config.passengerSeats[0]!);
          r.data.loud = loud;
        }
        for (let i = 0; i < 12; i++) {
          const d = r.ped('dancer', venue.clone().add(new THREE.Vector3((Math.random() - 0.5) * 10, 0, (Math.random() - 0.5) * 5)), Math.random() * 6);
          if (d) {
            d.anim = 'dance';
            dancers.push(d);
          }
        }
      }),
      goTo('Shaadi mein pahuncho (Jugaadpur)', () => venue, { radius: 25 }),
      until(
        'Dulhe ki Thaar churao: paas jao aur F dabao',
        (r, dt) => {
          for (const d of dancers) d.heading += dt * 2;
          return !!thar && r.services.vehicles?.current === thar;
        },
        () => thar?.position ?? null,
      ),
      action((r) => {
        r.say(M3.stolen, 'Pappu', 4);
        // Two baraati Innocent-as join the dancing mob.
        for (let k = 0; k < 2; k++) {
          const car = r.vehicle('innova', venue.clone().add(new THREE.Vector3(-12 - k * 7, 1.2, 0)), Math.PI / 2);
          if (car) {
            car.ai = new PursuitAI(car, () => r.playerPos, 0.85).drive;
            cars.push(car);
          }
        }
      }),
      until(
        () => M3.lose,
        (r, dt) => {
          const v = r.services.vehicles?.current;
          if (thar && thar.wrecked) return { fail: 'Thaar ka kachumber nikal gaya. Chetan bhai naraz.' };
          chaseTime += dt;
          // Baraatis run after you, still dancing.
          const p = r.playerPos;
          let nearest = Infinity;
          for (const d of dancers) {
            if (d.state !== 'scripted') continue;
            const to = p.clone().sub(d.pos).setY(0);
            const dist = to.length();
            nearest = Math.min(nearest, dist);
            if (dist > 1.5) d.pos.addScaledVector(to.normalize(), Math.min(dist, 6.5 * dt));
            d.heading += dt * 5;
            d.anim = 'dance';
            d.pos.y = 0.1;
          }
          for (const c of cars) nearest = Math.min(nearest, c.position.distanceTo(p));
          loudT -= dt;
          if (loudT <= 0 && v === thar) {
            loudT = 7;
            r.say(M3.loudBoy, 'Loud Boy');
          }
          if (!mummyDone && chaseTime > 18) {
            mummyDone = true;
            audio.ring();
            setTimeout(() => r.say(M3.mummyCall, 'Mummy (calling)', 5), 1200);
          }
          if (nearest > 150) farTime += dt;
          else farTime = 0;
          r.extraText = nearest < 150 ? `Baraat ${Math.round(nearest)} m peeche` : 'Baraat chhoot gayi! Godown chalo.';
          return farTime > 2 || (v === thar && thar !== null && thar.position.distanceTo(godown) < 12);
        },
        () => godown,
      ),
      goTo('Thaar ko Kachra Ghat godown pahuncho', () => godown, { inVehicle: 'thar', stop: true, radius: 12 }),
      action((r) => {
        for (const c of cars) c.ai = null;
        r.extraText = '';
      }),
    ];
  },
};
