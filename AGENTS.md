# Project Instructions

## Shared memory

- Read `memory/README.md` and `memory/PROJECT.md` before changing the project.
- Read `memory/DECISIONS.md` for architectural constraints. Consult dated reports
  only when relevant; code and reproducible tests take precedence over old notes.
- `memory/` is the version-controlled source of project memory for both Codex and
  Claude Code. Do not rely on a private agent home directory for project facts.
- Historical review is an explicit, on-demand task. Do not add a post-commit hook,
  scheduled job, or mandatory summarization step to normal development.

## Development

- Preserve the procedural art direction, gameplay rules, deterministic level
  generation, and relative-path static deployment unless a task says otherwise.
- Keep simulation, rendering, and platform lifecycle responsibilities separate.
  Performance settings must not change collision geometry or combat balance.
- Run the applicable checks documented in `README.md`; distinguish automated
  coverage from manual checks and measured performance from estimates.
- Keep unrelated local changes intact and out of task commits. Never commit
  secrets, raw chat transcripts, machine-local paths, or generated build output.
- When a task requires multiple reviews, record their exact scope and resolve
  blocking findings before committing. Do not treat silence as approval.

## Local command output

If `RTK.md` exists in your local Codex home, read and follow it. Other contributors
do not need that machine-local file to work on this project.
