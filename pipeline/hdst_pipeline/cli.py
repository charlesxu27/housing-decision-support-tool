"""Command line entry point: fetch, build, validate."""

from __future__ import annotations

import argparse
import sys


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="hdst_pipeline", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    p_fetch = sub.add_parser("fetch", help="download pinned sources into data/raw/")
    p_fetch.add_argument("--only", nargs="*", help="source ids to fetch")

    p_build = sub.add_parser("build", help="build web/public/data/ from data/raw/")
    p_build.add_argument("--skip-tiles", action="store_true", help="do not run tippecanoe")
    p_build.add_argument("--out", help="override output directory")

    p_validate = sub.add_parser("validate", help="re-check the exported snapshot")
    p_validate.add_argument("--out", help="override output directory")

    args = parser.parse_args(argv)

    if args.command == "fetch":
        from .sources import fetch_all

        log = fetch_all(only=args.only)
        failed = [k for k, v in log.items() if not v.get("available")]
        print(f"fetched {len(log) - len(failed)} sources; unavailable: {failed or 'none'}")
        return 0

    if args.command == "build":
        from .build import run_build

        run_build(skip_tiles=args.skip_tiles, out_override=args.out)
        return 0

    if args.command == "validate":
        from .validate import validate_snapshot

        problems = validate_snapshot(out_override=args.out)
        if problems:
            print(f"validation FAILED with {len(problems)} problem(s):", file=sys.stderr)
            for p in problems:
                print(f"  - {p}", file=sys.stderr)
            return 1
        print("validation passed")
        return 0

    return 2
