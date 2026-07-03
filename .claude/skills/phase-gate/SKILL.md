---
name: phase-gate
description: Adjudicate the current phase gate for spectral-prism. Use when all requirements for the current phase appear met, when the user or goal asks to check gate status, or at the end of a /goal run. Writes GATE-REPORT-P<N>.md with a PASS or FAIL verdict.
---

# Phase Gate Adjudication

Determine the current phase N from docs/autonomy/STATE.md (CURRENT_PHASE). The gate's requirement set is the ROADMAP.md gate-coverage line for phase N; REQUIREMENTS.md holds each requirement's acceptance criterion and verification class.

## Procedure

1. **Evidence sweep.** For each requirement the gate cites: locate its verifying test or measurement, run it (`pnpm verify` covers the standing set; perf-class requirements run their harness fresh, never trusting stale numbers in STATE.md), and record pass/fail with the actual measurement against the SPEC Section 9 baseline targets.
2. **Quality passes.** Run /simplify (whole-package), then /security-review, then /code-review (read-only). Triage findings: anything touching a gate requirement blocks; the rest is ledgered as debt in STATE.md.
3. **Audits.** Invoke the spec-auditor subagent; DRIFT at severity 1 or 2 blocks the gate. Invoke the design-reviewer on the phase's shipped surface (Phases 1-3); REJECT blocks.
4. **CI parity.** Confirm main is green in CI for the same commit being adjudicated; a gate never passes on local-only evidence.
5. **Open questions.** Any SPEC Q whose close-by gate is this phase must be closed (resolved in SPEC, promoted to an ADR, or explicitly parked per the disposition rule); an open one blocks.
6. **Report.** Write docs/autonomy/GATE-REPORT-P<N>.md: verdict (PASS/FAIL), the requirement table with evidence links and measurements, quality-pass summaries, audit verdicts, debt ledger, and (on PASS) the next phase's requirement set as the handoff. On PASS, update CURRENT_PHASE in STATE.md. On FAIL, list the blocking items in dependency order; do not advance.

## Rules

- Never mark a requirement met on assertion; only on executed evidence.
- Never weaken a target to pass a gate; a target that seems wrong is a stop condition (AUTONOMY-PLAN Section 7.2), not an editable number.
- The report is append-only history; a re-run after fixes writes a new section, never rewrites the verdict it supersedes.
