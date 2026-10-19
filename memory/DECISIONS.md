# Durable Decisions

## 2026-10-19: One shared memory directory

Context: development may alternate between Codex and Claude Code.

Decision: keep project knowledge in tracked `memory/`, linked by both root agent
entry points. Avoid model-specific copies of the same project facts.

Consequence: a fresh checkout exposes the same knowledge to both tools; personal
agent memory and local conversation stores are not required dependencies.

Source: user request for shared project memory, 2026-10-19.

## 2026-10-19: History maintenance stays on demand

Decision: historical review is a separately delegated maintenance task when
requested, not part of every iteration or a scheduled/commit-time process.
Assessment and application of proposed updates may be separate requests.

Source: user request to allow either Claude Code or Codex to summarize later.

## 2026-10-19: Preserve the game while reducing rendering cost

Decision: prioritize measured rendering and lifecycle bottlenecks, bounded work,
and repeatable validation over framework migration or gameplay redesign.
Do not trade away collision correctness or attack readability for frame rate.

Source: performance/production-readiness scope; existing game architecture at
`c641431` and gameplay documentation in `README.md`.
