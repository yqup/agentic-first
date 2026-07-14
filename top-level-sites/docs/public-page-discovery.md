# Public Page Discovery And Preview Contract

Status: implemented for the generated top-level-sites bundle.

Date: 2026-07-14

## Public Head Contract

Every generated public page must render its discovery metadata in the HTML
head. JavaScript must not be required for crawlers to read it.

- One unique title and description per public page.
- One absolute HTTPS canonical URL, matching `og:url` and the sitemap entry.
- Open Graph image metadata including secure URL, PNG MIME type, dimensions,
  and descriptive alt text.
- Matching `summary_large_image` Twitter metadata.
- Article JSON-LD containing headline, author, publisher, canonical URL,
  publication dates, and the 1200 x 627 image.
- An Atom feed link, web manifest, favicon, and Apple touch icon.

The shared social image is generated at `/assets/og-image.png`. Release QA
requires exactly 1200 x 627 pixels and a file size below 1 MB.

## Discovery Files

Each site publishes:

- `/robots.txt`
- `/sitemap.xml`
- `/feed.xml`
- `/favicon.svg`
- `/apple-touch-icon.png`
- `/app-icon-192.png`
- `/app-icon-512.png`
- `/site.webmanifest`
- `/llms.txt`
- `/.well-known/agentic-profile.json`

`robots.txt` allows public crawlers and declares the absolute sitemap URL.
The sitemap, Atom feed, canonical tag, and Open Graph URL all use the same apex
HTTPS URL.

Agent-readable files are public information only. They grant no authority,
credentials, private access, or permission to act. This change does not add an
MCP or A2A endpoint.

## Release Gate

`top-level-sites/deploy/package-release.sh` now rebuilds the bundle and runs:

```sh
node --check top-level-sites/build-sites.mjs
node --check top-level-sites/scripts/check-social-previews.mjs
node --check top-level-sites/scripts/check-public-discovery.mjs
node top-level-sites/build-sites.mjs
node top-level-sites/scripts/check-social-previews.mjs
node top-level-sites/scripts/check-public-discovery.mjs
find top-level-sites/dist -path '*/www/server.mjs' -print0 | xargs -0 -n1 node --check
```

The validator fails the release when canonical, social metadata, structured
data, discovery files, icons, or the public no-authority boundary are missing.

## Production Verification

After deployment, test apex and `www` with crawler-style requests. Confirm the
homepage and social image return `200` anonymously, inspect content types, and
verify that the social image remains exactly 1200 x 627.

Then compose a new WhatsApp message containing the canonical URL without
sending it, and inspect the canonical URL in LinkedIn Post Inspector. Existing
messages and posts normally retain their old cached preview.

## Deployment Receipt

Planned ANI release:

```text
top-level-sites-20260714T093523Z
```

The receipt is written by the managed deployment gate under:

```text
/srv/deploy-state/top-level-sites/receipts/top-level-sites-20260714T093523Z.yaml
```
