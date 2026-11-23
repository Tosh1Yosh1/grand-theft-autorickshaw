import * as THREE from 'three';
import { Animals } from './ai/animals/Animals';
import { StreetEvents } from './ai/events/StreetEvents';
import { Pedestrians } from './ai/peds/Pedestrians';
import { Traffic } from './ai/traffic/Traffic';
import { Radio } from './audio/Radio';
import { Combat } from './combat/Combat';
import { saveGame } from './core/save';
import { Minimap } from './ui/Minimap';
import { PauseMenu } from './ui/menu/PauseMenu';
import { MainMenu } from './ui/menu/MainMenu';
import { LOADING_STEPS } from './content/menu';
import { Phone } from './ui/phone/Phone';
import { Shops } from './world/Shops';
import { rankOf } from './missions/MissionManager';
import { MissionManager } from './missions/MissionManager';
import { MeterDown } from './missions/defs/m1MeterDown';
import { DabbaDash } from './missions/defs/m2DabbaDash';
import { Shaadi } from './missions/defs/m3Shaadi';
import { Form47B } from './missions/defs/m4Form47B';
import { ItemNumber } from './missions/defs/m5ItemNumber';
import { Showdown } from './missions/defs/m6Showdown';
import { FlyoverRace, FoodDelivery, Godman } from './missions/defs/hustles';
import { Fares } from './missions/Fares';
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
  let stepI = 0;
  const step = async () => {
    loading.step(LOADING_STEPS[stepI++ % LOADING_STEPS.length]!);
    await nextFrame();
  };
  await step();
  const engine = await Engine.create(document.getElementById('game')!);
  await step();
  await engine.add(new DebugGui(engine));
  await engine.add(new Potholes());
  const city = new City();
  await engine.add(city);
  await step();
  await engine.add(new DayNight(engine));
  await engine.add(new PostFX(engine));
  await engine.add(new ThirdPersonCamera());
  const spawn = new THREE.Vector3(SPAWN.x, 0.2, SPAWN.z);
  await engine.add(new Player(spawn));
  const vehicles = new VehicleManager();
  await engine.add(vehicles);
  vehicles.spawn('auto', new THREE.Vector3(SPAWN.x + 1, 0.8, SPAWN.z - 5), Math.PI / 2);
  // A bike outside home, and the secret bullock cart deep in a Jugaadpur gali.
  vehicles.spawn('bike', new THREE.Vector3(SPAWN.x - 6, 0.8, SPAWN.z - 4.5), Math.PI / 2);
  vehicles.spawn('cart', new THREE.Vector3(-300 + 2 * 60 + 30, 1, -300 + 6 * 60 + 30), 0);
  await step();
  await engine.add(new Pedestrians());
  await engine.add(new Traffic());
  await engine.add(new Animals());
  await engine.add(new StreetEvents());
  await step();
  const combat = new Combat();
  await engine.add(combat);
  await engine.add(new Wanted());
  await engine.add(new Police());
  await engine.add(new PlayerHealth());
  await engine.add(new MissionManager([MeterDown, DabbaDash, Shaadi, Form47B, ItemNumber, Showdown, FlyoverRace, FoodDelivery, Godman]));
  await engine.add(new Fares());
  await engine.add(new Radio());
  await engine.add(new Phone());
  await engine.add(new Minimap());
  await engine.add(new Shops());
  const pause = new PauseMenu();
  await engine.add(pause);
  // Weapon pickups near home to get started.
  combat.addPickup('bat', new THREE.Vector3(SPAWN.x + 8, 0, SPAWN.z + 0.5));
  combat.addPickup('slingshot', new THREE.Vector3(SPAWN.x - 10, 0, SPAWN.z + 0.5));
  const sh = city.landmarks.safehouse;
  await engine.add(new Parcels(new THREE.Vector3(sh.x + 14, 0, sh.z + 1)));

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
        rank: rankOf(engine.ctx.store.getState().player.respect),
      });
    },
  };
  await engine.add(actionReadout);

  // Handy for console poking and automated smoke tests.
  Object.assign(window, { gtar: engine.ctx, gtarEngine: engine });

  // Progress: the main menu offers Continue; autosave after missions and every 2 minutes when calm.
  await engine.add(new MainMenu(pause));
  engine.ctx.events.on('mission:passed', () => saveGame(engine.ctx));
  setInterval(() => {
    if (!services.missions?.run && (services.wanted?.level ?? 0) === 0) saveGame(engine.ctx);
  }, 120000);

  engine.start();
  loading.hide();
  engine.ctx.events.on('game:start', () => showHint());
}

boot().catch((err) => showError(err));
