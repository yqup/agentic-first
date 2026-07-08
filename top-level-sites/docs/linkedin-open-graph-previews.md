# LinkedIn Open Graph Previews

Status: next site-change task.

Date: 2026-07-08

## Why This Exists

LinkedIn is not picking up the generated site links cleanly when Tony adds them
as profile media. The pages currently expose ordinary title and description
metadata, but LinkedIn needs explicit Open Graph tags and an absolute preview
image to build reliable cards.

## Affected Sites

Apply this to generated top-level public sites, especially:

- `https://yqup.com/`
- `https://orchistra.com/`
- `https://snaxk.com/`
- `https://agentic-first.co/`

## Next Change Requirement

The next change to the top-level site generator should add first-class social
preview metadata to each generated home page.

Required head tags:

```html
<meta property="og:type" content="website">
<meta property="og:title" content="...">
<meta property="og:description" content="...">
<meta property="og:url" content="https://example.com/">
<meta property="og:image" content="https://example.com/assets/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="627">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="...">
<meta name="twitter:description" content="...">
<meta name="twitter:image" content="https://example.com/assets/og-image.png">
```

Preview image requirements:

- Use one 1200 x 627 PNG per site.
- Keep each image below 5 MB.
- Use an absolute HTTPS URL in `og:image`.
- Make the card readable at LinkedIn thumbnail size.

## Suggested Implementation

- Add `ogTitle`, `ogDescription`, and `ogImage` fields to `sites.json`.
- Update `top-level-sites/build-sites.mjs` so every generated page emits Open
  Graph and Twitter card tags.
- Add or generate site-specific preview images under the relevant static
  assets path.
- Add a small smoke check that fetches each generated page and asserts the
  required metadata exists.

## Verification

After deployment, refresh LinkedIn's cache for each URL using:

```text
https://www.linkedin.com/post-inspector/
```

Pass condition: LinkedIn shows the intended title, description, and preview
image without manual correction.
