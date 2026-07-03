# Spectral Prism: Autonomous Delivery Plan (the Loop)

**Status:** v1.0, 2026-07-01. Companion to the v0.4 specification baseline. This document defines how Claude Code drives implementation through all roadmap phases with minimal human intervention, and precisely when it must stop.

Capability notes verified 2026-07: /goal (verifiable end-state autonomous execution), /loop (recurring in-session or scheduled runs; routines for cloud scheduling), agent teams (Opus 4.6+ research preview: parallel coordinated instances over worktrees), subagents (.claude/agents/), skills-as-commands (.claude/skills/<name>/SKILL.md), hooks (deterministic callbacks: PreToolUse, PostToolUse, Stop, SubagentStop, SessionStart), /simplify (bundled cleanup skill, three parallel review agents, fix-applying; split from /code-review as of v2.1.154), /security-review (branch-scoped vulnerability pass), /code-review and /code-review ultra, permission modes (acceptEdits for dev machines; bypassPermissions reserved for sandboxes/CI), headless `claude -p` for scripting.

## 1. The Loop, in One Paragraph

Every loop has a doer and a checker, and the checker is the hard part. Ours is already built: the v0.4 baseline gives us numbered requirements with acceptance criteria (REQUIREMENTS.md), phase gates that cite them (ROADMAP.md), a single verification vocabulary (`pnpm verify`, mirroring bessel and vector-channels), and CI that runs the same command. The loop is therefore: **select the next unmet requirement in the current phase, implement it, prove it with the shared vocabulary, clean it (/simplify), audit it (/security-review where triggered), design-review it (UI-touching work), commit with the REQ ID, update the ledger, repeat; at a gate, run the phase-gate skill; on pass, advance phase; on ambiguity or drift, stop and escalate.** The outer driver is /goal per phase; hooks make the non-negotiables deterministic rather than judgment calls.

## 2. Primitive Mapping

| Concern | Primitive | Artifact |
|---|---|---|
| Phase driver | /goal with a checkable end state | Goal text per phase in Section 5 |
| Iteration ledger | Auto-memory + STATE.md | docs/autonomy/STATE.md (template provided) |
| Deterministic gates | Hooks | .claude/settings.json: Stop hook runs `pnpm verify`; PostToolUse formats; PreToolUse blocks protected paths |
| Gate adjudication | Skill | .claude/skills/phase-gate/ (checks phase REQ set, writes GATE-REPORT) |
| Design taste and UX | Subagent + brief | .claude/agents/design-reviewer.md + docs/design/DESIGN-BRIEF.md |
| Spec drift detection | Subagent | .claude/agents/spec-auditor.md (invariants, ADRs, REQ traceability) |
| Cleanup | /simplify | Cadence in Section 4 |
| Security | /security-review | Cadence in Section 4; CI mirror via audit step |
| Parallelism (opt-in) | Agent teams + worktrees | Section 6; off by default |
| Long-running supervision | /loop or /rc | Read-only supervisor session (separate terminal or worktree): `/loop 30m` reads STATE.md and git log, reports to the human, never edits; STATE.md is written by the /goal session alone |
| CI mirror | GitHub Actions | .github/workflows/ci.yml + deploy.yml (bessel/vector-channels pattern) |

## 3. Session Protocol (what each iteration does)

1. **Orient.** Read STATE.md, CLAUDE.md, the current phase's REQ set. If STATE.md is stale relative to git log, reconcile first.
2. **Select.** The lowest-numbered unmet P0 requirement in the current phase whose dependencies are met. One requirement (or one coherent cluster) per iteration; never two unrelated ones.
3. **Plan.** Plan mode for anything touching more than three files or any ADR-adjacent area; the plan must name the REQ ID, the acceptance criterion, and the test that will prove it.
4. **Implement.** Tests land with the code, not after. New abstractions in prism-core require both consumers to exhibit the shape (ADR-0006 rule); otherwise implement in spectral-prism.
5. **Prove.** `pnpm verify` green locally (the Stop hook enforces this even if forgotten). Perf-class REQs additionally run their harness and record numbers in STATE.md.
6. **Clean.** /simplify scoped to the changed area.
7. **Audit.** /security-review when the security trigger list matches (Section 4).
8. **Design review.** UI-touching work goes to the design-reviewer subagent with a screenshot or running-story description; two consecutive rejections on the same item is a stop condition.
9. **Commit.** Conventional commit with package scope and REQ ID: `feat(spectral): probe spectrum extraction [SP-DP-007]`. Update STATE.md (requirement status, measurements, decisions, next selection).
10. **Gate check.** If the phase REQ set is fully met, invoke /phase-gate; a passing GATE-REPORT advances CURRENT_PHASE in STATE.md and the loop continues into the next phase's goal.

## 4. Quality Interlacing Cadence

**/simplify:** after every requirement cluster lands (step 6), plus a whole-package pass at each phase gate. Never during red tests.

**/security-review triggers** (any one suffices): changes under the store abstraction or request-authorization hook; worker message boundaries; anything parsing external bytes (codecs, ENVI/NetCDF/GeoTIFF parsers, `.spb`/`.sps` loaders); CSP or deploy workflow changes; dependency additions. Plus unconditionally at every phase gate. CI mirrors with `pnpm audit --prod --audit-level high` per the bessel pattern.

**/code-review:** read-only pass at each phase gate before the GATE-REPORT is finalized; findings triage into fix-now (blocks gate) or ledgered debt.

**Design review:** every REQ in SP-RP and SP-UX, plus any change to panel layout, interaction, typography, color, or motion. The reviewer holds DESIGN-BRIEF.md as its constitution and the frontend-design skill as its method.

## 5. Phase Goals (the /goal texts)

Each phase runs as one /goal whose end state is the phase gate. Copy verbatim, adjusting only the phase:

```
/goal Advance spectral-prism through Phase <N> of ROADMAP.md: implement every
unmet requirement the Phase <N> gate cites in REQUIREMENTS.md, following the
session protocol in docs/autonomy/AUTONOMY-PLAN.md Section 3 (one requirement
per iteration; pnpm verify green before every commit; /simplify after each
cluster; /security-review on its trigger list; design-reviewer on UI work).
Done means: /phase-gate writes a passing GATE-REPORT-P<N>.md, CI is green on
main, and STATE.md shows every Phase <N> requirement met with evidence. Stop
immediately and write docs/autonomy/ESCALATION.md instead if any stop
condition in AUTONOMY-PLAN.md Section 7 fires. Do not modify files under
docs/adr/ or REQUIREMENTS.md except by the amendment protocol.
```

The outer sequence (Phase 0 -> 1 -> 2 -> 3) can be run as consecutive /goal invocations. For supervision, prefer /rc in the goal session (monitor and steer from claude.ai) or a cloud routine; if supervising from a second local session, run it read-only from a separate git worktree with `/loop 30m read docs/autonomy/STATE.md and git log since last check; report progress, stalls, or ESCALATION.md; make no edits`. STATE.md has exactly one writer: the /goal session. Recommended posture: acceptEdits permission mode on a dev machine with the hook set active; bypassPermissions only inside a sandboxed container.

## 6. Parallelism (opt-in, not default)

Agent teams (research preview) become worthwhile exactly twice in this roadmap: Phase 1's three panels (spatial, spectral, feature-space) after the coordination contract lands, and Phase 2's kernel pairs (WebGPU + wasm implementations of the same reduction, which ADR-0008 requires to share an accumulation tree; a two-agent doer/checker split maps well). Rules: worktree per teammate; teammates own disjoint packages; only the lead touches STATE.md, prism-core, and merges; the full Section 3 protocol applies to the merged result, not per-teammate. Below three coupled workstreams, a single session is faster; default to it.

## 7. Stop Conditions (uncertainty and drift)

The loop stops and writes docs/autonomy/ESCALATION.md (what fired, evidence, options, recommendation) rather than guessing, when:

1. **Acceptance ambiguity:** a REQ's criterion is untestable as written, or two REQs conflict.
2. **ADR contradiction:** implementation evidence contradicts an accepted ADR (for example a probe-latency floor that dual layout cannot meet). ADRs change only by amendment; the loop proposes, the human disposes.
3. **Numerical tolerance failure:** cross-tier or oracle parity cannot reach ADR-0008 tolerances after two distinct kernel strategies.
4. **Dependency break:** icechunk-js or another pinned dependency fails conformance and the fix requires upstream changes (the plain-Zarr fallback keeps SP-DP-003 shippable meanwhile).
5. **Design deadlock:** the design-reviewer rejects the same item twice with materially different guidance, or a taste decision has no DESIGN-BRIEF anchor.
6. **Budget:** per-phase turn/cost ceiling reached (set at /goal launch), or three consecutive iterations produce no requirement transition.
7. **Scope gravity:** the correct implementation of a REQ appears to require work the non-goals exclude.

Escalations are the designed human touchpoints; an escalation is loop success, not failure.

## 8. Bootstrap Order (first session)

1. Scaffold monorepo per ROADMAP Phase 0 (pnpm workspaces, .nvmrc, verify scripts matching Section 9 vocabulary), commit the v0.4 spec package plus this autonomy kit.
2. Install the kit: .claude/settings.json, agents, phase-gate skill; run /init review so auto-memory anchors; confirm hooks fire with a dry run.
3. Author DESIGN-BRIEF.md v1 (seed provided) using the frontend-design skill; this must precede any UI code, since the reviewer needs a constitution before it can reject anything.
4. Wire CI: push ci.yml + deploy.yml; confirm Pages deploys the placeholder shell at /spectral-prism/.
5. Launch the Phase 0 /goal.

## 9. Verification Vocabulary (shared with CI, per bessel/vector-channels)

`pnpm verify` = typecheck && lint && test && build:web && size. Additional named gates: `pnpm audit:prod` (high+), `pnpm e2e` (Playwright; WebGPU-enabled Chromium flags for tier-A kernel tests, wasm tier runs headless everywhere), `pnpm lhci` (Lighthouse budgets, activates in Phase 1 when lighthouserc.json lands), `pnpm build:pages` (SPECTRAL_PRISM_BASE=/spectral-prism/). The completion checker, the developer, the hooks, and CI all speak exactly this vocabulary; nothing verifies with a command CI does not run.
