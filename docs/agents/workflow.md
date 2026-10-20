# Development workflow

How tickets in `.scratch/webhook-delivery/issues/` get built.

## Per-ticket loop

1. Start a fresh session per ticket.
2. Branch `ticket/NN-slug` off `main`.
3. Build it with `/tdd`, test-first through the seams in the spec.
4. Run `/code-review` against `main`; fix what it finds.
5. Open a PR with `/pr`. Set the ticket's `Status:` to `done` in the same PR.
6. The user reviews and merges. Never merge your own PR.
7. Use `/handoff` if a session runs long.

## Phases

- **Paired (tickets 01–03):** work interactively with the user. Pause after the first few tests of each ticket so the user can steer the API shape; these tickets set the conventions everything else copies.
- **Setup after 01:** `/setup-pre-commit`, `/setup-ts-deep-modules`, and a short `CODING_STANDARDS.md` once 01–02 have established real patterns.
- **Delegated (04 onward):** the user decides per batch whether to keep the per-ticket loop (in parallel sessions where the frontier allows) or hand the remainder to `/implement-spec`.
- **Retros:** `/retro` after 03 and after 08.

When a ticket raises a design question the spec doesn't answer, stop and grill the user rather than guessing; record the outcome in `GLOSSARY.md` or `docs/adr/`.
