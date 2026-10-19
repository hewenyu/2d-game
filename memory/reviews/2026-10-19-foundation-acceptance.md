# Foundation and Performance Acceptance

Date: 2026-10-19. Baseline: `c641431`; accepted implementation: `cb91da4`.
Condensed from the report in `cb91da4`; all results below are historical, not
checks rerun during documentation maintenance.

## Scope

Runtime performance/lifecycle hardening, tests, tooling, CI, shared memory, and
an assessment-only history review; no new gameplay iteration. Changes cap canvas
pixels and particles, move exit emission out of drawing, bound physics substeps,
clear stale input, skip hidden-tab work, and validate saves/practice exclusions.

## Recorded independent review gate

- Opus: PASS for frozen runtime/tests/CI/shared memory; independently ran 26 unit
  tests, build, and 17 browser checks in default and low quality; separately
  confirmed final history and corrected performance report/raw JSON before commit.
- DeepSeek independent reviewer: PASS for frozen code/final docs; independently
  ran 26 unit tests and 17 browser checks, compared a fresh build byte-for-byte
  with the preview asset, and verified report tables against JSON.
- Astra independent auditor: PASS for frozen code/tests/CI/benchmark evidence,
  shared memory, and final history report; independently ran 26 unit tests,
  17 production-preview browser checks, and `git diff --check`.

These approvals were distinct from implementation self-approval. All final
documentation confirmations were recorded before the implementation commit.

## Additional historical validation and limits

Coordinator checks: Node 20.20.2 tests/typechecks passed; desktop 1440 x 900 DPR 2
medium and narrow 390 x 844 DPR 2 low title/play screenshots were captured, play
screenshots inspected, with no page errors and correct logical center mapping.
Narrow-layout inspection does not imply touch support.

[PERF.md](../../docs/PERF.md) and its raw JSON retain the paired measurements,
script hash, and reproduction commands. The old paused-draw particle growth is
covered by `tools/perf/regress.mjs`; discarded transform-bug timings are not a
valid baseline. No universal FPS, confirmed GPU backend, or memory-saving claim.

Hosted CI had not been run as part of that local task. Later CI/deployment evidence
is recorded separately in [maintenance](2026-10-19-memory-maintenance.md).
No manual full-game playthrough, cross-browser certification, or proof of every
map's reachability. The original history proposals were not applied at acceptance;
their later disposition is in [design history](2026-10-19-history-review.md).
