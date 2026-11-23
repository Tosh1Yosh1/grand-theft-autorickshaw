import type * as THREE from 'three';
import type { MissionRun } from './MissionRun';
import type { Step, StepResult } from './types';

/** Reach a point (optionally in a vehicle, optionally stopped). */
export function goTo(text: string | (() => string), where: () => THREE.Vector3, opts: { radius?: number; inVehicle?: string | 'any'; stop?: boolean; onArrive?: (run: MissionRun) => void } = {}): Step {
  const radius = opts.radius ?? 6;
  return {
    objective: text,
    target: where,
    update(run): StepResult {
      const vm = run.services.vehicles;
      const v = vm?.current;
      if (opts.inVehicle && (!v || (opts.inVehicle !== 'any' && v.config.id !== opts.inVehicle))) return 'running';
      const p = run.playerPos;
      const w = where();
      if (Math.hypot(p.x - w.x, p.z - w.z) > radius) return 'running';
      if (opts.stop && v && Math.abs(v.speed) > 2) return 'running';
      opts.onArrive?.(run);
      return 'done';
    },
  };
}

/** Wait until a condition is true. */
export function until(text: string | (() => string), cond: (run: MissionRun, dt: number) => StepResult | boolean, target?: () => THREE.Vector3 | null): Step {
  return {
    objective: text,
    target,
    update(run, dt) {
      const r = cond(run, dt);
      return r === true ? 'done' : r === false ? 'running' : r;
    },
  };
}

/** Run something once and move on. */
export function action(fn: (run: MissionRun) => void | Promise<void>): Step {
  let done = false;
  return {
    objective: '',
    async start(run) {
      await fn(run);
      done = true;
    },
    update: () => (done ? 'done' : 'running'),
  };
}
