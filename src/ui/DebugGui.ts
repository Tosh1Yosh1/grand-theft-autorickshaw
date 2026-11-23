import type { Engine } from '../core/Engine';
import type { GraphicsPreset } from '../core/store';
import type { GameContext, GameSystem } from '../core/System';
import { debugFolder, debugGui } from './debugPanel';

/** Core debug panel folders (stats, graphics, settings, time, physics). Toggled with `. */
export class DebugGui implements GameSystem {
  readonly name = 'debugGui';
  private ctx!: GameContext;

  constructor(private readonly engine: Engine) {}

  init(ctx: GameContext): void {
    this.ctx = ctx;
    const { store, events } = ctx;
    const set = store.getState();

    const stats = debugFolder('Stats', false);
    for (const key of ['fps', 'frameMs', 'drawCalls', 'triangles', 'bodies'] as const) {
      stats.add(this.engine.stats, key).listen().disable();
    }

    const s = store.getState();
    const proxy = {
      potato: s.settings.graphics === 'potato',
      preset: s.settings.graphics,
      retro: s.settings.retro,
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

    const gfx = debugFolder('Graphics', false);
    const potatoCtl = gfx.add(proxy, 'potato').name('Potato PC mode')
      .onChange((v: boolean) => set.setSettings({ graphics: v ? 'potato' : 'normal' }));
    const presetCtl = gfx.add(proxy, 'preset', ['potato', 'normal', 'ultra'] satisfies GraphicsPreset[]).name('Preset')
      .onChange((v: GraphicsPreset) => set.setSettings({ graphics: v }));
    gfx.add(proxy, 'retro').name('Retro 2004 look').onChange((v: boolean) => set.setSettings({ retro: v }));

    const settings = debugFolder('Settings');
    settings.add(proxy, 'profanity').name('Profanity (gaali)').onChange((v: boolean) => set.setSettings({ profanity: v }));
    settings.add(proxy, 'mouseSensitivity', 0.1, 3, 0.05).name('Mouse sensitivity')
      .onChange((v: number) => set.setSettings({ mouseSensitivity: v }));
    settings.add(proxy, 'invertY').name('Invert Y').onChange((v: boolean) => set.setSettings({ invertY: v }));

    const time = debugFolder('Time');
    time.add(proxy, 'timeScale', 0, 3, 0.05).name('Time scale').onChange((v: number) => set.setDebug({ timeScale: v }));
    time.add(proxy, 'paused').name('Paused').onChange((v: boolean) => set.setDebug({ paused: v }));

    const phys = debugFolder('Physics');
    phys.add(proxy, 'physicsWireframe').name('Collider wireframe').onChange((v: boolean) => set.setDebug({ physicsWireframe: v }));
    phys.add(proxy, 'spawn10').name('Drop 10 parcels (B)');
    phys.add(proxy, 'spawn50').name('Drop 50 parcels');
    phys.add(proxy, 'reset').name('Reset level (R)');

    store.subscribe((st) => {
      proxy.potato = st.settings.graphics === 'potato';
      proxy.preset = st.settings.graphics;
      potatoCtl.updateDisplay();
      presetCtl.updateDisplay();
    });
  }

  update(): void {
    const { input, store } = this.ctx;
    if (input.wasPressed('toggleDebug')) {
      const visible = !store.getState().debug.visible;
      store.getState().setDebug({ visible });
      debugGui().show(visible);
      if (visible) document.exitPointerLock?.();
    }
  }
}
