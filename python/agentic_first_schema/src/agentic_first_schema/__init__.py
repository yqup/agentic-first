"""Canonical agentic-first profile schemas and validator.

The four canonical schemas (company / personal x public / private)
live in ``agentic_first_schema/schemas/`` and are loaded lazily.

The public-tier schemas intentionally use *bands* rather than precise
figures on the public surface to keep the directory clear of UK FCA
financial-promotion rules. See ``docs/security-policy.md`` in the
``agentic-first`` repo for the full rationale.

Typical use::

    from agentic_first_schema import validate_profile

    report = validate_profile(profile_dict)
    if not report.ok:
        for issue in report.issues:
            print(issue.path, issue.message)
"""

from .security import (
    REJECTED_PATTERNS,
    PatternHit,
    RejectedPattern,
    StripFinding,
    sanitize_text,
    scan_profile,
    scan_text,
)
from .validator import (
    CANONICAL_SCHEMA_VERSION,
    SCHEMA_NAME,
    SCHEMAS,
    ProfileKind,
    Tier,
    ValidationIssue,
    ValidationReport,
    detect_kind_and_tier,
    list_schemas,
    load_schema,
    validate_profile,
)

__all__ = [
    "CANONICAL_SCHEMA_VERSION",
    "PatternHit",
    "REJECTED_PATTERNS",
    "RejectedPattern",
    "SCHEMA_NAME",
    "SCHEMAS",
    "StripFinding",
    "ProfileKind",
    "Tier",
    "ValidationIssue",
    "ValidationReport",
    "detect_kind_and_tier",
    "list_schemas",
    "load_schema",
    "sanitize_text",
    "scan_profile",
    "scan_text",
    "validate_profile",
]
