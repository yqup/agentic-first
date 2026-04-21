"""Content-layer security checks applied to profile prose.

The directory does not call an LLM, but the profiles it serves get
read by LLM agents downstream. A malicious publisher who slips a
prompt-injection payload into a free-text field (``tagline``,
``summary``, ``bio``, ``notes``, anything inside ``evidence`` /
``links``) is attacking *that downstream agent*, not us.

Two responsibilities therefore live here:

1. **Reject** documents whose prose fields match a known-malicious
   pattern (jailbreak openers, role hijack, system-prompt
   impersonation, tool-call exfiltration, embedded HTML/JS, oversized
   base64 runs, ``javascript:`` markdown image sources, credential
   harvest).
2. **Strip silently** unicode that has no legitimate use in profile
   prose: zero-width characters, bidirectional overrides
   (Trojan Source / CVE-2021-42574), and C0/C1 control characters.

The rejected-pattern list is the authoritative server-side encoding
of the policy documented at ``https://www.agentic-first.co/security/``.
Add to either side here and the website should be updated to match.

Patterns are intentionally conservative: false positives are
fixable by the publisher (rewrite the field, resubmit), false
negatives are not.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterator

# ---------------------------------------------------------------------------
# Rejected patterns (server-side mirror of www/security/#patterns)
# ---------------------------------------------------------------------------
#
# Each entry has a ``code`` (machine-readable, surfaced in the
# ValidationIssue), a ``category`` (human-readable group name shown
# in the publisher-facing error), and a compiled regex.
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class RejectedPattern:
    code: str
    category: str
    pattern: re.Pattern[str]
    note: str


REJECTED_PATTERNS: tuple[RejectedPattern, ...] = (
    RejectedPattern(
        code="injection_imperative_override",
        category="Direct imperative override",
        pattern=re.compile(
            r"ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?)",
            re.IGNORECASE,
        ),
        note="Classic jailbreak opener.",
    ),
    RejectedPattern(
        code="injection_role_hijack",
        category="Role hijack",
        pattern=re.compile(
            r"\b(you\s+are\s+now|act\s+as|pretend\s+to\s+be)\s+"
            r"(a\s+|an\s+)?(developer|admin|root|system|dan|jailbroken)\b",
            re.IGNORECASE,
        ),
        note="Forces a role-swap on the reading agent.",
    ),
    RejectedPattern(
        code="injection_system_prompt_impersonation",
        category="System-prompt impersonation",
        # `<|system|>`, `<system>`, `### system`, `system:` at line start.
        pattern=re.compile(
            r"(<\|?system\|?>)|(^\s*###\s*system\b)|(^\s*system\s*:)",
            re.IGNORECASE | re.MULTILINE,
        ),
        note="Mimics chat-template separators.",
    ),
    RejectedPattern(
        code="injection_tool_call_exfiltration",
        category="Tool-call exfiltration",
        pattern=re.compile(
            r"\b(call|invoke|execute)\s+(the\s+)?(tool|function)\s+"
            r"['\"`]?[a-z_][a-z0-9_]*['\"`]?",
            re.IGNORECASE,
        ),
        note="Tries to make the reader call its own tools on the attacker's behalf.",
    ),
    RejectedPattern(
        code="injection_embedded_html",
        category="Embedded HTML/JS",
        pattern=re.compile(
            r"(<\s*(script|iframe|object|embed|form)\b)|"
            r"(javascript\s*:)|"
            r"(data\s*:\s*text\s*/\s*html)|"
            r"(\bon[a-z]+\s*=)",
            re.IGNORECASE,
        ),
        note="Rendered HTML in profile prose is never legitimate.",
    ),
    RejectedPattern(
        code="injection_base64_payload",
        category="Base64 payload",
        # Contiguous run > 200 base64-alphabet characters.
        pattern=re.compile(r"[A-Za-z0-9+/=]{201,}"),
        note="Hidden payload delivered via base64 round-trip.",
    ),
    RejectedPattern(
        code="injection_markdown_javascript_image",
        category="Markdown image with javascript: source",
        pattern=re.compile(r"!\[[^\]]*\]\(\s*javascript\s*:", re.IGNORECASE),
        note="Active markdown payload.",
    ),
    RejectedPattern(
        code="injection_credential_harvest",
        category="Credential harvest",
        pattern=re.compile(
            r"\b(send|post|email|share|upload)\s+(your\s+|the\s+)?"
            r"(api[\s\-_]?key|access\s+token|bearer\s+token|password|cookie|"
            r"session\s+token|secret)\b",
            re.IGNORECASE,
        ),
        note="Direct social-engineering payload aimed at the reader's user.",
    ),
)


# ---------------------------------------------------------------------------
# Unicode hardening (server-side mirror of www/security/#unicode)
# ---------------------------------------------------------------------------
#
# Three classes of unicode get stripped silently:
#   1. Zero-width characters (smuggling invisible content)
#   2. Bidirectional overrides (Trojan Source)
#   3. C0/C1 control characters (terminal escapes, NULL)
#
# Confusables (Cyrillic А vs Latin A) are NOT stripped here -
# stripping them would corrupt legitimate non-Latin profiles. They
# are handled as a higher-layer warning later.
# ---------------------------------------------------------------------------

_ZERO_WIDTH = {
    "\u200B",  # ZWSP
    "\u200C",  # ZWNJ
    "\u200D",  # ZWJ
    "\u2060",  # WORD JOINER
    "\uFEFF",  # ZERO WIDTH NO-BREAK SPACE / BOM
}

_BIDI_OVERRIDES = {chr(c) for c in range(0x202A, 0x202E + 1)}
_BIDI_OVERRIDES |= {chr(c) for c in range(0x2066, 0x2069 + 1)}

# C0 controls: 0x00-0x1F except \n (0x0A) and \t (0x09).
_C0 = {chr(c) for c in range(0x00, 0x20)} - {"\n", "\t"}
# DEL + C1 controls 0x7F-0x9F.
_C1 = {chr(c) for c in range(0x7F, 0xA0)}

_UNICODE_CLASSES: tuple[tuple[str, frozenset[str]], ...] = (
    ("zero_width", frozenset(_ZERO_WIDTH)),
    ("bidi_override", frozenset(_BIDI_OVERRIDES)),
    ("control_char", frozenset(_C0 | _C1)),
)

_ALL_STRIP_CHARS = frozenset().union(*(chars for _, chars in _UNICODE_CLASSES))


@dataclass(frozen=True)
class StripFinding:
    """Result of stripping unicode from one prose field."""

    path: str
    classes_removed: tuple[str, ...]
    chars_removed: int


@dataclass(frozen=True)
class PatternHit:
    """Result of one rejected-pattern match against one prose field."""

    path: str
    code: str
    category: str
    matched_text: str
    note: str


def sanitize_text(text: str) -> tuple[str, tuple[str, ...]]:
    """Return ``(cleaned_text, classes_removed)``.

    ``classes_removed`` is a tuple of class names (``zero_width``,
    ``bidi_override``, ``control_char``) that had at least one
    character stripped.
    """
    if not text:
        return text, ()
    if not any(ch in _ALL_STRIP_CHARS for ch in text):
        return text, ()
    seen: list[str] = []
    out_chars: list[str] = []
    for ch in text:
        for class_name, chars in _UNICODE_CLASSES:
            if ch in chars:
                if class_name not in seen:
                    seen.append(class_name)
                break
        else:
            out_chars.append(ch)
    return "".join(out_chars), tuple(seen)


def scan_text(path: str, text: str) -> tuple[PatternHit, ...]:
    """Run every rejected-pattern check against one field's text.

    Returns one ``PatternHit`` per matching pattern (multiple matches
    of the same pattern collapse to one hit). The caller is expected
    to convert these into ValidationIssues and reject the document.
    """
    if not text:
        return ()
    hits: list[PatternHit] = []
    for rule in REJECTED_PATTERNS:
        match = rule.pattern.search(text)
        if match is None:
            continue
        snippet = match.group(0)
        if len(snippet) > 80:
            snippet = snippet[:77] + "..."
        hits.append(
            PatternHit(
                path=path,
                code=rule.code,
                category=rule.category,
                matched_text=snippet,
                note=rule.note,
            )
        )
    return tuple(hits)


# ---------------------------------------------------------------------------
# Document walker
# ---------------------------------------------------------------------------


def walk_strings(profile: object, base: str = "$") -> Iterator[tuple[str, str]]:
    """Yield ``(json_path, value)`` for every string leaf in ``profile``.

    The path uses the same ``$.foo[0].bar`` shape that the validator's
    structural errors use, so the publisher can correlate a content
    error to a structural one in the same response.
    """
    if isinstance(profile, str):
        yield base, profile
        return
    if isinstance(profile, dict):
        for key, value in profile.items():
            yield from walk_strings(value, f"{base}.{key}")
        return
    if isinstance(profile, list):
        for idx, value in enumerate(profile):
            yield from walk_strings(value, f"{base}[{idx}]")
        return
    # numbers / booleans / None contribute nothing
    return


def scan_profile(
    profile: object,
) -> tuple[tuple[PatternHit, ...], tuple[StripFinding, ...]]:
    """Walk ``profile`` and return ``(pattern_hits, strip_findings)``.

    ``pattern_hits`` is a flat tuple of every rejected-pattern match
    across every string leaf. ``strip_findings`` records which fields
    contained unicode that should be silently stripped (and which
    classes). The caller decides whether to mutate the profile in
    place; this function is non-destructive.
    """
    hits: list[PatternHit] = []
    strips: list[StripFinding] = []
    for path, text in walk_strings(profile):
        # Pattern check runs against the *original* text - if the
        # attacker hides "ignore previous instructions" between
        # zero-width characters, we still catch it because we also
        # check the stripped version below.
        hits.extend(scan_text(path, text))
        cleaned, classes_removed = sanitize_text(text)
        if classes_removed:
            strips.append(
                StripFinding(
                    path=path,
                    classes_removed=classes_removed,
                    chars_removed=len(text) - len(cleaned),
                )
            )
            # Also re-scan the cleaned text - catches payloads hidden
            # behind zero-width separators like
            # "ig\u200Bnore previous instructions".
            for hit in scan_text(path, cleaned):
                if not any(h.code == hit.code and h.path == hit.path for h in hits):
                    hits.append(hit)
    return tuple(hits), tuple(strips)


__all__ = [
    "PatternHit",
    "REJECTED_PATTERNS",
    "RejectedPattern",
    "StripFinding",
    "sanitize_text",
    "scan_profile",
    "scan_text",
    "walk_strings",
]
