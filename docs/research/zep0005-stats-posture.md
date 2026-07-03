# ZEP0005 and the Per-Chunk Stats Posture

**Status:** v1, 2026-07-02. Informs SP-DP-006. Cross-checked against primary sources (workflow wf_fd1e99a0-464).

## Posture, in one paragraph

ADR-0003 calls the stats sidecar "ZEP0005-aligned". The research below establishes that ZEP0005 is a stale draft about chunk cumulative sums, not a ratified per-chunk statistics format, and that no per-chunk statistics convention exists in zarr-conventions as of 2026-07. So "aligned" means aligned in spirit only. The spectral-prism sidecar is therefore the tool's own convention: a group of per-chunk scalar arrays (min/max/sum/count) whose shape equals the data array's chunk grid, versioned under `spectral_prism:stats` and read through a single dialect adapter (packages/prism-core/src/stats/chunk-stats.ts). Unknown attributes are ignored, partial sidecars load partially, stat arrays whose length does not match the chunk grid are dropped, and absence degrades to on-the-fly computation with a warning. When a real zarr-conventions statistics convention lands, it is added as another dialect behind the same adapter, and the extensions ledgered for eventual registration (ADR-0003) can seed it.

## 1. Current status: stale Draft, never advanced, not folded into anything ratified

**ZEP0005, "Zarr-based Chunk-level Accumulation in Reduced Dimensions"** (Hailiang Zhang et al., NASA GES DISC / Goddard, created 2023-02-12) carries `Status: Draft` and still sits in the `draft/` folder of [zarr-developers/zeps](https://github.com/zarr-developers/zeps/blob/main/draft/ZEP0005.md) as of today. Verified via GitHub API:

- Last substantive commit to `draft/ZEP0005.md`: **2023-03-08**. No edits since.
- Its discussion PR, [zarr-specs #205](https://github.com/zarr-developers/zarr-specs/pull/205), is **open, unmerged**, last comment 2023-11-30 (a ZEP-meeting invitation that went nowhere).
- The NASA team published a paper in June 2025 ([arXiv 2506.14981](https://arxiv.org/pdf/2506.14981)) but did not advance the ZEP.

**Critical framing correction**: ZEP0005 is not primarily a per-chunk statistics proposal. It specifies **chunk-interval cumulative sums (prefix sums) for O(1) range averaging**. Per-chunk statistics appear only as one sentence: "this solution is also applicable for storing chunk statistics (min, max, sum, count, etc.) to help with performing aggregations." Everything beyond that sentence in a "ZEP0005-aligned stats sidecar" is extrapolation.

**The "chunk-scaled metadata" thread did not produce a mechanism either:**

- [zarr-specs #305](https://github.com/zarr-developers/zarr-specs/issues/305) ("Entrypoint for storing metadata that scales with number of chunks", TomNicholas, 2024-08-10): **open, 4 comments, dormant since 2024-08-12**. Its resolution trend: defer chunk-scaled metadata to the Store layer (rabernat: Earthmover's then-unreleased store, which became Icechunk).
- [zarr-specs #319](https://github.com/zarr-developers/zarr-specs/issues/319) ("Extension proposal: chunk statistics", barbuz, 2024-11-14): **open, dormant since 2024-11-21**. Proposed one small JSON per chunk with min/max/average/non-NaN-count; feedback (d-v-b, martindurant, jhamman) steered it toward chunk manifests (Icechunk) as the natural home. No spec, no prototype landed.
- [Icechunk #331](https://github.com/earth-mover/icechunk/issues/331) ("Support chunk-level statistics", dcherian, 2024-10-25): **open, empty body, zero comments**. Icechunk has "intentionally left room in the Chunk Manifest spec" for statistics (jhamman on #319) but has not implemented them through spec 2.x.

**Ecosystem shift since the draft**: the ZEP pipeline was largely superseded by (a) the [zarr-extensions](https://github.com/zarr-developers/zarr-extensions) registry (ZEP0009 / spec v3.1; ZEP10 generic `extensions` field still draft, [zeps #67](https://github.com/zarr-developers/zeps/issues/67)) and (b) a new **[zarr-conventions](https://github.com/zarr-conventions/zarr-conventions-spec) GitHub org** (active 2025-2026, ZEP0011 governance accepted 2026-05-29) with a `zarr_conventions` attributes mechanism. I enumerated all repos in the org: multiscales, spatial, proj, dggs, stac, CF, nz, missing_value, seamless-arrays, dependent-arrays, zarr-cm, template. **No statistics convention exists**; no statistics extension is registered in zarr-extensions; the registered-attributes catalog is empty.

**Honest status for the project**: ZEP0005 is an abandoned-in-place draft. If per-chunk statistics standardize, the likely vehicles are a zarr-conventions convention (declared via a `zarr_conventions` CMO with `uuid`/`schema_url`) or Icechunk manifest columns, not ZEP0005 ratification. Treating the exact spelling as provisional is the correct posture; "ZEP0005-aligned" should be understood as "aligned with a stale draft's direction," and the sidecar should be designed for renaming/redeclaration under the conventions framework.

## 2. Proposed on-disk structure

What ZEP0005 **actually specifies** (all Zarr v2-era: `.zgroup`/`.zattrs`/`.zarray`, xarray `_ARRAY_DIMENSIONS`):

- A **sibling Zarr group** named `${raw_dataset}_accumulation_group`, adjacent to the raw array in the same hierarchy. Association is by **naming convention** (the suffix) plus the group's own attributes; the parent array's metadata is untouched (no pointer from parent to sidecar).
- Inside the group, **one Zarr array per accumulation dataset** (e.g. `acc_lat`, `acc_wt_lat`, `acc_lat_lon`).
- Group attribute `_ACCUMULATION_GROUP`: a recursive JSON object keyed by **ordered dimension names**; leaf keys are the three cumulative-sum types `_DATA_WEIGHTED`, `_DATA_UNWEIGHTED`, `_WEIGHTS`, whose values are dataset names. Unused dimension combinations are empty `{}`.
- Per-array attributes `_ARRAY_DIMENSIONS` plus `_ACCUMULATION_STRIDE` (same length; stride k = sums computed every k chunks along that dim, 0 = no accumulation along that dim). So a conformant sidecar is **not necessarily per-chunk**.

What ZEP0005 does **not** specify: canonical names for min/max/sum/count (none exist anywhere in ratified Zarr specs), statistic dtypes (the draft is silent; NASA's implementation choices are unspecified in the ZEP), or a parent-side attribute pointer.

The structure you describe (parallel Zarr array of shape = the data array's chunk-grid shape, one array per statistic) is the shape the **discussion** converges on, not the draft's text: TomNicholas in #305 ("another zarr array (with shape = chunk grid shape)") and d-v-b in #319 ("a tabular data structure, with 1 row per chunk"). If spectral-prism uses chunk-grid-shaped stat arrays with names like `min`/`max`/`sum`/`count`, that is an inference from community discussion plus Parquet/Snowflake zone-map precedent, and it is your convention to document, not a standard to cite.

## 3. Skip indices

**Nothing is standardized.** The pattern is articulated in [zarr-specs #319](https://github.com/zarr-developers/zarr-specs/issues/319): for a predicate like `x > t`, a chunk **cannot contain a hit** if `chunk_max <= t` (skip fetch entirely); it is **all hits** if `chunk_min > t` (mask without fetch); only chunks with `min <= t < max` need fetching. This is classic zone-map pruning (the ZEP itself cites Snowflake's table-statistics optimization as prior art); Zarr has no spec-level encoding for it.

**All-fill/nodata chunks**: the only spec-level mechanism is Zarr core (v2 and v3): **a chunk with no stored object is defined to be entirely `fill_value`** ([v3 core spec](https://zarr-specs.readthedocs.io/en/latest/v3/core/v3.0.html)); zarr-python's `write_empty_chunks=False` and Icechunk manifests (absent chunk ref) both use chunk absence as the all-fill encoding. There is no standardized "all-nodata" flag inside any stats sidecar; #319's "number of non-nan values" per chunk (a valid-count of 0 implying skip) is the closest proposal. The zarr-conventions `missing_value` repo covers sentinel missing values, not chunk-level emptiness. A consumer wanting cheap all-fill detection without a HEAD/list operation must get it from its own sidecar (e.g. `count == 0`) or from a manifest store.

## 4. Percentiles and histograms

**Not covered anywhere.** ZEP0005 defines only cumulative sums of weighted data, unweighted data, and weights; its one statistics sentence lists "min, max, sum, count, etc." Issue #305 mentions "mean, median, mode, min, max" as hypothetical examples; #319 proposes "minimum, maximum, average, number of non-nan values." No Zarr proposal, extension, or convention mentions per-chunk percentiles, histograms, or sketches (t-digest, KLL, etc.). **Per-chunk mean spectra and histogram sketches are 100% spectral-prism extensions** and should be namespaced (`spectral_prism:`) and documented as such, consistent with the ADR-0003 posture of keeping binding/provenance metadata under the project namespace.

## 5. What a browser reader should tolerate

Since nothing is ratified, these are recommendations inferred from the conventions framework and the draft's own semantics, plus defensive-reader practice:

- **Unknown attributes must never fail a read**: both the [zarr-conventions spec](https://github.com/zarr-conventions/zarr-conventions-spec) (conventions are "safely ignorable") and the [zarr-extensions](https://github.com/zarr-developers/zarr-extensions) attributes catalog ("implementations... are not required to fail if the attributes dictionary contains unknown keys") establish this.
- **Partial sidecars are the spec'd norm, not an edge case**: ZEP0005 explicitly permits accumulation for only some dimension combinations (empty `{}` entries) and sub-chunk-resolution strides. Presence-test each statistic array independently; degrade per-statistic (no min/max: no skip index, full fetch; no count: assume all chunks may contain data). Never require the full stat set.
- **Validate shape against the parent's chunk grid at load**: a stat array whose shape mismatches the current chunk grid (array appended/rechunked after stats were written) is stale; ignore it silently and surface "stats unavailable" through the provenance UI (invariant 3), do not error. Plain Zarr provides no transactional link between data and sidecar; Icechunk would, but does not implement stats yet.
- **Version skew**: ZEP0005's attribute schema has **no version field at all**. The conventions framework versions via `schema_url` (e.g. `.../v1/schema.json`) in the `zarr_conventions` CMO. Carry an explicit sidecar version key under `spectral_prism:`, accept-and-ignore unknown newer fields, and gate skip-index trust (stats used to _avoid_ fetches must be version-and-shape validated; stats used only for display hints can be laxer).
- **Plan for respelling**: read the sidecar through one adapter keyed by a declared identifier, so a future zarr-conventions statistics convention (or Icechunk manifest stats) can be added as a second dialect without touching consumers.

## Sources

- ZEP0005 draft: https://github.com/zarr-developers/zeps/blob/main/draft/ZEP0005.md (rendered: https://zarr.dev/zeps/draft/ZEP0005.html)
- Discussion PR: https://github.com/zarr-developers/zarr-specs/pull/205
- Chunk-scaled metadata: https://github.com/zarr-developers/zarr-specs/issues/305
- Chunk statistics proposal: https://github.com/zarr-developers/zarr-specs/issues/319
- Icechunk chunk stats: https://github.com/earth-mover/icechunk/issues/331
- Reference implementations: https://github.com/nasa/zarr-accumulation-generation, https://github.com/nasa/zarr-accumulation-service
- NASA paper (June 2025): https://arxiv.org/pdf/2506.14981
- Extensions registry: https://github.com/zarr-developers/zarr-extensions
- Conventions spec: https://github.com/zarr-conventions/zarr-conventions-spec
- Governance (ZEP0011, accepted 2026-05-29): https://github.com/zarr-developers/zeps/blob/main/active/ZEP0011.md; ZEP10: https://github.com/zarr-developers/zeps/issues/67
- Zarr v3 core (fill_value / missing chunk semantics): https://zarr-specs.readthedocs.io/en/latest/v3/core/v3.0.html
