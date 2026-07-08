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

- Planned release ID: `top-level-sites-20260708T144135Z`
- Deployment target: ANI via `top-level-sites-deploy-ani`

## Verification

Local verification before deploy:

- `node --check top-level-sites/build-sites.mjs`
- `node top-level-sites/build-sites.mjs`
- `git diff --check`
- Local Node fetch checks for `/`, `/healthz`, `/matomo-config.json`, `/llms.txt`, `/.well-known/agentic-profile.json`, and `/favicon.svg`
- Generated HTML checks for SNAXK logo assets, Matomo loader, tracked CAO/advisory links, country-map hero, and footer wording

Chrome headless screenshot capture was blocked by the desktop command policy in this lane, so visual verification was limited to the accepted concept and generated HTML/CSS inspection before deployment.
