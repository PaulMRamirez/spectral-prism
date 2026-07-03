# Gate Report: Phase 0

Append-only history. Each adjudication is a new section; a later re-run never rewrites an earlier verdict.

## Adjudication 2026-07-03

**Verdict: FAIL** (blocked on human-only prerequisites; see ESCALATION.md). Adjudicated at commit `68a761f` on `main`.

The data plane is implemented and independently verified. The gate cannot pass because two gate criteria depend on artifacts only a human can provide: the demo mirror (for the SP-DP-007/008 perf measurement) and the ADR-0008 amendment adopting the Q1 capability-tier table. This is the escalation in docs/autonomy/ESCALATION.md, not a defect in the work.

### Requirement table (gate set: SP-DP-001..008, SP-DP-010, SP-UX-001)

| REQ       | Verdict                 | Executed evidence                                                                                                                                                                                                                                                                       |
| --------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SP-DP-001 | PASS                    | 10 store-conformance tests over loopback HTTP vs zarr-python fixtures (v2 zlib, v3 gzip, sharded v3); shard reads ranged and coalesced.                                                                                                                                                 |
| SP-DP-002 | PASS                    | 7 tests vs Python-icechunk fixtures; branch/tag/snapshot pinning with per-ref snapshot ids; inline/native/virtual payloads; plus a range-ignoring-server defensive-slicing test.                                                                                                        |
| SP-DP-003 | PASS                    | Fallback suite green with icechunk-js mocked absent; Icechunk stores reject with the explicit fallback-naming error; icechunk-js is a lazy import.                                                                                                                                      |
| SP-DP-004 | PASS                    | 22 conventions tests (unit + HTTP conformance): missing-georeferencing and missing-wavelengths matrix rows; malformed-CRS and non-finite-transform refusals (invariant 3); vocabulary CONFIRMED vs zarr-conventions v0.1.                                                               |
| SP-DP-005 | PASS (remainder)        | Binding round-trips generator->browser over HTTP; per-layout CRS asserted; degradation rows; SSRF closed. Producer half re-verifies when CLI v0 lands (debt-ledgered).                                                                                                                  |
| SP-DP-006 | PASS                    | Sidecar load via the binding pointer; skip-index zone-map pruning; sidecar-equals-fallback identity now non-vacuous (all-nodata + partial-nodata chunks); grid-shape/version validation; absent-stats returns null so the caller computes.                                              |
| SP-DP-007 | FAIL (gate measurement) | Probe implemented + conformance-tested (reads only the probed pixel column). Perf harness: p95 131 ms < 200 ms on a LOCAL PROXY (simulated 50 ms RTT / 50 Mbps, ADR-0003 sharded store), fresh run at adjudication. Acceptance is "measured on demo mirror"; the mirror does not exist. |
| SP-DP-008 | FAIL (gate measurement) | Cold-open-to-composite-data path + harness: 627 ms < 5 s on the LOCAL PROXY (excludes GPU render, Phase 1). Same mirror dependency.                                                                                                                                                     |
| SP-DP-010 | PASS                    | 7 auth-conformance tests: header/bearer/URL-rewrite hook modes on both stores; missing-credential surfaces an error; origin-scoped token proven not to leak to a foreign virtual-chunk host; credentials preserved through the hook.                                                    |
| SP-UX-001 | PASS                    | DESIGN-BRIEF v1.1 authored before any UI code; design-reviewer APPROVE on the placeholder shell (after one REJECT cycle closed by the TK-5 amendment).                                                                                                                                  |

Fresh evidence at adjudication: `pnpm verify` 103 tests + build (bundle 52.61 kB vs 5 MB budget); `pnpm test:parity` 3 tests; `pnpm audit:prod` clean; `pnpm perf` probe p95 131 ms, cold-open 627 ms (local proxy).

### Quality passes

- **/simplify:** applied inline per requirement cluster through the phase (the standing lighter-touch form); no outstanding cleanup.
- **/security-review:** run every iteration on its trigger list. Found and fixed: SP-DP-004 Low (prototype-chain unit lookup bypassing the nm-refusal gate), SP-DP-005 F-crit (SSRF/store-root escape via unvalidated binding paths; closed with the safeSubpath allowlist at the store boundary). SP-DP-001/002/003/006/010 clean.
- **/code-review (gate, read-only):** correctness findings F1 (transform coercion), F2 (hollow CrsInfo), F3 (vacuous sidecar identity), F4 (grid-shape validation), F6 (range-ignoring server), F7 (credential-dropping hook) all fixed with regression tests. F5 (coalesced-abort spillover, the documented ARCH 2.6 caveat, SP-DP-013 P1), F8, F9 ledgered as debt.

### Audits

- **spec-auditor:** returned DRIFT with one gate-blocking finding, F-1 (severity 2): the probe was shipped inside prism-core Stage 1, which ADR-0006 reserves for Stage 2. **Resolved** at this adjudication: extractProbeSpectrum and its conformance test moved to packages/spectral-prism (its consumer), the prism-core barrel export removed (verified: no probe module or export remains in prism-core). Debt findings F-2 (governor/chunk-cache open Phase 0 scope), F-3 (SP-DP-005/006 producer/warn re-verify), F-4 (probe reflectance doc, corrected), F-5 (hygiene) ledgered.
- **design-reviewer:** no new UI shipped since the placeholder shell it already APPROVEd (brief v1.1). Not re-run.

### CI parity

CI green on the adjudicated commit lineage (`main`). Each iteration's push was watched to green; two transient GitHub Pages deploy failures were resolved by re-dispatch, not code changes.

### Open questions closing by this gate

- **Q5 (icechunk-js posture):** CLOSED. Resolved in SPEC.md with a pointer to docs/research/icechunk-js-posture.md; ADR-0002 records the decision; SP-DP-002/003 met.
- **Q1 (capability tiers):** BLOCKED. The table is written (docs/capability-tiers.md) but "adopted" requires an ADR-0008 amendment (the tier-C reproducibility rule extends ADR-0008's parity contract), which the human disposes. This blocks the gate.

### Blocking items, in dependency order

1. **Q1 adoption** needs the ADR-0008 amendment (human disposes). Smallest unblock.
2. **SP-DP-007** needs `pnpm perf` run against the demo mirror on reference hardware. The mirror needs a public CORS bucket (human cloud credentials) carrying CLI-converted scenes (CLI v0, plus Earthdata-gated inputs).
3. **SP-DP-008** unblocks with the same mirror.

Do not advance CURRENT_PHASE. The loop is paused at the escalation; the recommended path is Option 1 in ESCALATION.md (human provisions the mirror and disposes the amendment; the loop finishes the gate).
