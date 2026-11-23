import { WEBGL_MISSING } from './content/errors';
import { Engine } from './core/Engine';
import type { GameSystem } from './core/System';
import { Player } from './player/Player';
import { ThirdPersonCamera } from './player/ThirdPersonCamera';
import { DebugGui } from './ui/DebugGui';
import { createActionReadout, showError, showHint, showLoading } from './ui/overlay';
import { TestLevel } from './world/TestLevel';

function hasWebGL(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

async function boot(): Promise<void> {
  window.addEventListener('error', (e) => showError(e.error ?? e.message));
  window.addEventListener('unhandledrejection', (e) => showError(e.reason));

  if (!hasWebGL()) {
    showError('WebGL2 unavailable', WEBGL_MISSING);
    return;
  }

  const loading = showLoading();
  const engine = await Engine.create(document.getElementById('game')!);
  await engine.add(new DebugGui(engine));
  await engine.add(new TestLevel());
  await engine.add(new ThirdPersonCamera());
  await engine.add(new Player());

  const readout = createActionReadout();
  const actionReadout: GameSystem = {
    name: 'actionReadout',
    update: () => readout(engine.ctx.input.activeActions()),
  };
  await engine.add(actionReadout);

  engine.start();
  loading.hide();
  showHint();
}

boot().catch((err) => showError(err));
