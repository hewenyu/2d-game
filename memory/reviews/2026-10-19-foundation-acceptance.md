# Foundation and Performance Acceptance

Date: 2026-10-19. Source baseline: `c641431`.
Scope: performance hardening, repeatable validation, shared project memory, and
an independently delegated historical assessment. No new gameplay iteration.

## Implementation

DeepSeek performed the runtime, test, tooling, and CI implementation. Root Astra
coordinated the work, reviewed changes, maintained shared documentation, corrected
measurement/reporting issues, and performed independent compatibility checks.
The DeepSeek review role was scheduled by root because the implementation
agent's model session did not expose nested collaboration tools.

The changes bound canvas pixels and particles, separate exit-particle emission
from drawing, preserve the 1/120-second maximum physics step, clear stale input
on focus/visibility changes, and skip hidden-tab simulation/rendering. Quality
settings reduce rendering work, not collision or combat parameters. Save parsing
is validated and practice victories no longer update normal records.

## Independent review gate

- Opus: PASS for frozen runtime, tests, CI, and shared-memory design; independently
  ran 26 unit tests, build, and 17 browser checks in default and low quality;
  separately confirmed PASS on the final history report and corrected performance
  report/raw JSON before commit.
- DeepSeek independent reviewer: PASS for frozen code and final documents;
  independently ran 26 unit tests and 17 browser checks, compared a fresh build
  byte-for-byte with the preview asset, and verified report tables against JSON.
- Astra independent auditor: PASS for frozen code, tests, CI, benchmark evidence,
  shared memory, and the final historical report; independently ran 26 unit and
  17 production-preview browser checks and `git diff --check`.

No implementation agent's own approval substitutes for these independent reviews.
All three final documentation confirmations were received before committing.

## Additional coordinator validation

- Node 20.20.2: `npm test` passes source/test typechecking and all 26 unit tests.
- Desktop 1440 x 900 at DPR 2, medium quality: backing 1920 x 1080; title/play
  captured and play screenshot inspected, no page errors; canvas center maps to
  logical (480, 270).
- Narrow viewport 390 x 844 at DPR 2, low quality: backing 780 x 438; title/play
  captured and play screenshot inspected, no page errors; center mapping remains
  (480, 270). This verifies layout, not touch controls (which are not implemented).
- The pre-existing user change adding `.vite` to `.gitignore` stays out of the
  task commit. Build output, local browser state, and raw transcripts stay out too.

## Evidence and limitations

See `docs/PERF.md` and `docs/perf/2026-10-19/` for paired raw data, reproduction
commands, browser configuration, and the benchmark script hash. At DPR 2 the
observed isolated draw median changes from 124.6-132.9 ms at baseline to
31.1-33.0 ms at medium quality; low-quality samples are 9.5-9.6 ms. These are
headless measurements with forced readback, not a universal FPS guarantee or a
verified GPU benchmark. Low quality does not release background-layer caches.

CI is configured but hosted GitHub Actions have not been run as part of this
local task. Automated tests and screenshot inspection are not a manual full-game
playthrough, cross-browser certification, or proof that every map is reachable.

The historical assessment is in `2026-10-19-history-review.md`. Its proposed
canonical-memory updates are deliberately not applied. History maintenance
remains a separate, user-requested task that either Codex or Claude Code can run.
