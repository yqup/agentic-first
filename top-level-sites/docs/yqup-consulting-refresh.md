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

## Next site-change task

Add LinkedIn/Open Graph preview metadata for `https://yqup.com/` before or
during the next YQUP site change. This should include `og:title`,
`og:description`, `og:url`, `og:image`, Twitter card tags, and a 1200 x 627
preview image that LinkedIn can use without manual correction.

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
