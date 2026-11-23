# Grand Theft Auto-Rickshaw: Mumbhai Bhaukaal

A browser-based, open-world, third-person action-comedy. Pappu "Bhaukaal" Pandey, auto driver
with too many EMIs, wants to become the biggest bhai of Mumbhai. 18+ (gaali, cartoon violence,
behind a profanity toggle). Every asset is original, procedural or CC0.

> Status: see the draft PR for the phase-by-phase log and how to test each phase.

## Run it

Needs Node 20+.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
npm run preview    # serve dist/ locally
npm run typecheck
npm run lint
```

## Controls

| Key | Action |
| --- | --- |
| Click | Lock mouse (camera) |
| W A S D | Move |
| Shift | Sprint |
| Space | Jump (hold for higher) |
| C | Crouch |
| F | Get in / out of a vehicle |
| W / S (in vehicle) | Gas / brake, then reverse |
| A / D (in vehicle) | Steer |
| Space (in vehicle) | Handbrake (drift) |
| H | Horn (hold) |
| M / T | Auto meter down-up / tamper (3x fare) |
| B / R | Drop parcels / reset test level |
| \` | Debug panel |
| Esc | Release mouse |

## Debug panel (`)

- **Stats**: fps, frame time, draw calls, triangles, physics bodies.
- **Graphics**: *Potato PC mode* toggle and Potato / Normal / Ultra preset (pixel ratio, shadows, fog distance). Saved to localStorage.
- **Settings**: profanity toggle, mouse sensitivity, invert Y.
- **Time**: time scale, pause.
- **Physics**: collider wireframe, drop parcels, reset.
- **Player**: speeds, accel/decel, air control, jump height, gravity, coyote time, jump buffer, turn speed; *Copy tuning JSON* to paste good values back into `PLAYER_TUNING`.
- **Camera**: FOV, sprint FOV kick, follow sharpness.
- **NPCs**: ped / traffic density, wrong-way chance, cow and dog counts, spawn a cow in front of you, start an angry mob.
- **Street events**: toggle random events, start any event, end all.
- **Time of day**: scrub the hour, change cycle length (default 12 real minutes), freeze time.
- **Post FX**: warmth, contrast, saturation, vignette, grain.
- **Graphics → Retro 2004 look**: low internal resolution with nearest-neighbour upscale, posterised colour, heavier smog.

## Project layout

```
src/
  core/        Engine (renderer, fixed 60 Hz loop), Physics (Rapier + interpolation),
               store (zustand vanilla), safeStorage, EventBus, graphics presets
    input/     Action-based input, data-driven bindings, gamepad stub
               PostFX: bloom, warm split-tone grade, vignette, grain, Retro 2004 posterise
  world/       City (chunked generation + culling), DayNight (sky dome, sun, night uniforms), Potholes, Parcels
    city/      layout (grid, districts, road graph), district generators, roads/wires/flyover/stalls,
               world-space facade shader (windows, shutters, lit-at-night), sign atlas (all signs = 1 draw call)
  ui/          HTML overlay: loading screen, error screen, hints, lil-gui debug panel
  content/     ALL text: loading tips, error quips, labels. Lines can be {dirty, clean}.
  player/      Pappu: procedural model, animator, kinematic controller, third-person camera
  vehicles/    Vehicle (Rapier raycast vehicle + arcade assists), configs, procedural models, fare meter, manager
  audio/       Procedural WebAudio: horns, engines, thuds, beeps
  ai/          rig/ (RigInstancer: jointed crowds as one InstancedMesh per part; ModelInstancer: vehicles
               baked per material), peds/ (6 pedestrian types, sidewalks, jaywalking, knockdowns, mobs),
               traffic/ (left-hand lanes on the road graph, honking, wrong-way, overtakes, wrecks),
               animals/ (cows, street dogs), events/ (baraat, gully cricket, monsoon, digging, rally, rain)
  combat/ wanted/ missions/ assets/   (filled in later phases)
```

### Conventions

- Systems implement `GameSystem` (`init`, `fixedUpdate`, `update`, `dispose`) and are added with `engine.add()`.
- Game code reads **actions** (`input.isDown('jump')`), never raw keys. Bindings live in `src/core/input/bindings.ts`.
- Any line that may swear is a `{ dirty, clean }` pair, resolved with `pickLine()` / `resolveLine()` from `src/content/lines.ts`.
- Assets: CC0 only. Log every third-party asset in `ASSETS_CREDITS.md`; missing ones go in `TODO_ASSETS.md`.

## Mumbhai map

10x10 grid of 60 m blocks (600 m square), roads every 60 m, docks and sea to the south.

| District | Where | Flavour |
| --- | --- | --- |
| Jugaadpur | centre/west | Pastel chawls, galis, balconies, laundry, string lights, tapris |
| Startup Nagar | north-east | Glass towers, rooftop startup logos, ₹400 vada pav |
| Filmistan | north-west | Studio sheds, fake palace sets |
| Sarkari Colony | east | Identical colony blocks, the Sarkari Daftar |
| Kachra Ghat | south | Godowns, containers, cranes, the sea |

A half-built flyover runs east-west across the north and stops in mid-air.

## Tech

Vite, TypeScript (strict), Three.js, Rapier (`@dimforge/rapier3d-compat`), howler.js, lil-gui, zustand.

## Legal-ish

This is an original parody. It is not affiliated with, and contains no assets from, Rockstar Games or the GTA series.
All characters, brands and places are fictional.
