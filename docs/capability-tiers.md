# Capability Tiers

**Status:** v1.1, adopted 2026-07-04 at the Phase 0 gate per ADR-0008 Amendment 1 (tier-C overlay reproducibility); closes SPEC Q1
**References:** SPEC Section 10 (Q1), ARCHITECTURE Sections 3, 8.1, 9; ADR-0004; ADR-0008; REQUIREMENTS SP-CP-003, SP-CP-004, SP-CP-005, SP-CP-006, SP-XP-003, SP-UX-003; docs/design/DESIGN-BRIEF.md (vocabulary doctrine)

---

## 1. Why Tiers, Not Browser Versions

Q1 asked where the capability boundaries sit. The answer is not a browser-version matrix, because browser versions are the wrong join key: WebGPU availability in mid-2026 varies by operating system, GPU vendor, and driver within a single browser version, and cross-origin isolation is a deployment header decision, not a browser property at all. The code branches on detected capabilities, so the tiers are defined by detected capabilities. This document is the table the code, the tests, the UI copy, and the Phase 0 gate all cite.

Two axes, kept explicit because they are orthogonal (ARCHITECTURE 8.1):

- **Compute axis:** does a trustworthy WebGPU compute device exist? This is a per-machine runtime fact.
- **Isolation axis:** is the page cross-origin isolated (COOP: same-origin plus COEP)? This is a per-deployment posture fact; it unlocks SharedArrayBuffer and therefore threads, and it restricts reachable stores to hosts that send CORP/CORS.

WebGL2 is below the tier system entirely: it is the render-plane prerequisite in every tier (ADR-0004), universally available in 2026 evergreen browsers, and if a WebGL2 context cannot be created the application states that plainly and stops; there is no render fallback tier.

## 2. The Tier Table

| Tier | Compute kernels | DuckDB-WASM bundle | Requires | Where it holds (mid-2026) |
|---|---|---|---|---|
| **A** | WebGPU compute passes (fit reductions, apply projections per ADR-0004) | mvp/eh, single-threaded | `navigator.gpu` adapter and device passing the smoke kernel; hardware (non-fallback) adapter | Chrome/Edge on Windows, macOS, ChromeOS, Android 12+; Firefox on Windows and Apple-silicon macOS; Safari 26+ on Apple platforms. Linux is partial in every browser |
| **B** | Single-threaded wasm SIMD kernels in the decode worker pool, identical accumulation tree (SP-CP-005) | mvp/eh, single-threaded | wasm with SIMD (baseline in all target browsers) | Everywhere. This is the universal floor |
| **C** | Threaded wasm kernels (SharedArrayBuffer heap, work distributed across chunks) | coi threaded build | `crossOriginIsolated === true`: the isolated deployment posture per ARCHITECTURE 8.1 | Only deployments that set COOP/COEP and control their data hosts (mission-internal fit) |

**Composition rule.** C is an overlay on the compute axis, not a third point on it. A runtime profile is one of: `A`, `B`, `A+C`, `B+C`. Under `A+C` the fit and apply kernels stay on WebGPU and C contributes the threaded DuckDB bundle plus shared-memory threading within wasm instances; under `B+C` the wasm kernels themselves thread across chunks. Decode is already a multi-worker pool exchanging transferables in every posture (ARCHITECTURE 2.6), so C adds no decode parallelism, and the f64 merge stays on CPU in chunk-index order in every profile (ADR-0008). The open (default) posture can never reach C regardless of browser capability, because an isolated page may only fetch cross-origin resources that opt in via CORP/CORS, which arbitrary stores do not send.

**Invariant across all tiers (ADR-0008).** Per-chunk partials accumulate in f32 co-moment form on whatever device the tier provides; the hierarchical merge and all solves (224 x 224 eigen, Cholesky) run in f64 on CPU in every tier, because WGSL has no f64 type. Tier A is a throughput claim, never a precision claim.

**Determinism across the C overlay.** Tier C threads parallelize across chunks, never within a chunk's accumulation, and the f64 merge runs on CPU in the fixed chunk-index order that ADR-0008 prescribes; thread count and scheduling never change the merge tree's shape. Therefore `B` and `B+C` produce bitwise-identical fit results for the same chunk stream, and `A` and `A+C` likewise, so the reproducibility contract of SP-CP-006 keys on the compute axis (A or B) only; the C overlay is performance, not numerics. ADR-0008 defines reproducibility within a tier and does not define the C overlay, so this rule extends its parity contract; it binds only once recorded as an ADR-0008 amendment (per Section 10), and adoption of this document at the Phase 0 gate requires that amendment. The Section 8 tier C fixture asserts the amended contract.

## 3. Platform Snapshot, Mid-2026 (Descriptive, Not Contractual)

This section records the evidence behind the "where it holds" column. It is dated and will rot; the detection procedure in Section 4 is what the code trusts.

- **Chrome/Edge:** WebGPU on by default since Chrome 113 (Windows, macOS, ChromeOS, May 2023) and Chrome 121 on Android 12+. On Linux, default enablement is expanding rather than complete: Chrome 144 enabled it for Intel Gen12+ hardware, and Chrome 147-148 expands support to modern NVIDIA drivers (2024-05 or newer) on Wayland; other stacks remain behind `chrome://flags/#enable-unsafe-webgpu`.
- **Firefox:** WebGPU on by default on Windows since Firefox 141 (July 2025) and on Apple-silicon macOS (macOS Tahoe 26) since Firefox 145. Linux and Android are not on by default as of mid-2026; Mozilla has stated Linux is expected during 2026.
- **Safari:** WebGPU ships enabled by default in Safari 26 across macOS Tahoe 26, iOS 26, iPadOS 26, and visionOS 26 (September 2025).
- **Integrated-GPU caveat:** an adapter existing says nothing about throughput; 2024-class integrated GPUs (the reference baseline) pass tier A detection and are exactly what SP-CP-003 is calibrated against. Software adapters (SwiftShader-class) also answer `requestAdapter` in some environments and are explicitly demoted (Section 4).
- **WebGL2:** universal across evergreen Chrome, Edge, Firefox, and Safari (baseline since Safari 15, 2021).
- **wasm SIMD:** baseline everywhere the application's ES2022 bundle runs (Chrome 91+, Firefox 89+, Safari 16.4+). Fixed-width 128-bit SIMD is part of the wasm 2.0 baseline; the kernels assume it.
- **wasm threads:** require SharedArrayBuffer, which every engine gates behind cross-origin isolation (COOP: same-origin plus COEP: require-corp or credentialless). This is why C is a posture, not a probe result the open posture could ever satisfy.
- **DuckDB-WASM:** ships three bundles: mvp (baseline wasm), eh (wasm exception handling, the usual pick on 2026 browsers), and coi (pthread-threaded, requires cross-origin isolation, marked experimental upstream). `selectBundle` performs the feature detection; ARCHITECTURE Section 5 fixes mvp/eh as the default and coi as isolated-posture-only.
- **WGSL numerics:** no f64 in WGSL; IEEE-754 binary64 remains an open gpuweb proposal (issue 2805). The optional `shader-f16` feature (shipped since Chrome 120) is irrelevant to the ADR-0008 policy and is not probed.

## 4. Detection Procedure at Startup

Detection is layered so that nothing blocks first render: the render plane needs only WebGL2, and the compute tier resolves in the background before the first fit can be requested.

**Step 0, synchronous, every startup, never cached:**

1. Create a WebGL2 context. Failure is a stop condition with a plain-language message, not a tier.
2. Read `crossOriginIsolated`. True selects the C overlay: the threaded DuckDB bundle and threaded wasm kernels become eligible at their lazy-load points. This is a header fact that can change per deployment and per response, so it is re-read every load and never cached.
3. Read `navigator.hardwareConcurrency` for pool sizing (ARCHITECTURE 2.6). Pool sizing is not a tier input.

**Step 1, asynchronous, timeboxed at 2 seconds, cached only on a successful adapter probe (see below):**

4. If `navigator.gpu` is absent, the compute axis is B. Done.
5. `requestAdapter({ powerPreference: "high-performance" })`, falling back to a default request. A null adapter means B.
6. Reject fallback adapters: if the adapter identifies as a software implementation (fallback-adapter flag or SwiftShader-class adapter info), the compute axis is B; single-threaded wasm SIMD beats an emulated GPU for these reduction kernels, and honesty beats a nominal "GPU" label.
7. `requestDevice()` against default limits. The kernels are designed inside WebGPU's guaranteed defaults (a spectral-major chunk of 224 bands x 64 x 64 pixels at int16 is about 1.8 MB, far under the 128 MiB default storage-buffer binding limit), so no limit negotiation is needed; the adapter's actual limits are recorded in the profile for diagnostics.
8. Device loss during the probe, validation errors, or timebox expiry resolve the compute axis to B for the session only; these outcomes are transient, are never written to the cache, and the probe reruns at the next startup.

**Step 2, first tier A dispatch, result cached:**

9. Before the first real fit on a fresh adapter, run the smoke kernel: a covariance-partial reduction over a committed synthetic chunk with a known answer, tolerance-checked per ADR-0008. Failure demotes the compute axis to B and caches the demotion keyed to the adapter identity, so a broken driver is not re-trusted every session.

**Step 3, at wasm kernel lazy-load:**

10. `WebAssembly.validate` on an 8-byte SIMD probe module confirms the SIMD build loads; this is expected to pass everywhere the bundle runs and exists to fail loudly rather than mysteriously.

**What is cached, and where.** One localStorage record, `spectral-prism.capability.v1`: schema version, application version, adapter identity (vendor, architecture, device, description from adapter info), recorded limits, smoke-kernel result, resolved compute axis, timestamp. A record is written only when there is an adapter identity to key on: a successful adapter and device probe (steps 5 through 7), and any smoke-kernel outcome (step 9), including a demotion, which persists keyed to that adapter identity. Step 8 resolutions are session-only and never persisted. When `navigator.gpu` is absent or `requestAdapter` returns null, there is no adapter identity to key on or to detect a change against; no record is written, and the B resolution is recomputed at each startup, a check that costs milliseconds. The cache is invalidated by an application version change, an adapter identity change, or an explicit re-probe from the diagnostics surface. Never cached: WebGL2 presence, `crossOriginIsolated`, `hardwareConcurrency`.

**Overrides.** A `?tier=B` URL parameter (and the equivalent diagnostics toggle) forces the wasm compute axis for parity debugging and demonstrations. A `?tier=A` parameter with an allow-software-adapter flag forces the WebGPU compute axis and admits adapters that step 6 would reject; it exists for the CI harness (Section 8), where software backends (SwiftShader, Lavapipe) are the only adapters available. A forced tier is recorded as forced in provenance in both directions.

## 5. What Branches on the Tier

The branch surface is deliberately small; everything not listed here is tier-independent by design.

1. **Kernel dispatch** in the compute orchestrator: WebGPU compute passes (A) versus wasm kernels in the decode pool (B), threaded wasm instances under B+C.
2. **DuckDB bundle selection** at lazy-load: mvp/eh by default, coi under C only.
3. **Fit-size guidance** thresholds in the pre-fit estimator (Section 6).
4. **Memory governor staging shape:** GPU staging buffers (A) versus wasm heap headroom (B), within the same governed envelope (ARCHITECTURE 2.5).
5. **The tier badge** in the quiet-indicator family (SP-UX-003) and the diagnostics surface.
6. **Provenance:** the resolved profile (compute axis, C overlay, forced or detected) is recorded in every `.spb` and `.sps`, because reproducibility is defined within a tier (ADR-0008, SP-CP-006).

Explicitly tier-independent: the render path (WebGL2 always), store implementations, strategy availability (every strategy runs in every tier), the degradation matrix semantics, and all UI layouts. No strategy may be tier-gated; tiers change how long the math takes, never which math exists.

## 6. Fit-Size Guidance per Tier

The anchor is SP-CP-003: a viewport-scale fit of 512 x 512 pixels x 224 bands (AVIRIS-class, roughly 380 nm to 2510 nm) completes in under 10 seconds on tier A on the reference baseline (2024-class integrated-GPU laptop, 50 Mbps, 50 ms RTT), with progress and cancellation. That number is the only binding performance requirement in this table. The tier B and C figures below are planning guidance derived from kernel cost modeling (accumulation cost is linear in pixels, quadratic in bands); they are provisional until the Phase 2 perf harness measures them, and measured revisions bump this document's version.

| Profile | Default interactive fit region | 512 x 512 x 224 expectation (reference baseline) | Estimator behavior above the default |
|---|---|---|---|
| A, A+C | 512 x 512 x 224 | Under 10 s (binding, SP-CP-003) | Offer stratified sampling for region areas beyond viewport scale |
| B | 128 x 128 x 224 | Tens of seconds to a few minutes | Show a time estimate; offer a sampled fit or a smaller region |
| B+C | 256 x 256 x 224 | Roughly (pool size) x faster than B | Same as B with higher thresholds from the measured thread count |

Rules that hold in every tier:

- A fit is never refused on time grounds; the estimator informs and offers alternatives, and the user may always proceed with progress and cancellation. Fits are refused on exactly three grounds: memory governor (the stream cannot fit the staging budget, ARCHITECTURE 9), the single-layout (spatial-only) size threshold in the degradation matrix (ARCHITECTURE 9), and conditioning (RX/CEM inversions refuse with guidance past the condition-number threshold, ADR-0008 decision 3).
- Sampled fits extend the feature-space sampling policy (ARCHITECTURE Section 5, design invariant 10) to fit sampling: stratified per-chunk, deterministic seed recorded in provenance, visible sample-fraction indicator. No accepted document previously defined a fit-sampling policy, so this table is the defining source for that extension. A sampled basis records its sample fraction.
- Apply-phase derived tiles fill asynchronously and visibly in every tier; the first viewport tiles arrive within 2 seconds of fit per SP-CP-004, which carries no tier qualifier in the ledger.

## 7. UI Surfacing Rules

The DESIGN-BRIEF vocabulary doctrine governs: the interface speaks spectroscopy, capability states are neutral facts about where computation runs, and a student's laptop is never framed as the problem. Tier letters (A, B, C) appear only in quiet indicators, diagnostics, and provenance records, never in sentences addressed to the user.

Approved copy patterns:

| Profile | Badge (quiet indicator) | Expanded statement |
|---|---|---|
| A, A+C | GPU | "Computing on GPU." |
| B | CPU | "Computing on CPU: larger fits take longer." |
| B+C | CPU xN | "Computing on CPU across N threads." |

Estimator copy states time, region, and options: "This fit covers 512 x 512 pixels across 224 bands, estimated about 2 minutes on this device. Fit a 10% sample instead (about 15 seconds)?" The estimate is about the fit, not about the machine.

Banned in user-facing copy: "degraded", "fallback", "unsupported", "legacy", "slow device", and any construction that names the user's hardware or browser as deficient. The words "tier", "wasm", "WebGPU", and "SharedArrayBuffer" stay in diagnostic surfaces. When the compute axis was demoted by a failed smoke kernel, the badge shows CPU and the diagnostics surface carries the reason; the user-facing state is simply where computation runs.

The badge is part of the single quiet-indicator grammar (SP-UX-003): small, consistent placement, monospaced, hover-expandable, alongside sample fraction, ramp domain, overview level, fill state, and memory readout.

## 8. CI Implications

- **The wasm tier is the parity anchor.** Tier B kernels run headless in Node on every CI platform with no browser or GPU. The NumPy/SciPy oracle fixtures and the committed real-AVIRIS golden scene compare against the wasm tier first; tier A is then tolerance-compared against wasm per ADR-0008. All functional kernel coverage gates on the wasm tier, so a WebGPU-less CI runner can still block a merge on a math bug.
- **Tier A end-to-end needs a flagged Chromium.** Headless Chromium with WebGPU enabled: `--headless=new` plus `--enable-unsafe-webgpu`, and on Linux runners `--enable-features=Vulkan` with a software backend (SwiftShader or Lavapipe) where no GPU is attached. These runs launch with the Section 4 force-A override (allow-software-adapter, recorded as forced), because detection step 6 would otherwise demote a software adapter to B. Software-backend runs count for correctness within ADR-0008 tolerances only; SP-CP-003 timing is measured exclusively on the reference-baseline hardware harness, never on shared CI.
- **Kernel-level WGSL tests** may additionally run against Dawn or wgpu natively (ADR-0004 notes this path); this exercises shaders without a browser but does not replace the flagged-Chromium e2e, which also covers device-loss and adapter-probe behavior.
- **Tier C fixtures:** a CI fixture server sends COOP/COEP, asserts `crossOriginIsolated`, loads the coi DuckDB bundle and the threaded kernel build, and verifies the Section 2 determinism rule as anchored by the ADR-0008 parity-contract amendment: B+C fit results are bitwise-identical to B for the same chunk stream.
- **Degradation coverage:** the "No WebGPU" row of the degradation matrix (ARCHITECTURE 9, SP-XP-003) is a test fixture that forces the compute axis to B and asserts the badge, the estimator thresholds, and unchanged rendering.
- **Platform demotion is a release-time decision** (ROADMAP risk table): a tier A kernel failure on a target platform in CI demotes that platform to B in the detection denylist. The denylist keys on adapter identity (vendor, architecture, device from adapter info, the same fields the Section 4 capability cache records), never on browser or OS identity, consistent with the Section 9 non-claim; the fallback tier is not optional scope.

## 9. Non-Claims

This table deliberately does not promise:

- **A browser support matrix.** Tiers are detected at runtime, not assumed from user agents. Section 3 is dated evidence, not a compatibility commitment, and no code may branch on browser identity.
- **Tier A performance on arbitrary hardware.** The 10-second SP-CP-003 figure binds the reference baseline only. A 2019 integrated GPU may pass tier A detection and take longer; the estimator, progress, and cancellation are the contract there.
- **GPU double precision.** No tier performs f64 arithmetic on the GPU; merges and solves are CPU f64 everywhere (ADR-0008). Choosing tier A never changes numerical policy.
- **Cross-tier bitwise reproducibility.** A-versus-B parity is tolerance-bounded, never bitwise (ADR-0008). The only bitwise cross-profile guarantee is the C overlay rule of Section 2.
- **Threads in the open posture.** No browser improvement can deliver tier C to the default deployment; the COEP constraint against arbitrary cross-origin stores is structural (ARCHITECTURE 8.1). Deployments choose isolation; the application only detects it.
- **Driver correctness.** The smoke kernel catches gross breakage; it does not certify a driver. The golden-scene parity suite in CI and per-release platform demotion carry that burden.
- **WebGPU rendering.** The render plane is WebGL2 in every tier; WebGPU render unification stays deferred (ADR-0004, ARCHITECTURE 10).
- **Stability of the guidance numbers.** The tier B and C fit-size figures in Section 6 are estimates pending the Phase 2 perf harness; the tier A figure is a requirement, the rest are forecasts.

## 10. Revision Policy

This document is versioned like the other living specifications. Adoption at the Phase 0 gate makes Sections 2, 4, 5, and 7 normative; Section 6 guidance figures become normative when the Phase 2 perf harness replaces the estimates with measurements. Any change to the tier definitions, the detection order, or the branch surface bumps the version with a dated changelog line here; changes that contradict an accepted ADR require an ADR amendment first.

**Changelog**

- v1.1 draft, 2026-07-02: applied review findings: enumerated the three fit-refusal grounds; added the force-A (allow-software-adapter) harness override and cited it from the CI section; updated the Chrome-on-Linux evidence for Chrome 147-148 (NVIDIA on Wayland); conditioned the C overlay determinism rule on an ADR-0008 parity-contract amendment and removed merge relocation from the composition rule; separated session-only (step 8) from persisted (step 9) cache outcomes and specified no-adapter cache behavior; removed the tier scoping of SP-CP-004 and added it to the references; anchored fit sampling as an extension of the feature-space sampling policy; keyed the detection denylist on adapter identity; corrected the composition rule's decode-parallelism claim.
- v1 draft, 2026-07-02: initial table; closes SPEC Q1 pending Phase 0 gate adoption.
