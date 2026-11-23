# Grand Theft Auto-Rickshaw: Mumbhai Bhaukaal

A browser-based, open-world, third-person action-comedy. Pappu "Bhaukaal" Pandey, auto driver
with too many EMIs, wants to become the biggest bhai of Mumbhai. 18+ (gaali, cartoon violence,
behind a profanity toggle). Every asset is original, procedural or CC0.

> Status: **Phase 0** — engine skeleton, input, physics, debug panel, a test ground full of
> very fragile Pandey Logistics parcels.

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

## Controls (Phase 0)

| Key | Action |
| --- | --- |
| Click | Lock mouse, look around |
| W A S D | Fly camera |
| E / Q | Up / down |
| Shift | Fly faster |
| B | Drop 10 parcels |
| R | Reset test level |
| \` | Debug panel |
| Esc | Release mouse |

## Debug panel (`)

- **Stats**: fps, frame time, draw calls, triangles, physics bodies.
- **Graphics**: *Potato PC mode* toggle and Potato / Normal / Ultra preset (pixel ratio, shadows, fog distance). Saved to localStorage.
- **Settings**: profanity toggle, mouse sensitivity, invert Y.
- **Time**: time scale, pause.
- **Physics**: collider wireframe, drop parcels, reset.

## Project layout

```
src/
  core/        Engine (renderer, fixed 60 Hz loop), Physics (Rapier + interpolation),
               store (zustand vanilla), safeStorage, EventBus, graphics presets
    input/     Action-based input, data-driven bindings, gamepad stub
    debug/     Phase 0 fly camera
  world/       Levels and props (procedural)
  ui/          HTML overlay: loading screen, error screen, hints, lil-gui debug panel
  content/     ALL text: loading tips, error quips, labels. Lines can be {dirty, clean}.
  player/ vehicles/ ai/ combat/ wanted/ missions/ audio/ assets/   (filled in later phases)
```

### Conventions

- Systems implement `GameSystem` (`init`, `fixedUpdate`, `update`, `dispose`) and are added with `engine.add()`.
- Game code reads **actions** (`input.isDown('jump')`), never raw keys. Bindings live in `src/core/input/bindings.ts`.
- Any line that may swear is a `{ dirty, clean }` pair, resolved with `pickLine()` / `resolveLine()` from `src/content/lines.ts`.
- Assets: CC0 only. Log every third-party asset in `ASSETS_CREDITS.md`; missing ones go in `TODO_ASSETS.md`.

## Tech

Vite, TypeScript (strict), Three.js, Rapier (`@dimforge/rapier3d-compat`), howler.js, lil-gui, zustand.

## Legal-ish

This is an original parody. It is not affiliated with, and contains no assets from, Rockstar Games or the GTA series.
All characters, brands and places are fictional.
