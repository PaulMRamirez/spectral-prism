# Spectral Prism: Loop State Ledger

CURRENT_PHASE: 0
LAST_AUDIT: none (audit:prod clean locally and in CI, 2026-07-02; first full /security-review fires on its Section 4 trigger list during Phase 0 iterations)
OPEN_ESCALATION: none

## How to read this file

Single source of loop truth, updated at the end of every iteration (session protocol step 9) and by the phase-gate skill. The SessionStart hook prints the top of this file into every session. If git history and this ledger disagree, git wins and the first act of the session is reconciliation.

## Requirement Status: Phase 0

| REQ       | Status | Evidence | Notes                            |
| --------- | ------ | -------- | -------------------------------- |
| SP-DP-001 | unmet  |          |                                  |
| SP-DP-002 | unmet  |          |                                  |
| SP-DP-003 | unmet  |          |                                  |
| SP-DP-004 | unmet  |          |                                  |
| SP-DP-005 | unmet  |          |                                  |
| SP-DP-006 | unmet  |          |                                  |
| SP-DP-007 | unmet  |          | perf: record ms against baseline |
| SP-DP-008 | unmet  |          | perf: record s against baseline  |
| SP-DP-010 | unmet  |          |                                  |

Bootstrap items (pre-REQ): monorepo scaffold [x], verify vocabulary wired [x], hooks confirmed firing [x], CI green on placeholder [x], Pages deploy live [x], DESIGN-BRIEF v1 authored [x], governance scaffold [x], name-collision scan [x], mirror bucket [ ], capability-tier table (Q1) [x], icechunk-js posture (Q5) [x].

Bootstrap evidence (2026-07-02): scaffold commit 9116bba; pnpm verify, test:parity, audit:prod, e2e all green locally and in CI run 28638995432; Pages live at https://paulmramirez.github.io/spectral-prism/ (deploy run 28638995411); hooks dry-run: PreToolUse blocked a REQUIREMENTS.md edit, PostToolUse prettier reformatted a probe file, SessionStart printed this ledger. DESIGN-BRIEF v1.1 at docs/design/DESIGN-BRIEF.md; Q1 at docs/capability-tiers.md; Q5 at docs/research/icechunk-js-posture.md; scan at docs/research/name-collision-scan.md.

Mirror bucket: blocked on two prerequisites, deliberately unchecked. It carries CLI-converted scenes, so CLI v0 must exist first (Phase 0 work), and provisioning a public CORS-enabled bucket needs cloud credentials only the human holds. Human touchpoint, not an escalation.

## Human Follow-ups (non-blocking)

- Claim the @spectral-prism npm org (scan could not rule out squatting anonymously; first come, first served).
- At the Phase 0 gate: adopting docs/capability-tiers.md requires an ADR-0008 amendment recording the tier C overlay reproducibility rule (amendment protocol; the loop proposes, the human disposes).
- Launch the Phase 0 /goal (AUTONOMY-PLAN Section 8 step 5) when ready.

## Design-Review Verdicts (SP-UX-005 ledger)

| Date       | Item                             | Verdict | Notes                                                             |
| ---------- | -------------------------------- | ------- | ----------------------------------------------------------------- |
| 2026-07-02 | Placeholder shell vs. brief v1.0 | REJECT  | TK-2 (invented -line tokens; brief gap), TK-1 (literal max-width) |
| 2026-07-02 | Placeholder shell vs. brief v1.1 | APPROVE | Gap closed by TK-5 amendment; literal removed                     |

## Measurements

(append: date, REQ, metric, value, baseline target, hardware note)

## Debt Ledger

- Token :root block lives in packages/spectral-prism/src/shell.css; at Stage 2 extraction the full DESIGN-BRIEF Section 3 set (not this subset) ships in the prism-core panel shell and the block here is deleted. One definition, ever.
- Inter and IBM Plex Mono WOFF2 must be bundled before any surface with live numeric readouts ships (TY-1, TY-3): before the Phase 1 first-run surface and triad.
- App.tsx status-line copy is engineering register; move toward instrument vocabulary when next touched (Principle 6, VOC-1 spirit).
- DESIGN-BRIEF gap flagged by reviewer: font weights and TY-2 letter-spacing are committed values without token names; tidy-up amendment when next amending Section 3.
- First-run content measure (max-width) is an open brief gap, to be settled when the Phase 1 first-run surface is designed, not guessed earlier.
- sprism CLI stub returns exit 1 by design until CLI v0 lands.

## Decisions Journal

- 2026-07-02: Section 8 bootstrap executed end to end (governance dbe7c28, docs c8c73c0, brief amendment 8aa66f2, scaffold 9116bba). Research ran as a 20-agent verified workflow (wf_4f11d0c7-7fb): name scan (keep spectral-prism + sprism; prism-core publishes scoped only), Q1 tier table drafted for gate adoption, Q5 resolved as exact-pin icechunk-js 0.6.0 with the official Earthmover wasm bindings watched as successor.
- 2026-07-02: /init review skipped deliberately: CLAUDE.md is hand-authored and current; regenerating it risked destroying the baseline. Memory anchor written to the session memory store instead (AUTONOMY-PLAN Section 8 step 2 intent preserved).
- 2026-07-02: Commit order enforced brief-before-UI so SP-UX-001 holds in git history, not just in the working tree.
