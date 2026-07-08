# SNAXK Country-Map Refresh

Date: 2026-07-08

## Summary

SNAXK was refreshed as a warmer English-country / field-map site while keeping its judgement-engine identity and Chief Agentic Officer feeder role.

The visual direction uses warm paper, hedgerow green, honey-gold, charcoal, and restrained oxblood. The first viewport now presents SNAXK as a judgement engine map: signal markers, boundary/review nodes, and a dark console-style panel for signal, boundary, and review status.

## Preserved Interfaces

- `/`
- `/healthz`
- `/.well-known/agentic-profile.json`
- `/llms.txt`
- `/matomo-config.json`
- `/favicon.svg`
- `/assets/snaxk-logo.png`
- `/assets/snaxk-lozenge.png`
- `/assets/snaxk-badge.png`

## Analytics

- Matomo site ID remains `6`.
- Health mode remains `static-snaxk-container`.
- CAO feeder links keep `snaxk_to_chiefagenticofficer`.
- Tonywood advisory / engine-interest links keep `snaxk_to_tonywood_advisory`.

## Footer

The footer now includes:

- `A YQUP product`
- `Copyright (c) 2026 YQUP Ltd`

## Release

- Previous release ID: `top-level-sites-20260708T144135Z`
- Corrective release ID: `top-level-sites-20260708T152257Z`
- Corrective commit: `e5b60a3`
- Corrective archive SHA-256: `9c248cdc706162f8d6eb5a8361bfc5ad6e94dadd25eb2851ef37aa7faf0b673a`
- Documentation follow-up release ID: `top-level-sites-20260708T154213Z`
- Deployment target: ANI via `top-level-sites-deploy-ani`

## Deployment Acceptance

The corrective release was deployed to ANI and made current at:

- `/srv/apps/top-level-sites/releases/top-level-sites-20260708T152257Z`

Deploy gate evidence:

- Archive hash verification: OK
- Per-site containers: recreated successfully
- Loopback `/healthz`: OK for all top-level-site containers
- Loopback `/.well-known/agentic-profile.json`: OK for all top-level-site containers
- Caddy validation: valid configuration
- Receipt written: `/srv/deploy-state/top-level-sites/receipts/top-level-sites-20260708T152257Z.yaml`

Public SNAXK acceptance:

- `https://snaxk.com/`: 200
- `https://www.snaxk.com/`: 200
- `/healthz`: 200 on apex and `www`
- `/matomo-config.json`: 200 on apex and `www`
- `/.well-known/agentic-profile.json`: 200 on apex and `www`
- `/llms.txt`: 200 on apex and `www`
- `/favicon.svg`: 200 on apex and `www`
- `/assets/snaxk-badge.png`: 200 on apex and `www`
- Public Matomo surface checker: passed for apex and `www`

## Verification

Local verification before corrective deploy:

- `node --check top-level-sites/build-sites.mjs`
- `node top-level-sites/build-sites.mjs`
- `git diff --check`
- Local Node fetch checks for `/`, `/healthz`, `/matomo-config.json`, `/llms.txt`, `/.well-known/agentic-profile.json`, and `/favicon.svg`
- Generated HTML checks for SNAXK logo assets, Matomo loader, tracked CAO/advisory links, country-map hero, and footer wording

Visual verification was completed in the in-app browser against the accepted country-map concept:

- Desktop/laptop viewport: `1037x898`
- Mobile viewport: `390x844`
- Verified no horizontal overflow.
- Verified the first viewport uses the planned light paper background, wide SNAXK mark, two-line hero, field-map judgement graphic, dark engine console, CAO CTA, signal strip, loop, boundary cards, lower panels, and dark YQUP footer.
- Verified footer text: `A YQUP product` and `Copyright (c) 2026 YQUP Ltd`.
