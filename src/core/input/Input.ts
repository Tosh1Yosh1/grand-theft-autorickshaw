import { ACTIONS, DEFAULT_BINDINGS, type Action, type Bindings } from './bindings';
import { GamepadSource } from './Gamepad';

/**
 * Action-based input. Game code asks "is jump down?", never "is Space down?".
 * Call endFrame() once per rendered frame to clear pressed/released edges and mouse delta.
 */
export class Input {
  private codesDown = new Set<string>();
  private down = new Set<Action>();
  private pressed = new Set<Action>();
  private released = new Set<Action>();
  private codeToActions = new Map<string, Action[]>();
  readonly gamepad = new GamepadSource();

  /** Mouse movement since last frame, in pixels. Only accumulates while pointer is locked. */
  readonly mouseDelta = { x: 0, y: 0 };

  constructor(
    private readonly target: HTMLElement,
    bindings: Bindings = DEFAULT_BINDINGS,
  ) {
    this.setBindings(bindings);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    target.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    target.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  setBindings(bindings: Bindings): void {
    this.codeToActions.clear();
    for (const action of ACTIONS) {
      for (const code of bindings[action]) {
        const list = this.codeToActions.get(code) ?? [];
        list.push(action);
        this.codeToActions.set(code, list);
      }
    }
  }

  get pointerLocked(): boolean {
    return document.pointerLockElement === this.target;
  }

  requestPointerLock(): void {
    if (!this.pointerLocked) this.target.requestPointerLock?.();
  }

  isDown(action: Action): boolean {
    return this.down.has(action);
  }
  wasPressed(action: Action): boolean {
    return this.pressed.has(action);
  }
  wasReleased(action: Action): boolean {
    return this.released.has(action);
  }
  /** -1..1 from two opposing actions, e.g. axis('moveLeft', 'moveRight'). */
  axis(negative: Action, positive: Action): number {
    return (this.isDown(positive) ? 1 : 0) - (this.isDown(negative) ? 1 : 0);
  }
  activeActions(): Action[] {
    return [...this.down];
  }

  /** Call at the start of every frame, before systems read input. */
  beginFrame(): void {
    this.gamepad.poll(
      (c) => this.press(c),
      (c) => this.release(c),
      (dx, dy) => {
        this.mouseDelta.x += dx;
        this.mouseDelta.y += dy;
      },
    );
  }

  endFrame(): void {
    this.pressed.clear();
    this.released.clear();
    this.mouseDelta.x = 0;
    this.mouseDelta.y = 0;
  }

  private press(code: string): void {
    if (this.codesDown.has(code)) return; // key repeat
    this.codesDown.add(code);
    for (const a of this.codeToActions.get(code) ?? []) {
      if (!this.down.has(a)) this.pressed.add(a);
      this.down.add(a);
    }
  }

  private release(code: string): void {
    if (!this.codesDown.delete(code)) return;
    for (const a of this.codeToActions.get(code) ?? []) {
      // Only release if no other bound code is still held.
      const stillHeld = [...this.codesDown].some((c) => this.codeToActions.get(c)?.includes(a));
      if (!stillHeld) {
        this.down.delete(a);
        this.released.add(a);
      }
    }
  }

  private isTyping(e: Event): boolean {
    const el = e.target as HTMLElement | null;
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA');
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.isTyping(e)) return;
    if (this.codeToActions.has(e.code) && e.code !== 'F5' && e.code !== 'F12') e.preventDefault();
    this.press(e.code);
  };
  private onKeyUp = (e: KeyboardEvent): void => this.release(e.code);
  private onMouseDown = (e: MouseEvent): void => this.press(`Mouse${e.button}`);
  private onMouseUp = (e: MouseEvent): void => this.release(`Mouse${e.button}`);
  private onMouseMove = (e: MouseEvent): void => {
    if (!this.pointerLocked) return;
    this.mouseDelta.x += e.movementX;
    this.mouseDelta.y += e.movementY;
  };
  private onBlur = (): void => {
    for (const code of [...this.codesDown]) this.release(code);
  };
}
