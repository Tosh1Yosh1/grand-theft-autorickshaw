const DEADZONE = 0.35;
const LOOK_SPEED = 14; // pseudo-pixels per frame at full right-stick tilt

/**
 * Standard-mapping gamepad (Xbox/PlayStation layouts) turned into pseudo key codes, so
 * the same bindings, rebinding screen and action code serve keyboard and pad alike.
 */
export class GamepadSource {
  /** True once a pad has been touched (combat then works without mouse lock). */
  active = false;
  private down = new Set<string>();

  /** Diff the pad against last frame; report codes that went down/up and right-stick look. */
  poll(press: (code: string) => void, release: (code: string) => void, look: (dx: number, dy: number) => void): void {
    const pad = navigator.getGamepads?.().find((p) => p?.connected && p.mapping === 'standard');
    const now = new Set<string>();
    if (pad) {
      pad.buttons.forEach((b, i) => b.pressed && now.add(`Pad${i}`));
      const [lx = 0, ly = 0, rx = 0, ry = 0] = pad.axes;
      if (lx < -DEADZONE) now.add('PadLX-');
      if (lx > DEADZONE) now.add('PadLX+');
      if (ly < -DEADZONE) now.add('PadLY-');
      if (ly > DEADZONE) now.add('PadLY+');
      const dz = (v: number) => (Math.abs(v) < 0.15 ? 0 : v);
      if (dz(rx) || dz(ry)) look(dz(rx) * LOOK_SPEED, dz(ry) * LOOK_SPEED);
      if (now.size) this.active = true;
    }
    for (const c of now) if (!this.down.has(c)) press(c);
    for (const c of this.down) if (!now.has(c)) release(c);
    this.down = now;
  }
}
