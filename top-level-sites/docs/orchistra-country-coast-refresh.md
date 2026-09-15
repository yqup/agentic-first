# Orchistra country and coast reimagining

Date: 2026-09-15
Scope: Orchistra public homepage only. Local review, not a production release.

## Direction

A bright English coastal garden replaces the darker conservatory opening.
Sea-blue light, fresh green planting and pale stone bring warmth without
changing the control-panel positioning. A full-width garden interlude gives
the long page a visual pause. A new light-mode product illustration makes
the product story easier to inspect.

The existing copy, capability qualifications, audiences, tracked outbound
links and social-preview image remain unchanged. The only new page copy is
the garden caption and explicit illustrative-product caption.

## Visual rules

- Dark green ink #173d36 and white/pale mint surfaces, with sky-blue, coral
  and gold section accents. Keep the main page bright; reserve dark green
  for the footer and high-contrast controls.
- Instrument Sans for interface/body text; Newsreader for editorial headings.
  Fixed responsive type sizes, zero tracking, crisp 8px control corners.
- Full-bleed photographic hero and garden scene; open section layouts and
  thin rules instead of repeated floating cards.
- Four-stage model laid out horizontally on desktop, two columns on tablet
  and one column on mobile. Product illustration is a large centred view.
- Slow 28/30-second image pans and a small 12-second product float.
  These are animated still images, not video. Pause control and reduced
  motion are retained. Motion pauses offscreen and when the tab is hidden.

## Image provenance and safety

Generated with the built-in OpenAI image-generation tool, using the prompts
below. No external stock assets, new runtime dependencies or real private
workspace data were introduced. The gardens are imagined, not photographs
of Tony's property. The product is an illustrative concept, not a claim that
the generated interface is the shipped app. Its workspace and data are
fictional; the caption states this.

Canonical deployable assets are under top-level-sites/assets/orchistra/:

| Asset | Desktop | Mobile |
| --- | --- | --- |
| Coastal opening | coastal-garden.webp | coastal-garden-mobile.webp |
| Garden interlude | garden-gate.webp | garden-gate-mobile.webp |
| Product concept | control-panel-light.webp | control-panel-light-mobile.webp |

Mechanical WebP conversion uses cwebp. Combined desktop images are about
932 KiB; combined mobile variants about 324 KiB. Hero preloads are
media-qualified; lower images load lazily. Original older assets remain
available but are not referenced by this page presentation.

## Verification

Passed build, generator/presentation JavaScript syntax, all generated server
syntax, social-preview validation, public-discovery validation and diff checks.
Playwright checked 1440x900, 1024x768, 390x844 and 1920x1080:
no horizontal overflow, all displayed images decode, no broken fragment links,
no page errors. Pause freezes the hero transform; reduced motion disables it.
Keyboard menu open/Escape-close and no-JavaScript content checks passed.

Tracked outbound anchor markup matches the predecessor exactly. Other-site
metadata and generated output are unchanged. Social image bytes are unchanged.
No Gateway, API, MCP, Docker configuration, deployment gate or production
service was modified. Only the local Orchistra preview container was recreated
after regeneration, to refresh its bind-mounted generated directory.

Preview: http://127.0.0.1:8220/?preview=country-coast-20260915

This supersedes the image/palette direction in orchistra-control-panel-refresh.md,
not its positioning or operating boundaries. Review locally before deployment.

## Generation prompts

### coastalHero

Use case: photorealistic-natural. Create a premium original wide landscape website hero image, 16:9. A bright English country garden meeting the sea, inspired by the Dorset and Devon coast. Expansive pearly blue morning sky over gentle green fields, chalk cliffs, a quiet sparkling turquoise bay. A beautiful modest English country house with pale stone walls, a contemporary glass garden room and climbing roses occupies the far right, surrounded by natural white cosmos, soft pink roses, clipped hedges, grasses. Editorial architectural photography, sophisticated and uplifting, real textures, airy sunlight, fresh greens, sea blue, tiny coral flower accents. Composition: the LEFT 50 percent and top 55 percent are very uncluttered pale sky and softly lit pale garden terrace, suitable for dark green website headline overlay; visual richness, house, garden and coastline concentrate on the right and lower third. Actual land and sea must be sharp and legible, not vague. No dusk, dark enclosure, fog, gloom, fantasy castles, no people, no words, no logos, no UI, no vignette. This is a beautiful confident modern British product-brand world, not a travel poster. Keep scene believable and calm. No split composition, no frames. Deliver one seamless photograph.

### countryGarden

Use case: photorealistic-natural. An original bright editorial landscape photograph for an English technology brand, 3:2 landscape. A sunlit English walled garden in early summer, a curving pale gravel path through naturalistic white daisies, lavender, soft pink roses, lush fresh green hedges and an old apple tree, leading to an open pale stone garden gate. Through the gate a subtle glimpse of distant blue English sea and rolling coastal fields. Modern premium countryside photography with sparkling clear light, sophisticated natural detail, hopeful and refreshing. Interesting close foreground flowers, deep perspective, bright open upper-left area. No people, no lettering, no dark shadows, no sepia, no fantasy, no gimmicks. Crisp realistic planting and materials. Picture should feel like breathing fresh air, with highlights on leaves and a light breeze implied in grasses. One seamless photograph, no borders.

### controlPanel

Use case: ui-mockup. Create a premium high-resolution 3:2 landscape product presentation image of a beautiful light-mode macOS desktop control panel named exactly 'Orchistra'. Public-safe fictional demonstration, not a real customer screenshot. A single large frontal app window occupies 90 percent of the image, fully visible and legible with subtle 3D depth, polished silver-white window chrome, soft realistic ambient shadow on a very pale cool mint seamless background. No laptop hardware. Sophisticated clean productivity UI, restrained deep green typography, fine grey dividers, mint, sky blue, warm amber and coral status accents. Minimal 8px corner curves, no large blobs or dramatic tilt. App title Orchistra, fictional workspace 'Garden House'. Left sidebar labels 'Overview', 'Goals', 'Work', 'Needs you', 'Evidence'. Main heading 'A clear view of the work'. Three summary metrics explicitly labelled 'Demo workspace': '4 priorities', '2 for review', '6 updates'. Main feed has three well-spaced large readable items: 'Weekly research' with status 'Ready to review', 'Customer follow-up' with status 'In progress', 'Team priorities' with status 'Updated'. Right narrow column headed 'Needs you' includes 'Review the research summary' and 'Confirm next week’s priorities'. Bottom understated label 'Illustrative workspace'. Gentle sunlight reflection across the glass chrome only, not obscuring text. Sharp elegant modern interface type. No URLs, no domains, no names of real individuals, no API keys, internal hostnames, real customer data or technical identifiers. Dark readable text, coherent spacing, generous but practical density. Produce one app window, not stacked cards, not multiple screens.

