# Spectral Prism Specification Package: Review of Draft v0.3

**Status:** Review report, 2026-07-01 (third pass). This pass hunts in the last unexamined territory: formalization, traceability, governance, and process. It also renders a convergence judgment on the review loop itself.

## Summary Judgment

No F-crit findings. No finding in this pass touches an ADR, a plane, or a data-flow trace; the technical design has stabilized across two hardening rounds. What remains is the connective tissue that lets the package operate as an engineering baseline rather than a well-argued essay: numbered requirements with acceptance criteria, question ownership, and a handful of hygiene items. After applying these, the loop has reached diminishing returns (see Convergence).

## Findings

### F30 (F-major): Requirements lack identifiers and acceptance criteria; gates cite prose

SPEC's requirements are correct but unnumbered, so nothing downstream (roadmap gates, tests, CI job names) can cite them stably. **Proposed change:** a `REQUIREMENTS.md` traceability annex: numbered requirements (SP-DP-nnn data plane, SP-CP-nnn compute, SP-RP-nnn render, SP-CO-nnn coordination, SP-XP-nnn cross-cutting) each with priority (P0/P1/P2), a testable acceptance criterion, the verifying test class from CLAUDE.md, and the phase gate that proves it. SPEC stays the narrative; the annex is the ledger. Roadmap gates then cite requirement IDs rather than restating numbers.

### F31 (F-major): Open questions have no owners or deadlines

Q1-Q7 float free; unowned questions calcify into permanent footnotes. **Proposed change:** each question gains a close-by gate (Q1, Q5 close at the Phase 0 gate; Q2, Q3-residual, Q4 at Phase 1; Q6, Q7 at Phase 2 planning) and a disposition rule: a question open past its gate becomes either an ADR or a parked Phase 4+ item, never a rollover.

### F32 (F-minor): Standing risks lack triggers and responses in a scannable form

The prose risks are sound; convert to a table (risk, tripwire, response, review cadence) inside ROADMAP so a status review can walk it in one screen.

### F33 (F-minor): Project-name collision check is unassigned

"Prism" is a crowded namespace (PRISM climate dataset, Prisma ORM, Prism.js). Confusion risk is low in the imaging-spectroscopy niche but the check (npm, PyPI, GitHub org, trademark scan) belongs in Phase 0 next to the existing `sprism` check, with "Spectral Prism" as the display name and `spectral-prism` as the namespace either way unless the scan surprises.

### F34 (F-minor): Governance stubs are implied, never listed

Apache 2.0 is stated; the accompanying set is not: LICENSE, NOTICE, CONTRIBUTING (DCO sign-off, conventional-commit scopes, ADR process for design changes), CODE_OF_CONDUCT, SECURITY.md (no-telemetry statement plus disclosure contact). One Phase 0 scaffold item; mission-community-plugins distribution will expect them.

### F35 (F-minor): The review loop itself should be codified

Three review documents now exist with an implicit method. Add four lines to CLAUDE.md: reviews are versioned documents in docs/reviews; findings are graded F-crit/F-major/F-minor and numbered continuously across reviews; applying a review bumps the draft version; accepted-ADR changes arrive only by amendment or supersession recorded in the ADR itself.

## Convergence

Yield across the loop: pass 1 found 4 critical + 5 major (two ADRs materially wrong or missing); pass 2 found 1 critical + 5 major (no ADR overturned, one added); pass 3 finds 0 critical + 2 major, both process-shaped rather than design-shaped. The curve is the expected one, and the remaining uncertainty is no longer of the kind reviews retire: it lives in Q1-Q7 and in the Phase 0 gate measurements (probe latency, cold open, icechunk-js conformance), which only running code answers. **Recommendation: apply this pass as v0.4, declare the specification baselined, and route further hardening through implementation evidence rather than a fourth documentary review.** A fourth pass would manufacture findings to justify itself.

## Proposed v0.4 Change List

1. REQUIREMENTS.md traceability annex; gates cite IDs (F30).
2. Q1-Q7 owners/close-by gates and the disposition rule (F31).
3. Risk table in ROADMAP (F32).
4. Phase 0: name-collision check and governance scaffold items (F33, F34).
5. CLAUDE.md: review-loop protocol (F35); README index updates.
