# Performance Baseline

Date: 2026-10-19. Reviewer: independently delegated Opus agent.
Scope: source revision `c641431`; baseline, not final implementation approval.

## Environment and method

Headless Chromium via Playwright 1.64; 1920 x 1080 viewport; seed 99. The initial
script performs two updates before timing a draw with a forced flush, over 60
samples. Updates are NOT included in the timed interval.

Root audit found that the script reset the canvas transform for component tests
and did not restore it for subsequent full-scene samples. The initial timing
numbers below are therefore diagnostic only, not valid high-DPR full-frame
baselines. A corrected like-for-like benchmark is required before making speedup
claims. The paused-particle reproduction is independent of this timing flaw.

These are synchronous submission-plus-flush measurements, not browser FPS or an
end-to-end guarantee on low-end hardware. GPU/driver and thermal variation can
change the result; do not compare these numbers to a different benchmark method.

## Initial observations (timing method superseded)

- DPR 2 produces a 3840 x 2160 backing canvas. Full-frame median across sampled
  levels: 8.0-10.1 ms; p95: 8.8-10.9 ms.
- DPR 1: full-frame median 7.1-8.0 ms.
- Background layers: 3.0-3.9 ms; terrain: 1.0-1.7 ms; foreground: 0.5-0.6 ms.
- Estimated RGBA backing memory for parallax layers: 24-34 MB per level; reported
  level construction: 4-13 ms. Backing memory is an estimate, not a heap profile.

## Corrected baseline

Opus reran the same scenes on macOS arm64 (M4), restoring the actual backing-store
transform before every timed call. Updates and draws are now measured separately.
Software rasterization with a forced readback after each draw gives:

| Backing size | Draw median | Draw p95 | Background median |
| --- | --- | --- | --- |
| 3840 x 2160 (DPR 2) | 117-121 ms | 124-146 ms | 72-78 ms |
| 1920 x 1080 (DPR 1) | 31-33 ms | 33-35 ms | 18.5-20.4 ms |

Two simulation updates cost at most 0.2 ms in these samples. Background work is
roughly 60-65% of forced software-raster cost, supporting a backing-pixel budget.
The reviewer also reports about 173-181 uncapped frames/second with real Metal
GPU rendering at DPR 2, and 60 with vsync. These are separate modes, not directly
comparable to forced-readback timings. Software rendering is a stress scenario,
not an exact model of every low-end browser. The final implementation report
must document its checked-in reproduction commands and matching settings.

## Confirmed defect

`Level.draw()` emits exit particles, while paused/read/rest/dead states do not
regularly update and expire them. At depth 0, 6000 paused draws increased the
particle count from 0 to 1838 and draw time from roughly 8 ms to 18.1 ms in the
reviewer's reproduction. The exact count is random; growth without simulation
is the defect. Move emission to simulation and bound decorative particle storage.

## Guardrails

Preserve substeps no larger than 1/120 second, hitstop behavior, attack telegraphs,
and collision logic. Limit backing resolution independently of CSS/input scale.
Use like-for-like tests for final comparisons. This report records review evidence
from the current task; no historical conversation transcript is included.
