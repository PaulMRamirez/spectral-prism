# Spectral Prism

A browser-native analytical workbench for imaging spectroscopy. The spectrum is the primary object; the image is spatial context.

Spectral Prism loads cloud-hosted hyperspectral cubes (Zarr v3 / GeoZarr / Icechunk, including virtualized archival AVIRIS and EMIT granules) directly in the browser, runs fit-phase linear algebra (PCA, MNF, RX) on the client GPU via WebGPU, and presents a linked triad of spatial, spectral, and feature-space views with cross-panel brushing. No server compute, no install, air-gap deployable.

Sibling project of raster-prism; shared substrate in prism-core.

## Documents

| File | Contents |
|---|---|
| `SPEC.md` | Vision, design principles, goals and non-goals, panel triad, strategy families with compatibility rules, success criteria, owned open questions |
| `REQUIREMENTS.md` | Traceability annex: numbered P0/P1/P2 requirements with acceptance criteria, verification classes, and proving gates |
| `ARCHITECTURE.md` | Data / compute / render / coordination planes, worker topology and request mechanics, memory governor, isolation postures, degradation matrix, library selections, data-flow traces |
| `docs/adr/0001` | Zarr v3 + GeoZarr conventions as native format |
| `docs/adr/0002` | zarrita.js + icechunk-js access; virtualization for archival data |
| `docs/adr/0003` | Dual chunk layout with ZEP0005-aligned statistics (amended: sparse pyramid spacing) |
| `docs/adr/0004` | All spectral math in the compute plane; WebGL2 renders derived tiles (amended) |
| `docs/adr/0005` | Mosaic + DuckDB-WASM coordination and analytics layer |
| `docs/adr/0006` | prism-core package split (two-stage extraction) |
| `docs/adr/0007` | Display projection model: native-CRS scene mode default, ingest-warped basemap mode optional |
| `docs/adr/0008` | Numerical policy for streaming fits and cross-tier parity |
| `docs/reviews/` | Versioned reviews v0.1-v0.3 plus the v0.4 user-journey review and its addendum (findings F1-F43) |
| `GAP-ANALYSIS.md` | Competitive landscape matrix (four camps), gap statement, threats, complements, adoption wedges |
| `ROADMAP.md` | Phases 0-3 with gates citing requirement IDs; risk table with tripwires; parked items |
| `docs/autonomy/` | AUTONOMY-PLAN.md (the /goal-driven delivery loop, quality cadence, stop conditions) and STATE.md (the loop ledger) |
| `docs/design/DESIGN-BRIEF.md` | Design constitution seed; expanded to v1 at bootstrap before any UI code |
| `.claude/` | Autonomy harness: hooks (settings.json), design-reviewer and spec-auditor subagents, phase-gate skill |
| `.github/workflows/` | ci.yml and deploy.yml (shared verification vocabulary; GitHub Pages, bessel/vector-channels pattern) |
| `CLAUDE.md` | Project reference for coding sessions: ten invariants, conventions, review-loop protocol, testing expectations, current phase |

## Status

Specification stage, **v0.6 baselined** (2026-07-01): four review passes plus addendum applied (F1-F43: five personas incl. airborne ops: technical, hardening, formalization, user-journey), ADR-0003 amended for sparse pyramids per Earthmover multiscales findings, optional posture-4 acceleration documented. Further hardening routes through Phase 0 implementation evidence. Phase 0 (substrate) is the next executable step; see `ROADMAP.md`.

## License

Apache 2.0 (intended).
