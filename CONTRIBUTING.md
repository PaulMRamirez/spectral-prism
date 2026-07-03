# Contributing to Spectral Prism

Thank you for considering a contribution. This project is early; the fastest way to help is to read `SPEC.md` and `ARCHITECTURE.md` first, then open an issue before writing code, so we can point you at the right seam.

## Developer Certificate of Origin

Contributions are accepted under the [Developer Certificate of Origin 1.1](https://developercertificate.org/). Sign off every commit:

```
git commit -s
```

The `Signed-off-by:` trailer certifies you have the right to submit the work under the project license (Apache 2.0). Unsigned commits cannot be merged.

## Commit Conventions

Conventional commits with package scopes, citing requirement IDs where one applies:

```
feat(core): chunk scheduler priority ring [SP-DP-013]
fix(spectral): MNF boundary-pixel exclusion count [SP-CP-002]
docs: capability-tier table for Q1
```

Scopes: `core` (packages/prism-core), `spectral` (packages/spectral-prism), `py` (tools CLI), or none for repo-wide changes. Requirement IDs come from `REQUIREMENTS.md` and are never reused.

## Verification

One vocabulary, shared by developers, hooks, and CI (nothing verifies with a command CI does not run):

```
pnpm verify        # typecheck && lint && test && build:web && size
pnpm test:parity   # kernel parity vs. oracle fixtures (ADR-0008)
pnpm audit:prod    # dependency audit, high and critical
pnpm e2e           # Playwright, after pnpm build:web
```

`pnpm verify` must be green before every commit.

## Design Changes

Decisions of consequence get an ADR in `docs/adr/` following the existing numbering. Accepted ADRs change only by amendment or supersession recorded in the ADR itself; do not relitigate them in passing. Baseline documents (`REQUIREMENTS.md`, `docs/adr/`, `docs/reviews/`) change only via the amendment protocol described in `docs/autonomy/AUTONOMY-PLAN.md`.

UI-touching work is reviewed against `docs/design/DESIGN-BRIEF.md`; hardcoded visual values in components are rejected by rule.

## Style

- TypeScript strict; React + Vite with ES module output.
- No em dashes anywhere: code comments, docs, UI strings. Use commas, colons, parentheses, or semicolons.
- Wavelength is a coordinate (nm), never a bare band index, at every API boundary above the chunk layer.
