# Orchistra 2027 Design Pilot

## Purpose

This pilot gives `orchistra.com` the first Modern British Agentic treatment in
the top-level-sites bundle. It combines the existing warm-paper and
English-country character with a darker, dimensional product surface. No other
site opts into this design during the pilot.

## Visual system

- Porcelain: `#fbf7ee`
- Ink: `#171512`
- Near-black product surface: `#0b100f`
- Hedgerow: `#1c2721`
- Mint: `#2fa875`
- Cobalt: used sparingly for product and focus signals
- Brass: `#dea331`
- Coral: `#ef6b4a`
- Interface type: self-hosted Instrument Sans variable font
- Editorial type: self-hosted Newsreader variable font
- Corners: no more than `8px`
- Motion: short load transitions and a slow product drift, disabled when the
  visitor prefers reduced motion

The page uses open editorial columns, evidence bands, and full-width dark
product sections instead of repeating the same card treatment throughout.

## Assets

Source assets live under `assets/orchistra/` and are copied into the generated
Orchistra container by the site metadata in `sites.json`.

- `hero-conservatory*.webp`: generated English-country glasshouse background
- `hero-console*.webp`: stylised public-safe Orchistra product render
- `countryside-field.webp`: local field-note photograph
- `instrument-sans-latin-variable.woff2`
- `newsreader-latin-variable.woff2`

The generated product render contains invented demonstration content only. It
must not contain machine names, internal paths, production URLs, customer data,
or private channel content. Font licence files remain beside the source assets.

## Behaviour preserved

- Existing Orchistra copy and public product claims
- Chief Agentic Officer, TonyWood, and Shepherd outbound destinations
- Matomo loader, campaign parameters, funnel stages, and content values
- `/llms.txt`, `/.well-known/agentic-profile.json`, `/matomo-config.json`,
  `/healthz`, and social preview metadata

The pilot does not change Gateway, MCP, Docker, Caddy, DNS, APIs, or deployment
gates. It remains local until Tony reviews the generated browser preview.

## Feature marketing refresh

The July 2026 feature refresh keeps the visual pilot intact while bringing its
public product language into line with the current Gateway and Mac app. The
marketing hierarchy is:

1. visible conversations and evidence;
2. permission-aware MCP access for people and agents;
3. focused human attention, acknowledgement, and decisions;
4. Shepherd-reviewed work packets and evidence-linked guidance;
5. searchable operating context across work, strategy, relationships, routines,
   and attachments.

Public copy describes the outcome and operating boundary, not the private
implementation. It must not publish endpoint paths, token handling, internal
lane names, customer records, workspace content, recovery topology, deployment
details, or confidential examples. Feature claims are grounded in the current
Gateway and native Mac app repositories and remain subject to each caller's
identity, permissions, and enabled capabilities.
