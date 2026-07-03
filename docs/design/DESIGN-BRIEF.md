# Spectral Prism Design Brief

**Status:** v1.1, 2026-07-02, expanded from seed v0.1 per AUTONOMY-PLAN Section 8 step 3; the design-reviewer subagent enforces this document. Amendment 1 (v1.1, 2026-07-02): TK-5 names the type-ladder line-height tokens, closing a TK-1/TK-2 conflict found in design review.

This document is normative. Rules carry stable IDs (TK, CD, TY, DN, QI, MO, SIG, VOC, AX, REF, AM); the design-reviewer cites rule IDs in APPROVE and REJECT verdicts, and a change that violates a numbered rule is a REJECT naming the rule. Where a rule commits a value, the value is the specification; adjectives elsewhere do not override a committed value. Where this document is silent, the reviewer flags a DESIGN-BRIEF gap for amendment (Section 14) and never improvises. Where two rules appear to conflict, the stricter rule governs until an amendment resolves the text.

## 1. Positioning

Spectral Prism should feel like a **precision optical instrument**: the calm authority of a spectrometer bench, not the noise of an analytics dashboard. A scientist should trust a number because of how it is set, before they have verified it.

## 2. Principles

1. The interface is the optical bench; the data is the light. Near-black warm surfaces frame the data; everything that is not data recedes.
2. All hue belongs to the data. The shell is achromatic plus exactly one accent. Never let a button compete with a wavelength.
3. The quiet indicators are the honesty layer: every decision the system makes on the user's behalf is visible, in one shared grammar, while it is in effect.
4. Instrument-dense, pixel-true: an 8px grid, panels earn their chrome, and the triad's shared edges align to the device pixel.
5. Motion is functional only. Exactly two animations exist; nothing else moves; layout never shifts during asynchronous fills.
6. The interface speaks spectroscopy, never engineering, and never frames the user's hardware as the problem.
7. Wavelength is a coordinate: values always carry the nm unit, and a band index never stands alone.
8. Tokens are the mechanism by which taste survives autonomous implementation.

## 3. Token Schema

**TK-1.** Every value in this section ships as a CSS custom property defined once, at `:root`, in the prism-core panel shell stylesheet. Components consume tokens by name; a literal color, size, duration, radius, or z-index in component code is a REJECT (SP-UX-002), and the review cites the token that should have been used.

**TK-2.** The token set is closed. Adding, removing, or changing a token is a brief amendment, not a code change; a pull request that introduces a new token without amending this section is a REJECT. No component derives its own neutral by lightening, darkening, or alpha-compositing a token; the ladders are closed.

**TK-3.** v1 ships dark only. Light mode (a Phase 3 consideration) will be a value swap behind these same names, never a parallel token set.

### 3.1 Surface ladder

Exactly five surfaces. Elevation is expressed by stepping up this ladder, never by shadows or borders alone. A component that needs a sixth surface has a design problem, not a token gap.

| Token               | Value     | Role                                                        |
| ------------------- | --------- | ----------------------------------------------------------- |
| `--prism-surface-0` | `#0A0908` | App canvas; data-panel ground (map nodata, plot background) |
| `--prism-surface-1` | `#121110` | Panel body; the default component ground                    |
| `--prism-surface-2` | `#1A1816` | Panel chrome: headers, indicator rails, tab strips          |
| `--prism-surface-3` | `#221F1C` | Floating layer 1: menus, popovers, expanded indicator cards |
| `--prism-surface-4` | `#2B2723` | Floating layer 2: tooltips, drag ghosts                     |

### 3.2 Lines

| Token                 | Value     | Role                                                               |
| --------------------- | --------- | ------------------------------------------------------------------ |
| `--prism-line-grid`   | `#1E1C19` | Plot grid lines, axis rules inside data panels                     |
| `--prism-line-subtle` | `#2E2A26` | Panel edges, the triad's shared 1px borders, input borders at rest |
| `--prism-line-strong` | `#3D3833` | Hovered or active control borders, resize handles                  |

### 3.3 Shadow and recess

| Token                    | Value                          | Role                                                       |
| ------------------------ | ------------------------------ | ---------------------------------------------------------- |
| `--prism-shadow-overlay` | `0 2px 8px rgba(0, 0, 0, 0.5)` | The only shadow; floating layers only (TK-4)               |
| `--prism-shade-recessed` | `rgba(10, 9, 8, 0.55)`         | Bad-band spans, out-of-domain regions, disabled plot areas |

**TK-4.** Shadows apply only to elements on `--prism-z-overlay` and above. A shadow on a panel, header, rail, button, or card in the bench plane is a REJECT. Recessed regions recede by darkening; they are never hatched, colored, or outlined.

### 3.4 Ink ladder

| Token                   | Value     | Contrast on `--prism-surface-1` | Role                                                |
| ----------------------- | --------- | ------------------------------- | --------------------------------------------------- |
| `--prism-ink-primary`   | `#E9E5DF` | at least 12:1                   | Values, primary labels, probe readouts              |
| `--prism-ink-secondary` | `#B3ACA2` | at least 7:1                    | Secondary labels, units, axis titles                |
| `--prism-ink-muted`     | `#877F74` | at least 4.5:1                  | Quiet indicators at rest, placeholders, tick labels |
| `--prism-ink-disabled`  | `#57524B` | exempt                          | Disabled controls only; never used for information  |

### 3.5 Accent

| Token                   | Value                      | Role                                                                                    |
| ----------------------- | -------------------------- | --------------------------------------------------------------------------------------- |
| `--prism-accent`        | `#5EA7D8`                  | Focus rings, selected controls, active tab underline, brush strokes, wavelength cursors |
| `--prism-accent-hover`  | `#7DBAE2`                  | Hovered accent surfaces                                                                 |
| `--prism-accent-active` | `#4288B8`                  | Pressed state                                                                           |
| `--prism-accent-ink`    | `#0A0F14`                  | Text and glyphs on accent-filled surfaces                                               |
| `--prism-accent-wash`   | `rgba(94, 167, 216, 0.16)` | Selection fills, focus washes, brushed-region tint                                      |

### 3.6 Status

| Token                  | Value     | Role                                                                |
| ---------------------- | --------- | ------------------------------------------------------------------- |
| `--prism-status-error` | `#E06C5F` | Failures, refusals (grid incompatibility, coverage below threshold) |
| `--prism-status-warn`  | `#D9A03F` | Cautions (mask-intersection warnings, on-the-fly stats, low memory) |
| `--prism-status-ok`    | `#7FA65B` | Completed fits, passing conformance checks; transient only          |

### 3.7 Data color

| Token                   | Value                      | Role                                                                                            |
| ----------------------- | -------------------------- | ----------------------------------------------------------------------------------------------- |
| `--prism-data-density`  | `#E8DCC8`                  | Terminal hue of the additive-density luminance ramp (SIG-2, SIG-3); reserved, used nowhere else |
| `--prism-data-cat-1`    | `#F2C14E`                  | Categorical assignment 1 (gold)                                                                 |
| `--prism-data-cat-2`    | `#6FD1B4`                  | Categorical assignment 2 (mint)                                                                 |
| `--prism-data-cat-3`    | `#E88BC4`                  | Categorical assignment 3 (orchid)                                                               |
| `--prism-data-cat-4`    | `#A48FE8`                  | Categorical assignment 4 (violet)                                                               |
| `--prism-data-cat-5`    | `#E8896B`                  | Categorical assignment 5 (coral)                                                                |
| `--prism-data-cat-6`    | `#B5D66B`                  | Categorical assignment 6 (chartreuse)                                                           |
| `--prism-data-cat-7`    | `#5ECFDF`                  | Categorical assignment 7 (cyan)                                                                 |
| `--prism-data-cat-8`    | `#C9BFA8`                  | Categorical assignment 8 (sand)                                                                 |
| `--prism-select-stroke` | `var(--prism-accent)`      | Brush and selection geometry over data                                                          |
| `--prism-select-casing` | `var(--prism-surface-0)`   | Mandatory 1px casing under every selection stroke                                               |
| `--prism-select-fill`   | `var(--prism-accent-wash)` | Selection region fill                                                                           |

Categorical hues are assigned in fixed order, 1 through 8, alternating high and low luminance so adjacent assignments separate by value as well as hue.

### 3.8 Type faces

| Token               | Value                                                                    |
| ------------------- | ------------------------------------------------------------------------ |
| `--prism-font-ui`   | `"Inter", "SF Pro Text", "Segoe UI", system-ui, sans-serif`              |
| `--prism-font-data` | `"IBM Plex Mono", ui-monospace, "SFMono-Regular", "Consolas", monospace` |

Both faces are bundled as WOFF2 in the application; no network font fetch, ever (air-gap deployment is a success criterion).

### 3.9 Type ladder

| Token                  | px   | rem       | Line height | Weights  | Use                                                        |
| ---------------------- | ---- | --------- | ----------- | -------- | ---------------------------------------------------------- |
| `--prism-type-micro`   | 11px | 0.6875rem | 16px        | 400, 500 | Quiet indicators, rail readouts, axis ticks, unit suffixes |
| `--prism-type-body`    | 13px | 0.8125rem | 20px        | 400, 500 | Default UI text, controls, menus, panel header titles      |
| `--prism-type-title`   | 16px | 1rem      | 24px        | 500, 600 | Dialog headers, first-run section titles                   |
| `--prism-type-heading` | 20px | 1.25rem   | 28px        | 500, 600 | First-run surface headings, empty states                   |
| `--prism-type-display` | 25px | 1.5625rem | 32px        | 600      | First-run hero only; never inside the triad                |

**TK-5** (v1.1 amendment). The line heights in this ladder ship as tokens alongside their sizes: `--prism-type-micro-line` (16px), `--prism-type-body-line` (20px), `--prism-type-title-line` (24px), `--prism-type-heading-line` (28px), `--prism-type-display-line` (32px). Rationale: v1.0 committed these five values in the table while TK-1 requires every committed value to ship as a custom property and TK-2 closes the token set, leaving the two rules unsatisfiable together; design-reviewer finding, 2026-07-02.

### 3.10 Spacing

| Token                | Value |
| -------------------- | ----- |
| `--prism-space-half` | 4px   |
| `--prism-space-1`    | 8px   |
| `--prism-space-2`    | 16px  |
| `--prism-space-3`    | 24px  |
| `--prism-space-4`    | 32px  |
| `--prism-space-6`    | 48px  |
| `--prism-space-8`    | 64px  |

### 3.11 Radii

| Token              | Value | Use                                                                   |
| ------------------ | ----- | --------------------------------------------------------------------- |
| `--prism-radius-0` | 0     | Panels, the triad, rails, plot frames, anything holding data          |
| `--prism-radius-1` | 2px   | Buttons, inputs, badges, menu items                                   |
| `--prism-radius-2` | 4px   | Popovers, tooltips, expanded indicator cards, first-run gallery cards |

4px is the maximum radius in the product. Pill shapes and circles (other than point marks in data) are a REJECT. Data-bearing frames are always square: the instrument does not round its aperture.

### 3.12 Z-layers

| Token                 | Value | Layer                                        |
| --------------------- | ----- | -------------------------------------------- |
| `--prism-z-base`      | 0     | Panels and data canvases                     |
| `--prism-z-indicator` | 20    | Quiet-indicator rails overlaying data panels |
| `--prism-z-sticky`    | 100   | Panel headers, pinned toolbars               |
| `--prism-z-overlay`   | 200   | Menus, popovers, expanded indicator cards    |
| `--prism-z-modal`     | 300   | Modal dialogs and their scrim                |
| `--prism-z-toast`     | 400   | Transient notices                            |
| `--prism-z-tooltip`   | 500   | Tooltips; nothing renders above a tooltip    |

Any `z-index` that is not one of these seven tokens is a REJECT. No component wins a stacking fight by incrementing; it uses the layer it belongs to.

### 3.13 Motion tokens

| Token                  | Value | Use                                                             |
| ---------------------- | ----- | --------------------------------------------------------------- |
| `--prism-motion-fill`  | 120ms | Derived-tile fill reveal, opacity only, linear                  |
| `--prism-motion-brush` | 80ms  | Selection-mask highlight fade on brush commit and clear, linear |

These are the only durations in the product. No easing tokens exist because no easing curves exist (MO-4).

## 4. Color Doctrine

**CD-1.** The shell is achromatic plus exactly one accent. The accent hue is ice blue, chosen because blue is the most reliably discriminable hue across protanopia and deuteranopia and because it leaves amber free for caution semantics. It is used for focus rings, selection affordances, active-state indication, and wavelength cursors. It is used for nothing else: not links-as-decoration, not icons at rest, not headers, not branding. A second accent anywhere in the shell is a REJECT.

**CD-2.** Shell neutrals keep OKLCH chroma at or below 0.02; the accent and status tokens are the only shell colors permitted above it. Hue budget: at any moment the shell shows at most the accent plus two status hues.

**CD-3.** Status hues exist for the honesty layer and validation only: mask-mismatch warnings, apply refusals, nodata notices, kernel failures. They never decorate, never fill large regions, and never appear at rest. There is no info color: informational notices use `--prism-ink-secondary`. Capability statements are neutral facts and render in ink, never in a status hue; a tier badge in amber or red frames the user's hardware as a defect and is a REJECT.

**CD-4.** All hue belongs to the data. Ramps, wavelength composites, spectra, derived tiles, and feature-space density own every saturated pixel on screen. The test the reviewer applies: desaturate a screenshot of the shell alone (data panels masked out); if anything other than focus, selection, or an active status message changes meaningfully, the shell stole hue from the data, and the change is a REJECT.

**CD-5.** Spectra are data and draw from the data palette (Section 3.7), never from shell tokens. The single place the accent touches data is the brushed-selection density field (SIG-5) and selection geometry, where it encodes membership, never a data value.

**CD-6.** Selection geometry over data panels uses `--prism-select-stroke` with a mandatory 1px casing in `--prism-select-casing` and fills with `--prism-select-fill`. The dark casing guarantees the selection separates from any ramp value by luminance, independent of hue perception; a selection stroke without its casing is a REJECT.

**CD-7.** The v1 ramp catalog ships exactly five ramps, all perceptually uniform and CVD-checked: sequential `viridis` (the default for every derived product), `cividis`, `magma`, `gray`; diverging `vik` (Crameri), the only diverging ramp in v1. Red-green diverging ramps are banned. `jet`, `rainbow`, and `turbo` never enter the catalog, in v1 or later. Any ramp added after v1 requires simulated deuteranopia, protanopia, and tritanopia renderings plus perceptual-uniformity evidence recorded in the pull request; a ramp PR without the simulations is a REJECT. Ramp identity and domain are always visible in the quiet-indicator grammar; a ramp is data provenance, not a style.

## 5. Type and Numerals

**TY-1.** `--prism-font-ui` carries all UI text. `--prism-font-data` carries every numeric readout: wavelengths, reflectance values, coordinates, SAM angles, sample fractions, memory budgets, tier words, chunk diagnostics. If a number can update while visible, it is set in `--prism-font-data`.

**TY-2.** The ladder has exactly five sizes (Section 3.9). A font size outside the table, anywhere, is a REJECT. Weights 400, 500, and 600 are the only weights loaded; no 300, no 700. Letterspacing is default everywhere, with one exception: section labels may be set uppercase only at `--prism-type-micro` with `letter-spacing: 0.06em` in `--prism-ink-secondary`. Uppercase at any other size is a REJECT.

**TY-3.** Every live readout sets `font-variant-numeric: tabular-nums lining-nums` (inherent in `--prism-font-data`; any UI-face element containing an updating number sets it explicitly). Readouts never jump width (SP-UX-004): a value that updates in place reserves the width of its maximum expected string (a wavelength readout reserves four digits plus the unit; a percentage reserves `100.0%`).

**TY-4.** Wavelength formatting: value, one regular space, lowercase `nm`: `2314 nm`. Never `2314nm`, never `2,314 nm`, never `2314 NM`. Integer nm by default; one decimal only where the sensor grid requires it (`2314.5 nm`). No thousands separators in any readout.

**TY-5.** Wavelength ranges join two full values with the word "to", each carrying its unit: `2100 nm to 2400 nm`. A hyphenated range or a range stating the unit once is a REJECT.

**TY-6.** A unit sets one ink step below its value (value in `--prism-ink-primary` takes its unit in `--prism-ink-secondary`; an indicator value in `--prism-ink-secondary` takes its unit in `--prism-ink-muted`). Units are never bolder or larger than their values. Unit symbols keep canonical case (`MB`); prose units are lowercase. Reflectance readouts show 4 decimal places (`0.3127`); SAM angles show degrees to two decimals (`3.21°`).

## 6. Spacing and Density

**DN-1.** All layout spacing derives from the spacing tokens (Section 3.10). The 4px half-step is legal only inside a compound component (indicator internals, icon-to-label gaps, input padding), never between components or panels. Panel bodies pad at `--prism-space-2`; panel headers pad at `--prism-space-1` vertical.

**DN-2.** Panel chrome budget: each triad panel spends at most 48px of vertical chrome, composed of a 28px header and a 20px indicator rail. No toolbars, legends, or persistent controls inside the data viewport; controls live in the header, and header overflow goes to a single overflow menu, never a second row. A panel exceeding the budget is a REJECT.

**DN-3.** Panel headers sit on `--prism-surface-2` with a 1px bottom edge in `--prism-line-subtle`. Titles are set in `--prism-font-ui` at `--prism-type-body` weight 500, left-aligned; controls right-align as 24px square hit areas with 16px glyphs.

**DN-4.** The triad's shared edges are single lines: adjacent panels share exactly one 1px separator in `--prism-line-subtle`; two abutting borders producing a 2px seam is a REJECT. There are no gaps between triad panels; the separator is the entire boundary, and it doubles as the resize handle with an 8px hit zone centered on the line.

**DN-5.** Pixel alignment is mandatory. Panel layout resolves to integer CSS pixels; canvas and WebGL surfaces size to integer device pixels honoring devicePixelRatio. A shared edge renders as one device-pixel-crisp line at every DPR; a blurred or doubled edge in a screenshot is a REJECT.

## 7. Quiet-Indicator Grammar

**QI-1.** Every decision the system makes on the user's behalf, while it is in effect, is represented by exactly one quiet indicator: sample fraction, ramp domain, overview level, capability tier, fill state, and memory readout. This is the UI half of the no-invisible-decisions invariant. Omitting the indicator and over-promoting it are both REJECTs.

**QI-2.** The family is closed and singular: all six are instances of one component (`QuietIndicator` in the prism-core panel shell) with one anatomy, one type treatment, one expansion behavior (SP-UX-003). A bespoke badge, chip, pill, or toast reporting system state outside this family is a REJECT. A new machine-made decision extends the family by brief amendment, never by invention.

**QI-3.** Indicators are informational, never controls: no buttons, toggles, or links in the collapsed indicator or the expanded card. The expanded card's last line names where the decision can be changed (example: "Sampling policy: View menu, Sampling"). The one interactive concession is focusability: every indicator is keyboard-focusable per SP-RP-006.

**QI-4.** Indicators never alarm: no red, no accent, no blinking, no pulsing, no count badges. Two visual states exist: nominal (label in `--prism-ink-muted`, value in `--prism-ink-secondary`) and attention (label and value in `--prism-ink-primary`, prefixed by a 6px filled diamond glyph in the same color). Attention is entered only when the condition changes the meaning of what the user sees (stats sidecar absent so the ramp domain is computed on the fly; memory governor under eviction pressure; mask-intersection warning active). State transitions are instantaneous (MO-4).

**QI-5.** Collapsed anatomy, left to right: optional 6px state glyph (attention only), label, value, optional unit. Height 20px, line-height 20px, single line always; wrapping or ellipsis truncation is a REJECT. Internal horizontal padding 4px; label-to-value gap 4px. The entire indicator sets in `--prism-font-data` at `--prism-type-micro` with tabular numerals; labels lowercase; no weight above 500.

**QI-6.** Every value field reserves a fixed width in `ch` units sized to its longest legal rendering (table below). Values update in place; a width-changing readout is a REJECT (SP-UX-004).

| Indicator       | Label    | Rail                                                   | Collapsed format (exemplar)                            | Reserved width |
| --------------- | -------- | ------------------------------------------------------ | ------------------------------------------------------ | -------------- |
| Sample fraction | `sample` | Feature-space panel                                    | Two significant figures: `sample 4.2%`, `sample 100%`  | 6 ch           |
| Ramp domain     | `ramp`   | Spatial panel                                          | Endpoints at 4 significant figures: `ramp 0.031:0.874` | 14 ch          |
| Overview level  | `level`  | Spatial panel                                          | Decimation ratio, `1:1` is native: `level 1:16`        | 5 ch           |
| Capability tier | (none)   | App status bar                                         | Substrate word only: `gpu`, `cpu`, `cpu mt`            | 6 ch           |
| Fill state      | `fill`   | Spatial panel (and feature-space during densification) | Integer percent of viewport tiles resolved: `fill 62%` | 4 ch           |
| Memory readout  | `mem`    | App status bar                                         | Integer MB, used over budget: `mem 412/1024 MB`        | 13 ch          |

**QI-7.** Rail placement and order are fixed so position becomes muscle memory. Each panel owns one indicator rail: the full-width bottom strip, 20px tall, on `--prism-surface-2` with a 1px top edge in `--prism-line-subtle`. Indicators sit right-aligned with 8px gaps. Spatial rail order, left to right: `level`, `ramp`, `fill`. Feature-space rail: `sample`, then `fill` during densification. App status bar, rightmost first: `mem`, then tier. Reordering, duplicating an indicator in two locations, or placing a global indicator (tier, memory) anywhere but the status bar is a REJECT.

**QI-8.** The rail's left region is reserved for cursor readouts (lat/lon in the spatial panel; the wavelength cursor, for example `2314 nm`, in the spectral panel). Readouts share rail typography but are not indicators (they report the pointer, not a system decision) and never hover-expand.

**QI-9.** Rail slots are reserved: an inactive indicator (for example `fill` at completion) hides via visibility, keeping its width; siblings never reflow when an indicator appears or clears (MO-6).

**QI-10.** Expansion triggers after a 150ms hover dwell, or immediately on keyboard focus plus Enter. The card appears in a single frame: no transition, no fade, no scale. Card: max-width 320px, padding `--prism-space-2`, background `--prism-surface-3`, 1px border `--prism-line-subtle`, radius `--prism-radius-2`, shadow `--prism-shadow-overlay`, on `--prism-z-overlay`, anchored above the indicator. It overlays; it never displaces content. Dismiss on pointer leaving both indicator and card, on Escape, or on blur.

**QI-11.** Expanded-card content mandates, at minimum: sample fraction states policy name, seed, exact sampled and total counts, whether exact mode is available at the current extent, and provenance-recording confirmation. Ramp domain states domain source (stats sidecar percentile stretch, or computed on the fly), the percentile bounds, exact endpoint values with units, and locked versus tracking. Overview level states pyramid level, decimation factor, native ground sample distance when georeferenced, and why the level was chosen. Capability tier states the tier letter and a neutral capability statement (VOC-3), never deficiency language. Fill state states tiles resolved over total, in-flight fetches, and the source layout. Memory readout states the per-pool breakdown under the governor (chunk cache, derived tiles, GPU staging, feature-space), each pool's used over budget, and current eviction pressure.

**QI-12.** Collapsed labels follow the instrument register: capability surfaces as the compute substrate (`gpu`, `cpu`, `cpu mt`), never as "degraded" or "fallback". The words "chunk", "shard", "tier", and "co-moment" may appear only inside expanded cards and diagnostic surfaces, never in collapsed labels.

## 8. Motion Rules

**MO-1.** Exactly two animated behaviors exist in the product: derived-tile fill reveal and brush-commit highlight fade. The list is closed; a third animation anywhere (hover transitions, skeleton shimmer, spinner easing, panel slide, menu fade) is a REJECT. Extending the list requires a brief amendment, not reviewer discretion.

**MO-2.** Derived-tile fill reveal: each tile fades from 0 to full opacity over `--prism-motion-fill` (120ms), linear, at its final geometry. Tiles never slide, scale, or push neighbors. Before a tile resolves, its geometry is occupied by the underlying raw composite or a reserved neutral fill at `--prism-surface-1`; the fill sequence changes pixels, never layout.

**MO-3.** Brush highlight: the selection-mask highlight fades in or out over `--prism-motion-brush` (80ms), linear, on brush commit and on clear only. During an active drag, mask updates render immediately every frame with no interpolation; smoothing a live brush is a REJECT because it misreports what is selected. Selection propagation across panels is immediate, within the 100ms budget of SP-CO-001.

**MO-4.** Everything else is 0ms: hover states, focus rings, indicator state changes, expansion cards, mode switches, panel resize, menu opening are instantaneous state changes. No easing curves exist in the product; the two permitted animations are linear only. Spring, bounce, and overshoot do not exist here.

**MO-5.** Only opacity animates. Animating `transform`, `width`, `height`, or any layout property is a REJECT, which enforces zero layout shift during asynchronous fills (SP-UX-007) by construction.

**MO-6.** The no-layout-shift law: during any asynchronous operation (tile fetch, fit progress, stats arrival, sampling densification, indicator appearance) no element changes size or position. Mechanisms are mandatory, not suggested: reserved rail slots (QI-9), ch-reserved numeric widths (QI-6, TY-3), overlays on dedicated z-layers, and progress rendered inside pre-reserved geometry. Enforcement: the Lighthouse CI cumulative-layout-shift budget is 0.02 for the app shell, and any layout shift attributable to an asynchronous fill is a REJECT regardless of measured magnitude.

**MO-7.** Value-driven redraws are not motion: progress bars advancing, readouts ticking, band cursors tracking arrow keys, and spectra redrawing under a moving probe are data rendering, exempt from MO-1, but they are never smoothed with CSS transitions or tweening; they render the current value each frame.

**MO-8.** Under `prefers-reduced-motion: reduce`, both permitted animations drop to 0ms. Nothing else changes, because nothing else moves.

## 9. Spectral Panel Signature Treatment

The spectral panel is where the taste budget is spent (SP-UX-006, SP-RP-005). It must read, at a glance and in a screenshot, as the product's identity: a dark field in which data is light. The metaphor is literal: spectra render as emission, crowds sum like photons, and everything that is not data recedes into the bench.

**SIG-1.** The panel composes exactly this z-order, back to front: panel surface, grid and axes, bad-band spans, additive density field, brushed-selection density field, library reference overlays, basis vectors, probe spectra, wavelength cursors and readouts. Rendering out of order is a REJECT. Nothing ever renders above a probe spectrum except cursors and their readouts, and no chrome may occlude the plot area's central 80% width.

**SIG-2.** Overplotted populations render into an additive accumulation buffer: each spectrum contributes a fixed per-line weight equivalent to 4% opacity; counts are tone-mapped with a square-root curve normalized to the visible population's maximum; the result maps onto a single-hue luminance ramp from `--prism-surface-1` up to `--prism-data-density`. One spectrum is barely visible; a hundred agreeing spectra glow. Alpha-blended overdraw (painter's stacking of translucent strokes) is a REJECT: it order-biases the image and clips at saturation instead of accumulating.

**SIG-3.** The density hue token is reserved: no probe, reference, basis, or UI element may use `--prism-data-density`. Its job is to make "many spectra" instantly distinguishable from "one spectrum" by color alone.

**SIG-4.** Density is honest about its population: the rendered count and sampling status (full population, or sampled with the fraction) appear in the panel's quiet-indicator rail using the shared grammar, with the tone-map normalization anchor available in the expansion. A density field with no population indicator is a REJECT.

**SIG-5.** Brushed selections render as a second additive density field in the accent hue, composited above the base field. This is the single place the accent touches data, and it encodes membership, never a data value. Selection highlight by any other means (outlining, dimming the unselected, remapping the base field) is a REJECT.

**SIG-6.** Probe spectra render as solid, anti-aliased, fully opaque lines at 1.5px CSS width, above all density fields, never additively blended. The hovered or focused probe renders at 2px; nothing else changes on hover.

**SIG-7.** Probe hues come from `--prism-data-cat-1` through `--prism-data-cat-8` in fixed assignment order. At most 8 simultaneous individual probe spectra; the ninth probe forces the UI to offer grouping (mean plus envelope), it does not silently thin lines or recycle hues. Hue recycling within one panel is a REJECT.

**SIG-8.** Region probes render a mean line (1.5px solid, probe hue) plus a p10 to p90 envelope filled at 12% opacity of the same hue. The envelope's definition is printed in the probe's legend entry ("p10 to p90"): an unlabeled envelope is an invisible decision.

**SIG-9.** Library and uploaded references render dashed: 1px width, 6px on, 3px off, 85% opacity, in categorical hues distinct from active probe hues. A reference is never solid and a probe is never dashed; this dichotomy is the panel's grammar for "measured here" versus "brought from elsewhere", and it must survive grayscale reproduction.

**SIG-10.** A reference resampled to the sensor's bands (Gaussian convolution by FWHM) carries the resampling in its label, for example "USGS jarosite, resampled to AVIRIS-3". Displaying a resampled reference without saying so is a REJECT.

**SIG-11.** Masked wavelength spans render as full-height regions shaded with `--prism-shade-recessed`: darker than the bench, not overlaid on it. No border, no hatching, no icon. The eye reads them as regions where the instrument does not look.

**SIG-12.** Probe, reference, and basis lines break across masked spans; they never interpolate through them. A bridging segment across a masked span fabricates data and is a REJECT. Masked bands contribute nothing to the density field.

**SIG-13.** Hovering a masked span reveals extent and origin in a readout, for example "1343 nm to 1443 nm: masked (store bad-band list)". Masked spans are always stated in nm with the word "to", never as band-index ranges.

**SIG-14.** Basis vectors render as solid 1px lines against a dedicated normalized-loading axis on the panel's right edge; they never share the reflectance axis. Each line terminates in a right-edge label with component identity and, for variance-ordered decompositions, explained variance: "PC1 (62.4%)", "MNF3". Sign and ordering follow the ADR-0008 conventions; the panel never flips a sign for visual tidiness.

**SIG-15.** The wavelength axis is denominated in nm, end to end (for AVIRIS-class data, roughly 380 nm to 2510 nm). Band indices never appear on the axis. Wavelength cursors are 1px accent hairlines that snap to band centers; the cursor readout sets in `--prism-font-data` and reads nm first, band parenthetical: "2314 nm (band 187)". A readout showing a band index without its nm value is a REJECT.

**SIG-16.** Continuum removal is a visible state, not a silent rescale: when active, the y-axis label changes to "continuum-removed reflectance" and a persistent state chip appears in the panel header; toggling completes without animation. Any transform that changes the y-axis's meaning without relabeling it is a REJECT.

**SIG-17.** Motion budget: brushing feedback updates within the 100ms propagation budget (SP-CO-001) and hover emphasis is immediate. Nothing else in the spectral panel animates; entrance transitions, eased line drawing, and pulsing cursors are REJECTs.

## 10. Vocabulary Doctrine

**VOC-1.** There are exactly two lexicons. The instrument lexicon (bands, wavelengths, spectra, continuum removal, SAM angle, components, loadings, reflectance, radiance, masks, scenes, fits) is the only vocabulary in primary UI: labels, buttons, dialogs, empty states, progress text, errors. The engineering lexicon (chunk, shard, tier, cache, worker, wasm, WebGPU, LUT, texture, co-moment, eviction, fetch) is confined to quiet-indicator expansions and diagnostic surfaces. An engineering-lexicon word in primary UI is a REJECT.

**VOC-2.** Banned-term table for primary UI, with required replacements:

| Never in primary UI                   | Say instead                                          |
| ------------------------------------- | ---------------------------------------------------- |
| chunk, shard, fetch, request          | "loading spectra", "reading the scene"               |
| tier, fallback, degraded, unsupported | a capability statement (VOC-3)                       |
| cache, evict, pool                    | nothing; the memory readout is a quiet indicator     |
| texture, LUT, shader                  | "ramp", "display mapping"                            |
| worker, thread, wasm, WebGPU          | "GPU" and "CPU" are the only permitted compute words |
| co-moment, covariance staging         | "fitting", with progress                             |
| a bare band index                     | the nm value first, band index in parentheses        |

**VOC-3.** Capability copy follows one pattern: what the instrument is doing, colon, what that means for the user. Present tense, no apology, no blame. Canonical examples, reused verbatim where they fit: "Computing on CPU: larger fits take longer." "Computing statistics as you explore." "Rendering at overview level 2: zoom in for full detail."

**VOC-4.** Banned everywhere a user reads, including tooltips and errors: "degraded", "fallback", "unsupported", "missing", "limited", "slow device", "old browser", and any construction of the form "your device/browser cannot". The litmus test: if the sentence assigns fault to the user's hardware, network, or data, it fails; rewrite it to state what the instrument is doing. A student's laptop is never framed as the problem.

**VOC-5.** Genuine failures name the operation and the next action, in instrument terms: "Could not read the store at this URL: check the address, or open a local file." Stack traces, HTTP status codes, and store internals belong in the diagnostic surface behind the quiet indicator, never in the primary message.

**VOC-6.** Copy that states a wavelength without its nm unit is a REJECT; formatting follows TY-4 and TY-5.

## 11. Accessibility Commitments

**AX-1.** All informational text meets 4.5:1 contrast against its actual surface. `--prism-ink-disabled` is the only exemption and appears only on non-interactive disabled states, never for information.

**AX-2.** CVD safety is structural, not aspirational: the ramp catalog and its addition protocol (CD-7) are the enforcement point for SP-RP-006's ramp clause; the selection casing (CD-6) guarantees luminance separation independent of hue; the solid-versus-dashed probe and reference dichotomy (SIG-9) survives grayscale; quiet-indicator states are carried by ink weight and a glyph, never by hue alone (QI-4).

**AX-3.** Keyboard operability per SP-RP-006: every focusable element shows `outline: 2px solid var(--prism-accent); outline-offset: 1px` on `:focus-visible`; removing the outline or replacing it with a box-shadow is a REJECT. Every interactive element and every quiet indicator is reachable in a logical order; indicators expand on Enter and dismiss on Escape (QI-10). Non-pointer brushing exists in every panel: a keyboard path creates, adjusts, and clears selections without a pointer, and it drives the same selection-mask pipeline as the pointer path.

**AX-4.** Hover is never the sole disclosure of analytic state (mask, sample fraction, ramp domain, resampling, overview level). Hover may expand detail; the collapsed truth is always visible.

**AX-5.** `prefers-reduced-motion: reduce` is honored per MO-8.

## 12. Design-Review Checklist

The design-reviewer applies this checklist verbatim to every UI-touching change and issues APPROVE or REJECT citing rule IDs (SP-UX-005). Two consecutive REJECTs on the same change escalate per the autonomy plan.

1. Token discipline: no literal color, size, duration, radius, or z-index in component code; every value resolves to a Section 3 token; any new token carries a brief amendment (TK-1, TK-2).
2. Ladder closure: no sixth surface, no second accent, no invented neutral, no off-ladder font size, weight, radius, spacing, duration, or z-index (TK-4, CD-1, TY-2, Sections 3.10 to 3.13).
3. Desaturation test: with data panels masked and the screenshot desaturated, only focus, selection, and active status messages change meaningfully (CD-4).
4. Hue budget: at most the accent plus two status hues visible; capability copy in ink, never a status hue (CD-2, CD-3).
5. Focus and selection: `:focus-visible` outline present and unmodified; every selection stroke carries its casing (AX-3, CD-6).
6. Readout integrity: tabular numerals, reserved widths, no width jump; nm formatting per TY-4; ranges per TY-5; no thousands separators (TY-3 to TY-6).
7. Quiet indicators: every machine-made decision has exactly one indicator from the family, on the correct rail, in the fixed order, with mandated expansion content; no bespoke badges (QI-1 to QI-12).
8. Density and chrome: 48px chrome budget respected; single shared edges; integer pixel alignment at every DPR; no shadows in the bench plane (DN-2 to DN-5, TK-4).
9. Motion: only the two permitted animations, linear, at token durations; everything else instantaneous; nothing animates a layout property; CLS at or under 0.02; reduced motion drops to 0ms (MO-1 to MO-8).
10. Spectral panel: layer order intact; additive density, not alpha overdraw; population indicator present; probes solid and references dashed; lines break across masked spans; resampled references labeled; basis vectors on the loading axis; continuum removal relabels the y-axis (SIG-1 to SIG-17).
11. Vocabulary: no engineering lexicon in primary UI; no banned deficiency words; capability statements follow the VOC-3 pattern; failures name the operation and next action (VOC-1 to VOC-6).
12. Ramps: catalog-only; any addition carries CVD simulations and uniformity evidence; ramp identity and domain visible (CD-7).
13. Accessibility: 4.5:1 informational contrast; keyboard paths for indicators and brushing; hover never sole disclosure (AX-1 to AX-4).
14. Rejected ancestor patterns (Section 13) do not appear.
15. Where the brief is silent, flag a DESIGN-BRIEF gap for amendment; do not improvise (Section 14).

## 13. References and Rejections

Four ancestors, studied and never copied. Shipping a rejected pattern is a REJECT citing the rule.

**REF-1 (mission-operations displays, OpenMCT lineage: extract).** Operational legibility: every displayed value is trustworthy because its state is never ambiguous. Stale data looks stale, loading states are explicit, layouts hold perfectly still while values update underneath. Spectral Prism commits: fill states and staleness are always visible (the quiet-indicator grammar), and no asynchronous update ever moves layout (MO-6, SP-UX-007).

**REF-2 (OpenMCT lineage: reject).** The composable panel farm and its chrome: unbounded grids of bordered widgets, each with its own toolbar, legible only to their author. Spectral Prism has exactly three panels and they are not user-composable. Also rejected: alarm-limit color semantics (red and yellow state coloring). Spectral data is not alarmed telemetry; hue belongs to data values and to nothing else.

**REF-3 (Linear: extract).** Restraint as discipline: one accent, keyboard-first operation, motion held short and only in service of causality, hierarchy carried by type and spacing rather than boxes and rules. The single-accent doctrine, the fixed type ladder, and the keyboard paths of SP-RP-006 are Linear's lesson applied to an instrument.

**REF-4 (Linear: reject).** Reading-list density and hover-revealed state. Linear's generous whitespace is tuned for scanning issues, not an instrument bench; Spectral Prism runs instrument-dense on the 8px grid. Linear's habit of revealing actions and metadata only on hover is incompatible with the no-invisible-decisions contract: no analytic state may be hover-only (AX-4).

**REF-5 (Observable: extract).** Data-forward neutrality: an achromatic frame that cedes all color to the visualization, and typography that treats numbers as first-class citizens. The shell is the optical bench, achromatic plus one accent, and every readout sets in the tabular-numeral face.

**REF-6 (Observable: reject).** The document metaphor. Observable is a scrolling notebook where the reader's position determines what is visible. Spectral Prism is a fixed bench: the triad does not scroll, panels do not reflow, and no analytic view lives below the fold. Also rejected: the editable-prose register; Spectral Prism's surfaces are controls and readouts, not documents.

**REF-7 (carbonplan maps: extract).** Data-dominant color on a near-black ground: the basemap recedes to context, the data raster owns the entire hue budget, the few floating controls are quiet and monochrome. This is the closest existing embodiment of "the interface is the optical bench, the data is the light"; the spatial panel's derived-tile rendering commits to it directly, including the CVD-safe perceptually uniform default catalog (CD-7).

**REF-8 (carbonplan maps: reject).** The editorial frame: scrollytelling drives the camera, ramps are hard-committed per story, the reader is a passenger. Spectral Prism's scientist drives: view state belongs to the user, ramp choice is a user decision recorded in provenance, and no surface may sequence the user through a story. A ramp the user cannot change, or a camera the user does not control, is a REJECT.

## 14. Amendment Protocol

**AM-1.** Gaps become brief amendments, not improvisation. When the design-reviewer, an implementer, or a user journey exposes a question this brief does not answer, the finding is recorded as a DESIGN-BRIEF gap; the surface in question does not ship a guessed answer. The amendment states the rule, its ID, and its rationale, and bumps this document's version (v1.1, v1.2, and so on) in the status header with the date.

**AM-2.** The closed lists extend only by amendment: the token set (TK-2), the surface ladder (TK-4), the type ladder (TY-2), the ramp catalog (CD-7), the animation list (MO-1), and the quiet-indicator family (QI-2). A pull request that extends any of them without amending this document is a REJECT.

**AM-3.** Amendments that change architecture-adjacent commitments (the render plane's treatment of density accumulation, the ramp catalog's interaction with derived tiles, anything touching an accepted ADR) are proposed as ADR amendments or superseding ADRs per the review-loop protocol, and this brief cites the ADR rather than restating it.

**AM-4.** The design-reviewer enforces whatever the current version says, in full, from the moment it lands. Verdicts cite rule IDs; the checklist in Section 12 is the reviewer's script, and drift between the checklist and the rules it cites is itself a gap under AM-1.
