import type { Action } from './bindings';

/**
 * Gamepad support is stubbed for now (keyboard + mouse only).
 * When it lands: poll navigator.getGamepads() here and report pressed actions + stick axes.
 */
export class GamepadSource {
  readonly enabled = false;
  poll(): ReadonlySet<Action> {
    return EMPTY;
  }
}
const EMPTY: ReadonlySet<Action> = new Set();
