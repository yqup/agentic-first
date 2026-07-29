# SNAXK and Orchistra Sibling Product Refresh

Date: 2026-07-29

## Summary

SNAXK and Orchistra now form a shared Modern British Agentic Systems product
family. Both sites use the editorial typography, cinematic English-country
imagery, polished dark surfaces, restrained motion, navigation rhythm, and
footer treatment established by YQUP.

The products remain deliberately distinct:

- Orchistra keeps agent work visible, coordinated, and reviewable.
- SNAXK helps decide what may proceed, what should stop, and where human
  judgement is required.

They are presented as sibling YQUP products. The sites do not claim that SNAXK
is already integrated into Orchistra.

## SNAXK

SNAXK keeps its original logo, lozenge, warm gold identity, and headline:
`A judgement engine for agentic work.`

The refreshed page uses a glasshouse judgement room, a working evidence table,
and a conceptual judgement console to explain signals, consequences,
uncertainty, boundaries, stop conditions, evidence, review, and escalation. The
console is labelled as a concept model and is not presented as finished
software.

## Orchistra

Orchistra keeps its existing conservatory and product imagery while gaining a
clearer editorial hierarchy, stronger typography, polished operating surfaces,
and more deliberate spacing.

Its story follows signals arriving, work moving, human attention, approved
decisions, receipts, evidence, and reusable learning.

## Product Relationship

- SNAXK links to Orchistra with campaign `snaxk_to_orchistra`.
- Orchistra links to SNAXK with campaign `orchistra_to_snaxk`.
- Cross-product links remain secondary to each product's existing conversion.
- Chief Agentic Officer and Tonywood Advisory remain the leadership and
  commercial routes.

Both footers include:

- `A YQUP product`
- `Copyright (c) 2026 YQUP Ltd`

## Public Interfaces

Both sites preserve:

- `/`
- `/healthz`
- `/llms.txt`
- `/.well-known/agentic-profile.json`
- `/matomo-config.json`
- `/favicon.svg`
- `/robots.txt`
- `/sitemap.xml`
- `/feed.xml`
- `/site.webmanifest`
- `/assets/og-image.png`

SNAXK also preserves its public logo assets.

## Analytics

- SNAXK remains Matomo site ID `6`.
- Orchistra remains Matomo site ID `14`.
- Existing `data-funnel-*` tracking remains in place.
- Existing Chief Agentic Officer and Tonywood Advisory campaign routes remain
  intact.

## Assets

The release adds dedicated desktop and mobile SNAXK hero photography, a SNAXK
supporting editorial image, and unique `1200 x 627` social cards for both
products. Orchistra continues to use its existing public-safe product imagery.

Licensed Newsreader and Instrument Sans font assets are copied into both
containers.

## Verification

Run from `/Users/tonywood/agentic-first/agentic-first`:

```bash
node --check top-level-sites/build-sites.mjs
node top-level-sites/build-sites.mjs
node top-level-sites/scripts/check-social-previews.mjs
node top-level-sites/scripts/check-public-discovery.mjs
git diff --check
```

Local review uses:

- SNAXK: `http://127.0.0.1:8212/`
- Orchistra: `http://127.0.0.1:8220/`

Desktop and mobile browser checks cover product identity, navigation contrast,
horizontal overflow, headings, images, calls to action, cross-product campaign
parameters, reduced-motion handling, image loading, and clean browser consoles.

## Deployment

- Target: ANI through the `top-level-sites-deploy-ani` forced-command gate.
- Release ID: `top-level-sites-20260729T081923Z`.
- Source commit: `a4d2222`.
- Archive SHA-256:
  `1ee1a6929367565c9e9be1fa624c8252ffb1743ec8459288200c0e4a90e1adb0`.
- Current release:
  `/srv/apps/top-level-sites/releases/top-level-sites-20260729T081923Z`.
- Server receipt:
  `/srv/deploy-state/top-level-sites/receipts/top-level-sites-20260729T081923Z.yaml`.

The deploy gate checksum-verified the archive, recreated the managed site
containers, passed loopback `/healthz` and agentic-profile smokes, validated and
reloaded Caddy, switched the current release, and wrote the receipt.

## Public Acceptance

Crawler-style HTTPS checks passed for:

- `https://snaxk.com/`
- `https://www.snaxk.com/`
- `https://orchistra.com/`
- `https://www.orchistra.com/`

For all four hosts, `/`, `/healthz`, `/llms.txt`,
`/.well-known/agentic-profile.json`, `/matomo-config.json`, `/favicon.svg`,
`/robots.txt`, `/sitemap.xml`, `/feed.xml`, `/site.webmanifest`, and
`/assets/og-image.png` returned `200`.

Public HTML checks confirmed canonical metadata, Open Graph and Twitter
metadata, JSON-LD, the correct sibling campaign, and the expected headline.
Matomo configuration remains site ID `6` for SNAXK and `14` for Orchistra.

Live desktop visual checks confirmed:

- the SNAXK judgement-room hero, original identity, readable navigation, and
  visible `Before the work moves` section;
- the Orchistra conservatory hero, clear product identity, readable
  navigation, and visible `One calm operating layer` section;
- no horizontal overflow at the tested `1440px` viewport.

Do not deploy by directly changing Docker, Caddy, DNS, or files on ANI.
