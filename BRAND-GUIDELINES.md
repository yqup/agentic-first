# Agentic First Brand Guidelines

Version: 0.2
Date: 2026-10-26

The current directory-led identity uses a forest-green AF monogram, sage and
muted rose, with a Georgia wordmark and headings. It replaces the black
route-map favicon. The original route palettes below remain secondary area
colours, not a requirement to recolour the approved English-country homepage.
Production assets, exact generation prompt and export instructions are in
[`brand-assets/README.md`](brand-assets/README.md).

Agentic First should feel calm, trustworthy, and quietly technical. The brand
is about making public information usable by agents without making humans feel
displaced by the system. It should not look like a monochrome infrastructure
dashboard or a generic AI startup page.

Use a pastel route-map system: one shared visual language, with each public
area getting its own soft background and darker pastel anchor color.

## Brand Idea

Agentic First means source-owned facts, readable public surfaces, and governed
agent access.

The visual idea is a living route map:

- **Agentic First** is the parent system and route map.
- **Companies** is the source-owned profile and company facts surface.
- **Directory** is the working directory of agent-friendly tools and notes.
- Future areas should receive their own pastel tint while keeping the same
  typography, layout density, and governance cues.

## Personality

Use these words as design checks:

- Clear
- Source-owned
- Warm
- Governed
- Practical
- Agent-readable
- Human-directed

Avoid:

- Pure black-and-white minimalism
- Neon AI gradients
- Dark dashboard styling
- Decorative blobs or floating orbs
- Cartoonish mascots
- Overly corporate blue SaaS polish

## Color System

The palette should replace hard black/white contrast with muted ink, warm
paper, and pastel route colors. Use dark text on pastel surfaces wherever
possible. Reserve white text for larger buttons on darker anchor colors.

### Shared Neutrals

| Token | Hex | Use |
| --- | --- | --- |
| `--af-ink` | `#242337` | Primary text, headings, primary button text on light surfaces |
| `--af-muted` | `#606170` | Secondary copy, metadata, footer links |
| `--af-paper` | `#F7F4F0` | Default page background |
| `--af-panel` | `#FFFCF8` | Cards, diagrams, contained panels |
| `--af-line` | `#D8D3CB` | Borders and dividers |
| `--af-focus` | `#7EA6E8` | Keyboard focus ring |

### Product Colors

| Area | Anchor | Background | Soft Panel | Meaning |
| --- | --- | --- | --- | --- |
| Agentic First | `#345B48` | `#E8EFE8` | `#F4F7F3` | Parent identity, wayfinding, trusted discovery |
| Companies | `#5E8B75` | `#DFF0E8` | `#F2FAF6` | Source-owned company facts, trust, verification |
| Directory | `#8C789E` | `#ECE2F2` | `#F8F2FB` | Discovery, tools, experiments, field notes |
| Approvals | `#A47C54` | `#F3E3CB` | `#FCF6EC` | Permission, review, audit boundaries |
| Standards | `#668AAA` | `#DDECF7` | `#F3F8FC` | Schemas, protocols, machine-readable contracts |

The Agentic First parent color is a muted forest green, not black. It should
hold the identity without overpowering
Companies or Directory.

### Suggested CSS Tokens

```css
:root {
  color-scheme: light;
  --af-ink: #242337;
  --af-muted: #606170;
  --af-paper: #f7f4f0;
  --af-panel: #fffcf8;
  --af-line: #d8d3cb;
  --af-focus: #7ea6e8;

  --af-agentic: #345b48;
  --af-agentic-bg: #e8efe8;
  --af-agentic-soft: #f4f7f3;

  --af-companies: #5e8b75;
  --af-companies-bg: #dff0e8;
  --af-companies-soft: #f2faf6;

  --af-directory: #8c789e;
  --af-directory-bg: #ece2f2;
  --af-directory-soft: #f8f2fb;

  --af-approvals: #a47c54;
  --af-approvals-bg: #f3e3cb;
  --af-approvals-soft: #fcf6ec;

  --af-standards: #668aaa;
  --af-standards-bg: #ddecf7;
  --af-standards-soft: #f3f8fc;
}
```

## Route Color Ownership

Use the background tint as the first signal of which area someone is in.
Keep the shared navigation and page structure consistent so the colors feel
like siblings, not separate brands.

- `/` Agentic First: forest-green identity and a soft countryside hero.
- `/companies/`: sage background bands, Companies anchor color for primary
  buttons and card accents.
- `/directory/`: soft violet background bands, Directory anchor color for
  primary buttons and card accents.
- Approval, feedback, and governance moments: use the warm approvals palette.
- Schema, protocol, and machine-readable documentation: use the standards
  palette sparingly as a secondary cue.

## Typography

Use the existing type direction:

- Body type: system UI sans-serif; Georgia for the live wordmark and headings.
- Headings should be large, plain, and confident.
- Body copy should stay compact and readable.
- Do not use negative letter spacing.
- Do not introduce additional decorative fonts.

Suggested hierarchy:

- Hero H1: 4.8rem to 5.2rem desktop, 3rem to 3.3rem mobile.
- Section H2: 2.6rem to 3rem desktop.
- Card H3: 1.1rem to 1.25rem.
- Body: 1rem to 1.2rem with line-height around 1.5.

## Layout And Components

Keep the site practical and navigable:

- Use full-width pastel bands or page backgrounds rather than floating
  decorative sections.
- Cards should stay functional, with radius at 8px or less.
- Avoid cards inside cards.
- Use colored surfaces and top borders to identify route areas.
- Keep buttons short and direct.
- Use icons only when they clarify action or route type.
- Route cards should show the area name, job-to-be-done, and one sentence of
  practical context.

## Logo, Favicon, And Route Map

Use the AF monogram as the primary symbol. It suggests joined routes and
forward discovery, without depicting circuitry or generic AI stars.

- Forest `#345B48`, sage `#A8BFA8`, muted rose `#C99290`.
- Header: 44px symbol plus accessible live brand text, with 10px separation.
- Standalone lockup: `www/static/img/agentic-first-logo.svg`.
- Browser: self-contained SVG favicon on light sage, with PNG/ICO fallbacks.
- Keep transparent master exports undistorted and retain generous clear space.
- Never recolour the mark per product area or put detailed labels into the icon.
- Historical route-map illustrations are secondary diagrams, not the current logo.

## Imagery And Illustration

Use diagrams, route maps, source cards, profile previews, and interface
fragments. Avoid generic robot imagery and abstract AI clouds.

The core metaphor is not "AI magic." It is:

- source facts
- readable routes
- explicit permissions
- humans and agents working through governed paths

## Accessibility Rules

- Text on pale pastel backgrounds should use `--af-ink`.
- Secondary text should use `--af-muted`, but avoid using it below 14px.
- Primary buttons can use white text only on the darker anchor colors.
- Check AA contrast for all route-specific text/button combinations.
- Keep focus rings visible on every pastel surface.

## Pitch Implementation Handoff

Pitch should implement this as a shared token system before restyling any one
page.

Recommended order:

1. Add the shared color tokens to the top-level Agentic First site and the
   `pitch-mcp` product surfaces.
2. Restyle the top-level Agentic First page first using the Agentic First
   lavender-slate system.
3. Apply Companies sage as the route background and primary action color under
   `/companies/`.
4. Apply Directory violet as the route background and primary action color
   under `/directory/`.
5. Update `favicon.svg` and `static/img/agentic-first-map.svg` to use the new
   token colors.
6. Verify desktop and mobile screenshots for `/`, `/companies/`, and
   `/directory/`.
7. Keep routing, Caddy, DNS, secrets, services, and runtime paths unchanged
   unless there is a separate deployment approval.

Acceptance checks:

- The top-level page no longer reads as black-and-white.
- Each area has a recognizable pastel background.
- The palette still feels like one system.
- CTAs are readable and meet contrast requirements.
- Companies and Directory feel related but visually distinct.
- The route map and favicon use the same color family as the page.
