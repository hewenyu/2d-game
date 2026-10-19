# Historical Review: Git History and Claude Code Session

Date: 2026-10-19. Reviewer: independently delegated DeepSeek review agent.
Type: on-demand historical assessment. **Report only — no canonical memory,
code, or docs were modified.**

## Scope

- Repository: `2d-game` (Huifeng / 回锋 · 沉钟寺).
- Git history: all commits on `master` and `feat/sunken-bell-temple`
  (`d8ece82`, `8d57691`, `c641431`). No other branches exist.
- Project conversations: the single Claude Code session store for this project,
  which ran 2026-10-18 20:05 → 2026-10-19 00:31 local (America/Los_Angeles),
  i.e. 2026-10-19 03:05Z → 07:31Z, plus the four memory notes in that session's
  private `memory/` directory.
- Time range covered: all Git and conversation evidence available for this
  project — three commits and one session store. Coverage is limited to what
  exists in this checkout; earlier or off-repo material cannot be ruled out.

## Sources read and not read

Read (evidence):

- All three commits, their dates/authors, and the `d8ece82 → 8d57691 → c641431`
  merge topology.
- The four session memory notes: `MEMORY.md`, `art-direction-feedback.md`,
  `game-feel-design-feedback.md`, `project-deploy-cloudflare.md`.
- From the ~68 MB session log, a **streamed filter** of: user-authored text
  turns (9), mid-turn queued user messages, the session title, and the
  machine-generated turn/away summaries. Large tool outputs, attachments, and
  assistant tool traffic were **not** read.
- Current tracked docs for comparison: `README.md`, `docs/WORLD.md`,
  `docs/PERF.md`, `memory/PROJECT.md`, `memory/DECISIONS.md`, `memory/README.md`,
  `AGENTS.md`, `CLAUDE.md`, and the existing
  `memory/reviews/2026-10-19-performance-baseline.md`.

Not read / unavailable (stated honestly):

- Other Claude project directories on this machine (unrelated projects). Not
  scanned, per scope.
- The prototype-phase verification scripts (a Playwright "bot" suite and a
  screenshot script) that the session summary says lived only in a machine-local
  scratch directory. They are not in the repository and are not reproducible from
  a fresh checkout.
- Pre-compaction assistant reasoning that was dropped by two automatic context
  compactions; only the surviving summaries remain.
- No prior history review exists; this is the first one.

## Confirmed facts (evidence-backed)

1. **The game was produced in one session against a one-hour design-autonomy
   brief** (2026-10-19 03:05Z). The brief fixed the experience goals, not a
   feature list: observe enemies, act with weight but reliable input, readable
   danger, growth from tension to mastery; pick one distinctive mechanic; and a
   priority order when time and quality conflict — runnable loop → control/feel →
   enemy/boss fairness and depth → audio-visual identity → more content.
2. **The prototype was rejected and rebuilt once.** The user rejected the first
   art outright (04:19Z) and asked for a proper project code structure rather
   than a single HTML file, plus a "hakoniwa"-style side-scroller with a random
   layout per level, cleared level by level downward.
3. **Cloudflare static hosting is a project constraint.** A mid-turn message
   (04:20Z) states the user will deploy the build under an external project on
   Cloudflare, which is why the build must stay static and subpath-safe.
4. **Visual identity converged on an original East-Asian bell-temple direction.**
   The user asked for refined modelling (05:36Z), then rejected the result for
   being too close to Hollow Knight (05:38Z, "太像空洞骑士了，没有自己的特色")
   and required story/epic feel/world-building (05:41Z). The shipped
   `docs/WORLD.md` §7 and `README.md` encode the resulting direction.
5. **Two combat/level-design complaints, reported implemented in-session (not
   independently verified here):** hits felt sluggish ("钝感") rather than
   weighty (06:37Z), and obstacles could only be jumped, not crouched under,
   which the user called contrary to player habit ("太反用户操作习惯了"), with the
   rule that a blocking element must have a purpose and give the player a choice
   (06:39Z, mid-turn). The assistant's summary says both were addressed; this
   review only confirms the code and docs that now implement them.
6. **Git rationale is limited.** `d8ece82` is a two-line README init; `8d57691`
   is a single implementation commit that lands the whole game (51 files,
   ~8.4k lines); `c641431` is the user's own PR merge. Nothing in the commit
   messages records why the game is shaped this way, so the durable rationale
   lives in `docs/` (`WORLD.md`, `PERF.md`) and in `memory/`, with the
   conversation supplying additional context.
7. **The `.vite` gitignore entry is a user request** (07:28Z, "加进getignor吧")
   and was still uncommitted when the session ended. The current working tree
   matches that state.
8. **Verification honesty is a user-originated standard.** The original brief
   required a real playtest and an honest report of what was and was not
   verified, and warned against treating "written in code" as "verified". This is
   now reflected in `AGENTS.md`, `README.md`, and `memory/PROJECT.md`.

## Classification of the four Claude memory notes

| Note | Verdict | Basis |
| --- | --- | --- |
| `art-direction-feedback.md` | **Keep** (durable, still current) | Matches 05:36/05:38/05:41 evidence and the shipped `docs/WORLD.md` §7. The "avoid HK signatures, own identity, refined models, lore with every addition" rule is a standing content constraint. Only stored in the private session; see proposed updates. |
| `game-feel-design-feedback.md` | **Keep** (durable, still current) | Matches 06:37/06:39 evidence. The user objected to sluggishness and over-long pauses, not to hitstop as such: keep combat rhythm, and keep particles/shake/impact feedback animating during hitstop, checked by playtest. Blocking elements need readable intent plus more than one solution (already in `README.md` "障碍的设计原则"). Treat this as playtest-backed feedback, **not** a hard rule banning all full-screen hitstop — `memory/PROJECT.md` explicitly preserves hitstop. Its internal date "2026-10-18" is consistent once UTC is converted to local time. |
| `project-deploy-cloudflare.md` | **Keep** (durable, still current) | Matches 04:20Z. `base: './'` + no backend + no external asset URLs is confirmed in `vite.config.ts`, `README.md`, and `AGENTS.md`. The deployment intent itself is not yet recorded in tracked memory. |
| `MEMORY.md` (index) | **Superseded** | It is a three-line index of the other notes. Tracked `memory/README.md` + `memory/PROJECT.md` are now the canonical read order. If the private store is retained, keep it as a private index only, not as a project fact source. |

## Contradictions and superseded instructions

- **Art target reversed twice.** "Do not imitate an existing game" (original
  brief) → "I want Bloodborne/Dark Souls, or Hollow Knight 2D" (04:19Z) →
  "too much like Hollow Knight, no identity of its own" (05:38Z). The current
  and durable target is the original bell-temple identity. Any note that treats
  "Hollow Knight-like" as the goal is **superseded**; the Hollow Knight reference
  survives only as a *negative* constraint.
- **Scope grew.** The brief targeted a 5–10 minute first playthrough; `README.md`
  now states 15–30 minutes with six levels and two chapters. The original figure
  is **superseded** as a requirement (it was explicitly "a reference, not a
  requirement").
- **Platform scope narrowed.** "Keyboard/mouse only, no touch" is recorded as a
  known limitation; the original brief did not specify input. No user statement
  contradicts the limitation, so it stands.

## Uncertain (evidence too weak or machine-generated)

- The machine-generated turn/away summaries describe what the assistant believed
  it had done (including a scripted bot playthrough). They are useful pointers,
  not user instructions, and should not be promoted to memory facts.
- Whether the user still wants the "one-hour challenge" framing is unknown and
  probably irrelevant to the current codebase.
- The practice-run record semantics appear in code and README but were not
  directly requested in the surviving user turns; treat as an internal design
  decision, not a user requirement. Precisely: only runs started from depth > 0
  are practice and excluded from best records, so `?debug` at depth 0 still
  counts normally.
- Whether the user wants the private Claude session store to remain in use at all
  is unresolved; `memory/README.md` already declares it optional.

## Proposed updates (for a later, separately authorized change)

These are recommendations only; nothing below was applied.

1. `memory/DECISIONS.md` — add a durable decision recording the **product
   intent**: a static, subpath-safe browser game whose purpose is public play via
   Cloudflare, with the user's stated experience goals (observable/readable
   combat, weighty but reliable input, growth through mastery) as the design
   compass. Sources: session 2026-10-19 03:05Z and 04:20Z; commits `d8ece82`,
   `8d57691`, `c641431`.
2. `memory/DECISIONS.md` — add the **content-design constraints** as one entry:
   original East-Asian identity (no Hollow Knight / Bloodborne signatures), every
   addition carries lore, and every blocking element offers a choice (jump *or*
   crouch) with visible intent. Sources: session 2026-10-19 05:36–05:41Z and
   06:37–06:39Z; already partly in `docs/WORLD.md` §7 and `README.md`.
3. `memory/DECISIONS.md` — add the **verification standard**: measured,
   explicitly scoped evidence; distinguish automated coverage from manual
   playtesting; never present "written" as "verified". Source: original brief,
   2026-10-19 03:05Z; already reflected in `AGENTS.md`/`README.md`.
4. `memory/PROJECT.md` — record the **provenance note**: the game landed as a
   single implementation commit with no rationale in its message, so the durable
   rationale lives in `docs/` and `memory/`, and the prototype-era
   bot/screenshot scripts were machine-local and are not reproducible from a
   fresh checkout.
5. Note that the `.vite` ignore entry came from an explicit user request and was
   uncommitted at session end, so it should be preserved as-is and kept out of
   unrelated commits.
6. Do **not** copy any of the four private notes verbatim into `memory/`; they
   contain session-store front-matter and personal-agent framing that
   `memory/README.md` explicitly excludes.

## Unresolved risks and gaps

- Git rationale is thin: a future maintainer reading commit history sees one
  implementation commit. The durable rationale is split between `docs/` and
  `memory/`, so a stale entry there is costly to detect.
- Some user constraints currently live only in the private session notes; until
  the proposed decisions are added, a fresh checkout can reconstruct the art and
  obstacle rules from `docs/WORLD.md` and `README.md`, but not the Cloudflare
  deploy constraint's origin or the user's experience goals.
- Evidence for the crouch/obstacle and refined-modelling turns survives only as
  short mid-turn messages plus assistant summaries; the original long-form
  reasoning was dropped by two context compactions.
- Verification of the shipped build is currently automated only
  (`npm test`, `npm run test:browser`, `npm run perf`). Whether the user has since
  played the current build manually is not recorded anywhere.

## Confidence

- High for Git topology, commit dates/authors, and the four memory notes.
- High for the user statements quoted above (they are short, verbatim, and
  mutually consistent with the shipped docs).
- Medium for the assistant's self-reported fixes, which are corroborated by code
  and docs but were not re-tested in this review.
- Low for machine-generated summaries, treated here as pointers only.
