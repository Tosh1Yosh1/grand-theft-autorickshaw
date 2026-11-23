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
| F | Get in / out of a vehicle · bribe a hawaldar · respray · pay off Netaji |
| Left mouse | Attack (fists: hold 0.5 s + release = slow-mo TIGHT SLAP) |
| Q / E | Previous / next weapon (fists, boomerang chappal, bat, gulel, Mummy ki belan) |
| W / S (in vehicle) | Gas / brake, then reverse |
| A / D (in vehicle) | Steer |
| Space (in vehicle) | Handbrake (drift) |
| H | Horn (hold) |
| M / T | Auto meter down-up / tamper (3x fare) |
| P / Tab | Phone (WhatsUpp, Map + waypoint, Contacts, BOLX) |
| R (in vehicle) | Next radio station / off |
| Esc | Pause menu: settings, controls (rebinding), save, load |
| B / F8 | Debug: drop parcels / reset parcels |
| \` | Debug panel |

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
  ui/          HTML overlay: HUD, minimap, phone/, menu/ (pause + settings + rebinding), dialogue, subtitles,
               loading/error screens, lil-gui debug panel
  content/     ALL text: loading tips, error quips, labels. Lines can be {dirty, clean}.
  player/      Pappu: procedural model, animator, kinematic controller, third-person camera
  vehicles/    Vehicle (Rapier raycast vehicle + arcade assists), configs, procedural models, fare meter, manager
  audio/       Procedural WebAudio: horns, engines, thuds, siren, moo, dhol; MusicEngine (generative station
               music) + Radio (5 stations, ads, ticker, optional browser TTS for hosts)
  ai/          rig/ (RigInstancer: jointed crowds as one InstancedMesh per part; ModelInstancer: vehicles
               baked per material), peds/ (6 pedestrian types, sidewalks, jaywalking, knockdowns, mobs),
               traffic/ (left-hand lanes on the road graph, honking, wrong-way, overtakes, wrecks),
               animals/ (cows, street dogs), events/ (baraat, gully cricket, monsoon, digging, rally, rain)
  combat/      Weapons, melee cones, boomerang chappal + gulel projectiles, slow-mo slap, pickups
  wanted/      Challan system (0-5 chappals, cooling, hiding, bribes/respray/neta) and Police dispatcher
               (hawaldars, bike pair, jeeps, squad, news van, roadblocks, drone, ringtone siren)
  missions/    MissionManager (markers, step machine, objective HUD, target beam, guide arrow, pass/fail,
               rewards, ranks), MissionRun (auto-cleanup of spawned peds/vehicles), steps (goTo/until/action),
               defs/ (one file per mission)
  assets/      (filled in later phases)
```

### Conventions

- Systems implement `GameSystem` (`init`, `fixedUpdate`, `update`, `dispose`) and are added with `engine.add()`.
- Game code reads **actions** (`input.isDown('jump')`), never raw keys. Bindings live in `src/core/input/bindings.ts`.
- Any line that may swear is a `{ dirty, clean }` pair, resolved with `pickLine()` / `resolveLine()` from `src/content/lines.ts`.
- Assets: CC0 only. Log every third-party asset in `ASSETS_CREDITS.md`; missing ones go in `TODO_ASSETS.md`.

## Radio (in any vehicle, R to cycle)

Bhaukaal FM (parody songs + dedications) · Cricket Kranti (the match that never ends) · Astro Aunty Live (Mercury and your saas) · Uncle Gyaan Radio (forward-powered conspiracies) · Startup Sutra Podcast (two bros, one word: disrupt) · plus ads (Fair & Happy, Instant Loan, IIT coaching for your unborn child...). All music is generated live; all scripts are original. Hosts can be read aloud by your browser's text-to-speech (toggle in Settings).

## Saving

Autosaves after every mission and every 2 minutes when no mission or chappals are active. Sleep at Pandey Niwas (F at the door) to save and skip to 7 AM. Pause menu has Save / Load. Loading always wakes Pappu up at home.

## Missions

Walk or drive into an orange light pillar and press **F**. Dialogue: **F**/Space next line, **Enter** skips.

| # | Mission | Start | Notes |
| --- | --- | --- | --- |
| 1 | Meter Down | Pandey Niwas | Auto only. Drive the drunk Startup Bro to Club Pivot; the ulti-meter rises with sharp turns, hard braking, speed, potholes and crashes. Meter down = proper fare; tampered = he notices. |
| 2 | Dabba Dash | Two doors down from Pandey Niwas | 10 tiffins in 4 minutes. Stop at each drop. Dal spills on turns, potholes and crashes; leftover dal = reputation = reward. |
| 3 | Shaadi Mein Zaroor Aana | Denting-Painting shop | Steal the groom's Thaar (Loud Boy included). The baraat chases you, dancing. Lose them, deliver to Kachra Ghat. Reward: Mummy ki belan. |

Ranks by respect: Pappu → Bhai (100) → Don (300) → MLA (600).

## Challan (wanted) levels

| Chappals | Who shows up | Make it go away |
| --- | --- | --- |
| 1 | Hawaldar on foot | Bribe ₹200 (F next to him) |
| 2 | + two cops on a bike | Bribe ₹600 |
| 3 | + jeep with ringtone siren | Bribe ₹2,500 |
| 4 | + Special Squad, Cheekh TV news van | Denting-Painting respray ₹2,000 |
| 5 | + roadblocks, drone, Mummy calls | Netaji: ₹5,000 per chappal |

Heat also cools when no cop sees you; hiding in a baraat or a traffic jam cools it much faster.
Hitting a cow is an instant 3 chappals and an angry mob.

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
