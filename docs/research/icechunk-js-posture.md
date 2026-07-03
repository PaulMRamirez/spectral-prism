# icechunk-js Dependency Posture

**Status:** v1, 2026-07-02, closes SPEC Q5 pending Phase 0 gate adoption
**Owner:** data plane
**Relates to:** ADR-0002, SP-DP-002, SP-DP-003, ROADMAP standing risk "icechunk-js maturity"

## 1. Verified Facts

All facts checked on 2026-07-02 against the npm registry, the GitHub API, and the Icechunk documentation site. Where SPEC.md Q5 characterized the project ("young community reader, EarthyScience, MIT"), every element verified true, and the maturity picture is better than the Q5 wording implies.

### The community reader: icechunk-js (EarthyScience)

- **npm package:** `icechunk-js`, latest published version **0.6.0** (2026-06-24). Source: npm registry metadata for `icechunk-js`.
- **Repository:** https://github.com/EarthyScience/icechunk-js, created 2026-03-27, last push 2026-06-24, MIT license (confirmed in both the GitHub license field and npm metadata), 21 stars, 1 open issue.
- **Description (upstream):** "Read-only JavaScript/TypeScript reader for Icechunk repositories, designed for use with zarrita." Pure TypeScript, no wasm, browsers and Node.js 18+.
- **Release cadence:** seven releases in three months: 0.3.0 (2026-03-27), 0.3.1 (2026-04-02), 0.3.2 (2026-04-18), 0.4.0 (2026-04-27), 0.5.0 (2026-06-23), 0.5.1 (2026-06-24), 0.6.0 (2026-06-24). This is an active early-stage project, not an abandoned one.
- **Maintainers and bus factor:** one npm publisher (`shane98c`); three GitHub contributors, with Shane98c at 87 of 110 commits, espg at 15, lazarusA at 8. Bus factor is effectively one. The issue tracker shows fast turnaround: the manifest-shard OOM (issues 24, 26) was reported and fixed in a next-day release (0.5.1); the dotted-bucket S3 endpoint bug (issue 25) and dictionary-compressed virtual locations (issue 22) were closed in the 0.5.x cycle; "Cannot open 2.0+ repos" (issue 20) is closed. CI moved to Node 24 with OIDC trusted publishing (issue 23).
- **Icechunk spec versions read:** v1 and v2 with automatic format detection (a `formatVersion` option can skip detection). See spec-version note below for why this covers current repos.
- **zarrita integration:** `IcechunkStore` implements zarrita's `AsyncReadable` with both `get()` and `getRange()` (required for sharded arrays), and supports zarrita's `withRangeCoalescing` (requires zarrita >= 0.7). This matches the ADR-0002 decision text exactly.
- **Virtual chunks:** all three payload types (inline, native, virtual) are supported, including `s3://`, `gs://`, and `az://` URL translation to HTTPS, `vcc://` resolution against repository config, dictionary-compressed virtual chunk locations (0.5.0), and optional checksum validation via integrity headers. Authentication for protected virtual chunks goes through a caller-supplied `fetchClient` (URL rewriting, pre-signing, header injection), which satisfies the pluggable request-authorization hook required on every store (CLAUDE.md, SPEC section 8).
- **Pinning:** branch (default `main`), tag, and snapshot selection are all supported at store open, satisfying the branch/tag/snapshot clause of SP-DP-002. Manifest reads go through an LRU cache with a configurable size; refs are resolved lazily since 0.5.1 to avoid loading whole manifest shards.
- **Known gaps and caveats:**
  - Read-only by design (consistent with ADR-0002; basis persistence routes through the CLI).
  - Over plain HTTP storage, `listBranches()` and `listTags()` are only reliable for v2 repos; v1 repos need a backend with prefix listing. Data reads by branch, tag, or snapshot are unaffected.
  - Range coalescing uses zarrita's merged abort-signal behavior: aborting one read in a merged batch may reject others. Our viewport-epoch cancellation tests (store conformance suite) must cover this; do not share an `AbortController` across requests that cancel independently.
  - 0.6.0 contained a breaking API change (`VirtualChunkContainer[]` replaced `Map<string, string>` in `ReadSession.open`), a reminder that pre-1.0 minor bumps break APIs; exact pinning is mandatory.

### Upstream: Icechunk (Earthmover)

- **Current release:** icechunk v2.1.0, released 2026-06-29 (three days before this note). Source: GitHub releases for earth-mover/icechunk.
- **Current spec:** version 2.1, used by Icechunk 2.1.0 and higher (icechunk.io, reference/spec-v2-1). The spec v2 to v2.1 delta is a single optional flatbuffers field (`pruned_ancestor_tx_logs` in `SnapshotInfo`), and the spec states the change is backward and forward compatible; the on-disk format flags both as version 2. Consequence: icechunk-js 0.6.0's v2 reader reads spec 2.1 repositories today, and the fresh upstream release triggers the ROADMAP "per release" review, which this note performs: canary status green on compatibility grounds, fixture regeneration against 2.1.0 still required (section 2).
- **Official JS bindings now exist:** `@earthmover/icechunk` on npm, latest 2.0.3 (2026-04-16), Apache 2.0, maintained by Earthmover (jhamman, mpiannucci), with the source living in the main earth-mover/icechunk monorepo (`icechunk-js/` directory, at 2.1.0 on main, unpublished). It is the Rust core exposed as a napi-rs native Node addon plus a wasm browser build (installed with `--cpu=wasm32`), supports read and write, and provides a read-only `createFetchStorage` that works in the browser. zarrita consumes its store by duck-typing. This is ADR-0002's Option B ("Icechunk Rust core via wasm, deferred, watched") materializing ahead of schedule, and it changes the amendment calculus in section 3.

## 2. Posture Decision

**Decision: adopt icechunk-js as a normal, exactly pinned npm dependency. Do not vendor now. Watch the official wasm bindings as the designated successor path.**

### Version pin

- Pin `icechunk-js` at exactly **0.6.0** (no caret, no tilde) in `packages/prism-core`, with the pnpm lockfile committed. zarrita at `^0.7` or later, which icechunk-js requires for range coalescing; the two pins move together and only by deliberate PR.
- icechunk-js is lazy-loaded behind the store-type probe, never in the initial interactive bundle (SPEC section 9 bundle budget). Its pure-TypeScript, tree-shakeable form is a concrete advantage over the wasm alternative here.

### Dependency, not vendoring

Vendoring today buys nothing: npm packages are immutable once published, the lockfile pins the resolved tarball hash, and MIT preserves the fork option forever. Vendoring costs us upstream fixes at exactly the phase where the project is fixing real bugs weekly. Vendoring (a fork under our org, or `pnpm patch` for single fixes) is the contingency, entered only through the response ladder below, never preemptively.

### Conformance fixtures in CI (per ADR-0002)

Fixture repositories are generated by a pinned icechunk (Python) 2.1.0 in `tools/spectral-prism-py` and committed to the repo. The suite covers, at minimum:

- a spec v1 repository and a spec v2 repository (format auto-detection both ways, plus explicit `formatVersion`);
- a repository written by icechunk 2.1.0 with `pruned_ancestor_tx_logs` populated (proves the optional-field tolerance claimed above rather than trusting it);
- native chunks, inline chunks, and virtual chunks (plain and dictionary-compressed locations, including a `vcc://` case);
- a sharded array exercising `getRange` with and without `withRangeCoalescing`;
- branch, tag, and snapshot resolution, with the resolved snapshot id asserted (SP-DP-002 requires it recorded in provenance);
- abort-scope cases for viewport-epoch cancellation, including the merged-batch abort caveat;
- the degraded case: HTTP storage where ref listing is unavailable, reads still succeed by snapshot id.

Two CI lanes:

1. **Blocking lane, every PR:** the suite against the pinned icechunk-js and committed fixtures. Red blocks merge.
2. **Canary lane, weekly schedule plus manual dispatch:** the same suite against `icechunk-js@latest`, and fixtures regenerated with `icechunk@latest` (Python). Failure does not block merges; it files an issue automatically and starts the tripwire clock.

### Contribution posture

Upstream-first. Bugs we find are reported with reproductions from our fixture corpus and, where we can, fixed with PRs; the maintainer's demonstrated next-day turnaround makes this the cheapest path. We do not carry local patches while an upstream PR is open unless the blocking lane is red. Phase 0 concretely: the data-plane spike (ROADMAP) doubles as our first upstream-quality signal.

### Standing tripwire (ROADMAP risk table, restated and operationalized)

The tripwire fires when either:

- the canary lane fails after an upstream Icechunk release (spec or writer behavior drift), or
- maintainer inactivity exceeds one quarter (no commits, releases, or issue responses on EarthyScience/icechunk-js for 90 days).

Response ladder, in order: (1) contribute the fix upstream; (2) if unmerged after four weeks and blocking, carry it via `pnpm patch` against the pinned version; (3) if inactivity persists past the quarter, fork under our org (MIT permits) or migrate per section 3; (4) at every rung, the plain-Zarr fallback (section 4) remains shippable, so no rung is an emergency. Review cadence: per upstream Icechunk release, per the ROADMAP risk table.

## 3. ADR-0002 Amendment Triggers

ADR-0002 stands. Any of the following triggers a superseding-amendment proposal (not a silent switch):

1. **Option B graduates.** `@earthmover/icechunk` demonstrates, in our own spike: an `AsyncReadable`-compatible store with working `getRange` for sharded arrays; a request-authorization hook equivalent to `fetchClient`; a browser wasm bundle that fits the lazy-load budget and behaves under the prism-core memory governor; and fixture parity on the full conformance suite. If that holds and it offers material advantages (day-zero spec support from the format owners, an eventual in-browser write path, the maintainer depth of Earthmover), propose amending ADR-0002 to Option B with icechunk-js retained as the lightweight fallback tier. This is now a realistic Phase 1 or Phase 2 review item, not a distant watch.
2. **Spec outruns the reader.** An Icechunk spec revision with incompatible on-disk changes ships and icechunk-js does not read it within one quarter of release.
3. **Tripwire ladder exhausts.** Maintainer inactivity persists and the projected cost of a fork exceeds the cost of migrating to the official bindings or narrowing to the plain-Zarr path.
4. **Write requirement arrives.** In-browser Icechunk write sessions move out of the Phase 4+ parking lot (ROADMAP); icechunk-js is read-only by design and cannot serve that.

## 4. The Fallback Stays First-Class

Independent of everything above, SP-DP-003 stands: plain Zarr over HTTP via zarrita is always functional, tested in CI with icechunk-js entirely absent from the bundle, and sufficient to ship. Icechunk support is additive capability (virtual archival access, snapshot-pinned provenance, time travel), never a load-bearing wall. If every mitigation in this note failed simultaneously, Spectral Prism still opens conformant GeoZarr stores; that is the posture that makes an exactly pinned, bus-factor-one dependency an acceptable risk rather than a structural one.

## Sources

- npm registry: `icechunk-js` (versions, dates, license, publisher) and `@earthmover/icechunk` (versions, dates, license, maintainers), queried 2026-07-02.
- GitHub API: EarthyScience/icechunk-js (repo metadata, contributors, issues, releases); earth-mover/icechunk (releases, tags, `icechunk-js/` package source), queried 2026-07-02.
- EarthyScience/icechunk-js README (API surface, zarrita >= 0.7 requirement, fetchClient contract, caveats), main branch, 2026-07-02.
- icechunk.io, reference/spec-v2-1: current spec version 2.1, v2 to v2.1 change summary and compatibility statement, fetched 2026-07-02.
