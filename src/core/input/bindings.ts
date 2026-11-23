/**
 * Action -> physical inputs. Codes are KeyboardEvent.code values, Mouse0/1/2, or gamepad
 * pseudo-codes from Gamepad.ts: Pad0..Pad15 (standard-mapping buttons), PadLX-/PadLX+/PadLY-/PadLY+ (left stick).
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
  'skip',
  'phone',
  'radio',
  'pause',
  'toggleDebug',
  'debugSpawnBoxes',
  'debugReset',
] as const;

export type Action = (typeof ACTIONS)[number];
export type Bindings = Record<Action, string[]>;

export const DEFAULT_BINDINGS: Bindings = {
  moveForward: ['KeyW', 'ArrowUp', 'PadLY-', 'Pad7'],
  moveBack: ['KeyS', 'ArrowDown', 'PadLY+', 'Pad6'],
  moveLeft: ['KeyA', 'ArrowLeft', 'PadLX-'],
  moveRight: ['KeyD', 'ArrowRight', 'PadLX+'],
  jump: ['Space', 'Pad0'],
  sprint: ['ShiftLeft', 'ShiftRight', 'Pad10'],
  crouch: ['KeyC', 'ControlLeft', 'Pad1'],
  interact: ['KeyF', 'Pad3'],
  horn: ['KeyH', 'Pad11'],
  meter: ['KeyM', 'Pad12'],
  tamperMeter: ['KeyT', 'Pad13'],
  attack: ['Mouse0', 'Pad2'],
  weaponNext: ['KeyE', 'Pad5'],
  weaponPrev: ['KeyQ', 'Pad4'],
  skip: ['Enter', 'Backspace'],
  phone: ['KeyP', 'Tab', 'Pad8'],
  radio: ['KeyR', 'Pad15'],
  pause: ['Pad9'], // Esc is handled by the pause menu directly (browsers eat it under pointer lock)
  toggleDebug: ['Backquote'],
  debugSpawnBoxes: ['KeyB'],
  debugReset: ['F8'],
};
