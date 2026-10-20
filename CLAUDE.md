# learning-project

## Workflow

Tickets are built one per session, test-first, with a PR per ticket. See `docs/agents/workflow.md`.

## Code layout

Packages are deep modules: see [src/README.md](./src/README.md) before adding or importing one.

## Agent skills

### Issue tracker

Issues live as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the five default triage roles (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), recorded on each issue's `Status:` line. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
