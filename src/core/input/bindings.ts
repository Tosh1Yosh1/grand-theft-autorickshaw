/**
 * Action -> physical inputs. Codes are KeyboardEvent.code values, or Mouse0/1/2.
 * Kept as plain data so the Settings rebinding screen can edit and persist it later.
 */
export const ACTIONS = [
  'moveForward',
  'moveBack',
  'moveLeft',
  'moveRight',
  'jump',
  'sprint',
  'crouch',
  'interact',
  'horn',
  'meter',
  'tamperMeter',
  'attack',
  'weaponNext',
  'weaponPrev',
  'toggleDebug',
  'debugSpawnBoxes',
  'debugReset',
] as const;

export type Action = (typeof ACTIONS)[number];
export type Bindings = Record<Action, string[]>;

export const DEFAULT_BINDINGS: Bindings = {
  moveForward: ['KeyW', 'ArrowUp'],
  moveBack: ['KeyS', 'ArrowDown'],
  moveLeft: ['KeyA', 'ArrowLeft'],
  moveRight: ['KeyD', 'ArrowRight'],
  jump: ['Space'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  crouch: ['KeyC', 'ControlLeft'],
  interact: ['KeyF'],
  horn: ['KeyH'],
  meter: ['KeyM'],
  tamperMeter: ['KeyT'],
  attack: ['Mouse0'],
  weaponNext: ['KeyE'],
  weaponPrev: ['KeyQ'],
  toggleDebug: ['Backquote'],
  debugSpawnBoxes: ['KeyB'],
  debugReset: ['KeyR'],
};
