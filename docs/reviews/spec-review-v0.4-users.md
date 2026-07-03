# Spectral Prism Specification Package: User-Journey Review of v0.4

**Status:** Review report, 2026-07-01 (fourth pass, first from the user's chair). Prior passes reviewed the design as engineering; none walked it as a person with a Tuesday-morning task. Findings continue the numbering (F36+). Method: four personas, each walked through their golden journey against the v0.4 documents; a finding is a place the journey stalls, detours, or ends outside the tool.

## Personas

**P1: The imaging spectroscopist** (AVIRIS-3/EMIT science user). Task: "is there jarosite in this scene, and where?" Fluent in ENVI, allergic to installs, publishes plots. Success is a defensible figure and a CSV.

**P2: The mission ops / science-planning engineer** (MMGIS-embedded context). Task: triage an observation against a target list during a tactical cycle. Success is a decision plus a link a colleague can open and see exactly the same thing.

**P3: The instrument-lab user** (Headwall-class bench sensor, no georeferencing). Task: inspect a lab cube, mask bad bands, run PCA, export components. Success is trust that the math matches their MATLAB reference.

**P4: The student** (modest laptop, tier B hardware, public mirror data). Task: learn what MNF actually does by seeing it. Success is the tool never making them feel their hardware is the problem.

## Journey Findings

### F36 (F-major): There is no first-run journey

Every journey begins before our spec does. P1 arrives with a granule ID or nothing at all; v0.4 assumes a store URL in hand. The opening screen is unspecified, and an empty triad is a dead end. **Applied:** SP-UX-008: first-run surface with open-by-URL (paste anything: store root, Icechunk repo, https file), an example gallery backed by the demo mirror, a drag-and-drop affordance for local files, and recents. The gallery is also the student's (P4) entire entry path.

### F37 (F-major): The probe-to-publication path stops one step short

P1's unit of scientific exchange is a spectrum plot and its numbers. v0.4 has bulk export in Phase 3, but the moment of need is per-probe and immediate: copy this spectrum as CSV/JSON, save this profile panel as a publication-quality figure. Waiting for Phase 3 bulk export misreads the journey. **Applied:** SP-CO-005 (P1 priority, Phase 2 gate): per-probe export (CSV/JSON with wavelengths, values, mask, provenance) and profile-panel figure export (SVG/PNG with axes and annotations), independent of the Phase 3 bulk surface.

### F38 (F-minor): The share link is the ops collaboration primitive; its acceptance should say so

P2's journey ends with "send it to the tactical channel." SP-XP-005 (the .sps URL fragment) exists at the right phase but its acceptance criterion tested round-tripping, not fidelity of the shared moment. **Applied:** SP-XP-005 acceptance now requires the fragment to reproduce view, probes, active basis reference, and ramp settings such that two browsers show the same figure.

### F39 (F-minor): Tier language must not shame hardware

P4 on tier B reads "degraded," "fallback," and "refuses" throughout our internal vocabulary. Internally fine; in the UI it tells a student their laptop is the problem. **Applied:** DESIGN-BRIEF addition: capability tiers surface as neutral capability statements ("computing on CPU: larger fits take longer"), never as deficiency language; the quiet-indicator grammar carries tier state without judgment.

### F40 (F-minor, validation): The lab persona survives the spec

P3's journey (no proj:, no wavelengths beyond a user CSV, oracle-matching paranoia) is actually served: scene mode is the no-CRS default by construction (ADR-0007), the degradation matrix row covers missing wavelengths with user mapping, Q2 already scopes user-defined sensor registration, and ADR-0008's oracle fixtures are exactly the trust artifact P3 needs surfaced. One gap folded into Q2's close-out: the sensor registry must accept a lab-frame definition (wavelength+FWHM CSV, no CRS) as first-class, not as a degraded Earth sensor.

### F41 (F-minor): The UI speaks spectroscopy, not engineering

Journeys P1 and P3 never say "chunk," "tier," "shard," or "co-moment." **Applied:** DESIGN-BRIEF addition: user-facing vocabulary is the domain's (bands, wavelengths, continuum removal, SAM angle, components); engineering vocabulary is confined to quiet indicators and diagnostics surfaces.

## What the Journeys Validated Unchanged

The triad-plus-brushing loop is P1's actual mental model (space to spectrum to feature space is how spectroscopists already think); probe-first interaction ordering matches all four journeys; the no-invisible-decisions surface is precisely what P3's trust journey demands; the example-mirror wedge (GAP-ANALYSIS Section 5) is P4's whole world; and the client-side thesis is what makes P2's embedded journey possible at all.

## Convergence Note

This pass found no F-crit and no architecture changes: the findings are surface and sequencing, exactly what a user-chair review should find at this stage. With F36-F41 applied (v0.5), the baseline has now been reviewed from four directions (technical, hardening, formalization, user). Further findings should come from watching a real P1 use the Phase 1 build.

## Addendum (applied as v0.6)

### F42 (F-minor): The design reviewer never read the personas

The design-reviewer subagent enforced DESIGN-BRIEF.md, which carries persona-derived doctrine secondhand (vocabulary, tier tone), but never read Section 12 itself, so it could not ask whether a surface serves a journey at all. **Applied:** Section 12 added to the reviewer's required reading; new check 6 (journey fit: name the persona and step served; no journey means REJECT with scope-gravity escalation; journey friction gets reordering direction).

### F43 (F-major): A fifth persona was missing: the airborne instrument operator

**P5: the airborne instrument operator** (AVIRIS-NG/AVIRIS-3 campaign pattern). Task: "did line 14 come down clean, and do we re-fly it before transit home?" Journey: line lands as ENVI off the instrument, operator opens it on a field laptop (field-site LAN is posture 2 exactly), checks coverage, clouds/glint, saturation and dropouts, SNR sanity on dark and bright targets, renders the re-fly verdict under time pressure.

The persona largely validates the architecture: cold-open under 5 s becomes operationally meaningful; per-chunk stats make saturation/dropout detection a sidecar query; scene mode handles weak early nav solutions; the air-gap posture is the field site. **Applied consequences:** SP-DP-011 (local file ingest, ENVI first) elevated P1 to P0 and its gate moved Phase 3 to Phase 1, since it is the opening step of a golden journey rather than a convenience; new SP-CP-011 (QA-mask fixed transforms: saturation, dropout, cloud thresholds, stats-sidecar accelerated); new SP-RP-007 (flight-plan vector overlay for coverage-vs-plan, P2, parked at Phase 4+ since MMGIS embedding may own it in ops contexts); SPEC Section 7 gains the QA-mask strategy row; the non-goals now explicitly fence cross-line campaign mosaics and instrument-health trending (per-line sequential QA is the supported journey).

