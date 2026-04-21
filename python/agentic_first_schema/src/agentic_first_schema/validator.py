"""Validate a profile against the right canonical schema.

The directory ships four canonical schemas, in two dimensions:

    profile_kind  ∈ {"company", "person"}
    tier          ∈ {"public",  "protected"}

The right schema is selected from the document's own ``profile_kind``
and ``tier`` discriminators (both optional for backward compatibility:
absent is taken to mean ``("company", "public")``).

Validation returns a structured report, never a boolean. Errors are
fatal (the profile cannot be indexed); warnings are recorded and
surfaced to the operator and the dispute flow.

Schema governance lives in ``SCHEMA.md``.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from importlib import resources
from typing import Any, Literal

from jsonschema import Draft202012Validator, FormatChecker

from .security import scan_profile

CANONICAL_SCHEMA_VERSION = "0.2.0"

#: Versions the validator still accepts. Adding optional fields is
#: backward-compatible — a 0.1.0 profile validates fine against the
#: 0.2.0 schema (the new ``parent_brand`` field is optional). Older
#: versions stay in this set so existing publishers don't see a churny
#: ``schema_version_mismatch`` warning the moment we ship a minor bump.
SUPPORTED_SCHEMA_VERSIONS: frozenset[str] = frozenset({"0.1.0", "0.2.0"})

ProfileKind = Literal["company", "person"]
Tier = Literal["public", "protected"]

# Registry of canonical schemas. The keys are the discriminator pair as
# they appear in any conforming document; the values are the resource
# names inside ``agentic_first_schema.schemas``.
SCHEMAS: dict[tuple[ProfileKind, Tier], str] = {
    ("company", "public"): "company-profile.schema.json",
    ("company", "protected"): "company-private-profile.schema.json",
    ("person", "public"): "personal-profile.schema.json",
    ("person", "protected"): "personal-private-profile.schema.json",
}

# Display name of the *primary* schema. Kept on the module surface for
# back-compat with callers (``/healthz``, the CLI) that just want a
# single human-readable name.
SCHEMA_NAME = "company-profile"

DEFAULT_KIND: ProfileKind = "company"
DEFAULT_TIER: Tier = "public"


@dataclass(frozen=True)
class ValidationIssue:
    path: str
    code: str
    message: str

    def to_dict(self) -> dict[str, str]:
        return {"path": self.path, "code": self.code, "message": self.message}


@dataclass
class ValidationReport:
    ok: bool
    errors: list[ValidationIssue] = field(default_factory=list)
    warnings: list[ValidationIssue] = field(default_factory=list)
    score_inputs: dict[str, float] = field(default_factory=dict)
    profile_kind: ProfileKind = DEFAULT_KIND
    tier: Tier = DEFAULT_TIER

    def to_dict(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "errors": [e.to_dict() for e in self.errors],
            "warnings": [w.to_dict() for w in self.warnings],
            "score_inputs": self.score_inputs,
            "profile_kind": self.profile_kind,
            "tier": self.tier,
        }


def detect_kind_and_tier(profile: Any) -> tuple[ProfileKind, Tier]:
    """Infer the canonical schema for ``profile``.

    Falls back to ``("company", "public")`` when the document does not
    declare its discriminators — the original v0.1.0 shape.
    """
    if not isinstance(profile, dict):
        return DEFAULT_KIND, DEFAULT_TIER
    kind = profile.get("profile_kind", DEFAULT_KIND)
    tier = profile.get("tier", DEFAULT_TIER)
    if (kind, tier) not in SCHEMAS:
        # Unknown discriminator — let the structural validator reject it
        # against the closest legitimate schema. Picking the default
        # keeps the error message comprehensible.
        return DEFAULT_KIND, DEFAULT_TIER
    return kind, tier  # type: ignore[return-value]


def load_schema(
    *,
    kind: ProfileKind = DEFAULT_KIND,
    tier: Tier = DEFAULT_TIER,
) -> dict[str, Any]:
    """Load a canonical JSON Schema.

    ``kind``/``tier`` select between the four canonical schemas. The
    default loads the company-public schema for back-compat with
    callers that don't yet pass either argument.
    """
    resource = SCHEMAS[(kind, tier)]
    with resources.files("agentic_first_schema.schemas").joinpath(resource).open("r") as fh:
        return json.load(fh)


def list_schemas() -> dict[str, str]:
    """Return ``{resource_name: schema $id}`` for every canonical schema.

    Used by the API to publish the schemas at canonical URLs.
    """
    out: dict[str, str] = {}
    for resource in SCHEMAS.values():
        with resources.files("agentic_first_schema.schemas").joinpath(resource).open("r") as fh:
            schema = json.load(fh)
        out[resource] = schema.get("$id", "")
    return out


def _format_path(path: tuple[Any, ...]) -> str:
    if not path:
        return "$"
    parts = ["$"]
    for p in path:
        parts.append(f"[{p}]" if isinstance(p, int) else f".{p}")
    return "".join(parts)


def validate_profile(profile: Any) -> ValidationReport:
    """Validate a profile and return a structured report.

    Layer 1 (structural) only. Semantic, cross-reference, temporal, and
    external (Companies House / GLEIF) layers are added in later phases.
    """
    kind, tier = detect_kind_and_tier(profile)
    schema = load_schema(kind=kind, tier=tier)
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    errors: list[ValidationIssue] = []
    warnings: list[ValidationIssue] = []

    if not isinstance(profile, dict):
        errors.append(
            ValidationIssue(
                path="$",
                code="not_an_object",
                message="Profile must be a JSON object.",
            )
        )
        return ValidationReport(
            ok=False, errors=errors, profile_kind=kind, tier=tier
        )

    declared_version = profile.get("schema_version")
    if declared_version and declared_version not in SUPPORTED_SCHEMA_VERSIONS:
        warnings.append(
            ValidationIssue(
                path="$.schema_version",
                code="schema_version_mismatch",
                message=(
                    f"Profile declares schema_version {declared_version!r}; "
                    f"directory canonical is {CANONICAL_SCHEMA_VERSION!r} "
                    f"and supported versions are "
                    f"{sorted(SUPPORTED_SCHEMA_VERSIONS)!r}."
                ),
            )
        )

    for err in validator.iter_errors(profile):
        errors.append(
            ValidationIssue(
                path=_format_path(tuple(err.absolute_path)),
                code=err.validator or "schema_error",
                message=err.message,
            )
        )

    # Layer 1.5 - content-layer security. Runs even when structural
    # errors are present, so a publisher fixing both at once sees both
    # in one round-trip. Rejected patterns are fatal (errors); stripped
    # unicode is informational (warnings).
    pattern_hits, strip_findings = scan_profile(profile)
    for hit in pattern_hits:
        errors.append(
            ValidationIssue(
                path=hit.path,
                code=hit.code,
                message=(
                    f"Rejected by content-security ({hit.category}): "
                    f"matched {hit.matched_text!r}. {hit.note} "
                    "See https://www.agentic-first.co/security/#patterns."
                ),
            )
        )
    for strip in strip_findings:
        warnings.append(
            ValidationIssue(
                path=strip.path,
                code="unicode_stripped",
                message=(
                    f"Stripped {strip.chars_removed} character(s) "
                    f"from {', '.join(strip.classes_removed)}. "
                    "See https://www.agentic-first.co/security/#unicode."
                ),
            )
        )

    if not errors:
        if kind == "company":
            warnings.extend(_company_warnings(profile))
        elif kind == "person":
            warnings.extend(_person_warnings(profile))

    score_inputs = (
        _compute_score_inputs(profile, schema, kind=kind) if not errors else {}
    )

    return ValidationReport(
        ok=not errors,
        errors=errors,
        warnings=warnings,
        score_inputs=score_inputs,
        profile_kind=kind,
        tier=tier,
    )


# ---- soft-signal helpers ---------------------------------------------------

def _company_warnings(profile: dict[str, Any]) -> list[ValidationIssue]:
    """Soft signals on company-public profiles."""
    warnings: list[ValidationIssue] = []
    company = profile.get("company", {}) or {}

    if "registry" not in company and "lei" not in company:
        warnings.append(
            ValidationIssue(
                path="$.company",
                code="no_external_id",
                message=(
                    "No registry record or LEI provided. The profile cannot "
                    "earn the verified badge until at least one is added."
                ),
            )
        )

    evidence = profile.get("evidence", []) or []
    if not evidence:
        warnings.append(
            ValidationIssue(
                path="$.evidence",
                code="no_evidence",
                message="No evidence links provided. Trust score is capped.",
            )
        )

    metrics = profile.get("metrics", {}) or {}
    if metrics and not metrics.get("as_of"):
        warnings.append(
            ValidationIssue(
                path="$.metrics.as_of",
                code="metrics_undated",
                message="Metrics are present but not dated; recency cannot be scored.",
            )
        )

    return warnings


def _person_warnings(profile: dict[str, Any]) -> list[ValidationIssue]:
    """Soft signals on personal-public profiles."""
    warnings: list[ValidationIssue] = []

    credentials = profile.get("credentials", []) or []
    if not credentials:
        warnings.append(
            ValidationIssue(
                path="$.credentials",
                code="no_credentials",
                message=(
                    "No credentials declared. The profile cannot earn the "
                    "verified badge until at least one is added."
                ),
            )
        )

    evidence = profile.get("evidence", []) or []
    if not evidence:
        warnings.append(
            ValidationIssue(
                path="$.evidence",
                code="no_evidence",
                message="No evidence links provided. Trust score is capped.",
            )
        )

    if not profile.get("current_roles") and not profile.get("key_past_roles"):
        warnings.append(
            ValidationIssue(
                path="$.current_roles",
                code="no_roles",
                message=(
                    "No current or key past roles declared; the profile is "
                    "effectively just a headline."
                ),
            )
        )

    return warnings


# ---- score input helpers ---------------------------------------------------

def _compute_score_inputs(
    profile: dict[str, Any],
    schema: dict[str, Any],
    *,
    kind: ProfileKind,
) -> dict[str, float]:
    """v0 scoring inputs: completeness + evidence density + verifiability.

    Full scoring lives in ``pkg/score`` (Phase 3). This is enough to
    thread the wire so the API can return a meaningful ``score_inputs``
    block from day one.
    """
    properties = schema.get("properties", {})
    required = set(schema.get("required", []))
    optional = [k for k in properties.keys() if k not in required]
    completeness = (
        sum(1 for k in optional if profile.get(k)) / len(optional) if optional else 1.0
    )

    evidence = profile.get("evidence", []) or []
    evidence_density = min(len(evidence) / 5.0, 1.0)

    if kind == "person":
        person = profile.get("person", {}) or {}
        signals = sum(
            1 for k in ("name", "headline") if person.get(k)
        )
        signals += 1 if profile.get("credentials") else 0
        verifiability = round(signals / 3.0, 3)
    else:
        company = profile.get("company", {}) or {}
        signals = sum(
            1 for k in ("registry", "lei", "website") if company.get(k)
        )
        verifiability = round(signals / 3.0, 3)

    return {
        "completeness": round(completeness, 3),
        "evidence_density": round(evidence_density, 3),
        "verifiability": verifiability,
    }
