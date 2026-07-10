# YQUP consulting refresh

Date: 2026-07-05

## Summary

`yqup.com` was moved from the Gamma-ingested page into the self-hosted `top-level-sites` static renderer as the YQUP consulting and system-sites homepage.

The page positions YQUP around agent-readable system sites, human-visible governance surfaces, board/CEO advisory, operating-model review, agentic-system workshops, town halls, and ongoing advisory support. The primary conversion route is still Tonywood.org advisory.

## Public site changes

- Changed `yqup.com` from `gamma` mode to the new `yqup` static mode.
- Kept the core line: `AI is not the problem. Lack of clarity is.`
- Added the system-site focus: information agents can read, with human visibility around it.
- Added service sections for governance, decision trails, agentic operations, practical adoption, advisory days, operating-model reviews, system-site builds, workshops, town halls, and ongoing advisory.
- Added a YQUP ecosystem directory linking to Tonywood.org, Chief Agentic Officer, Orchistra, SNAXK, Shepherd of Agentic Sheep, AIperations, Agentic Leader, Agentic Board, Dilijenz, Syndesy, and My Agentic.
- Added Tonywood writing links for the thinking behind the work.
- Restored the original YQUP wordmark treatment from the old site: thin `YQUP` on the black hero with `YQUP · ADVISORY`.

## Analytics

YQUP remains Matomo site ID `5`.

Primary funnel:

- destination: `https://www.tonywood.org/advisory/`
- campaign: `yqup_to_tonywood_advisory`
- source: `yqup.com`
- medium: `owned-referral`

The generated page keeps `/static/js/matomo-loader.js`, `/matomo-config.json`, and `data-funnel-*` attributes on advisory, ecosystem, directory, and writing links.

## Public interfaces

Preserved:

- `/`
- `/healthz`
- `/.well-known/agentic-profile.json`
- `/llms.txt`
- `/matomo-config.json`
- `/favicon.svg`
- `/assets/yqup-logo.svg`

## LinkedIn/Open Graph status

LinkedIn/Open Graph preview metadata is now generated for `https://yqup.com/`.
The page includes `og:title`, `og:description`, `og:url`, `og:image`, Twitter
card tags, and a 1200 x 627 preview image at `/assets/og-image.png`.

Canonical task note:

```text
top-level-sites/docs/linkedin-open-graph-previews.md
```

After deployment, refresh the URL through LinkedIn Post Inspector:

```text
https://www.linkedin.com/post-inspector/
```

`/healthz` now reports:

```json
{"mode":"static-yqup-container","matomo_site_id":"5"}
```

## Commits

- `f4fef18` - Refresh YQUP consulting site.
- `a034904` - Add YQUP logo to site.
- `0a14596` - Restore old YQUP wordmark.

The middle commit added an invented logo asset. The follow-up commit replaced it with the old YQUP wordmark treatment and kept the old-site black hero feel.

## Deployment

Final live release:

```text
top-level-sites-20260705T095758Z
```

Deploy gate:

```bash
ssh top-level-sites-deploy-ani deploy top-level-sites-20260705T095758Z 3e0460bb5bb5477f24ea801e469f4ca89c0cc117395a19276f51dc5d5488b1cc
```

ANI receipt:

```text
/srv/deploy-state/top-level-sites/receipts/top-level-sites-20260705T095758Z.yaml
```

The gate recreated all ten top-level site containers, passed loopback `/healthz` and `/.well-known/agentic-profile.json` smokes for each, validated Caddy, and updated `current` to:

```text
/srv/apps/top-level-sites/releases/top-level-sites-20260705T095758Z
```

## Verification

Local checks:

```bash
node --check top-level-sites/build-sites.mjs
node top-level-sites/build-sites.mjs
git diff --check
```

Generated YQUP checks confirmed:

- no invented border/path logo remains in `yqup-logo.svg`
- logo asset is copied into `dist/yqup.com/www/assets/yqup-logo.svg`
- root HTML includes the header logo and hero logo
- hero has the black old-site treatment
- hero includes `YQUP · ADVISORY`
- page still includes `agent-readable system sites`
- page still includes `/static/js/matomo-loader.js`

Public checks passed for both `https://yqup.com/` and `https://www.yqup.com/`:

- `/` returns `200` and includes the restored logo, black hero, and old lockup
- `/assets/yqup-logo.svg` returns `200` and contains the old wordmark description
- `/healthz` returns `static-yqup-container`
- `/matomo-config.json` returns site ID `5`
- Matomo public-surface checker passed for apex and `www`

## Note

The old Gamma page did not expose a separate logo image file. The restored asset is a local SVG recreation of the visible original wordmark treatment from the old YQUP screenshot: thin `YQUP` text on a black hero, with `YQUP · ADVISORY` beneath it.

## Human Advisory Refresh - 2026-07-09

The YQUP homepage was softened after review in LinkedIn/profile context. The
previous first viewport was technically correct but led with `system sites`,
agent-readable routes, and the line `Small public surfaces for serious work`,
which made the page feel too technical for a board-level buyer considering
whether to hire Tony.

Changes made:

- Reframed the page title and description around AI clarity for boards, CEOs,
  and operators.
- Kept the core line: `AI is not the problem. Lack of clarity is.`
- Replaced the first-viewport technical route panel with a board decision
  panel: `Bring the decision that is stuck.`
- Changed the prompt chips to buyer questions: what to approve, who owns it,
  where evidence sits, when to stop, and how people trust it.
- Moved `llms.txt`, agentic profile, Matomo config, and health-route links into
  a lower `Quiet discipline underneath` proof section.
- Changed navigation from technical nouns to buyer-facing labels: `Board work`,
  `Ways to work`, `YQUP world`, `Thinking`, and `Contact`.
- Kept Matomo site ID `5`, the Tonywood advisory funnel, and all public static
  interfaces unchanged.

Local verification included:

```bash
node --check top-level-sites/build-sites.mjs
node --check top-level-sites/scripts/check-social-previews.mjs
node top-level-sites/build-sites.mjs
node top-level-sites/scripts/check-social-previews.mjs
git diff --check
```

Local browser review used the generated YQUP static preview at:

```text
http://127.0.0.1:8338/
```

Desktop and mobile screenshots confirmed the first viewport no longer exposes
the technical route panel and the old `Small public surfaces for serious work`
phrase is absent.

## Modern British Advisory Refresh - 2026-07-10

The YQUP homepage now uses the approved Modern British advisory design. It
borrows Orchistra's visual confidence and dimensional finish while presenting
YQUP as a human, board-level advisory business rather than a software product.

Visual changes:

- Added a cinematic glasshouse boardroom hero with the original YQUP logo.
- Added the open editorial `Bring the decision that is stuck` section.
- Rebuilt the decision principles as ruled columns beside a photographic brief.
- Rebuilt `Ways to work` as a five-stage dark service ledger.
- Replaced ecosystem and article cards with an editorial index and magazine rail.
- Added a countryside contact scene and restrained YQUP Ltd footer.
- Added self-hosted Instrument Sans and Newsreader fonts using the existing
  licensed font sources already shipped with Orchistra.
- Added subtle hero entrance and image movement with a reduced-motion fallback.
- Added a compact mobile navigation and dedicated mobile hero image.
- Removed visible technical route links from the commercial homepage while
  preserving every direct public interface.

Production assets live under `top-level-sites/assets/yqup/` and contain no
people, private data, internal system details, readable client material, or
technology screenshots. Page copy and controls remain native HTML.

Public interfaces preserved:

- `/`
- `/healthz`
- `/llms.txt`
- `/.well-known/agentic-profile.json`
- `/matomo-config.json`
- `/favicon.svg`
- `/assets/og-image.png`
- `/assets/yqup-logo.svg`

Analytics remains Matomo site ID `5`; existing Tonywood advisory, ecosystem,
directory, and writing campaign parameters remain in place.

Local verification:

```bash
node --check top-level-sites/build-sites.mjs
node top-level-sites/build-sites.mjs
node top-level-sites/scripts/check-social-previews.mjs
git diff --check
```

Rendered QA used `http://127.0.0.1:8338/` at 1600 x 1000 and 390 x 844.
Checks covered first-viewport balance, full-page section rhythm, mobile menu,
CTA navigation, console errors, horizontal overflow, lazy image loading, and
reduced-motion CSS. The implementation was compared directly with all three
approved concept images.

Deployment release:

```text
top-level-sites-20260710T203436Z
```

Expected ANI receipt:

```text
/srv/deploy-state/top-level-sites/receipts/top-level-sites-20260710T203436Z.yaml
```

## Navigation Contrast Fix - 2026-07-10

The desktop navigation now sits on a restrained translucent charcoal header
with a light blur. Ordinary navigation links use full opacity and a subtle text
shadow, keeping `Board work` and its neighbouring labels readable as they cross
the brighter glasshouse windows. The hero image, original YQUP logo, copy,
campaign tracking, Matomo site ID `5`, and public machine-readable routes are
unchanged.

Rendered QA covered the reported 1106 x 898 desktop viewport and the 390 x 844
mobile viewport. The compact mobile header and first-viewport layout remain
clear with no overflow.

Deployment release:

```text
top-level-sites-20260710T210726Z
```

Expected ANI receipt:

```text
/srv/deploy-state/top-level-sites/receipts/top-level-sites-20260710T210726Z.yaml
```
