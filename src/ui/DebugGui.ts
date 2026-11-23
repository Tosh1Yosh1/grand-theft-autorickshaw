import GUI from 'lil-gui';
import type { Engine } from '../core/Engine';
import type { GraphicsPreset } from '../core/store';
import type { GameContext, GameSystem } from '../core/System';

/** lil-gui panel, toggled with ` (Backquote). Bound to the zustand store. */
export class DebugGui implements GameSystem {
  readonly name = 'debugGui';
  private gui!: GUI;
  private ctx!: GameContext;

  constructor(private readonly engine: Engine) {}

  init(ctx: GameContext): void {
    this.ctx = ctx;
    const { store, events } = ctx;
    this.gui = new GUI({ title: 'Bhaukaal Debug (`)' });
    this.gui.domElement.style.zIndex = '10';

    const stats = this.gui.addFolder('Stats');
    for (const key of ['fps', 'frameMs', 'drawCalls', 'triangles', 'bodies'] as const) {
      stats.add(this.engine.stats, key).listen().disable();
    }

    // Proxy object mirrors store state; onChange writes back to the store.
    const s = store.getState();
    const proxy = {
      potato: s.settings.graphics === 'potato',
      preset: s.settings.graphics,
      profanity: s.settings.profanity,
      mouseSensitivity: s.settings.mouseSensitivity,
      invertY: s.settings.invertY,
      timeScale: s.debug.timeScale,
      paused: s.debug.paused,
      physicsWireframe: s.debug.physicsWireframe,
      spawn10: () => events.emit('debug:spawnBoxes', { count: 10 }),
      spawn50: () => events.emit('debug:spawnBoxes', { count: 50 }),
      reset: () => events.emit('debug:resetLevel'),
    };

    const gfx = this.gui.addFolder('Graphics');
    const potatoCtl = gfx.add(proxy, 'potato').name('Potato PC mode').onChange((v: boolean) => {
      store.getState().setSettings({ graphics: v ? 'potato' : 'normal' });
    });
    const presetCtl = gfx
      .add(proxy, 'preset', ['potato', 'normal', 'ultra'] satisfies GraphicsPreset[])
      .name('Preset')
      .onChange((v: GraphicsPreset) => store.getState().setSettings({ graphics: v }));

    const settings = this.gui.addFolder('Settings');
    settings.add(proxy, 'profanity').name('Profanity (gaali)').onChange((v: boolean) => store.getState().setSettings({ profanity: v }));
    settings.add(proxy, 'mouseSensitivity', 0.1, 3, 0.05).name('Mouse sensitivity')
      .onChange((v: number) => store.getState().setSettings({ mouseSensitivity: v }));
    settings.add(proxy, 'invertY').name('Invert Y').onChange((v: boolean) => store.getState().setSettings({ invertY: v }));

    const time = this.gui.addFolder('Time');
    time.add(proxy, 'timeScale', 0, 3, 0.05).name('Time scale').onChange((v: number) => store.getState().setDebug({ timeScale: v }));
    time.add(proxy, 'paused').name('Paused').onChange((v: boolean) => store.getState().setDebug({ paused: v }));

    const phys = this.gui.addFolder('Physics');
    phys.add(proxy, 'physicsWireframe').name('Collider wireframe')
      .onChange((v: boolean) => store.getState().setDebug({ physicsWireframe: v }));
    phys.add(proxy, 'spawn10').name('Drop 10 parcels (B)');
    phys.add(proxy, 'spawn50').name('Drop 50 parcels');
    phys.add(proxy, 'reset').name('Reset level (R)');

    // Keep the graphics controls in sync if something else changes the preset.
    store.subscribe((st) => {
      proxy.potato = st.settings.graphics === 'potato';
      proxy.preset = st.settings.graphics;
      potatoCtl.updateDisplay();
      presetCtl.updateDisplay();
    });

    this.setVisible(s.debug.visible);
  }

  update(): void {
    const { input, store } = this.ctx;
    if (input.wasPressed('toggleDebug')) {
      const visible = !store.getState().debug.visible;
      store.getState().setDebug({ visible });
      this.setVisible(visible);
      if (visible) document.exitPointerLock?.();
    }
  }

  private setVisible(v: boolean): void {
    this.gui.show(v);
  }

  dispose(): void {
    this.gui.destroy();
  }
}
