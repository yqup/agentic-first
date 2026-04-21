"""``agentic-first-validate`` - tiny offline validator CLI.

Validates a JSON file against the canonical agentic-first schemas.
Emits a one-line PASS / FAIL summary on stdout (machine-friendly) and
a structured error report on stderr when anything fails.

Examples::

    # Validate a public company profile
    agentic-first-validate ./.well-known/agentic-profile.json

    # Validate a private personal profile
    agentic-first-validate ./me.private.json

    # Read from stdin
    cat profile.json | agentic-first-validate -

    # JSON output (for CI / piping)
    agentic-first-validate --json profile.json

Exit codes:
    0   profile is valid
    1   profile is invalid (schema or security violations)
    2   bad usage (file missing, not JSON, etc.)
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from . import validate_profile

EXIT_OK = 0
EXIT_INVALID = 1
EXIT_USAGE = 2


def _load(path_arg: str) -> Any:
    if path_arg == "-":
        try:
            return json.load(sys.stdin)
        except json.JSONDecodeError as exc:
            print(f"agentic-first-validate: stdin is not valid JSON: {exc}", file=sys.stderr)
            sys.exit(EXIT_USAGE)
    path = Path(path_arg)
    if not path.exists():
        print(f"agentic-first-validate: file not found: {path}", file=sys.stderr)
        sys.exit(EXIT_USAGE)
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(f"agentic-first-validate: {path} is not valid JSON: {exc}", file=sys.stderr)
        sys.exit(EXIT_USAGE)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="agentic-first-validate",
        description="Validate a JSON file against the canonical agentic-first schemas.",
    )
    parser.add_argument(
        "file",
        help="path to a JSON file, or '-' for stdin",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="emit the full validation report as JSON on stdout",
    )
    args = parser.parse_args(argv)

    profile = _load(args.file)
    report = validate_profile(profile)

    if args.json:
        print(json.dumps(report.to_dict(), indent=2, sort_keys=True))
        return EXIT_OK if report.ok else EXIT_INVALID

    if report.ok:
        kind = report.profile_kind
        tier = report.tier
        warns = len(report.warnings)
        suffix = f" ({warns} warning{'s' if warns != 1 else ''})" if warns else ""
        print(f"PASS  {kind}/{tier}{suffix}")
        for warn in report.warnings:
            print(f"  warn  {warn.path}: {warn.message}", file=sys.stderr)
        return EXIT_OK

    print(f"FAIL  {len(report.errors)} error(s), {len(report.warnings)} warning(s)")
    for err in report.errors:
        print(f"  error  {err.path}: {err.message}", file=sys.stderr)
    for warn in report.warnings:
        print(f"  warn   {warn.path}: {warn.message}", file=sys.stderr)
    return EXIT_INVALID


if __name__ == "__main__":
    sys.exit(main())
