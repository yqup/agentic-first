# Agentic First Identity

26 October 2026. The AF mark pairs forest green with sage and a small muted-rose
accent, matching the current English-country directory rather than the retired
black route-map icon. Use the symbol with the live Georgia wordmark in headers.
Do not replace the wordmark with a rasterised text image.

## Assets

- `agentic-first-mark-master.png`: original transparent generated master.
- `../www/static/img/agentic-first-logo.svg`: self-contained symbol/wordmark lockup.
- `../www/static/img/agentic-first-mark.png`: 128px transparent header symbol.
- `../www/favicon.svg`: 64px embedded symbol on sage, readable on dark/light tabs.
- `../www/favicon-32.png` and `../www/favicon.ico`: compatibility exports.
- `../www/apple-touch-icon.png`, `icon-192.png`, `icon-512.png`: app-icon exports.

The Directory's matching assets are mirrored into its own release, so neither
application depends on the other app to serve its header mark or favicon.
CSS fixes the header symbol at 44px, alongside accessible live brand text.
Exports preserve alpha; the SVG favicon supplies its own light background.

From this repository on AKAAR, run `python3 deploy/export_brand_assets.py`.
This performs format/size exports with macOS sips, embeds the resulting PNG in
the compatibility SVG, typesets the wordmark, and mirrors to the sibling
Directory checkout when present. There is no new production dependency.
The original master is retained, not destructively edited.

## Generation Receipt

Built-in Codex ImageGen, transparent output, one native image. No CLI/API-key
fallback or paid account activation. Exporting sizes is not fresh AI generation.
The master is 1254x1254 with alpha. Final prompt:

> Use case: logo-brand. Asset type: one final production brand symbol, to use in the Agentic First website header and as its favicon. Create a distinctive compact AF monogram for Agentic First, a European tool-discovery directory with a calm English-country editorial feel. Flat, precise, simple silhouette: two broad interlocking wayfinding strokes subtly form an A and an F, suggesting paths joining and forward discovery. The mark must read at 16 and 32 pixels, with generous negative space and no fine lines. Muted dark forest green #345B48 is the primary colour, a small sage accent #A8BFA8 and a restrained dusty rose accent #C99290. Colour proportions approximately 80 percent forest, 15 percent sage, 5 percent rose. Solid flat colours, no gradients, no texture, no shadows, no 3D, no mockup, no enclosing card, no foliage, no maps, no circuits, no sparkles, no stars, no robot, no tagline or additional text. A single centred symbol filling approximately 84 percent of a square composition. Genuinely transparent background. This is a finished standalone symbol, not a page layout or contact sheet.
