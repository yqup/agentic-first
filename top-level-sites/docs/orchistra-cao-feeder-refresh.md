# Orchistra CAO feeder refresh

Date: 2026-07-05

## Summary

`orchistra.com` was refreshed as a feeder into the Chief Agentic Officer briefing while still presenting Orchistra as agent communication infrastructure.

The page now keeps the gateway, channels, rich updates, receipts, audit, roster, handoff, and guidance language, but links that operating layer to the Chief Agentic Officer mandate.

## Public site changes

- Added a Chief Agentic Officer feeder section: `Agent communication is a Chief Agentic Officer question.`
- Added a hero link and feeder-panel link to `chiefagenticofficer.com`.
- Added a platform-interest CTA to TonyWood advisory: `Discuss Orchistra as a platform`.
- Replaced the unexplained `Gateway / Channels / Audit trail / Guidance` strip with an explanatory `What becomes visible` band.
- Updated the roadmap to top-level layers: visible gateway foundation, CAO feeder and platform signal, cadence/trust/requests, and guidance/playbooks.

## Analytics

The Matomo loader still uses `data-funnel-*` attributes. Orchistra now separates:

- CAO briefing interest: `orchistra_to_chiefagenticofficer_briefing`
- Platform interest: `orchistra_platform_interest_to_tonywood_advisory`

The generated `matomo-config.json`, `healthz`, profile, and `llms.txt` inherit the updated Orchistra analytics goal and summary.

## Verification

Run from `/Users/tonywood/agentic-first/agentic-first`:

```bash
node top-level-sites/build-sites.mjs
node --check top-level-sites/build-sites.mjs
find top-level-sites/dist -path '*/www/server.mjs' -print0 | xargs -0 -n1 node --check
git diff --check
```

The redesigned local page was browser-checked at a `943x898` viewport. The old `signal-strip` is gone and the replacement cards render as a readable two-column band at that width.

## Deployment

No deployment was performed as part of this content refresh. Future deploys should use the existing `top-level-sites` package/release flow and the ANI forced-command deploy gate.
