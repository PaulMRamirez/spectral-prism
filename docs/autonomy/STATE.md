# Spectral Prism: Loop State Ledger

CURRENT_PHASE: 0
LAST_AUDIT: 2026-07-03, /security-review per iteration through SP-DP-005. SP-DP-004 found+fixed a Low (prototype-chain unit lookup); SP-DP-005 found+fixed an F-crit SSRF/store-root escape via unvalidated binding paths (safeSubpath allowlist at the store boundary). SP-DP-001/002/003 clean.
OPEN_ESCALATION: none

## How to read this file

Single source of loop truth, updated at the end of every iteration (session protocol step 9) and by the phase-gate skill. The SessionStart hook prints the top of this file into every session. If git history and this ledger disagree, git wins and the first act of the session is reconciliation.

## Requirement Status: Phase 0

| REQ       | Status | Evidence                                                                                                                                                                                                                                                                                              | Notes                                                                                                                            |
| --------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| SP-DP-001 | met    | Commit aa9846d: 10-test store-conformance suite over loopback HTTP against zarr-python-generated fixtures (v2 zlib, v3 gzip, sharded v3); shard reads ranged and coalesced (fewer requests than inner chunks; coalescer flush reports; baseline comparison)                                           | zarrita pinned ^0.7.3; useSuffixRequest off by default (HEAD + offset range fallback)                                            |
| SP-DP-002 | met    | Commit df4a655: 7-test conformance suite against Python-icechunk-generated repos over loopback HTTP; branch/tag/snapshot pinning with per-ref snapshot ids asserted; inline, native, and virtual payloads all exercised; snapshot id surfaced on the store for provenance                             | icechunk-js pinned exactly 0.6.0; virtual refs relocatable via the URL-rewriting hook                                            |
| SP-DP-003 | met    | Commit 17f8943: fallback suite green with icechunk-js mocked absent (v2/v3/sharded reads through the public barrel; Icechunk stores reject with the explicit fallback-naming error)                                                                                                                   | icechunk-js is now a lazy dynamic import at store-open time (Q5 bundle posture)                                                  |
| SP-DP-004 | met    | Commit 5b3fbdd: reader unit suite (13 tests incl. security regression) plus HTTP conformance over committed fixtures exercising missing-georeferencing and missing-wavelengths matrix rows; vocabulary verified against zarr-conventions v0.1 drafts (docs/research/geozarr-vocabulary.md, CONFIRMED) | wavelength normalizes to nm at this boundary; array-level proj:/spatial: resolution deferred to SP-DP-005 binding                |
| SP-DP-005 | met    | Commit 30a1011: binding round-trips generator to browser over HTTP (6 conformance + 4 unit tests); per-layout CRS asserted (native UTM spectral vs. EPSG:3857 pyramid, ADR-0007); single-layout and no-layout degradation rows; SSRF/traversal in layout paths closed                                 | statsPath resolution deferred to SP-DP-006, routes through the same safeSubpath gate                                             |
| SP-DP-006 | met    | Commit df7af6b: 14 tests (unit + HTTP conformance) covering sidecar load via the binding pointer, skip-index zone-map pruning, and the sidecar-equals-fallback identity; absent-stats returns null so the caller computes and warns; statsPath through the safeSubpath gate                           | ZEP0005 is non-ratified (stale, cumulative-sums draft); sidecar is a spectral-prism dialect versioned under spectral_prism:stats |
| SP-DP-007 | unmet  |                                                                                                                                                                                                                                                                                                       | perf: record ms against baseline                                                                                                 |
| SP-DP-008 | unmet  |                                                                                                                                                                                                                                                                                                       | perf: record s against baseline                                                                                                  |
| SP-DP-010 | unmet  |                                                                                                                                                                                                                                                                                                       |                                                                                                                                  |

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
- AuthorizedHttpStorage (stores/icechunk.ts) mirrors icechunk-js HttpStorage semantics because upstream only takes static headers; propose a fetch-injection option upstream (Q5 contribution posture), then delete the mirror.
- SP-DP-010 must include a hostile-virtual-ref fixture: a repo whose virtual chunk location points at a foreign host, asserting an origin-scoped hook attaches nothing there (sharp edge documented on RequestAuthorizer, security review 2026-07-03).
- Multiscales levels[].path (conventions/geozarr.ts) is attacker-controlled and inert today; when a Phase 1 REQ opens pyramid levels to render tiles, route those paths through safeSubpath before any fetch (same trust boundary as the binding paths; security review 2026-07-03).

## Decisions Journal

- 2026-07-02: Section 8 bootstrap executed end to end (governance dbe7c28, docs c8c73c0, brief amendment 8aa66f2, scaffold 9116bba). Research ran as a 20-agent verified workflow (wf_4f11d0c7-7fb): name scan (keep spectral-prism + sprism; prism-core publishes scoped only), Q1 tier table drafted for gate adoption, Q5 resolved as exact-pin icechunk-js 0.6.0 with the official Earthmover wasm bindings watched as successor.
- 2026-07-02: /init review skipped deliberately: CLAUDE.md is hand-authored and current; regenerating it risked destroying the baseline. Memory anchor written to the session memory store instead (AUTONOMY-PLAN Section 8 step 2 intent preserved).
- 2026-07-02: Commit order enforced brief-before-UI so SP-UX-001 holds in git history, not just in the working tree.
- 2026-07-02: SP-DP-001 shipped (aa9846d). Selected as lowest unmet P0; plan named the acceptance criterion and the proving test up front. API facts verified against zarrita 0.7.3's shipped types plus a research cross-check workflow (wf_67f6eb25-d34). Notes banked for later iterations: zarrita's default chunk queue is unbounded (SP-DP-013 must supply its own), AsyncReadable's options type changed in zarrita 0.7.0 so the icechunk-js pin must be version-matched at that boundary (SP-DP-002), useSuffixRequest stays off by default for host compatibility. /simplify ran inline (three fixes) after the parallel-agent form was declined; the lighter inline form is the standing preference for cleanup passes.
- 2026-07-03: SP-DP-002 shipped (df4a655). Fixtures from Python icechunk 2.1.0 (spec 2.1 repos, read fine by icechunk-js 0.6.0's v2 reader, confirming the Q5 compatibility note). Coverage deliberately spans all three payload types after noticing 64-byte chunks inline silently. Virtual-ref relocatability solved with the RFC 2606 .invalid placeholder host rewritten by the authorization hook, avoiding ReadSession-level virtualChunkContainers plumbing for now. Security review empty; virtual-ref credential sharp edge documented and its SP-DP-010 fixture ledgered.
- 2026-07-03: SP-DP-006 shipped (df7af6b). Research (wf_fd1e99a0-464) corrected the framing before commit: ZEP0005 is a stale draft about chunk cumulative sums, not per-chunk min/max, and no per-chunk statistics convention exists in zarr-conventions. So "ZEP0005-aligned" (ADR-0003) means in-spirit only; the sidecar is now explicitly a spectral-prism dialect (versioned under spectral_prism:stats, read via one adapter, unknown attrs ignored), documented in docs/research/zep0005-stats-posture.md. Verifier verdict pending at commit time; posture is the conservative non-ratified reading and does not depend on it.
- 2026-07-03: SP-DP-005 shipped (30a1011). Security review caught a real F-crit: binding layout paths flowed unvalidated into scopedReadable, and since FetchStore url-joins keys against its base, "../../secret" escaped the store root and "http://evil.example/x" redirected all reads cross-origin (SSRF, and an authorizer-token leak channel). Fixed at the store boundary with a strict safeSubpath allowlist so every metadata-supplied subpath (binding now, statsPath at SP-DP-006) is gated once. Also added a no-layout-readable degradation row found while writing the SSRF regression test (both-hostile case fell through the two single-layout branches).
- 2026-07-03: SP-DP-004 shipped (5b3fbdd). Vocabulary research (wf_d2c19f10-601, CONFIRMED) corrected two guesses before commit: zarr_conventions is an array of objects, and multiscales v0.1 is layout/asset (OME datasets/path kept as legacy fallback). Security review found a real Low: prototype-chain unit lookup ('constructor' as units) bypassed the nm refusal gate; fixed with a null-prototype table and regression tests. Reader reads group-level attributes only; array-level resolution lands with the SP-DP-005 binding.
- 2026-07-03: SP-DP-003 shipped (17f8943). Implemented as the lazy-import refactor rather than a test-only change: the requirement is architectural (fallback independent of icechunk-js), so the import graph now enforces it and the fallback suite guards it. Two transient GitHub Pages service failures on the SP-DP-002 deploy resolved by a fresh workflow_dispatch run; not a pipeline defect.
