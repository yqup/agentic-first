# Agentic First Brand Guidelines

Version: 0.1
Date: 2026-05-20

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
| Agentic First | `#625C8D` | `#E7E4F5` | `#F3F1FB` | Parent route map, governance, system identity |
| Companies | `#5E8B75` | `#DFF0E8` | `#F2FAF6` | Source-owned company facts, trust, verification |
| Directory | `#8C789E` | `#ECE2F2` | `#F8F2FB` | Discovery, tools, experiments, field notes |
| Approvals | `#A47C54` | `#F3E3CB` | `#FCF6EC` | Permission, review, audit boundaries |
| Standards | `#668AAA` | `#DDECF7` | `#F3F8FC` | Schemas, protocols, machine-readable contracts |

The Agentic First parent color should be the darkest pastel: a muted
lavender-slate, not black. It should hold the identity without overpowering
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

  --af-agentic: #625c8d;
  --af-agentic-bg: #e7e4f5;
  --af-agentic-soft: #f3f1fb;

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

- `/` Agentic First: lavender-slate hero background, parent route-map accents.
- `/companies/`: sage background bands, Companies anchor color for primary
  buttons and card accents.
- `/directory/`: soft violet background bands, Directory anchor color for
  primary buttons and card accents.
- Approval, feedback, and governance moments: use the warm approvals palette.
- Schema, protocol, and machine-readable documentation: use the standards
  palette sparingly as a secondary cue.

## Typography

Use the existing type direction:

- Primary type: `Inter`, then system UI fallbacks.
- Headings should be large, plain, and confident.
- Body copy should stay compact and readable.
- Do not use negative letter spacing.
- Do not introduce a second decorative font.

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

The current route-map mark is directionally right: paths, nodes, and
relationships. It should be softened to match the palette.

Update direction:

- Replace the black favicon background with `--af-agentic`.
- Keep route paths as Companies sage, Directory violet, and Approvals amber.
- Use `--af-panel` or `--af-paper` for nodes.
- The favicon should remain legible at 16px, so keep thick strokes and simple
  node shapes.
- The route-map SVG should use tinted cards or nodes, not only white boxes.

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
