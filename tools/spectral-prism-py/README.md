# sprism

CLI for Spectral Prism. Converts archival imaging-spectroscopy granules (EMIT, AVIRIS-3) into the dual-layout GeoZarr the browser workbench reads: a spectral-major primary layout plus a spatial-major multiscales pyramid, with ZEP0005-aligned per-chunk statistics (ADR-0003), optional ingest-time warping of the pyramid to a display CRS (ADR-0007), and a VirtualiZarr to Icechunk reference path.

Not what USGS PRISM (Processing Routines in IDL for Spectroscopic Measurements) is, and not related to the JPL PRISM airborne imaging spectrometer; the name overlap is coincidental domain crowding (see docs/research/name-collision-scan.md).

Status: scaffold only; CLI v0 is Phase 0 roadmap work.
