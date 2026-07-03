"""Entry point stub. CLI v0 (archival granule to dual-layout GeoZarr per
ADR-0003/0007, VirtualiZarr to Icechunk reference path) lands as Phase 0 work."""

import sys


def main() -> int:
    print(
        "sprism 0.0.0: CLI v0 is under construction (Phase 0).\n"
        "Planned: convert EMIT/AVIRIS granules to dual-layout GeoZarr with "
        "per-chunk stats, and virtualize to Icechunk references."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
