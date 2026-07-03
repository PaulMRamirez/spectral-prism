"""Generate committed store-conformance fixtures (SP-DP-001).

Writes three tiny stores with zarr-python (the reference implementation, so the
JS reader is tested against independently produced bytes) plus expected-value
JSON for each array:

  packages/prism-core/fixtures/stores/zarr-v2          Zarr v2, zlib compressor
  packages/prism-core/fixtures/stores/zarr-v3          Zarr v3, gzip codec
  packages/prism-core/fixtures/stores/zarr-v3-sharded  Zarr v3, sharding codec
  packages/prism-core/fixtures/stores/expected/*.json  independently read back

Run from the repo root:
  uv run --with zarr --with numpy tools/spectral-prism-py/scripts/generate_store_fixtures.py

Values are deterministic ramps so failures localize; wavelengths are a real nm
grid because wavelength-as-coordinate starts in the fixtures.
"""

import json
import shutil
import sys
from pathlib import Path

import numpy as np
import zarr

REPO = Path(__file__).resolve().parents[3]
FIXTURES = REPO / "packages" / "prism-core" / "fixtures" / "stores"

WAVELENGTHS_NM = np.array([450.5, 550.25, 650.0, 850.0], dtype=np.float64)


def reflectance_ramp(bands: int, height: int, width: int) -> np.ndarray:
    b, y, x = np.meshgrid(
        np.arange(bands), np.arange(height), np.arange(width), indexing="ij"
    )
    return (b * 1000 + y * 16 + x).astype(np.int16)


def expected_json(name: str, array: np.ndarray) -> None:
    out = FIXTURES / "expected" / f"{name}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        json.dumps(
            {
                "dtype": str(array.dtype),
                "shape": list(array.shape),
                "values": [
                    float(v) if array.dtype.kind == "f" else int(v)
                    for v in array.ravel(order="C")
                ],
            },
            indent=1,
        )
    )


def write_v2() -> None:
    import numcodecs

    root_path = FIXTURES / "zarr-v2"
    group = zarr.open_group(str(root_path), mode="w", zarr_format=2)
    group.attrs["title"] = "SP-DP-001 v2 conformance fixture"

    cube = reflectance_ramp(4, 8, 8)
    arr = group.create_array(
        "reflectance",
        shape=cube.shape,
        chunks=(2, 4, 4),
        dtype="int16",
        compressors=numcodecs.Zlib(level=5),
        fill_value=-9999,
    )
    arr[:] = cube
    arr.attrs["_ARRAY_DIMENSIONS"] = ["band", "y", "x"]

    wl = group.create_array(
        "wavelengths_nm",
        shape=WAVELENGTHS_NM.shape,
        chunks=WAVELENGTHS_NM.shape,
        dtype="float64",
        compressors=numcodecs.Zlib(level=5),
    )
    wl[:] = WAVELENGTHS_NM

    expected_json("zarr-v2-reflectance", cube)
    expected_json("zarr-v2-wavelengths_nm", WAVELENGTHS_NM)


def write_v3() -> None:
    from zarr.codecs import BytesCodec, GzipCodec

    root_path = FIXTURES / "zarr-v3"
    group = zarr.open_group(str(root_path), mode="w", zarr_format=3)
    group.attrs["title"] = "SP-DP-001 v3 conformance fixture"

    cube = reflectance_ramp(4, 8, 8)
    arr = group.create_array(
        "reflectance",
        shape=cube.shape,
        chunks=(2, 4, 4),
        dtype="int16",
        serializer=BytesCodec(endian="little"),
        compressors=GzipCodec(level=5),
        fill_value=-9999,
    )
    arr[:] = cube

    wl = group.create_array(
        "wavelengths_nm",
        shape=WAVELENGTHS_NM.shape,
        chunks=WAVELENGTHS_NM.shape,
        dtype="float64",
        serializer=BytesCodec(endian="little"),
        compressors=GzipCodec(level=5),
    )
    wl[:] = WAVELENGTHS_NM

    expected_json("zarr-v3-reflectance", cube)
    expected_json("zarr-v3-wavelengths_nm", WAVELENGTHS_NM)


def write_v3_sharded() -> None:
    from zarr.codecs import BytesCodec, GzipCodec

    root_path = FIXTURES / "zarr-v3-sharded"
    group = zarr.open_group(str(root_path), mode="w", zarr_format=3)
    group.attrs["title"] = "SP-DP-001 sharded v3 conformance fixture"

    cube = reflectance_ramp(4, 16, 16)
    # Shards of (2, 8, 8) each contain four (2, 4, 4) inner chunks, so a whole-
    # shard read is exactly the coalescing case: four inner-chunk range reads
    # that should merge.
    arr = group.create_array(
        "cube",
        shape=cube.shape,
        chunks=(2, 4, 4),
        shards=(2, 8, 8),
        dtype="int16",
        serializer=BytesCodec(endian="little"),
        compressors=GzipCodec(level=5),
        fill_value=-9999,
    )
    arr[:] = cube

    expected_json("zarr-v3-sharded-cube", cube)


def verify_roundtrip() -> None:
    """Independent read-back so the committed expected JSON is proven, not assumed."""
    for store_name, path, expected_name in [
        ("zarr-v2", "reflectance", "zarr-v2-reflectance"),
        ("zarr-v3", "reflectance", "zarr-v3-reflectance"),
        ("zarr-v3-sharded", "cube", "zarr-v3-sharded-cube"),
    ]:
        arr = zarr.open_array(str(FIXTURES / store_name / path), mode="r")
        expected = json.loads((FIXTURES / "expected" / f"{expected_name}.json").read_text())
        actual = np.asarray(arr[:]).ravel(order="C").tolist()
        assert actual == expected["values"], f"round-trip mismatch in {store_name}/{path}"
    print("round-trip verification passed")


# Convention metadata objects per the Zarr Conventions Framework (array of
# objects, never strings; UUID is the permanent id, tagged schema_url pinned).
# Sources verified 2026-07-02: docs/research/geozarr-vocabulary.md.
GEOREF_ATTRS = {
    "zarr_conventions": [
        {
            "name": "proj",
            "uuid": "f17cb550-5864-4468-aeb7-f3180cfb622f",
            "schema_url": "https://raw.githubusercontent.com/zarr-conventions/proj/refs/tags/v0.1/schema.json",
        },
        {
            "name": "spatial",
            "uuid": "689b58e2-cf7b-45e0-9fff-9cfc0883d6b4",
            "schema_url": "https://raw.githubusercontent.com/zarr-conventions/spatial/refs/tags/v0.1/schema.json",
        },
        {
            "name": "multiscales",
            "uuid": "d35379db-88df-4056-af3a-620245f8e347",
            "schema_url": "https://raw.githubusercontent.com/zarr-conventions/multiscales/refs/tags/v0.1/schema.json",
        },
    ],
    "proj:code": "EPSG:32611",
    "spatial:transform": [30.0, 0.0, 499980.0, 0.0, -30.0, 3800040.0],
    "spatial:dimensions": ["y", "x"],
}


def write_geozarr_variant(
    name: str,
    *,
    georef: bool,
    wavelengths_unit: str | None,
) -> dict:
    """One convention-annotated store; returns the expected-model fragment."""
    from zarr.codecs import BytesCodec, GzipCodec

    root_path = FIXTURES / name
    attrs: dict = {"title": f"SP-DP-004 {name} fixture"}
    if georef:
        attrs.update(GEOREF_ATTRS)
        # multiscales convention v0.1: single object, layout[].asset paths.
        attrs["multiscales"] = {
            "layout": [
                {"asset": "0"},
                {
                    "asset": "1",
                    "derived_from": "0",
                    "transform": {"scale": [2.0, 2.0], "translation": [0.5, 0.5]},
                },
            ],
            "resampling_method": "average",
        }
    group = zarr.open_group(str(root_path), mode="w", zarr_format=3)
    group.attrs.update(attrs)

    cube = reflectance_ramp(4, 8, 8)
    arr = group.create_array(
        "reflectance",
        shape=cube.shape,
        chunks=(2, 4, 4),
        dtype="int16",
        serializer=BytesCodec(endian="little"),
        compressors=GzipCodec(level=5),
        fill_value=-9999,
    )
    arr[:] = cube

    expected: dict = {
        "degradations": [],
        "crsCode": "EPSG:32611" if georef else None,
        "transform": GEOREF_ATTRS["spatial:transform"] if georef else None,
        "multiscalePaths": ["0", "1"] if georef else None,
        "wavelengthsNm": None,
        "fwhmNm": None,
        "goodBands": None,
    }
    if not georef:
        expected["degradations"].append("missing-georeferencing")

    if wavelengths_unit is None:
        expected["degradations"].append("missing-wavelengths")
    else:
        factor = 1.0 if wavelengths_unit == "nm" else 1e-3
        wl = group.create_array(
            "wavelengths", shape=(4,), chunks=(4,), dtype="float64",
            serializer=BytesCodec(endian="little"), compressors=GzipCodec(level=5),
        )
        wl[:] = WAVELENGTHS_NM * factor
        wl.attrs["units"] = wavelengths_unit
        wl.attrs["standard_name"] = "radiation_wavelength"

        fwhm = group.create_array(
            "fwhm", shape=(4,), chunks=(4,), dtype="float64",
            serializer=BytesCodec(endian="little"), compressors=GzipCodec(level=5),
        )
        fwhm[:] = np.array([5.0, 5.0, 6.0, 6.0]) * factor
        fwhm.attrs["units"] = wavelengths_unit

        good = group.create_array(
            "good_wavelengths", shape=(4,), chunks=(4,), dtype="uint8",
            serializer=BytesCodec(endian="little"), compressors=GzipCodec(level=5),
        )
        good[:] = np.array([1, 1, 0, 1], dtype=np.uint8)

        expected["wavelengthsNm"] = [float(v) for v in WAVELENGTHS_NM]
        expected["fwhmNm"] = [5.0, 5.0, 6.0, 6.0]
        expected["goodBands"] = [1, 1, 0, 1]

    return expected


def write_dual_layout_variant(name: str, *, spectral: bool, spatial: bool) -> dict:
    """A spectral_prism:binding store; returns the expected-binding fragment."""
    from zarr.codecs import BytesCodec, GzipCodec

    root_path = FIXTURES / name
    binding: dict = {
        "version": 1,
        "provenance": {"generator": "generate_store_fixtures.py", "source": "synthetic"},
    }
    if spectral:
        binding["spectral"] = {"path": "spectral"}
    if spatial:
        binding["spatial"] = {"path": "spatial"}

    group = zarr.open_group(str(root_path), mode="w", zarr_format=3)
    group.attrs.update({"spectral_prism:binding": binding})

    codec_kwargs = dict(serializer=BytesCodec(endian="little"), compressors=GzipCodec(level=5))

    if spectral:
        # Spectral-major layout: always native CRS (ADR-0007).
        sg = group.create_group("spectral")
        sg.attrs.update({**GEOREF_ATTRS})
        cube = reflectance_ramp(4, 8, 8)
        arr = sg.create_array(
            "cube", shape=cube.shape, chunks=(4, 4, 4), dtype="int16",
            fill_value=-9999, **codec_kwargs,
        )
        arr[:] = cube
        wl = sg.create_array("wavelengths", shape=(4,), chunks=(4,), dtype="float64", **codec_kwargs)
        wl[:] = WAVELENGTHS_NM
        wl.attrs["units"] = "nm"

    if spatial:
        # Spatial-major pyramid: ingest-warped to a display CRS, so its CRS
        # legitimately differs from the spectral layout (ADR-0007).
        pg = group.create_group("spatial")
        pg.attrs.update(
            {
                "zarr_conventions": GEOREF_ATTRS["zarr_conventions"],
                "proj:code": "EPSG:3857",
                "spatial:transform": [60.0, 0.0, -13358338.0, 0.0, -60.0, 4300621.0],
                "spatial:dimensions": ["y", "x"],
                "multiscales": {
                    "layout": [
                        {"asset": "0"},
                        {"asset": "1", "derived_from": "0",
                         "transform": {"scale": [4.0, 4.0]}, "resampling_method": "average"},
                    ],
                    "resampling_method": "average",
                },
            }
        )
        base = reflectance_ramp(3, 8, 8)
        for level, factor in (("0", 1), ("1", 4)):
            data = base[:, ::factor, ::factor]
            arr = pg.create_array(
                level, shape=data.shape, chunks=(1, 4, 4), dtype="int16",
                fill_value=-9999, **codec_kwargs,
            )
            arr[:] = data

    expected: dict = {
        "version": 1,
        "spectralPath": "spectral" if spectral else None,
        "spectralCrs": "EPSG:32611" if spectral else None,
        "spatialPath": "spatial" if spatial else None,
        "spatialCrs": "EPSG:3857" if spatial else None,
        "spatialLevels": ["0", "1"] if spatial else None,
        "provenance": binding["provenance"],
        "degradations": (
            []
            if spectral and spatial
            else (["single-layout-spectral-only"] if spectral else ["single-layout-spatial-only"])
        ),
    }
    return expected


def write_stats_sidecar() -> None:
    """A store with a ZEP0005-shaped per-chunk stats sidecar (SP-DP-006).

    The sidecar is a group of per-chunk scalar arrays (min/max/sum/count) whose
    shape equals the data array's chunk grid; the binding's stats pointer names
    it. The browser reader consuming the sidecar must match the on-the-fly
    computation over the same cube exactly.
    """
    from zarr.codecs import BytesCodec, GzipCodec

    codec = dict(serializer=BytesCodec(endian="little"), compressors=GzipCodec(level=5))
    name = "stats-sidecar"
    root_path = FIXTURES / name

    # 4 x 16 x 16 cube, 2 x 8 x 8 chunks -> a 2 x 2 x 2 chunk grid (8 chunks).
    shape = (4, 16, 16)
    chunks = (2, 8, 8)
    nodata = -9999
    cube = reflectance_ramp(*shape)
    # Nodata seams are first-class: one chunk is entirely fill, another is
    # partially fill. The sidecar must mask fill exactly as the on-the-fly
    # computeChunkStats does, or the identity test would be vacuous (SP-DP-006).
    cube[0:2, 0:8, 0:8] = nodata  # chunk (0,0,0) entirely nodata
    cube[2:4, 8:16, 8:16][0, 0, 0] = nodata  # one pixel of chunk (1,1,1)
    grid = tuple(int(np.ceil(s / c)) for s, c in zip(shape, chunks))

    group = zarr.open_group(str(root_path), mode="w", zarr_format=3)
    group.attrs.update(
        {"spectral_prism:binding": {"version": 1, "spectral": {"path": "cube"}, "stats": {"path": "stats"}}}
    )
    arr = group.create_array(
        "cube", shape=shape, chunks=chunks, dtype="int16", fill_value=-9999, **codec
    )
    arr[:] = cube

    # Reduce the cube to per-chunk stats over the chunk grid (C-order flat).
    mins = np.empty(grid, dtype=np.float64)
    maxs = np.empty(grid, dtype=np.float64)
    sums = np.empty(grid, dtype=np.float64)
    counts = np.empty(grid, dtype=np.float64)
    for bi in range(grid[0]):
        for yi in range(grid[1]):
            for xi in range(grid[2]):
                block = cube[
                    bi * chunks[0] : (bi + 1) * chunks[0],
                    yi * chunks[1] : (yi + 1) * chunks[1],
                    xi * chunks[2] : (xi + 1) * chunks[2],
                ]
                valid = block[block != nodata]
                if valid.size == 0:
                    # All-nodata chunk: NaN min/max, zero sum/count, matching
                    # computeChunkStats.
                    mins[bi, yi, xi] = np.nan
                    maxs[bi, yi, xi] = np.nan
                    sums[bi, yi, xi] = 0.0
                    counts[bi, yi, xi] = 0
                else:
                    mins[bi, yi, xi] = valid.min()
                    maxs[bi, yi, xi] = valid.max()
                    sums[bi, yi, xi] = valid.sum()
                    counts[bi, yi, xi] = valid.size

    stats_group = group.create_group("stats")
    # spectral-prism stats dialect (ZEP0005-aligned in spirit; not a ratified
    # convention, so versioned explicitly under the tool namespace).
    stats_group.attrs.update(
        {
            "spectral_prism:stats": {"version": 1, "data_array": "cube", "grid_shape": list(grid)},
        }
    )
    for stat_name, values in (("min", mins), ("max", maxs), ("sum", sums), ("count", counts)):
        sa = stats_group.create_array(
            stat_name, shape=grid, chunks=grid, dtype="float64", **codec
        )
        sa[:] = values

    def jsonable(arr: np.ndarray) -> list:
        # NaN (all-nodata chunks) is not valid JSON; emit null and let the
        # reader map it back to NaN when comparing.
        return [None if np.isnan(v) else float(v) for v in arr.ravel(order="C")]

    out = FIXTURES / "expected" / "stats-sidecar.json"
    out.write_text(
        json.dumps(
            {
                "dataPath": "cube",
                "statsPath": "stats",
                "shape": list(shape),
                "chunks": list(chunks),
                "gridShape": list(grid),
                "nodata": nodata,
                "min": jsonable(mins),
                "max": jsonable(maxs),
                "sum": jsonable(sums),
                "count": jsonable(counts),
                "cubeValues": [int(v) for v in cube.ravel(order="C")],
            },
            indent=1,
        )
    )


def write_dual_layout() -> None:
    bindings = {
        "dual-layout-full": write_dual_layout_variant("dual-layout-full", spectral=True, spatial=True),
        "dual-layout-spectral-only": write_dual_layout_variant(
            "dual-layout-spectral-only", spectral=True, spatial=False
        ),
        "dual-layout-spatial-only": write_dual_layout_variant(
            "dual-layout-spatial-only", spectral=False, spatial=True
        ),
    }
    out = FIXTURES / "expected" / "dual-layout-bindings.json"
    out.write_text(json.dumps(bindings, indent=1))


def write_geozarr() -> None:
    models = {
        "geozarr-full": write_geozarr_variant("geozarr-full", georef=True, wavelengths_unit="nm"),
        "geozarr-microns": write_geozarr_variant("geozarr-microns", georef=True, wavelengths_unit="um"),
        "geozarr-pixel-only": write_geozarr_variant("geozarr-pixel-only", georef=False, wavelengths_unit="nm"),
        "geozarr-no-wavelengths": write_geozarr_variant("geozarr-no-wavelengths", georef=True, wavelengths_unit=None),
    }
    out = FIXTURES / "expected" / "geozarr-models.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(models, indent=1))


def main() -> int:
    if FIXTURES.exists():
        for entry in FIXTURES.iterdir():
            # Icechunk fixtures (and their expected JSON) come from the
            # sibling script; leave them untouched.
            if entry.name.startswith("icechunk") or entry.name == "blobs":
                continue
            if entry.name == "expected":
                for f in entry.iterdir():
                    if not f.name.startswith("icechunk"):
                        f.unlink()
                continue
            if entry.is_dir():
                shutil.rmtree(entry)
            elif entry.name != "README.md":
                entry.unlink()
    write_v2()
    write_v3()
    write_v3_sharded()
    write_geozarr()
    write_dual_layout()
    write_stats_sidecar()
    verify_roundtrip()
    print(f"fixtures written to {FIXTURES} (zarr-python {zarr.__version__})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
