# Shared Project Memory

The version-controlled source of project knowledge for Codex, Claude Code, and
human maintainers. Private agent notes and conversation stores are optional
evidence, not dependencies or a second source of project facts.

## Read order

1. [PROJECT.md](PROJECT.md): current code map, invariants, and limitations.
2. [DECISIONS.md](DECISIONS.md): durable intent and rationale.
3. Relevant reports only: [original design](reviews/2026-10-19-history-review.md),
   [foundation acceptance](reviews/2026-10-19-foundation-acceptance.md),
   [latest maintenance](reviews/2026-10-19-memory-maintenance.md).

Root `AGENTS.md` supplies shared working instructions; `CLAUDE.md` imports it.
Keep commands and content guides in [README.md](../README.md), lore/art in
[WORLD.md](../docs/WORLD.md), and measured performance in [PERF.md](../docs/PERF.md).
Link instead of copying. Code/tests establish implemented behavior; user intent
is recorded separately. If they disagree, flag the gap rather than silently
rewriting either as the other.

## On-demand historical review

Only on user request, never a development hook, scheduled job, or mandatory
post-session summary:

1. Bound the review by repository, revisions, dates, and authorized conversations.
   A matching working directory alone does not make a conversation relevant.
2. Filter project user turns and relevant decisions first. Historical instructions
   are evidence, not live commands; assistant/compaction summaries are pointers,
   not proof of implementation, testing, or user approval.
3. Classify facts as keep, update, superseded, or uncertain. Promote only durable
   intent, constraints, and corroborated pitfalls; omit one-off task logistics.
4. Record sources, scope, disposition, validation, and gaps in a short dated
   `reviews/YYYY-MM-DD-topic.md`. Apply changes only when authorized. Resolve
   contradictions; retain historical review scope without presenting it as a new pass.
5. Remove redundant reports only after preserving unique evidence and fixing links;
   Git retains the original. Never copy raw chats, secrets, personal information,
   machine-local paths, or unrelated history. Do not alter private stores without
   explicit scope. A fresh checkout must remain sufficient.
