# agentic-first-schema

Canonical [agentic-first](https://github.com/yqup/agentic-first) profile schemas, validator, and `agentic-first-validate` CLI.

```bash
pip install agentic-first-schema
```

## What you get

Four canonical JSON Schemas:

| Name                       | Tier      | Audience                                      |
| -------------------------- | --------- | --------------------------------------------- |
| `company-profile`          | public    | Crawled by the directory; bands not figures   |
| `personal-profile`         | public    | Crawled by the directory; bands not figures   |
| `company-private-profile`  | protected | Served from your private MCP under your auth  |
| `personal-private-profile` | protected | Served from your private MCP under your auth  |

The public-tier schemas use *bands* (e.g. `"£1m-£5m"`, `"10-50 employees"`) instead of precise figures. This is deliberate: it keeps the directory clear of UK FCA financial-promotion rules while still letting an AI agent answer "is this company at my stage?". See `docs/security-policy.md` for the full rationale.

A library:

```python
from agentic_first_schema import validate_profile

report = validate_profile(json.loads(open("agentic-profile.json").read()))
if report.ok:
    print("valid", report.profile_kind, report.tier)
else:
    for issue in report.errors:
        print(issue.path, issue.message)
```

A CLI:

```bash
# Validate a file
agentic-first-validate ./.well-known/agentic-profile.json

# Validate via stdin (handy in CI)
curl -s https://example.com/.well-known/agentic-profile.json \
  | agentic-first-validate -

# Get the full machine-readable report
agentic-first-validate --json profile.json
```

Exit code is `0` when valid, `1` when invalid, `2` on bad usage. The PASS/FAIL summary goes to stdout, errors to stderr, so it pipes cleanly.

## What it checks

1. **Discriminator pair** — `(profile_kind, tier)` must select one of the four canonical schemas.
2. **JSON Schema validation** — required fields, types, formats, enums, length limits.
3. **Banded metrics** — public-tier numbers are bands from the canonical enum, not raw figures.
4. **Evidence URLs** — every material claim should be backed by a `https://` evidence link.
5. **Content security** — runs `scan_profile()` to flag prompt-injection patterns (jailbreak openers, role hijack, system-prompt impersonation, embedded HTML/JS, tool-call exfiltration, credential-harvest patterns) and unicode tricks (zero-width chars, bidi overrides, mixed scripts).

A profile that passes is **structurally** safe to publish. The reading-agent guidance in [`docs/reader-handling.md`](https://github.com/yqup/agentic-first/blob/main/docs/reader-handling.md) describes how to *use* a valid profile safely (delimited as untrusted content, plain-text rendering, URLs as suggestions not commands).

## Versioning

The schemas are pinned at `0.1.0`. The package version mirrors the schema version. Breaking changes to a schema bump the schema version and the package; non-breaking additions bump only the package.

The canonical URL for each schema is permanent and versioned, e.g. `https://directory.agentic-first.co/schemas/company-profile/0.1.0.json`. Documents `$ref` that URL; the bytes never change.

## License

MIT. See `LICENSE` in the repo root.
