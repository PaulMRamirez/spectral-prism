# Escalation: Phase 0 Gate Blocked on Human-Only Prerequisites

**Date:** 2026-07-03
**Raised by:** the autonomous loop, at the Phase 0 gate check (AUTONOMY-PLAN Section 3 step 10, Section 7).
**Status of the loop:** paused, awaiting disposition. Per AUTONOMY-PLAN Section 7, an escalation is loop success, not failure.

## Disposition (2026-07-04, Paul Ramirez)

**Blocker 1: Option 2 chosen.** SP-DP-007/008 acceptance is amended to accept the documented simulated reference baseline for the P0 gate, with the demo-mirror measurement remaining a ledgered follow-up obligation. Applied to REQUIREMENTS.md (v0.7) by the loop under this disposition; the amendment is recorded in the annex's status line and the mirror obligation in the STATE.md debt ledger.

**Blocker 2: pending.** The proposed ADR-0008 amendment below still awaits a separate yes/no; the gate cannot pass without Q1 adoption.

## What fired

Two Phase 0 gate criteria cannot be satisfied autonomously, because both depend on artifacts only a human can provide. Everything else the Phase 0 gate cites is done and green on `main`.

### Blocker 1: the demo mirror (SP-DP-007, SP-DP-008)

SP-DP-007 (probe-to-spectrum under 200 ms) and SP-DP-008 (cold open to composite under 5 s) have the acceptance criterion **"Measured on demo mirror"**, against the reference baseline in SPEC Section 9 (2024-class integrated-GPU laptop, 50 Mbps / 50 ms RTT). The demo mirror does not exist, and standing it up is a human-only task with two sub-dependencies already ledgered in STATE.md:

1. It carries CLI-converted scenes, so **CLI v0 must exist first** to produce dual-layout GeoZarr from real EMIT/AVIRIS-3 granules. CLI v0 is a Phase 0 ROADMAP deliverable but is not itself a gate-cited REQ; it is large, and the archives are auth-gated (Earthdata Login), so even generating the inputs needs credentials.
2. Provisioning a **public, CORS-enabled bucket needs cloud credentials only the human holds.**

The loop cannot self-provision cloud infrastructure or hold Earthdata credentials, so it cannot produce the gate-required measurement. This was anticipated: the mirror is described in STATE.md as "a human touchpoint, not an escalation." It becomes an escalation now only because it is the gate's blocking item.

**What the loop did instead (maximal autonomous progress):**

- Implemented the probe (`extractProbeSpectrum`) and the cold-open-to-composite-data path, both conformance-tested (commit `6dc80f5`). The probe conformance proves it reads only the probed pixel column, not the whole cube (the one-read-per-spectrum design, ADR-0003).
- Built a perf harness (`pnpm perf`) that measures against an AVIRIS-class synthetic store (224 bands x 512 x 512) under a **simulated** reference baseline (50 ms RTT, 50 Mbps, via a lumped network model in the test fixture server). The harness is parameterized by `PERF_STORE_URL`, so **the identical harness runs against the demo mirror the moment it exists** (`PERF_STORE_URL=https://... pnpm perf`), with no code change.
- Local-proxy measurements (STATE.md Measurements, not the gate measurement): probe p95 **132 ms** (target 200 ms), cold open **627 ms** (target 5 s). Both pass with margin under the simulated baseline.
- Surfaced a real design finding: plain `(224, 64, 64)` spectral chunks miss the probe target at reference bandwidth (one 1.83 MB chunk per probe, p95 287 ms). The **ADR-0003 sharded layout** (`(224, 16, 16)` inner chunks inside `(224, 64, 64)` shards) with suffix-range index reads meets it (132 ms). Sharding is therefore load-bearing for SP-DP-007, not merely a softening. This validates ADR-0003 empirically and is worth carrying into the CLI's default layout.

**What remains for the gate:** run `pnpm perf` against the demo mirror on reference hardware and record the numbers. Nothing else.

### Blocker 2: Q1 capability-tier adoption (Phase 0 gate criterion)

The Phase 0 gate also requires "the Q1 capability-tier table written and adopted." The table is **written** (`docs/capability-tiers.md`, v1 draft). **Adoption** is blocked: the table's tier-C-overlay reproducibility rule extends ADR-0008's parity contract, and per the table's own Section 10 and the amendment protocol, that binds only once recorded as an **ADR-0008 amendment**. ADRs change by amendment that the human disposes (the loop proposes). This is already in STATE.md Human Follow-ups.

## Options

1. **(Recommended) Human provisions the mirror and disposes the ADR-0008 amendment; the loop finishes the gate.** Concretely: (a) approve/author the ADR-0008 amendment adopting the tier-C reproducibility rule, which lets `docs/capability-tiers.md` be marked adopted; (b) stand up the CORS-enabled bucket and (with CLI v0, or a hand-converted seed scene) publish one EMIT and one AVIRIS-3 dual-layout store; (c) provide `PERF_STORE_URL`. The loop then runs `pnpm perf` against it, records the numbers, and `/phase-gate` re-adjudicates. Smallest change, keeps the gate criteria as written.

2. **Amend SP-DP-007/008 acceptance to permit a documented simulated baseline as the gate measurement, with the mirror run as a follow-up.** This would let the gate pass on the local-proxy numbers now. It requires a REQUIREMENTS.md amendment (the acceptance text "Measured on demo mirror" is the thing being relaxed) and weakens the guarantee: a simulated network and synthetic scene are not the real mirror on reference hardware. Not recommended without a deliberate decision, because the perf targets are the point of the gate.

3. **Build CLI v0 first (a larger autonomous effort), still stopping at the bucket + credentials.** The loop can build the CLI that converts a locally-supplied granule to dual-layout GeoZarr, which removes sub-dependency 1 from Blocker 1. It cannot remove the bucket/credentials or the Earthdata-gated inputs. This defers, not resolves, the escalation, and CLI v0 is not a gate-cited REQ.

## Recommendation

**Option 1.** The data plane is done and independently verified; the only things between here and a passing Phase 0 gate are (a) your ADR-0008 amendment for Q1 adoption and (b) the mirror, which needs your cloud credentials. The perf code and harness are ready and give strong pre-mirror evidence (probe 132 ms, cold open 627 ms in simulation) that the targets hold, so the mirror run should be a confirmation rather than a risk. If you want the gate to pass on simulated numbers in the interim, that is Option 2 and needs an explicit REQUIREMENTS.md amendment from you.

Options 1 and 3 compose: approve the amendment below (ten minutes, no infrastructure), tell the loop to build CLI v0 while you provision the bucket, and the mirror measurement closes the gate when both converge.

## Proposed ADR-0008 amendment text (the loop proposes; you dispose)

To reduce Blocker 2 to a yes/no, the following is ready to append to `docs/adr/0008-numerical-policy.md` under its Status line, verbatim or edited to taste. The loop has not touched that file.

> **Amendment 1 (2026-07-XX): tier-C threading overlay reproducibility.** The capability-tier table (docs/capability-tiers.md, adopted at the Phase 0 gate with this amendment) defines a tier C overlay: threaded wasm kernels and threaded DuckDB, available only in the isolated deployment posture per ARCHITECTURE 8.1. This amendment extends this ADR's reproducibility contract to that overlay. Tier C threads parallelize only across chunks, never within a chunk's accumulation; the f64 hierarchical merge runs on CPU in the fixed chunk-index order this ADR prescribes; and thread count or scheduling never changes the merge tree's shape. Consequently B and B+C produce bitwise-identical fit results for a given chunk stream, as do A and A+C: the within-tier reproducibility guarantee keys on the compute axis (A or B) alone, and the C overlay is a performance property, never a numerical one. The tier-C conformance fixture (capability-tiers.md Section 8) asserts this contract in CI.

On approval: date the amendment, append it to ADR-0008, update the ADR's Status line to "Accepted (amended v1.1: tier-C overlay reproducibility)", and mark docs/capability-tiers.md Section 10 adopted. Any wording change you make supersedes the proposal; the table's Section 2 text should then be aligned if the substance shifts.

## State at escalation

- **Met and green on `main` (7 of 9 data-plane P0 REQs):** SP-DP-001, 002, 003, 004, 005, 006, 010, plus SP-UX-001. CI green; Pages live.
- **Implementation + local-proxy PASS, gate-blocked:** SP-DP-007, SP-DP-008.
- **Written, adoption pending your amendment:** Q1 capability-tier table.
- No ADRs or REQUIREMENTS.md were modified by the loop. No stop condition other than this one fired.
