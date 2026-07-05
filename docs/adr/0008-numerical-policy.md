# ADR-0008: Numerical Policy for Streaming Fits and Cross-Tier Parity

**Status:** Accepted (amended v1.1: tier-C overlay reproducibility)
**Date:** 2026-07-01 (added by spec review v0.2, findings F20/F21); amended 2026-07-04

**Amendment 1 (2026-07-04, human-disposed per docs/autonomy/ESCALATION.md): tier-C threading overlay reproducibility.** The capability-tier table (docs/capability-tiers.md, adopted at the Phase 0 gate with this amendment) defines a tier C overlay: threaded wasm kernels and threaded DuckDB, available only in the isolated deployment posture per ARCHITECTURE 8.1. This amendment extends this ADR's reproducibility contract to that overlay. Tier C threads parallelize only across chunks, never within a chunk's accumulation; the f64 hierarchical merge runs on CPU in the fixed chunk-index order this ADR prescribes; and thread count or scheduling never changes the merge tree's shape. Consequently B and B+C produce bitwise-identical fit results for a given chunk stream, as do A and A+C: the within-tier reproducibility guarantee keys on the compute axis (A or B) alone, and the C overlay is a performance property, never a numerical one. The tier-C conformance fixture (capability-tiers.md Section 8) asserts this contract in CI.

## Context

WGSL has no f64; naive f32 sum-of-products covariance over 10^5 to 10^7 pixels in 224 dimensions loses precision exactly where MNF is most sensitive (noise covariance, small eigenvalues, near-singular inversions for RX/CEM). Floating-point reduction order differs between WebGPU workgroup reductions, GPU vendors, and sequential wasm loops, so bitwise cross-tier reproducibility of fits is mathematically unavailable. Eigenvector sign is arbitrary (-v is as valid as v) and component order under near-degenerate eigenvalues is solver-dependent; without conventions, "the same fit" can produce visually inverted components run to run.

## Decision

1. **Accumulation form:** per-chunk partial statistics computed in f32 using the pairwise/Welford-style co-moment form (deviations from a per-chunk running mean, never raw cross-products), which bounds catastrophic cancellation within a chunk.
2. **Merge in f64:** chunk partials merge hierarchically on CPU in f64 (JS numbers), using the standard parallel co-moment combination; the merge tree is deterministic (chunk-index order), so fits are reproducible within a tier given the same chunk stream.
3. **Solves in f64:** eigendecomposition and Cholesky run in f64 wasm on the merged matrices; condition number is computed and surfaced before any inversion (RX/CEM), refusing with guidance past a threshold.
4. **Conventions:** each eigenvector is oriented so its largest-magnitude coefficient is positive; components order by descending eigenvalue with deterministic index tiebreak; both conventions applied at solve time and recorded in `.spb`.
5. **Parity contract:** the wasm fallback tier implements the identical accumulation tree, so cross-tier differences are tolerance-bounded, not structural. CI enforces: apply is bitwise-deterministic within a tier for a given `.spb` and input chunks; fit is reproducible within a tier; fit and apply are tolerance-compared across tiers and against a NumPy/SciPy oracle, including a committed real-AVIRIS golden scene.

## Options Considered

**A. f32 end to end.** Fastest; unacceptable precision for MNF noise statistics and RX inversions. **B. Emulated f64 in WGSL (double-double).** Precise; roughly 10x kernel cost and heavy shader complexity for a merge the CPU does in microseconds. **C. f32 partials + f64 CPU merge and solves (chosen).** Precision where it matters, GPU speed where it dominates, and a deterministic merge tree for free. **D. Bitwise cross-tier determinism as a goal.** Rejected as unachievable; replaced by the parity contract.

## Consequences

Easier: the SPEC determinism criterion becomes testable; sign-stable components across sessions; honest CI gates. Harder: kernels must emit co-moment partials rather than raw sums (slightly more state per chunk); the merge tree ordering becomes part of the provenance contract. Revisit: if WGSL gains f64 or shader-f16 changes the cost model.
