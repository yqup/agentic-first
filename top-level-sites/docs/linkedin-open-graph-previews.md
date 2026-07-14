# LinkedIn Open Graph Previews

Status: implemented for generated top-level sites.

Date: 2026-07-09

## Why This Exists

LinkedIn is not picking up the generated site links cleanly when Tony adds them
as profile media. The pages currently expose ordinary title and description
metadata, but LinkedIn needs explicit Open Graph tags and an absolute preview
image to build reliable cards.

## Affected Sites

Apply this to every generated top-level public site that we maintain in Matomo:

| Domain | Matomo site ID | Notes |
| --- | ---: | --- |
| `https://yqup.com/` | `5` | YQUP consulting and system-sites homepage |
| `https://snaxk.com/` | `6` | SNAXK judgement engine |
| `https://my-agentic.com/` | `7` | Agentics URL home |
| `https://chiefagenticofficer.com/` | `8` | Chief Agentic Officer top-level listing |
| `https://agenticleader.com/` | `9` | Agentic Leader |
| `https://aiperations.com/` | `10` | AIperations |
| `https://agenticboard.com/` | `11` | Agentic Board |
| `https://dilijenz.com/` | `12` | Dilijenz holding page |
| `https://syndesy.com/` | `13` | Syndesy holding page |
| `https://orchistra.com/` | `14` | Orchistra |

`https://www.tonywood.org/` and the standalone
`https://chiefagenticofficer.com/` repo also have their own LinkedIn/Open Graph
next-step notes in their respective site repositories.

## Implemented Change

The top-level site generator now adds first-class social preview metadata to
each generated home page and creates one local 1200 x 627 PNG preview image
per site at `/assets/og-image.png`.

Generated head tags:

```html
<link rel="canonical" href="https://example.com/">
<meta property="og:type" content="website">
<meta property="og:title" content="...">
<meta property="og:description" content="...">
<meta property="og:url" content="https://example.com/">
<meta property="og:image" content="https://example.com/assets/og-image.png">
<meta property="og:image:secure_url" content="https://example.com/assets/og-image.png">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="627">
<meta property="og:image:alt" content="Example preview card">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="...">
<meta name="twitter:description" content="...">
<meta name="twitter:image" content="https://example.com/assets/og-image.png">
<meta name="twitter:image:alt" content="Example preview card">
```

Preview image requirements now enforced:

- Use one 1200 x 627 PNG per site.
- Keep each image below the 1 MB release target.
- Use an absolute HTTPS URL in `og:image`, `og:image:secure_url`, and
  `twitter:image`.
- Make the card readable at LinkedIn thumbnail size.

## Implementation

- `top-level-sites/build-sites.mjs` emits canonical Open Graph and Twitter card
  tags for every generated page.
- Gamma-derived snapshots have partial or stale `og:*` / `twitter:*` tags
  stripped and replaced with the canonical generated metadata.
- `top-level-sites/build-sites.mjs` generates the PNG card with macOS `sips`
  and the square app icons with ImageMagick during the AKAAR build.
- `top-level-sites/scripts/check-social-previews.mjs` verifies matching Open
  Graph and Twitter metadata plus a 1200 x 627 PNG below 1 MB.
- `top-level-sites/scripts/check-public-discovery.mjs` verifies unique titles
  and descriptions, one absolute canonical, Article JSON-LD, crawler discovery
  files, app icons, and the public no-authority boundary.
- `top-level-sites/deploy/package-release.sh` runs the build and validation
  before creating a release archive, so incomplete discovery metadata fails
  closed.

## Release

- Release ID: `top-level-sites-20260709T083629Z`
- Deployment target: ANI via `top-level-sites-deploy-ani`

## YQUP Card Correction

On 2026-07-09, the generated YQUP social preview card was corrected after the
LinkedIn media editor showed a broken-looking YQUP item. The live page metadata
was reachable, but the generated card layout allowed the large `AI is not the
problem. Lack of clarity is.` headline to collide with the logo block. The
shared card template now starts the headline lower, and the generated metadata
includes `og:image:secure_url`, `og:image:type`, and `og:image:alt` so crawler
tools have less room to misread the preview image.

## Orchistra Card Refresh

On 2026-07-09, `orchistra.com` received an Orchistra-specific social preview
refresh so LinkedIn cards describe the product rather than the generic
agent-readable site infrastructure.

- Title: `Orchistra | Visible agent work for people in charge`
- Description: `Messages, tasks, rich updates, receipts, handoffs, human requests, and audit-visible decisions in one calm operating layer.`
- Image title: `Agent work people can follow`
- Image feature labels: `Updates`, `Requests`, `Evidence`, `Learning`

## Verification

Local verification:

- `node --check top-level-sites/build-sites.mjs`
- `node --check top-level-sites/scripts/check-social-previews.mjs`
- `node top-level-sites/build-sites.mjs`
- `node top-level-sites/scripts/check-social-previews.mjs`
- `git diff --check`

Public verification after deploy:

- Fetch `https://<domain>/` and assert `og:title`, `og:description`, `og:url`,
  `og:image`, `og:image:width`, `og:image:height`, `twitter:card`,
  `twitter:title`, `twitter:description`, and `twitter:image`.
- Fetch `https://<domain>/assets/og-image.png` and assert HTTP 200 plus PNG
  dimensions `1200 x 627`.

After deployment, refresh LinkedIn's cache for each URL using:

```text
https://www.linkedin.com/post-inspector/
```

Pass condition: LinkedIn shows the intended title, description, and preview
image without manual correction.

Test with a newly composed share. LinkedIn posts and WhatsApp messages that
already exist normally keep their previously cached preview.
