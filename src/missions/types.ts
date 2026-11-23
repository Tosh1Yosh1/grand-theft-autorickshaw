import type * as THREE from 'three';
import type { DialogueLine } from '../content/missions';
import type { WeaponId } from '../core/store';
import type { MissionRun } from './MissionRun';

export type StepResult = 'running' | 'done' | { fail: string };

/** One objective. Steps run in order; each can show a target beam and a HUD line. */
export interface Step {
  objective: string | (() => string);
  /** World position for the beam/arrow, or null. */
  target?: () => THREE.Vector3 | null;
  start?(run: MissionRun): void | Promise<void>;
  update(run: MissionRun, dt: number): StepResult;
}

export interface MissionDef {
  id: string;
  title: string;
  tagline: string;
  /** Where the start marker sits. */
  start(run: { landmarks: import('../world/city/districts').Landmarks }): THREE.Vector3;
  requires: string[];
  /** Side hustles repeat and use cyan markers. */
  repeatable?: boolean;
  intro: readonly DialogueLine[];
  outro: readonly DialogueLine[];
  steps(run: MissionRun): Step[];
  reward: { money: number | ((run: MissionRun) => number); respect: number; weapon?: WeaponId; vehicle?: string };
}
