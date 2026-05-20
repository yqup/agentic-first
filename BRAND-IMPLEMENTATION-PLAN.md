# Agentic First Brand Implementation Plan

Version: 0.1
Date: 2026-05-20

This plan turns the Agentic First brand guidelines into a practical build plan
for the two public product routes:

- `/companies/`: Companies, an open source-owned company profile mechanism.
- `/directory/`: Tony's Agentics Tool Directory, a curated working directory of
  agent-friendly tools, notes, protocols, runtimes, and experiments.

The important split is conceptual before it is visual. Companies is a public
mechanism for organisations to publish correct information about themselves.
Directory is Tony's personal, practical field notebook of tools worth using or
tracking.

## Source Inputs

- Brand guidelines: `BRAND-GUIDELINES.md`
- Top-level site: `www/index.html`
- Top-level route map assets: `www/favicon.svg`,
  `www/static/img/agentic-first-map.svg`
- Product surfaces: sibling repo `../pitch-mcp/www/companies/`,
  `../pitch-mcp/www/directory/`
- Agent indexes: `llms.txt`, `www/llms.txt`,
  `../pitch-mcp/www/companies/llms.txt`,
  `../pitch-mcp/www/directory/llms.txt`
- Companies MCP endpoint: `https://agentic-first.co/companies/mcp`

## Product Positioning

### Agentic First

Agentic First is the parent system. It should explain the route map, not blur
the child products together.

Job:

- Make public information usable by agents.
- Show how source-owned facts, readable public surfaces, and governed agent
  access fit together.
- Send people clearly to Companies or Directory.

Tone:

- Calm, practical, trustworthy, quietly technical.
- Parent route-map language, not a generic AI landing page.

### Companies

Companies is the source-owned company facts surface.

Job:

- Give companies a free, canonical way to publish correct public facts from
  their own domain.
- Make those facts discoverable by agents without scraping, login walls, or a
  broker tax.
- Keep sensitive or precise figures behind the company's own governed MCP.

What it is:

- A profile mechanism and schema.
- A public directory of publisher-owned company facts.
- A route to governed private data when the publisher chooses to expose it.

What it is not:

- Not Tony's tool list.
- Not a public marketplace of software products.
- Not a PitchBook clone with another owner.
- Not a place to publish confidential diligence data.

### Directory

Directory is Tony's working directory of agent-friendly tools.

Job:

- Collect tools, protocols, runtimes, messaging systems, control planes, and
  monitoring layers that look useful for agentic work.
- Capture how Tony has used them, where they fit, and what trust checks matter.
- Help humans and agents find candidate tools quickly.

What it is:

- A curated field notebook.
- A practical tool catalog.
- A place for usage notes, cautions, source links, and experiments.

What it is not:

- Not a neutral public registry.
- Not a certification body.
- Not a company profile system.
- Not a paid ranking or marketplace.

Initial lanes:

- Agent communication: agent mail, agent inboxes, identity, direct messaging,
  and agent-only Slack-like chat.
- Agent protocols: MCP, ACP, A2A, AGENTS.md, skills, prompt formats, and
  context-discovery standards.
- Agent runtimes: coding agents, local orchestrators, multi-agent runners, and
  control planes.
- Agent operations: usage monitors, token trackers, review gates, logs, and
  observability surfaces.

## Shared Visual System

Implement the brand as a shared CSS token layer before styling individual pages.

Core tokens:

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

Route ownership:

- `/`: lavender-slate parent route map.
- `/companies/`: sage source-owned facts route.
- `/directory/`: soft violet discovery and field notes route.
- Approval moments: warm amber permission and audit cues.
- Schema/MCP/protocol moments: cool standards blue.

## Page Plans

### `/` Agentic First Home

Primary job:

- Explain that Agentic First has two related but separate surfaces.

First viewport:

- Hero headline should name Agentic First and the parent idea.
- Supporting copy should describe the split in plain language.
- Primary CTA: `Open Companies`.
- Secondary CTA: `Open Tony's Tool Directory`.
- Route map image should show Companies and Directory as separate routes in
  the same system.

Sections:

1. Route cards for Companies and Directory.
2. Three parent principles: source-owned, readable, governed.
3. Links to the essays and agent indexes.

Design work:

- Replace remaining black/white and old blue/green/red accents with brand
  tokens.
- Restyle route cards with Companies sage and Directory violet.
- Update favicon and route-map SVG colors to match the guidelines.

### `/companies/`

Primary job:

- Help a company understand why it should publish a source-owned profile and
  how to start.

First viewport:

- Eyebrow: `Companies - open profile mechanism`.
- Headline: company-controlled facts for AI agents.
- Lede: publish correct public information on your own domain, avoid scraping
  and broker-tax discovery, keep sensitive data behind governed MCP access.
- Primary CTA: `Publish your profile`.
- Secondary CTA: `I'm an AI agent`.

Sections:

1. Why this exists: agents are the reader, the web lacks a company layer,
   brokers own too much of the published profile.
2. What it is: public JSON profile plus protected MCP tier.
3. Why companies should take control: publisher-owned canonical source.
4. Comparison table: today versus Agentic First.
5. Who it is for: founders, IR leads, advisors, investors, agent builders.
6. Technical detail and GitHub handoff.

MCP and agent surface:

- Keep `/companies/llms.txt` as the agent index for Companies.
- Keep `/companies/mcp` as the Companies MCP endpoint.
- The MCP instructions should describe Companies as a source-owned company
  profile mechanism, not a tool directory.
- Any protected data language should make it clear that the public directory
  never receives private figures.

Design work:

- Move from the current dark interface to the Companies sage system.
- Use `--af-companies` for primary actions and route accents.
- Use `--af-companies-bg` for page bands and `--af-companies-soft` for panels.
- Use approvals amber for protected tier and permission language.
- Use standards blue for schema, JSON, and MCP callouts.

### `/directory/`

Primary job:

- Let Tony and agents quickly find useful tools for agentic work, with context
  and caution.

First viewport:

- Eyebrow: `Agentics tools - Tony's directory`.
- Headline: tools Tony thinks are useful for agentic work.
- Lede: a curated working directory, not a neutral public registry.
- Primary CTA: `View JSON catalog`.
- Secondary CTA: `Read the notes`.
- Tertiary route: `Company profiles`.

Sections:

1. What belongs here: protocols, communication infrastructure, runtimes and
   control planes.
2. Current catalog shape: lanes with examples.
3. How to read this list: source checked, trust model, install path, data
   access, credential handling, maintenance, network exposure.
4. Optional next section: Tony's usage notes, with fields for status,
   experience, caution, and suggested use.

Agent surface:

- Keep `/directory/llms.txt` as the agent index for Directory.
- Keep `directory/agentic-tools.json` as the canonical machine-readable catalog.
- Directory entries should include source URL, category, utility, trust notes,
  and Tony's experience where available.
- Do not present Directory as a public certification or company profile source.

Design work:

- Use `--af-directory` for primary actions and route accents.
- Use `--af-directory-bg` for page bands and `--af-directory-soft` for panels.
- Use standards blue for protocols and machine-readable catalog callouts.
- Use approvals amber for trust, installation, and credential warnings.

## Component Plan

Build shared components as plain HTML/CSS patterns, no new production
dependencies:

- Route card: area name, job-to-be-done, one practical sentence, route color.
- Status pill: live health, version, or source-checked status.
- Evidence row: source URL, last checked, trust note.
- Tier badge: public, protected, approval, standard.
- MCP panel: endpoint, auth status, intended reader, safety boundary.
- Tool note card: category, what it does, Tony's use, caution, source link.
- Comparison table: old route versus Agentic First route.

Constraints:

- Cards stay at 8px radius or less.
- Avoid cards inside cards.
- Use full-width pastel bands or page backgrounds instead of decorative blobs.
- Keep Inter/system UI, no second decorative typeface.
- Letter spacing stays 0 for headings.

## Implementation Phases

### Phase 0 - Confirm Current Split

- Confirm `/`, `/companies/`, `/directory/`, `/companies/healthz`,
  `/directory/llms.txt`, and `/companies/mcp` respond as expected.
- Confirm the homepage routes to Companies and Directory with the right copy.
- Record any wording that still treats Companies as "directory" in a confusing
  way.

### Phase 1 - Shared Tokens

- Add Agentic First tokens to the top-level stylesheet.
- Add the same token layer to the `pitch-mcp` product stylesheet.
- Map old variables to new tokens so existing pages can be restyled without
  breaking layout.

Target files:

- `www/static/css/site.css`
- `../pitch-mcp/www/companies/static/css/site.css`

### Phase 2 - Parent Home

- Restyle `/` with the lavender-slate parent route map system.
- Update route cards for Companies sage and Directory violet.
- Update `favicon.svg` and `agentic-first-map.svg` to the brand palette.
- Keep existing route links unchanged.

Target files:

- `www/index.html`
- `www/static/css/site.css`
- `www/favicon.svg`
- `www/static/img/agentic-first-map.svg`
- `www/llms.txt`

### Phase 3 - Companies

- Restyle `/companies/` from dark monochrome to sage source-owned facts.
- Tighten naming so Companies is consistently a profile mechanism, not a tool
  directory.
- Add visual distinction between public profile, protected MCP, approvals, and
  standards.
- Verify MCP initialize instructions still describe the Companies product
  correctly.

Target files:

- `../pitch-mcp/www/companies/index.html`
- `../pitch-mcp/www/companies/static/css/site.css`
- `../pitch-mcp/www/companies/llms.txt`
- `../pitch-mcp/apps/api/src/pitch_api/mcp_server.py`

### Phase 4 - Directory

- Restyle `/directory/` with the violet discovery and field-notes route.
- Add clearer catalog-entry language: useful, tried, tracking, caution.
- Make security/trust notes a first-class pattern on the page.
- Keep route back to `/companies/` visible but secondary.

Target files:

- `../pitch-mcp/www/directory/index.html`
- `../pitch-mcp/www/directory/llms.txt`
- `../pitch-mcp/directory/README.md`
- `../pitch-mcp/directory/agentic-tools.json`

### Phase 5 - Verification

- Desktop and mobile browser checks for `/`, `/companies/`, and `/directory/`.
- Link checks for top-level route links.
- Health checks for `/companies/healthz` and top-level `/healthz`.
- MCP initialize smoke for `/companies/mcp`.
- JSON sanity check for `directory/agentic-tools.json`.
- `git diff --check` in both repos.

### Phase 6 - Deploy

- Deploy top-level static changes through the Agentic First deploy gate.
- Deploy Companies and Directory product changes through the `pitch-mcp` deploy
  gate.
- Do not change Caddy, DNS, secrets, Docker membership, sudoers, or runtime
  paths as part of this brand pass.

## Acceptance Criteria

- A new visitor can tell within five seconds that Companies and Directory are
  different things.
- Companies reads as a public, source-owned company facts mechanism.
- Directory reads as Tony's personal tool field notebook.
- Both routes feel like part of Agentic First through shared type, layout,
  tokens, route cards, and governance cues.
- The site no longer reads as black-and-white or generic dark AI tooling.
- Companies and Directory have distinct route colors without becoming separate
  brands.
- CTAs meet contrast expectations on their route colors.
- Mobile views have no overlapping or clipped text.
- Agent indexes and MCP instructions match the product split.
- Deployment receipts show normal app deploys only, with no host-level changes.

## Next Build Slice

The next useful implementation slice is:

1. Add shared brand tokens to both stylesheets.
2. Restyle the top-level homepage, favicon, and route map.
3. Restyle `/companies/` and `/directory/` using the same token layer.
4. Run browser, link, health, MCP, JSON, and diff checks.
5. Deploy through the existing narrow gates when approved.
