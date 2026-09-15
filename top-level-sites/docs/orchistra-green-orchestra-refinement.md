# Orchistra green countryside and orchestra refinement

Date: 2026-09-15

## Brand direction

Tony clarified that Orchistra should retain green backgrounds, English
countryside and recognisable orchestral instruments. This supersedes the
coast-led hero in orchistra-country-coast-refresh.md, while keeping its
one-page copy, product illustration and garden interlude.

The new hero is an original imagined English garden with a cello, violin,
French horn and music stands. Forest green #173d2e supports ivory text;
sage #e8eedf and #dce7cd carry the main page backgrounds. Existing sky,
coral and gold accents provide contrast without changing the product story.

## Motion

The hero photograph uses a slow 24-second pan/zoom. A low-opacity daylight
layer moves over the image on an 18-second cycle. Text and navigation stay
still. This is CSS motion over a generated still image, not actual video.
No butterflies, sound, cursor-following effects or new runtime dependencies
were added. Movement is deliberately restrained.

The existing pause/resume control stops both effects, reduced motion disables
them, and offscreen/hidden-document pausing is retained. Content remains
readable without JavaScript.

## Assets and generation

Built-in OpenAI image-generation tool, not CLI/API fallback.
Optimised with cwebp; original generated image remains in Codex image storage.

- Desktop: top-level-sites/assets/orchistra/country-orchestra.webp
- Mobile: top-level-sites/assets/orchistra/country-orchestra-mobile.webp
- Copied to dist/orchistra.com/www/assets/orchistra/ through the generator.
- Media-qualified preloads select the appropriate image.
- No real venue, private workspace data or customer material is represented.

### Final prompt

Use case: photorealistic-natural.
Asset type: full-bleed homepage hero for Orchistra, a control panel for human and AI work.
Create a premium editorial photograph, wide 16:9, of a small chamber orchestra setting in a lush English country garden on a bright late-summer morning. Rolling green hills, mature oak trees, clipped hedges and a little pale stone country house in the distance. In the RIGHT half, a beautifully crafted honey-coloured cello upright on a proper stand, a violin resting safely in its open lined case on a wooden chair, a polished brass French horn on a small wooden table, and two elegant music stands with blank cream scores. A quiet rehearsal about to begin, no people. Instruments should be recognisable, carefully formed, realistic and arranged intentionally, not scattered. Green is the dominant environment: rich hedge green, meadow green, sage and moss, with warm wood and small brass highlights. Sunlight catches the instrument varnish and leaves, inviting and sophisticated rather than gloomy. LEFT half is uncluttered shaded green lawn and soft hedge suitable for ivory website typography. Natural photographic depth but instruments and setting sharp and inspectable. Eye-level slightly wide photographic composition. No text, no branding, no musical notes floating in the air, no fantasy instruments, no dark fog, no sepia, no electronic screens. An original imagined English countryside scene, not a real venue. One seamless photograph.

## Verification

Build, generator/presentation and generated server JavaScript syntax,
social-preview validator, public-discovery validator and diff checks passed.
Other-site metadata and tracked outbound links are unchanged.

Playwright (Browser plugin not available) verified the local page at
1440x900, 1024x768, 390x844 and 1920x1080. No horizontal overflow or blank
page/framework error. Images decode; fragment links resolve; no page errors.
Pause stops the image and daylight transforms; offscreen and reduced-motion
checks pass. Keyboard navigation opens the mobile menu and Escape closes it.
No-JavaScript content remains visible.

Local preview: http://127.0.0.1:8220/?preview=country-orchestra

No production deployment, API, Gateway, MCP or infrastructure change.
