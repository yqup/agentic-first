# Company profile v0.2.0 validation gate

Prepared on AKAAR, 2 November 2026. Review-only change: no deployment,
schema change, queue submission or production operation is included.

## Fault reproduced

All ten generated `/.well-known/agentic-profile.json` files failed the
canonical Open Company Information v0.2.0 validator:

- All sites included unsupported top-level `access` and `analytics` keys.
- `chiefagenticofficer.com` also included unsupported `briefing` and
  `briefing_categories` keys.

The schema correctly rejects additional properties. It has not been relaxed
or changed. A profile access/authority extension would require a separate
v0.3.0 specification proposal in `yqup/pitch-mcp`.

## Generator and build gate

- `build-sites.mjs` no longer adds those four fields to public profiles.
- Analytics remains unchanged in `/healthz`, the generated site manifest
  and existing analytics configuration.
- `llms.txt` retains its public-information/no-authority statements. Its
  embedded JSON now matches the corrected public profile.
- CAO retains `links.for_agents` and `links.llms`; briefing context and
  categories remain in the for-agents page and the prose of `llms.txt`.
- `scripts/check-company-profiles.mjs` invokes `agentic-first-validate` on
  every generated profile, reports all failures, and exits unsuccessfully if
  any fail. It also rejects missing configured sites, unexpected profile
  files or empty site lists. Empty retired directories with no profile are
  ignored. Warnings remain visible and non-fatal.
- The generator checks for the CLI before clearing `dist/` and validates
  profiles before reporting build success. The normal release packager
  already invokes this generator, so it inherits the gate.
- The existing public-discovery check now checks the v0.2.0 public-company
  discriminators rather than requiring the invalid `access.authority` key.

The build-only Python dependency is pinned in `requirements-build.txt` to
`yqup/pitch-mcp` revision
`ff50b9d881a4e27b6d954cf4dc6b84b94ff4087b`, package version `0.2.0`.
Python 3.11+ is required. Installation is explicit in an ignored virtualenv;
the build does not install packages or fetch remote schemas. No production
dependency, schema copy, or runtime validation service was added.

## Local verification

- Before rebuilding: canonical CLI rejected **10/10** profiles with the
  reported additional-properties errors.
- After rebuilding: canonical CLI passed **10/10** profiles:
  `agenticboard.com`, `agenticleader.com`, `chiefagenticofficer.com`,
  `dilijenz.com`, `emirorai.com`, `my-agentic.com`, `orchistra.com`,
  `snaxk.com`, `syndesy.com`, and `yqup.com`.
- Each valid profile retains two warnings: no registry/LEI and no evidence
  links. These are quality warnings, not structural failures or verification
  claims; no company facts were fabricated to silence them.
- Seventeen Node regression tests pass, including reintroduced unsupported
  fields, invalid known fields, malformed/missing files, incomplete outputs,
  all-sites iteration, non-fatal warnings and a missing CLI. The latter
  verifies the build fails before modifying existing generated profiles.
- Social preview and public discovery checks pass for all ten sites.
- Fifteen existing homepage/deployment unit tests pass, as does
  `git diff --check`. The installed validator's company schema matches
  `companies/schemas/company-profile/0.2.0.json` exactly.

Build commands and standalone validation are documented in
[`../README.md`](../README.md#build).

The build used the existing Agentic Board snapshot when the Gamma upstream
was unavailable. Incidental rasteriser-dependent PNG changes and a blank
line in that cached HTML were excluded from the PR; images, page HTML,
analytics outputs and site metadata remain unchanged. The generated changes
are the ten corrected profiles and their ten embedded `llms.txt` copies.

## Release status

Commit and push this fix on a feature branch and open a PR against
`yqup/agentic-first:main`. Merging and deployment await Tony's approval.
Local schema validation is not evidence of changed production endpoints.
