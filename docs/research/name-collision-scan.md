# Name-Collision Scan

**Status:** v1, 2026-07-02. Closes the ROADMAP Phase 0 scan item. Every check below was performed twice: an initial registry scan, then an independent verification pass that re-fetched each registry from scratch (workflow run wf_4f11d0c7-7fb, 2026-07-02).

## Verdict

**Keep the `spectral-prism` namespace and the `sprism` CLI name.** Every exact-name check came back clean.

## Findings

| Registry          | Name                               | Status                | Evidence                                                                                                                                                |
| ----------------- | ---------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PyPI              | `sprism`                           | free                  | 404 on both the JSON API and the simple index                                                                                                           |
| PyPI              | `spectral-prism`                   | free                  | 404 including PEP 503 underscore normalization                                                                                                          |
| npm               | `spectral-prism`                   | free                  | 404 from registry.npmjs.org                                                                                                                             |
| npm               | `prism-core`                       | **taken**             | Existing package since 2018 ("Prism Core Modules", latest 2.0.2, last release 2022, repo f12/prism-core)                                                |
| npm org/scope     | `@spectral-prism`                  | unclear, leaning free | Zero packages under the scope; zero maintainer/author matches; org-page existence unverifiable anonymously (Cloudflare 403 even on known-existing orgs) |
| GitHub            | `spectral-prism` (user/org)        | free                  | 404 on both /users and /orgs endpoints                                                                                                                  |
| Web/trademark     | "Spectral Prism" / "SpectralPrism" | free                  | No product or trademark with the exact name surfaced; not a formal USPTO query                                                                          |
| PyPI (confusable) | `spectral`                         | taken                 | Spectral Python (SPy), hyperspectral image processing, same domain                                                                                      |
| PyPI (confusable) | `prism`                            | taken                 | Unrelated                                                                                                                                               |

## Consequences

1. **`prism-core` never publishes unscoped.** The workspace package publishes as `@spectral-prism/prism-core` (or `@spectral-prism/core`) when publishing begins; until then all packages are `private: true` and the workspace name `prism-core` is internal only.
2. **Claim the `@spectral-prism` npm org promptly** (human action; scope claiming is first come, first served, and org existence could not be ruled out anonymously).
3. **Publish a real minimal `sprism` to PyPI at the first CLI release** rather than squatting; consider registering `spectral-prism` on PyPI pointing at the same distribution to prevent typo-squatting.
4. **Disambiguate in README and docs** from the two same-domain Prism artifacts: USGS PRISM (Processing Routines in IDL for Spectroscopic Measurements) and the JPL PRISM airborne imaging spectrometer. The broader Prism crowding (Prisma ORM, Prism.js, PRISM climate dataset) is far enough from imaging spectroscopy that the compound name distinguishes adequately.
