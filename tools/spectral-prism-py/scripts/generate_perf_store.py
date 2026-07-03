"""Generate an AVIRIS-class synthetic store for the perf harness (SP-DP-007/008).

Not committed (written under packages/prism-core/.perf-fixtures/, gitignored):
a dual-layout store whose spectral-major primary is 224 bands x 512 x 512 with
(224, 64, 64) chunks (one object read yields a full local spectrum block per
ADR-0003), plus a small spatial-major pyramid for the cold-open composite.
This stands in for a CLI-converted scene until the demo mirror exists; the
harness measures against it under simulated reference-baseline network.

Run from the repo root:
  uv run --with zarr --with numpy --with numcodecs \
    tools/spectral-prism-py/scripts/generate_perf_store.py
"""

import json
import shutil
import sys
from pathlib import Path

import numpy as np
import zarr
from zarr.codecs import BytesCodec, GzipCodec

REPO = Path(__file__).resolve().parents[3]
OUT = REPO / "packages" / "prism-core" / ".perf-fixtures" / "aviris-class"

BANDS = 224
HEIGHT = 512
WIDTH = 512
# Spectral-major primary is sharded (ADR-0003: "224 x 64 x 64, zstd, sharded").
# The shard is the 64x64 spatial block; small inner chunks let a probe fetch
# only the inner chunk covering the pixel via a range read, not the whole shard.
SPECTRAL_SHARD = (BANDS, 64, 64)
SPECTRAL_INNER = (BANDS, 16, 16)
WAVELENGTH_MIN_NM = 380.0
WAVELENGTH_MAX_NM = 2510.0
COMPOSITE_BANDS = 8


def wavelengths() -> np.ndarray:
    return np.linspace(WAVELENGTH_MIN_NM, WAVELENGTH_MAX_NM, BANDS)


def main() -> int:
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)

    codec = dict(serializer=BytesCodec(endian="little"), compressors=GzipCodec(level=4))
    rng = np.random.default_rng(20260702)

    group = zarr.open_group(str(OUT), mode="w", zarr_format=3)
    group.attrs.update(
        {
            "spectral_prism:binding": {
                "version": 1,
                "spectral": {"path": "spectral"},
                "spatial": {"path": "spatial"},
            }
        }
    )

    sg = group.create_group("spectral")
    sg.attrs.update({"proj:code": "EPSG:32611", "spatial:transform": [30.0, 0, 4e5, 0, -30.0, 38e5]})
    cube = sg.create_array(
        "cube", shape=(BANDS, HEIGHT, WIDTH), chunks=SPECTRAL_INNER, shards=SPECTRAL_SHARD,
        dtype="int16", fill_value=-9999, **codec,
    )
    # Fill shard by shard so peak memory stays bounded; smooth-ish spectra plus
    # noise so gzip behaves like real reflectance (not incompressible).
    base = (np.sin(np.linspace(0, 6, BANDS)) * 2000 + 3000).astype(np.int16)
    for y0 in range(0, HEIGHT, SPECTRAL_SHARD[1]):
        for x0 in range(0, WIDTH, SPECTRAL_SHARD[2]):
            h = min(SPECTRAL_SHARD[1], HEIGHT - y0)
            w = min(SPECTRAL_SHARD[2], WIDTH - x0)
            block = base[:, None, None] + rng.integers(-200, 200, size=(BANDS, h, w), dtype=np.int16)
            cube[:, y0 : y0 + h, x0 : x0 + w] = block
    wl = sg.create_array("wavelengths", shape=(BANDS,), chunks=(BANDS,), dtype="float64", **codec)
    wl[:] = wavelengths()
    wl.attrs["units"] = "nm"

    # Small spatial-major pyramid: COMPOSITE_BANDS bands at a coarse level for
    # the cold-open composite (up to ~8 raw bands per ADR-0004 / SP-RP-001).
    pg = group.create_group("spatial")
    pg.attrs.update(
        {
            "proj:code": "EPSG:32611",
            "spatial:transform": [30.0, 0, 4e5, 0, -30.0, 38e5],
            "multiscales": {"layout": [{"asset": "0"}]},
        }
    )
    level0 = pg.create_array(
        "0", shape=(COMPOSITE_BANDS, HEIGHT, WIDTH), chunks=(COMPOSITE_BANDS, 256, 256),
        dtype="int16", fill_value=-9999, **codec,
    )
    level0[:] = rng.integers(0, 4000, size=(COMPOSITE_BANDS, HEIGHT, WIDTH), dtype=np.int16)

    meta = {
        "bands": BANDS,
        "height": HEIGHT,
        "width": WIDTH,
        "spectralShard": list(SPECTRAL_SHARD),
        "spectralInner": list(SPECTRAL_INNER),
        "compositeBands": COMPOSITE_BANDS,
        "wavelengthRangeNm": [WAVELENGTH_MIN_NM, WAVELENGTH_MAX_NM],
    }
    (OUT.parent / "aviris-class.meta.json").write_text(json.dumps(meta, indent=1))
    print(f"perf store written to {OUT} (zarr-python {zarr.__version__})")
    print(json.dumps(meta))
    return 0


if __name__ == "__main__":
    sys.exit(main())
