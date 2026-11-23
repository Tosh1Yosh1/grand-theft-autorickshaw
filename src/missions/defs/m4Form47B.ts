import * as THREE from 'three';
import { M4 } from '../../content/missions2';
import { showSubtitle } from '../../ui/subtitles';
import type { MissionDef, Step } from '../types';
import { action, goTo, until } from '../steps';
import { counter, sidewalk } from './helpers';

const COSTS: Record<string, number> = { bijli: 100, peon: 50 };

/** Mission 4: one stamp that needs five other stamps. */
export const Form47B: MissionDef = {
  id: 'm4',
  title: M4.title,
  tagline: M4.tagline,
  requires: ['m3'],
  start: ({ landmarks }) => landmarks.sarkariDaftar.clone().add(new THREE.Vector3(-6, 0, 0)),
  intro: M4.intro,
  outro: M4.outro,
  reward: { money: 5000, respect: 60 },
  steps: (run) => {
    const lm = run.services.city!.landmarks;
    const spots: Record<string, THREE.Vector3> = {
      ration: sidewalk(3, 6, 0.3),
      bijli: sidewalk(7, 2, 0.6),
      police: sidewalk(8, 4, 0.4),
      notary: sidewalk(1, 2, 0.5),
      peon: lm.sarkariDaftar.clone().add(new THREE.Vector3(14, 0.15, 0)),
    };
    let stamps = 0;
    const steps: Step[] = [
      action((r) => {
        r.timer = 420;
        for (const s of M4.stops) {
          counter(r, spots[s.key]!.clone().add(new THREE.Vector3(0, -0.15, 1.2)), s.name.toUpperCase());
          const clerk = r.ped(s.key === 'police' ? 'cop' : 'clerk', spots[s.key]!.clone().add(new THREE.Vector3(0, 0, 2)), Math.PI);
          if (clerk) clerk.anim = s.key === 'peon' ? 'sitting' : 'idle';
        }
      }),
    ];
    for (const s of M4.stops) {
      steps.push(
        goTo(() => `${s.name} se stamp lo (${stamps}/5)`, () => spots[s.key]!, { radius: 4.5, stop: true }),
      );
      if (s.key === 'peon') {
        let waited = 0;
        steps.push(
          until(
            () => `${M4.peonWait} (${Math.max(0, Math.ceil(20 - waited))}s)`,
            (r, dt) => {
              waited += dt;
              if (r.consumeInteract()) {
                const st = r.ctx.store.getState();
                if (st.player.money >= COSTS.peon!) {
                  st.setPlayer({ money: st.player.money - COSTS.peon! });
                  return true;
                }
              }
              return waited > 20;
            },
            () => spots.peon!,
          ),
        );
      }
      steps.push(
        action((r) => {
          const cost = s.key === 'bijli' ? COSTS.bijli! : 0;
          if (cost) {
            const st = r.ctx.store.getState();
            st.setPlayer({ money: st.player.money - cost });
            showSubtitle(`${M4.bribe}₹${cost}`, 'Pappu');
          }
          r.say(s.lines, s.who, 4);
          stamps++;
          r.extraText = `Stamps: ${stamps}/5 ${'🟣'.repeat(stamps)}`;
        }),
      );
    }
    steps.push(
      until(
        'Sarkari Daftar, Window 3 pe wapas jao',
        (r) => {
          if (r.timer === 0) return { fail: M4.closed };
          const p = r.playerPos;
          return Math.hypot(p.x - lm.sarkariDaftar.x, p.z - lm.sarkariDaftar.z) < 6;
        },
        () => lm.sarkariDaftar,
      ),
    );
    // The office-hours timer applies throughout.
    return steps.map((st) => ({
      ...st,
      update: (r, dt) => (r.timer === 0 ? { fail: M4.closed } : st.update(r, dt)),
    }));
  },
};
