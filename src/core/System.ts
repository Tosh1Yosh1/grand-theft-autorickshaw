import type * as THREE from 'three';
import type { EventBus } from './EventBus';
import type { Input } from './input/Input';
import type { Physics } from './Physics';
import type { Services } from './services';
import type { store } from './store';

/** Everything a system may need. Passed once at init. */
export interface GameContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  physics: Physics;
  input: Input;
  events: EventBus;
  store: typeof store;
  services: Services;
  /** Gameplay time scale (slow-mo slaps, cutscenes). Multiplies with the debug time scale. */
  clock: { scale: number };
}

/**
 * A pluggable piece of the game. fixedUpdate runs at 60 Hz before each physics step;
 * update runs once per rendered frame (dt is scaled by debug time scale).
 */
export interface GameSystem {
  readonly name: string;
  /** Lower runs first each frame. Default 0. Cameras use 100 so they see final positions. */
  readonly priority?: number;
  init?(ctx: GameContext): void | Promise<void>;
  fixedUpdate?(dt: number): void;
  update?(dt: number): void;
  dispose?(): void;
}
