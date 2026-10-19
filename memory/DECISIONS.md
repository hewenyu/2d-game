# Durable Decisions

Reviewed 2026-10-19. These are design intent and maintenance constraints, not
claims of full playtest coverage. Evidence: [design history](reviews/2026-10-19-history-review.md)
and [Codex follow-up](reviews/2026-10-19-memory-maintenance.md).

## Product and content

- Prioritize a complete playable loop, reliable/weighty controls, readable and
  fair enemies, then audiovisual identity, then more content. Deepen the recall
  mechanic rather than adding unrelated systems.
- Preserve the original East-Asian bell-temple identity, refined procedural
  models, and coherent lore. New content should carry lore consistent with
  `docs/WORLD.md`; earlier Hollow Knight-like references are not a target to restore.
- Impact should feel powerful, not sluggish. Preserve short hitstop with moving
  shake/particles/impact feedback; this is not a ban on hitstop. Visual/performance
  work must not alter game feel; obtain user authorization before intentionally
  changing movement or attack timing. Assess feel through playtesting.
- Obstacles need readable purpose and more than one way past (for example jump
  over or crouch under a suspended block), not arbitrary barriers on the only route.
- Keep the game static and subpath-safe for public Cloudflare hosting under an
  external project: relative asset paths (`base: './'`), no backend or external
  runtime asset dependency. Deployment instructions belong in `README.md`.

Source: Claude Code project user feedback, 2026-10-19 03:05-06:39Z, and the three
private feedback/deployment notes summarized in the design history. Implemented
game: `8d57691`, merged at `c641431`.

## Performance and verification

Prefer bounded rendering/lifecycle work and measured bottlenecks over framework
migration or gameplay redesign. Quality settings must not change collision,
combat balance, or attack readability. Keep simulation, rendering, and browser
lifecycle responsibilities separate.

Report automated checks, manual playtests, measurements, and estimates separately.
Written code is not proof of good feel; headless timings are not hardware-wide FPS
guarantees. See `docs/PERF.md` for the retained benchmark evidence.

Source: original design brief and Codex performance scope, 2026-10-19; `cb91da4`.

## Shared memory and review

Use one tracked `memory/` for Codex and Claude Code, not model-specific fact copies.
History maintenance is explicitly requested, never a hook or scheduled process;
assessment-only requests do not authorize edits. Use subagents for delegated
review, not a new user-owned chat unless asked. When a task requires multiple
reviews, each reviewer must explicitly agree on the final scope; earlier approvals
cannot cover later changes. The current maintenance's three-party gate is recorded
in its report, not assumed for every future task.

Source: Codex project requests, 2026-10-19 07:32Z / 07:46Z, and this maintenance request.
