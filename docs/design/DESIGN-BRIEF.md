# Spectral Prism Design Brief (Seed v0.1)

**Status:** Seed. The bootstrap sequence (AUTONOMY-PLAN Section 8, step 3) expands this into v1 using the frontend-design skill *before any UI code lands*. The design-reviewer subagent enforces whatever the current version says; gaps it flags become brief amendments, not improvisation. This addresses the acknowledged v0.4 baseline gap: the specification defined interaction architecture but never design taste.

## Positioning Sentence

Spectral Prism should feel like a **precision optical instrument**: the calm authority of a spectrometer bench, not the noise of an analytics dashboard. A scientist should trust a number because of how it is set, before they have verified it.

## Direction (to be developed, not defaults)

- **Aesthetic register:** dark-lab neutral. Near-black surfaces with warm gray elevation steps; the interface is the optical bench, the data is the light. Light mode is a Phase 3 consideration, not a v1 promise.
- **Color doctrine:** the shell is achromatic plus exactly one accent (used for focus, selection affordances, and nothing else). All hue belongs to the data: ramps, spectra, derived tiles. Never let a button compete with a wavelength.
- **Typography:** one grotesque for UI, one monospaced companion with true tabular numerals for every readout (wavelengths, values, coordinates, budgets). Type scale is a fixed modular ladder in tokens; no ad hoc sizes. Set nm values with the unit at reduced emphasis: `2314 nm`, not `2314nm` or `2,314 NM`.
- **Density:** instrument-dense, not cramped: an 8px spacing grid, panels earn their chrome, and the triad's shared edges align to the pixel.
- **The quiet indicators:** sample fraction, ramp domain, overview level, tier badge, fill state, and memory readout share one visual grammar (small, consistent placement, monospaced, hover-expandable). They are the honesty layer; design them once, reuse everywhere.
- **Motion:** functional only. Derived-tile fill and brushing feedback may animate (fast, sub-150 ms, no easing theatrics); nothing else moves. No layout shift, ever, during asynchronous fills.
- **Vocabulary (user-journey review):** the interface speaks spectroscopy, never engineering: bands, wavelengths, continuum removal, SAM angle, components. "Chunk," "shard," "tier," and "co-moment" live only in quiet indicators and diagnostic surfaces. Capability tiers surface as neutral capability statements ("computing on CPU: larger fits take longer"), never deficiency language ("degraded," "fallback"); a student's laptop is never framed as the problem.
- **Spectra as protagonists:** the spectral panel is the signature view; overplotted spectra render with additive density so crowds read as luminous consensus, probes as crisp foreground lines, library references as distinguishable dashed overlays, bad-band spans as recessed shading. This one view carries the product's visual identity; spend the taste budget here.

## Token Discipline

All values ship as design tokens (CSS custom properties in prism-core's panel shell): color roles, type ladder, spacing grid, radii, z-layers, motion durations. Hardcoded values in components are a design-review REJECT by rule (design-reviewer check 1). Tokens are the mechanism by which taste survives autonomous implementation.

## References to Study During Expansion

Instrument and observability aesthetics done well (study, never copy): mission-operations displays in the OpenMCT lineage, Linear's restraint discipline, Observable's data-forward neutrality, and the carbonplan maps aesthetic for data-dominant color. The brief's v1 expansion should extract principles from these, name what Spectral Prism rejects about each, and commit.
