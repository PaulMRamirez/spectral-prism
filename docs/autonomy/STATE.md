# Spectral Prism: Loop State Ledger

CURRENT_PHASE: 0
LAST_AUDIT: none
OPEN_ESCALATION: none

## How to read this file

Single source of loop truth, updated at the end of every iteration (session protocol step 9) and by the phase-gate skill. The SessionStart hook prints the top of this file into every session. If git history and this ledger disagree, git wins and the first act of the session is reconciliation.

## Requirement Status: Phase 0

| REQ | Status | Evidence | Notes |
|---|---|---|---|
| SP-DP-001 | unmet | | |
| SP-DP-002 | unmet | | |
| SP-DP-003 | unmet | | |
| SP-DP-004 | unmet | | |
| SP-DP-005 | unmet | | |
| SP-DP-006 | unmet | | |
| SP-DP-007 | unmet | | perf: record ms against baseline |
| SP-DP-008 | unmet | | perf: record s against baseline |
| SP-DP-010 | unmet | | |

Bootstrap items (pre-REQ): monorepo scaffold [ ], verify vocabulary wired [ ], hooks confirmed firing [ ], CI green on placeholder [ ], Pages deploy live [ ], DESIGN-BRIEF v1 authored [ ], governance scaffold [ ], name-collision scan [ ], mirror bucket [ ], capability-tier table (Q1) [ ], icechunk-js posture (Q5) [ ].

## Measurements

(append: date, REQ, metric, value, baseline target, hardware note)

## Debt Ledger

(non-blocking findings from /simplify, /security-review, /code-review triage)

## Decisions Journal

(one line per iteration: what was selected, what shipped, commit hash; anything of consequence points to an ADR or escalation, never lives only here)
