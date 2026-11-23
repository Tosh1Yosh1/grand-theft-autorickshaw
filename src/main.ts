import * as THREE from 'three';
import { Animals } from './ai/animals/Animals';
import { StreetEvents } from './ai/events/StreetEvents';
import { Pedestrians } from './ai/peds/Pedestrians';
import { Traffic } from './ai/traffic/Traffic';
import { Combat } from './combat/Combat';
import { WEBGL_MISSING } from './content/errors';
import { Engine } from './core/Engine';
import { PostFX } from './core/PostFX';
import type { GameSystem } from './core/System';
import { Player } from './player/Player';
import { PlayerHealth } from './player/PlayerHealth';
import { Police } from './wanted/Police';
import { Wanted } from './wanted/Wanted';
import { updateHud } from './ui/hud';
import { DISTRICT_INFO } from './content/hoardings';
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
  await engine.add(new Pedestrians());
  await engine.add(new Traffic());
  await engine.add(new Animals());
  await engine.add(new StreetEvents());
  const combat = new Combat();
  await engine.add(combat);
  await engine.add(new Wanted());
  await engine.add(new Police());
  await engine.add(new PlayerHealth());
  // Weapon pickups near home to get started.
  combat.addPickup('bat', new THREE.Vector3(SPAWN.x + 8, 0, SPAWN.z + 0.5));
  combat.addPickup('slingshot', new THREE.Vector3(SPAWN.x - 10, 0, SPAWN.z + 0.5));
  const sh = city.landmarks.safehouse;
  await engine.add(new Parcels(new THREE.Vector3(sh.x + 6, 0, sh.z + 1)));

  const readout = createActionReadout();
  const services = engine.ctx.services;
  const actionReadout: GameSystem = {
    name: 'hud',
    priority: 110,
    update: () => {
      readout(engine.ctx.input.activeActions());
      updateHud({
        seen: services.wanted?.seen ?? false,
        clock: services.dayNight?.clockText ?? '',
        district: DISTRICT_INFO[services.city?.currentDistrict ?? 'jugaadpur']?.name ?? '',
      });
    },
  };
  await engine.add(actionReadout);

  // Handy for console poking and automated smoke tests.
  Object.assign(window, { gtar: engine.ctx, gtarEngine: engine });

  engine.start();
  loading.hide();
  showHint();
}

boot().catch((err) => showError(err));
