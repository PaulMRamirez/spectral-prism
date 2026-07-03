# GeoZarr Attribute Vocabulary for a Tolerant Browser Reader (state as of 2026-07)

## State of play

The OGC GeoZarr SWG (charter in `zarr-developers/geozarr-spec`, Architecture Board review targeted summer 2026) has pivoted from a monolithic spec to a **modular set of Zarr Conventions** built on the Zarr Conventions Framework: three conventions hosted in the `zarr-conventions` GitHub org (`proj`, `spatial`, `multiscales`), each UUID-identified and JSON-Schema-validated. geozarr.org states explicitly that the rendered spec-draft documents (the zarr.dev HTML/PDF with the `tile_matrix_set` multiscales and CF-centric text) **lag behind** convention development; that older draft vocabulary should be treated as a legacy fallback, not the current form. All three conventions are v0.1, pre-stable, with breaking changes possible before v1.0 (anticipated end of 2026), so a tolerant reader should key on UUIDs and be lenient about minor field drift.

Sources: https://github.com/zarr-developers/geozarr-spec , https://geozarr.org/ , https://zarr.dev/geozarr-spec/documents/standard/template/geozarr-spec.html

## 1. CRS

Current form: the **proj convention** (`zarr-conventions/proj`, v0.1, UUID `f17cb550-5864-4468-aeb7-f3180cfb622f`). Attributes live in the `attributes` of **either a group or an array**:

| Key | Type | Notes |
|---|---|---|
| `proj:code` | string | `authority:code`, regex `^[^:]+:[^:]+$`, e.g. `"EPSG:32611"` |
| `proj:wkt2` | string | WKT2 (ISO 19162); writers are told to prefer this (self-contained, lossless) |
| `proj:projjson` | object | PROJJSON per https://proj.org/schemas/v0.7/projjson.schema.json |

At least one MUST be present. Group-level values apply to **direct child arrays only** (no grandchild cascade); an array may override its parent. On conflict between representations, **`proj:wkt2` takes precedence**. There is no `proj:epsg` in this convention: `proj:epsg` is the STAC projection extension form, deprecated in STAC proj v1.2.0 and removed in v2.0.0 (Dec 2024) in favor of `proj:code`; accept it only as a legacy fallback (integer, implies authority EPSG).

Legacy/coexisting forms a reader will meet in the wild:
- **CF grid_mapping** (what rioxarray writes by default, and what the old GeoZarr draft blessed): a scalar coordinate variable, conventionally named `spatial_ref`, referenced by `grid_mapping: "spatial_ref"` on data variables, carrying `crs_wkt` (WKT2), a redundant GDAL-ism `spatial_ref` (WKT), plus CF parameter attributes (`grid_mapping_name`, `semi_major_axis`, ...). Not deprecated; the draft standard explicitly keeps it valid.
- **GDAL `_CRS`**: GDAL's own Zarr driver convention, an array-level attribute `_CRS` that is a dict with keys `url` (OGC CRS URL), `wkt` (WKT2:2019, GDAL's write default), `projjson`; GDAL reads in the order url, wkt, projjson.

## 2. Geotransform / affine

Current form: the **spatial convention** (`zarr-conventions/spatial`, v0.1, UUID `689b58e2-cf7b-45e0-9fff-9cfc0883d6b4`). Keys (on the node's `attributes`, group or array; also usable inside multiscales layout items):

| Key | Type | Notes |
|---|---|---|
| `spatial:dimensions` | string[2] | e.g. `["y","x"]`, required on arrays, binds which dims are spatial |
| `spatial:transform` | number[6] | **Rasterio/Affine coefficient order** `[a,b,c,d,e,f]`: `x = a*col + b*row + c`, `y = d*col + e*row + f` (a: x resolution, c: west origin, e: y resolution, negative for north-up, f: north origin) |
| `spatial:transform_type` | string | default `"affine"` |
| `spatial:bbox` | number[4] | `[xmin, ymin, xmax, ymax]` |
| `spatial:shape` | integer[2] | `[height, width]` |
| `spatial:registration` | string | `"pixel"` (default) or `"node"` |

So: 6 elements, JSON number array, rasterio order, not GDAL order. GDAL's `GetGeoTransform()` tuple `(c, a, b, f, d, e)` maps to it by reordering.

Legacy forms: the **CF/GDAL `GeoTransform` attribute** on the grid_mapping variable, a whitespace-separated **string** of 6 numbers in **GDAL order** (`"466266.0 3.0 0.0 8084700.0 0.0 -3.0"`, i.e. originX pixW rotX originY rotY pixH), written by rioxarray; and **explicit 1-D coordinate variables** (`x`/`y`, or `easting`/`northing`), which GDAL writes instead of any transform attribute when there is no rotation. A tolerant reader should be able to derive the affine from regularly spaced 1-D coordinates as a last resort.

## 3. Multiscales

Current form: the **multiscales convention** (`zarr-conventions/multiscales`, v0.1, UUID `d35379db-88df-4056-af3a-620245f8e347`). A **group-level** attribute `multiscales` (single object, not an array):

```json
{
  "multiscales": {
    "layout": [
      { "asset": "0", "transform": {"scale": [1.0, 1.0]} },
      { "asset": "1", "derived_from": "0",
        "transform": {"scale": [2.0, 2.0], "translation": [0.5, 0.5]},
        "resampling_method": "average" }
    ],
    "resampling_method": "average"
  }
}
```

Fields: `layout` (required, ordered array of level objects), per level `asset` (required, path to child array/group, e.g. `"1"` or `"0/data"`), `derived_from` (optional source-level ref), `transform` (required if `derived_from` present, with optional `scale[]` and `translation[]` per axis), `resampling_method` (optional, per level or top level). GDAL reads this convention for Zarr v3 and exposes levels as overviews.

Differences from OME-Zarr: OME-NGFF `multiscales` is an array of objects with `axes` and `datasets[{path, coordinateTransformations}]` (nested under the `ome` key in v0.5/Zarr v3) and embeds absolute spatial metadata in the multiscale block; the zarr-conventions form is domain-agnostic, uses `layout`/`asset` instead of `datasets`/`path`, records only the **relative** resampling transform, and leaves absolute georeferencing to `proj:`/`spatial:` attributes on each level. The **old GeoZarr draft** form (still in the zarr.dev document) is different again: children named by tile-matrix ids `"0","1","2"`, with `multiscales` containing `tile_matrix_set` (identifier, URI, or inline JSON), `resampling_method` (one of nearest, average, bilinear, cubic, cubic_spline, lanczos, mode, max, min, med, sum, q1, q3, rms, gauss), and optional `tile_matrix_set_limits`. Accept it read-only as legacy.

## 4. zarr_conventions declaration mechanism

Defined by the **Zarr Conventions Framework** (`zarr-conventions/zarr-conventions-spec`, inspired by STAC extensions; conventions must be safely ignorable by core Zarr implementations). The marker is the attribute **`zarr_conventions`** on the declaring node's `attributes` (arrays or groups, any level). It **MUST be an array of Convention Metadata Objects, not strings**. Each object must contain at least one of `uuid`, `schema_url`, `spec_url`; `name` is recommended, `description` optional. Example:

```json
{ "zarr_conventions": [ {
    "uuid": "f17cb550-5864-4468-aeb7-f3180cfb622f",
    "schema_url": "https://raw.githubusercontent.com/zarr-conventions/proj/refs/tags/v0.1/schema.json",
    "spec_url": "https://github.com/zarr-conventions/proj/blob/v0.1/README.md",
    "name": "proj" } ] }
```

There is no central registry authority; the UUID is the permanent identity. Geo convention UUIDs: proj `f17cb550-5864-4468-aeb7-f3180cfb622f`, spatial `689b58e2-cf7b-45e0-9fff-9cfc0883d6b4`, multiscales `d35379db-88df-4056-af3a-620245f8e347`. The reference validator (inspect.geozarr.org, geozarr-toolkit) auto-detects conventions **via `zarr_conventions` or via attribute prefixes**; a browser reader should do the same and never require the declaration (GDAL and early writers may omit or mangle it).

## What real tools write (mid-2026)

- **GDAL >= 3.13**: reads `proj:`/`spatial:` conventions; writes them only with creation option `GEOREFERENCING_CONVENTION=SPATIAL_PROJ`. Default write remains GDAL-native: `_CRS` dict + 1-D `X`/`Y` coordinate arrays + `_ARRAY_DIMENSIONS`. Reads CF grid_mapping CRS as well. Reads Zarr v3 multiscales as overviews.
- **rioxarray** (0.22 era): default remains CF (`spatial_ref` grid_mapping variable with `crs_wkt`, `spatial_ref`, `GeoTransform` string). Zarr-convention support proposed in issue #882, implemented via PR #918 (`write_zarr_crs()`, `write_zarr_transform()`, `write_zarr_spatial_metadata()`, `write_zarr_conventions()`), writing `proj:code`/`proj:wkt2`/`proj:projjson` and `spatial:transform` (numeric `[a..f]`) plus `spatial:dimensions`/`shape`/`bbox`/`registration`; read precedence Zarr attrs, then CF grid_mapping, then dataset attrs. Verify shipped version against the rioxarray changelog before pinning.

## 5. CF vocabulary for imaging spectroscopy (EMIT / AVIRIS mapping)

- **Wavelength coordinate**: CF standard names `radiation_wavelength` (canonical units m) and `sensor_band_central_radiation_wavelength` (canonical units m, "first moment of the band's normalized spectral response function"). Any UDUNITS length unit is legal on the variable: accept `"nm"`, `"nanometers"`, `"um"`, `"micrometers"`, `"microns"`, `"m"`, and normalize to nm.
- **FWHM**: no CF standard name exists; convention is a `fwhm` auxiliary variable on the band dimension with `long_name` and length units.
- **Bad bands**: CF flag semantics (`flag_values` + `flag_meanings`) on a small integer variable; EMIT's `good_wavelengths` (1 = good, 0 = bad) is the de facto pattern; ENVI-heritage products carry `bbl` (bad band list) in the ENVI header instead.
- **EMIT netCDF (L1B/L2A)**: group `sensor_band_parameters` with `wavelengths` (f4, long_name "Wavelength Centers", units `"nm"`), `fwhm` (f4, long_name "Full Width at Half Max", units `"nm"`), `good_wavelengths` (u1, long_name "Wavelengths where reflectance is useable: 1 = good data, 0 = bad data", units `"unitless"`); 285 bands, 381 to 2493 nm; water-absorption spans (about 1320 to 1440 and 1770 to 1970 nm) flagged 0 with reflectance set to -0.01. Geolocation is in a `location` group (GLT), not CF grid_mapping.
- **AVIRIS-3 netCDF (ORNL DAAC L2A RFL_ORT)**: flat file, variables `wavelength` (singular, nm, 284 bands), `fwhm` (nm), CF grid_mapping variable `transverse_mercator`, `easting`/`northing` coordinates, no good-band flag variable. So the CLI must accept both `wavelengths` (EMIT, in a group) and `wavelength` (AVIRIS-3, flat).

Recommended CLI mapping into GeoZarr: a 1-D `wavelength` coordinate array (standard_name `radiation_wavelength`, units `nm`, axis binding via `dimension_names`), `fwhm` auxiliary array (units `nm`), `good_wavelengths` u1 flag array with `flag_values: [0,1]`, `flag_meanings: "bad_data good_data"`; provenance of the source vocabulary goes under `spectral_prism:` per ADR-0003.

## Recommended acceptance table (tolerant reader)

| Concept | Primary (write and read) | Accepted fallbacks, in order |
|---|---|---|
| Convention detection | `zarr_conventions` array of objects, match by `uuid`, then `name`/`schema_url` | attribute-prefix sniffing (`proj:`, `spatial:`, `multiscales`); never require the declaration |
| CRS | `proj:wkt2` on array, else its direct parent group | `proj:projjson`; `proj:code`; CF grid_mapping variable via `grid_mapping` ref (`crs_wkt`, then `spatial_ref` attr, then CF parameter attrs); GDAL `_CRS` (`url`, then `wkt`, then `projjson`); legacy `proj:epsg` (int, assume EPSG) |
| Affine transform | `spatial:transform` number[6], rasterio order, honoring `spatial:registration` (default pixel) | `GeoTransform` string on grid_mapping variable (GDAL order, whitespace-split); derive from regularly spaced 1-D coordinate arrays (`x`/`y`, `easting`/`northing`, GDAL `X`/`Y`); `spatial:bbox` + `spatial:shape` as degenerate no-rotation case |
| Spatial dim identity | Zarr v3 `dimension_names` + `spatial:dimensions` | `_ARRAY_DIMENSIONS` (v2/xarray); NCZarr dim names; CF `axis`/`standard_name` on coordinate vars |
| Multiscales | group attr `multiscales.layout[].asset` (+ `transform.scale/translation`, `resampling_method`), per-level `proj:`/`spatial:` | legacy GeoZarr draft `tile_matrix_set` form with TMS-id child groups; OME-NGFF `multiscales[].datasets[].path` (read-only tolerance) |
| Wavelength | `wavelength` coord, standard_name `radiation_wavelength`, units normalized from any UDUNITS length | `wavelengths` (EMIT), `sensor_band_central_radiation_wavelength`, bare `units` string match (nm/um variants), ENVI header import |
| FWHM | `fwhm` variable, same units handling | absent: treat as unknown, surface in UI per invariant 3 |
| Band quality | u1 flag var with `flag_values`/`flag_meanings` | EMIT `good_wavelengths` semantics (1 good, 0 bad); ENVI `bbl`; absent: all good, provenance-noted |

Caveat for REQUIREMENTS ledgering: all three conventions are v0.1 pre-stable; pin the tagged `schema_url` versions in conformance fixtures and re-verify at v1.0 (expected late 2026).

## Sources

- https://github.com/zarr-developers/geozarr-spec (SWG home, convention links)
- https://geozarr.org/ (roadmap, draft-lag statement, validator)
- https://github.com/zarr-conventions/proj and https://raw.githubusercontent.com/zarr-conventions/proj/main/README.md
- https://github.com/zarr-conventions/spatial
- https://github.com/zarr-conventions/multiscales and https://raw.githubusercontent.com/zarr-conventions/multiscales/main/README.md
- https://github.com/zarr-conventions/zarr-conventions-spec (framework, CMO structure)
- https://zarr.dev/geozarr-spec/documents/standard/template/geozarr-spec.html (legacy draft: CF grid_mapping, tile_matrix_set multiscales)
- https://gdal.org/en/latest/drivers/raster/zarr.html (GDAL `_CRS`, `_ARRAY_DIMENSIONS`, GDAL 3.13 `GEOREFERENCING_CONVENTION=SPATIAL_PROJ`, multiscales read)
- https://corteva.github.io/rioxarray/stable/getting_started/crs_management.html (spatial_ref, crs_wkt, GeoTransform string)
- https://github.com/corteva/rioxarray/issues/882 (Zarr convention support, PR #918)
- https://github.com/zarr-developers/geozarr-toolkit and https://inspect.geozarr.org (validator detection behavior)
- https://github.com/stac-extensions/projection (proj:epsg deprecated 1.2.0, removed 2.0.0, replaced by proj:code)
- https://raw.githubusercontent.com/emit-sds/emit-sds-l2a/develop/output_conversion.py (EMIT sensor_band_parameters variable definitions)
- https://nasa.github.io/VITALS/python/Exploring_EMIT_L2A_RFL.html and https://lpdaac.usgs.gov/documents/1569/EMITL2ARFL_User_Guide_v1.pdf (EMIT groups, good_wavelengths semantics)
- https://daac.ornl.gov/AVUELO/guides/AVUELO_AV3_L2A_Reflectance.html (AVIRIS-3 netCDF: wavelength, fwhm, transverse_mercator)
- https://vocab.nerc.ac.uk/standard_name/sensor_band_central_radiation_wavelength/ and https://vocab.nerc.ac.uk/standard_name/radiation_wavelength/ (CF standard names, canonical units m)

## Verification

Cross-checked against primary sources 2026-07-02 (workflow wf_d2c19f10-601): verdict CONFIRMED. Clarifications recorded:
- Clarification (not an error), rioxarray claim: the flagged-unknown ship status is now resolvable from master history.rst: READ support for Zarr spatial/proj conventions shipped in rioxarray 0.22.0 (changelog entry cites #900), while WRITE support (from issue #882 / PR #918, merged) sits in the 'unreleased' changelog section as of 2026-07-02, so every tagged release still writes CF only (https://raw.githubusercontent.com/corteva/rioxarray/master/docs/history.rst)
- Clarification (not an error), EMIT claim: good_wavelengths' full long_name in output_conversion.py is 'Wavelengths where reflectance is useable: 1 = good data, 0 = bad data'; the claim quoted the trailing fragment (https://raw.githubusercontent.com/emit-sds/emit-sds-l2a/develop/output_conversion.py)
- Verification note: FWHM absence checked by grepping the full CF standard name table XML v94 (5071 entries, zero matches for fwhm/full_width/half_maximum); radiation_wavelength and sensor_band_central_radiation_wavelength both canonical_units m (https://cfconventions.org/Data/cf-standard-names/current/src/cf-standard-name-table.xml)
- Verification note: EMIT 285 bands / 381-2493 nm confirmed via NASA Earthdata catalog page for EMITL2ARFL v001 (https://www.earthdata.nasa.gov/data/catalog/lpcloud-emitl2arfl-001), not the VITALS notebook, which only confirms the water-band regions and the -0.01 masked reflectance
