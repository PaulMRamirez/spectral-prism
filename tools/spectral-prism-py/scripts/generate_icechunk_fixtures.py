"""Generate committed Icechunk store-conformance fixtures (SP-DP-002).

Writes two repositories with the Python icechunk library (the reference
implementation) plus expected-value JSON:

  packages/prism-core/fixtures/stores/icechunk-native   two commits on main,
      tag v1.0 on the first: proves branch/tag/snapshot pinning reaches
      different bytes and records which snapshot id each ref resolves to
  packages/prism-core/fixtures/stores/icechunk-virtual   an uncompressed array
      whose chunks are virtual references (offset+length) into
      blobs/virtual-chunks.bin under the placeholder host
      http://spectral-prism-fixture.invalid/ ; tests rewrite that host to the
      live fixture server through icechunk-js's pluggable FetchClient
  packages/prism-core/fixtures/stores/expected/icechunk-*.json

Run from the repo root:
  uv run --with icechunk --with zarr --with numpy tools/spectral-prism-py/scripts/generate_icechunk_fixtures.py
"""

import json
import shutil
import sys
from pathlib import Path

import icechunk as ic
import numpy as np
import zarr

REPO = Path(__file__).resolve().parents[3]
FIXTURES = REPO / "packages" / "prism-core" / "fixtures" / "stores"
VIRTUAL_HOST = "http://spectral-prism-fixture.invalid"

CUBE_SHAPE = (4, 8, 8)
CUBE_CHUNKS = (2, 4, 4)
VCUBE_SHAPE = (4, 4, 4)
VCUBE_CHUNKS = (2, 4, 4)
BLOB_PADDING = 16  # nonzero offsets so offset handling is actually exercised


def ramp(shape: tuple[int, ...]) -> np.ndarray:
    b, y, x = np.meshgrid(*(np.arange(n) for n in shape), indexing="ij")
    return (b * 1000 + y * 16 + x).astype(np.int16)


def values_list(array: np.ndarray) -> list[int]:
    return [int(v) for v in array.ravel(order="C")]


def write_native() -> None:
    path = FIXTURES / "icechunk-native"
    repo = ic.Repository.create(ic.local_filesystem_storage(str(path)))

    v1 = ramp(CUBE_SHAPE)
    session = repo.writable_session("main")
    arr = zarr.create_array(
        store=session.store,
        name="cube",
        shape=CUBE_SHAPE,
        chunks=CUBE_CHUNKS,
        dtype="int16",
        fill_value=-9999,
    )
    arr[:] = v1

    # 64-byte cube chunks land under icechunk's inline threshold (512 B), so
    # cube exercises InlineChunkPayload; wide's 2 KB chunk exercises
    # NativeChunkPayload. The virtual repo covers the third payload type.
    wide_values = ramp((4, 16, 16))
    wide = zarr.create_array(
        store=session.store,
        name="wide",
        shape=(4, 16, 16),
        chunks=(4, 16, 16),
        dtype="int16",
        fill_value=-9999,
    )
    wide[:] = wide_values
    snap1 = session.commit("c1: initial ramp")
    repo.create_tag("v1.0", snap1)

    v2 = v1.copy()
    v2[0] += 100
    session = repo.writable_session("main")
    zarr.open_array(session.store, path="cube", mode="a")[0] = v2[0]
    snap2 = session.commit("c2: band 0 shifted by 100")

    # Independent read-back per ref proves the pin table before committing it.
    for ref_kwargs, expected in [
        ({"branch": "main"}, v2),
        ({"tag": "v1.0"}, v1),
        ({"snapshot_id": snap1}, v1),
    ]:
        got = np.asarray(zarr.open_array(repo.readonly_session(**ref_kwargs).store, path="cube", mode="r")[:])
        assert np.array_equal(got, expected), f"ref {ref_kwargs} mismatch"

    out = FIXTURES / "expected" / "icechunk-native.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        json.dumps(
            {
                "dtype": "int16",
                "shape": list(CUBE_SHAPE),
                "refs": {
                    "branch:main": {"snapshotId": snap2, "values": values_list(v2)},
                    "tag:v1.0": {"snapshotId": snap1, "values": values_list(v1)},
                    f"snapshot:{snap1}": {"snapshotId": snap1, "values": values_list(v1)},
                },
                "wide": {"shape": [4, 16, 16], "values": values_list(wide_values)},
            },
            indent=1,
        )
    )


def write_virtual() -> None:
    path = FIXTURES / "icechunk-virtual"
    cube = ramp(VCUBE_SHAPE)
    chunk0 = cube[0:2].astype("<i2").tobytes(order="C")
    chunk1 = cube[2:4].astype("<i2").tobytes(order="C")

    blob_dir = FIXTURES / "blobs"
    blob_dir.mkdir(parents=True, exist_ok=True)
    blob = b"\x00" * BLOB_PADDING + chunk0 + chunk1
    (blob_dir / "virtual-chunks.bin").write_bytes(blob)
    blob_url = f"{VIRTUAL_HOST}/blobs/virtual-chunks.bin"

    config = ic.RepositoryConfig.default()
    config.set_virtual_chunk_container(ic.VirtualChunkContainer(f"{VIRTUAL_HOST}/", ic.http_store()))
    repo = ic.Repository.create(
        ic.local_filesystem_storage(str(path)),
        config,
        authorize_virtual_chunk_access={f"{VIRTUAL_HOST}/": ic.Credentials.HttpAccess()},
    )

    session = repo.writable_session("main")
    zarr.create_array(
        store=session.store,
        name="vcube",
        shape=VCUBE_SHAPE,
        chunks=VCUBE_CHUNKS,
        dtype="int16",
        fill_value=-9999,
        compressors=None,
        filters=None,
    )
    session.store.set_virtual_refs(
        "vcube",
        [
            ic.VirtualChunkSpec(index=(0, 0, 0), location=blob_url, offset=BLOB_PADDING, length=len(chunk0)),
            ic.VirtualChunkSpec(
                index=(1, 0, 0), location=blob_url, offset=BLOB_PADDING + len(chunk0), length=len(chunk1)
            ),
        ],
    )
    snap = session.commit("virtual refs into blobs/virtual-chunks.bin")

    out = FIXTURES / "expected" / "icechunk-virtual.json"
    out.write_text(
        json.dumps(
            {
                "dtype": "int16",
                "shape": list(VCUBE_SHAPE),
                "snapshotId": snap,
                "virtualHost": VIRTUAL_HOST,
                "values": values_list(cube),
            },
            indent=1,
        )
    )


def main() -> int:
    for name in ("icechunk-native", "icechunk-virtual", "blobs"):
        target = FIXTURES / name
        if target.exists():
            shutil.rmtree(target)
    write_native()
    write_virtual()
    print(f"icechunk fixtures written (icechunk {ic.__version__}, zarr {zarr.__version__})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
