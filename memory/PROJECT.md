# Project State

Last reviewed: 2026-10-19. Baseline: `c641431`.

## Product

Huifeng is a browser-based, single-player 2D action game with six procedural
levels across two chapters. Art and audio are generated in code. The setting and
visual direction are documented in `docs/WORLD.md` and `README.md`.

## Architecture

- TypeScript (strict) + Vite; Canvas 2D rendering and Web Audio; no runtime package
  dependencies or backend. The build uses `base: './'` for subpath deployment.
- `src/main.ts`: browser bootstrap, canvas sizing, animation loop, and lifecycle.
- `src/core/loop.ts` and `src/core/quality.ts`: testable substep planning,
  backing-pixel budgets, and opt-in adaptive quality (`?q=auto`). Default `med`
  caps the backing canvas at 1080p; `low` caps it at 720p and reduces decoration.
- `src/game/game.ts`: title/prologue/play/read/dead/rest/pause/victory/gallery
  states, run progression, and best-record persistence (`huifeng_save`).
- `src/game/save.ts`: validated record parsing and practice-run record exclusion.
- `src/game/level.ts`: level runtime, entities, combat resolution, and rendering.
- `src/world/`: seeded room generation, tiles, collision, and biome palettes.
- `src/entities/`: player, thrown/returning blade, enemies, boss, and props.
- `src/render/`: layered backgrounds, terrain, particles, and procedural rigs.
- `src/data/`: chapter progression, lore, and death tips; prefer data edits when
  adding content that fits the existing mechanics.

## Invariants

- Logical viewport: 960 x 540; tile size: 32. CSS size, backing-store resolution,
  and world coordinates are distinct. Input uses logical viewport coordinates.
- Physics substeps must be no larger than 1/120 second. Limit catch-up work rather
  than making collision steps larger on slow devices.
- Death/retry preserves the current run's seeded layout. Debug practice runs do
  not count as normal best-record attempts.
- Preserve combat telegraphs, hitstop, recall-path previews, and attack timing
  when reducing decorative rendering work.
- Rendering culling must not disable simulation or collisions offscreen.
- Background tabs do not advance the game. Focus/visibility changes clear held
  inputs and buffered presses; returning from a hidden tab resets the clock.
- Particle emission belongs in updates, not draws. The shared particle list has
  a 512-item cap, including decorative and combat particles; reduced quality
  retains combat telegraphs and collision rules.

## Validation

Node.js 20+ is required by the tooling. `npm test` checks source/test types and
unit tests; `npm run build` builds the static site. With a preview server running,
`npm run test:browser -- <url>` runs Chromium regression checks. `npm run perf --
--url <url>` records a separate, environment-specific benchmark. See `README.md`
for setup and comparison rules. CI runs unit and production-preview browser checks.

## Known limitations

- Keyboard/mouse only; responsive canvas layout does not imply touch controls.
- Level reachability checks approximate jump capability rather than proving it.
- Enemy aggro does not check line of sight.
- Browser/device performance claims require measured, explicitly scoped evidence;
  headless rendering results are not a guarantee for all real hardware.
- Low quality reduces draw work, not the allocation of all background layers.
- Seeded maps are reproducible; combat AI and effects are not deterministic replays.
