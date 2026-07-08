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
- Deployment target: ANI via `top-level-sites-deploy-ani`

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
