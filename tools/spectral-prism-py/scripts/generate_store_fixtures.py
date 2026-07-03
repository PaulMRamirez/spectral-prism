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
    verify_roundtrip()
    print(f"fixtures written to {FIXTURES} (zarr-python {zarr.__version__})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
