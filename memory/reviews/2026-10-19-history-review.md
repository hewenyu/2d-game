# Original Design History

Date: 2026-10-19. Condensed during the authorized memory maintenance; the original
assessment-only report by the independent DeepSeek reviewer remains in `cb91da4`.
Its selected durable recommendations are now in `memory/DECISIONS.md`; this is not
a new implementation acceptance. Codex follow-up is recorded in
[the maintenance report](2026-10-19-memory-maintenance.md).

## Scope and sources

- Git: `d8ece82` (README initialization), `8d57691` (game implementation),
  `c641431` (PR merge). Most game rationale was not recorded in commit messages.
- Claude Code project session, 2026-10-18 20:05 to 2026-10-19 00:31
  America/Los_Angeles (2026-10-19 03:05-07:31Z): user text and mid-turn queued
  messages, plus four private memory notes. These were re-read during maintenance.
- Compare with current source and `README.md` / `docs/WORLD.md`. The original
  review also consulted machine-generated summaries; they are pointers, not proof.

## Durable findings and disposition

| Evidence anchor (UTC, 2026-10-19) | Disposition |
| --- | --- |
| 03:05 original brief: readable combat, reliable weighty input, mastery; playable loop before more content | Keep product priorities and honest verification in `DECISIONS.md`. |
| 04:19: reject prototype, require project structure and randomized downward side-scrolling levels | Keep current architecture; do not restore the single-file prototype. |
| 04:20 queued request: public Cloudflare deployment under an external project | Keep static, relative-path deployment intent. |
| 05:36 / 05:38 / 05:41: refined models, reject derivative Hollow Knight look, require story/world-building | Keep original bell-temple identity and coherent lore. |
| 06:37 / 06:39: impact feels sluggish; obstacles should allow jump or crouch with visible purpose | Keep responsive impact and meaningful obstacle choices, not a blanket ban on hitstop. |

The intermediate Hollow Knight-like target is superseded by the later originality
feedback. The initial one-hour challenge and 5-10 minute reference are not ongoing
requirements; README's 15-30 minutes is an estimate, not a measured playthrough.

## Private-note disposition

| Note | Disposition |
| --- | --- |
| `art-direction-feedback.md` | Keep substance in `DECISIONS.md`; visual/lore detail stays in `docs/WORLD.md`. |
| `game-feel-design-feedback.md` | Keep feel, timing-change authorization, and obstacle constraints in `DECISIONS.md`. |
| `project-deploy-cloudflare.md` | Keep deployment intent in `DECISIONS.md`; instructions stay in README. |
| `MEMORY.md` | Superseded as the canonical index by tracked `memory/README.md`. |

Private stores were read only, not rewritten or deleted. The notes are secondary
interpretations of user feedback; implementation and playtest claims need separate
evidence. The `.vite` request is one-off change provenance, not lasting memory.

## Evidence limits

Two context compactions removed earlier detail; surviving assistant summaries do
not establish user approval or verified fixes. Prototype bot/screenshot scripts
were machine-local and are not reproducible from a fresh checkout. This review
does not claim a manual full-game playthrough. Current tests and the separately
scoped foundation acceptance replace prototype-era testing claims, not these gaps.
