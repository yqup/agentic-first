# Orchistra public site fresh look

Date: 2026-07-08

## Summary

`orchistra.com` has been refreshed as a public-safe service page for Orchistra,
the YQUP product for visible agent coordination.

The page keeps the agent communication infrastructure story while making the
service easier to understand: messages, tasks, rich updates, human requests,
receipts, handoffs, guidance, and audit-visible decisions become readable in one
operating layer.

## Public site changes

- Reworked the hero around a stylised, demo-safe Orchistra desktop app mock.
- Added four public outcomes: `Clear coordination`, `Human attention`,
  `Searchable evidence`, and `Reusable learning`.
- Added a field-note section linking the Shepherd of Agentic Sheep principle:
  the point is watching the right things, not everything.
- Reframed the service model as signals and workers becoming clear action,
  human control, and reusable learning.
- Added public-safe use cases for service triage, research and evidence work,
  sales and marketing operations, and recurring workflows.
- Kept the Chief Agentic Officer feeder path and platform-interest path, with
  separate Matomo campaigns for each.
- Updated the footer to identify Orchistra as a YQUP product and show YQUP Ltd
  copyright.

## Public safety

The hero mock uses fictional demonstration references under
`demo.orchistra.example`. It does not publish local machine names, private paths,
internal runtime URLs, production gateway URLs, bearer-token details, deployment
lanes, or customer-specific channel names.

Internal feature material was used only as pattern inspiration: readable channel
guidance, human attention, routine traceability, searchable evidence, and
handoff/review rhythms. Implementation-specific details stay out of the public
homepage.

## Analytics

The existing Matomo loader and `data-funnel-*` click attributes are preserved.
Tracked outbound interest remains split between:

- Chief Agentic Officer briefing interest:
  `orchistra_to_chiefagenticofficer_briefing`
- Orchistra platform interest to TonyWood advisory:
  `orchistra_platform_interest_to_tonywood_advisory`

## Verification

Run from `/Users/tonywood/agentic-first/agentic-first`:

```bash
node top-level-sites/build-sites.mjs
node --check top-level-sites/build-sites.mjs
find top-level-sites/dist -path '*/www/server.mjs' -print0 | xargs -0 -n1 node --check
git diff --check
```

Public HTML should not contain local-only strings such as `AKAAR`,
`operations_test`, private paths, `orchistra://`, localhost URLs, or the
production gateway URL inside the demo mock.

## Deployment

Deploy only through the existing `top-level-sites` package/release flow and ANI
forced-command deploy gate:

```bash
top-level-sites/deploy/package-release.sh
ssh top-level-sites-deploy-ani deploy <release-id> <sha256>
```

Do not deploy by directly changing Docker, Caddy, DNS, or files on ANI.
