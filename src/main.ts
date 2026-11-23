import * as THREE from 'three';
import { WEBGL_MISSING } from './content/errors';
import { Engine } from './core/Engine';
import { PostFX } from './core/PostFX';
import type { GameSystem } from './core/System';
import { Player } from './player/Player';
import { ThirdPersonCamera } from './player/ThirdPersonCamera';
import { DebugGui } from './ui/DebugGui';
import { createActionReadout, showError, showHint, showLoading } from './ui/overlay';
import { VehicleManager } from './vehicles/VehicleManager';
import { City } from './world/City';
import { SPAWN } from './world/city/layout';
import { DayNight } from './world/DayNight';
import { Parcels } from './world/Parcels';
import { Potholes } from './world/Potholes';

function hasWebGL(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

/** Let the loading screen paint before heavy synchronous work. */
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

async function boot(): Promise<void> {
  window.addEventListener('error', (e) => showError(e.error ?? e.message));
  window.addEventListener('unhandledrejection', (e) => showError(e.reason));

  if (!hasWebGL()) {
    showError('WebGL2 unavailable', WEBGL_MISSING);
    return;
  }

  const loading = showLoading();
  await nextFrame();
  const engine = await Engine.create(document.getElementById('game')!);
  await engine.add(new DebugGui(engine));
  await engine.add(new Potholes());
  const city = new City();
  await engine.add(city);
  await engine.add(new DayNight(engine));
  await engine.add(new PostFX(engine));
  await engine.add(new ThirdPersonCamera());
  const spawn = new THREE.Vector3(SPAWN.x, 0.2, SPAWN.z);
  await engine.add(new Player(spawn));
  const vehicles = new VehicleManager();
  await engine.add(vehicles);
  vehicles.spawn('auto', new THREE.Vector3(SPAWN.x + 1, 0.8, SPAWN.z - 5), Math.PI / 2);
  const sh = city.landmarks.safehouse;
  await engine.add(new Parcels(new THREE.Vector3(sh.x + 6, 0, sh.z + 1)));

  const readout = createActionReadout();
  const actionReadout: GameSystem = {
    name: 'actionReadout',
    update: () => readout(engine.ctx.input.activeActions()),
  };
  await engine.add(actionReadout);

  // Handy for console poking and automated smoke tests.
  Object.assign(window, { gtar: engine.ctx, gtarEngine: engine });

  engine.start();
  loading.hide();
  showHint();
}

boot().catch((err) => showError(err));
