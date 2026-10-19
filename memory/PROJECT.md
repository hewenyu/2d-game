# Project State

Last reviewed: 2026-10-19. Code reference: `cb91da4` (performance foundation).

## Product and code map

Huifeng is a browser-based, single-player 2D action game with six procedural
levels across two chapters. Art and audio are generated in code. See
`docs/WORLD.md` for visual/lore direction and `README.md` for play and development.

- Strict TypeScript + Vite, Canvas 2D and Web Audio; no runtime package dependencies
  or backend. The build uses `base: './'` for subpath deployment.
- `src/main.ts`: browser bootstrap, canvas sizing, animation loop, and lifecycle.
- `src/core/loop.ts` / `quality.ts`: testable substep planning and backing-pixel
  budgets. Default `med` caps at 1080p; `low` at 720p with reduced decoration;
  opt-in `?q=auto` starts high and only downgrades within a page session.
- `src/game/game.ts` / `save.ts`: game states, progression, validated best records
  (`huifeng_save`), and practice-run exclusion.
- `src/game/level.ts`: level runtime, combat resolution, and rendering orchestration.
- `src/world/`: seeded room generation, tiles, collision, and biome palettes.
- `src/entities/` and `src/render/`: entity logic and procedural drawing/models.
- `src/data/`: chapter progression, lore, death tips; prefer data edits for content
  that fits existing mechanics.

## Invariants

- Logical viewport: 960 x 540; tile size: 32. CSS size, backing resolution, and
  world coordinates are distinct. Input uses logical viewport coordinates.
- The semi-fixed loop allows at most 12 substeps / 0.1 second per frame, each no
  larger than 1/120 second. Drop excess catch-up time, never enlarge collision steps.
- Death/retry preserves the run's seeded layout. Runs started at depth > 0 are
  practice and excluded from best records; `?debug` alone at depth 0 is not.
- Quality changes must preserve combat telegraphs, hitstop, recall-path previews,
  attack timing, and collision rules. Rendering culling must not disable offscreen
  simulation or collisions.
- Hidden tabs do not advance or draw the game. Focus/visibility changes clear held
  inputs and buffered presses; visibility changes reset the clock.
- Emit particles in updates, not draws. The shared particle list has a 512-item
  cap including decoration and combat particles.

## Known limitations and validation

- Keyboard/mouse only; responsive layout does not imply touch controls.
- Reachability approximates jump capability, not a proof that every map is playable.
- Enemy aggro does not check line of sight.
- Low quality reduces drawing, not the allocation of all background layers.
- Seeded maps are reproducible; combat AI/effects are not deterministic replays.

Use `README.md` for Node requirements, test/build/browser commands, and CI scope;
`docs/PERF.md` for benchmark reproduction and measurement limits. Dated review
results are historical evidence, not current CI, full-playthrough, or device guarantees.
