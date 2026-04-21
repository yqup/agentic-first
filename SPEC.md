# The agentic-first profile standard

Version 0.1.0 · MIT

A small, well-versioned JSON contract that companies and individuals publish at a known location on their own website. Agents and directories discover it without scraping. Two tiers — **public** for discovery, **protected** for diligence-grade detail behind your own auth.

---

## Table of contents

- [Why this exists](#why-this-exists)
- [Public vs protected](#public-vs-protected)
- [Where it lives (the URI)](#where-it-lives-the-uri)
- [Discriminators](#discriminators)
- [Company · public profile](#company--public-profile)
- [Company · protected profile](#company--protected-profile)
- [Personal · public profile](#personal--public-profile)
- [Personal · protected profile](#personal--protected-profile)
- [Banded enums](#banded-enums)
- [Evidence](#evidence)
- [Related conventions](#related-conventions)
- [Validate and submit](#validate-and-submit)
- [Versioning and governance](#versioning-and-governance)

---

## Why this exists

Three things are happening at once:

1. Agents are becoming the primary consumer of company information.
2. The existing structured-data conventions (Schema.org, OpenGraph) describe **content** but not **capability** or **identity**.
3. The people best placed to describe a company are the company itself, not a third-party data broker.

`agentic-first` fills that gap with an opinionated JSON contract you publish on your own domain. It is deliberately not an attempt to model everything; it is the smallest schema that lets a serious investor, customer, or LLM agent decide whether to go further. Anything richer belongs on the protected tier, which the publisher controls entirely.

---

## Public vs protected

| Aspect                                  | Public                                                                                  | Protected                                                                       |
| --------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Where it lives                          | `/.well-known/agentic-profile.json` on your website                                     | Your private MCP server (auth-gated, scoped, audited)                           |
| Who can read it                         | Anyone, including search engines and LLM agents                                         | Principals you've issued a token to                                             |
| What it carries                         | Identity, jurisdiction, registry IDs, banded metrics, evidence links, contact channel   | Precise figures, fundraise detail, NDA-protected logos, references, updates     |
| FCA / financial-promotion exposure      | **Banded values only** — never precise revenue, growth, or fundraise numbers            | Precise figures permitted because the audience is gated and identified          |
| Crawled by the directory                | Yes, on submission and on a schedule                                                    | Never. The directory has no token and no view into it.                          |

In schema files the tier is set explicitly with the `tier` field (`"public"` or `"protected"`) and the kind of subject with `profile_kind` (`"company"` or `"person"`). This makes the same parser robust against either file showing up at either location.

---

## Where it lives (the URI)

The canonical hosting location is:

```
https://your-domain.example/.well-known/agentic-profile.json
```

Discovery from a homepage:

```html
<link rel="agentic-profile"
      href="https://your-domain.example/.well-known/agentic-profile.json">
```

If the canonical path is unavailable to you (some CMS hosts block dotted paths), publish a `<script type="application/agentic-profile+json">` data island on your homepage with the same JSON content, and still emit the `<link rel="agentic-profile">` discovery tag pointing at it. The standard defines five publishing modes in total — Mode 1 (file at `/.well-known/`, canonical), Mode 2 (script embed), Mode 3 (hidden XML block), Mode 4 (visible HTML table for AI-builder hosts; speculative), and Mode 5 (single-line plain-text colophon in a footer card, for hosts like Gamma / Tome / Beautiful.AI where the only available primitive is "type some text into a page"). Modes 3, 4, and 5 carry a soft warning at the directory because they are harder for reading agents to verify; Mode 5 carries the strongest warning. See [`docs/embed-recipes.md`](./docs/embed-recipes.md) for the full per-host catalogue and the per-mode recipe files at [`docs/recipes/modes/`](./docs/recipes/modes/). For hosts where the canonical path is unavailable, the standard does not prescribe any single fronting vendor: any static host that serves a JSON file from a custom-domain CNAME (Vercel, Netlify, Cloudflare Pages, Cloudflare Workers, Bunny.net, GitHub Pages, self-hosted reverse proxy) implements Mode 1 equivalently — see [`docs/recipes/hosts/gamma.md`](./docs/recipes/hosts/gamma.md) for the de-vendored menu.

---

## Discriminators

Every conforming document MUST set both:

| Field          | Type    | Allowed values                       |
| -------------- | ------- | ------------------------------------ |
| `profile_kind` | literal | `"company"` &middot; `"person"`      |
| `tier`         | literal | `"public"` &middot; `"protected"`    |

The pair `(profile_kind, tier)` selects exactly one of the four canonical schemas:

| `(profile_kind, tier)`     | Schema                              |
| -------------------------- | ----------------------------------- |
| `("company", "public")`    | `company-profile/0.1.0.json`         |
| `("company", "protected")` | `company-private-profile/0.1.0.json` |
| `("person",  "public")`    | `personal-profile/0.1.0.json`        |
| `("person",  "protected")` | `personal-private-profile/0.1.0.json`|

---

## Company · public profile

Hosted at `https://your-domain.example/.well-known/agentic-profile.json` with `profile_kind: "company"`, `tier: "public"`.

### Required fields

| Field                  | Type                  | Notes                                                       |
| ---------------------- | --------------------- | ----------------------------------------------------------- |
| `schema_version`       | string (semver)       | e.g. `"0.1.0"`                                              |
| `updated_at`           | ISO 8601 datetime UTC | When you last regenerated this file                         |
| `profile_kind`         | literal               | `"company"`                                                 |
| `tier`                 | literal               | `"public"`                                                  |
| `company.name`         | string                | Trading name                                                |
| `company.website`      | URL                   | Canonical homepage                                          |
| `company.jurisdiction` | ISO 3166-1 alpha-2    | `"GB"`, `"US"`, `"DE"`, …                                   |

### Recommended fields

| Field                          | Type                                                       | Notes                                                                                                                           |
| ------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `company.legal_name`           | string                                                     | Statutory name if different from trading name                                                                                   |
| `company.registry`             | object: `{ type, id, url }`                                | Companies House, Delaware, EDGAR, etc. Verified IDs add directly to the trust score.                                            |
| `company.lei`                  | string (20-char)                                           | GLEIF Legal Entity Identifier                                                                                                   |
| `company.founded`              | `YYYY` or `YYYY-MM`                                        |                                                                                                                                 |
| `company.industry`             | array of strings (max 8)                                   | Hyphenated lowercase tags                                                                                                       |
| `company.tagline` / `summary`  | string                                                     | Tagline ≤ 200 chars; summary ≤ 2000                                                                                             |
| `stage.current`                | enum                                                       | `Pre-Seed`, `Seed`, `Series A` … `Public`, `Acquired`, `Closed`                                                                 |
| `funding.total_raised_band`    | money band                                                 | `"<100k"`, `"100k-500k"`, … `">500m"`, `"undisclosed"`                                                                          |
| `funding.last_round`           | object                                                     | Stage, date, amount band, lead investor, evidence URL                                                                           |
| `team.headcount_band`          | headcount band                                             | `"1-10"`, `"11-50"`, `"51-200"`, …, `">5000"`                                                                                   |
| `team.key_people`              | array (max 10)                                             | Name, role, LinkedIn, evidence URL                                                                                              |
| `metrics.revenue_band`         | money band                                                 | **Bands only** — never precise revenue on the public surface                                                                    |
| `metrics.growth_band`          | growth band                                                | `"negative"`, `"flat"`, `"0-20%"`, `"20-100%"`, `"100-300%"`, `">300%"`                                                          |
| `metrics.customers_band`       | count band                                                 | `"<10"`, `"10-100"`, `"100-1k"`, `"1k-10k"`, `"10k-100k"`, `"100k-1m"`, `">1m"`                                                |
| `evidence`                     | array                                                      | Citations supporting public claims; empty array caps the trust score                                                            |
| `contact.preferred_channel`    | enum                                                       | `email`, `form`, `private-mcp`, `none`                                                                                           |
| `contact.private_mcp`          | URL                                                        | Pointer to your protected-tier MCP, if you run one                                                                              |

See [`examples/company-public.json`](./examples/company-public.json) for a complete profile.

---

## Company · protected profile

Lives behind your own MCP server, behind your own authentication (typically OAuth 2.0 with scopes per section). The directory never sees this.

> **Adopter responsibility.** The protected tier carries figures that, if leaked, may constitute a regulated financial promotion in jurisdictions like the UK. Your MCP MUST authenticate every reader, scope every section (`financials:read`, `fundraise:read`, `traction:read`, `updates:read`), and audit every access. `agentic-first` publishes the schema; the **controls** are yours.

### Sections

| Section       | Purpose                                                                                            | Sensitivity                                  |
| ------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `financials`  | Precise revenue, ARR, MRR, gross margin, burn, runway, cash on hand                                | High                                         |
| `traction`    | Customer count, named logos (incl. NDA flag), pipeline, churn, NPS                                 | High (especially `logos[].nda`)              |
| `fundraise`   | Active fundraise: instrument, ask, valuation target, room left, deck/data-room URLs, syndicate, close target | **Highest** — financial-promotion exposure |
| `updates`     | Append-only investor updates with id, date, title, body, tags                                      | Medium                                       |

See [`examples/company-protected.json`](./examples/company-protected.json) for a complete profile.

---

## Personal · public profile

Same hosting convention as the company tier: `/.well-known/agentic-profile.json`, with `profile_kind: "person"`. For founders, NEDs, advisors, consultants, fractional leaders, and anyone whose engagements are ad-hoc and discoverable. Public-tier personal profiles deliberately omit precise compensation, calendar links, and live engagement state — those go on the protected tier.

### Required fields

| Field             | Type                  | Notes                                                              |
| ----------------- | --------------------- | ------------------------------------------------------------------ |
| `schema_version`  | string (semver)       |                                                                    |
| `updated_at`      | ISO 8601 datetime UTC |                                                                    |
| `profile_kind`    | literal               | `"person"`                                                         |
| `tier`            | literal               | `"public"`                                                         |
| `person.name`     | string                | The name you publicly use professionally                           |
| `person.headline` | string ≤ 200          | One-liner, e.g. "Independent NED · former CFO at Series-B SaaS"    |

### Recommended fields

| Field                       | Type                       | Notes                                                                                |
| --------------------------- | -------------------------- | ------------------------------------------------------------------------------------ |
| `person.location`           | object: `{ city, country }`| Country is ISO 3166-1 alpha-2                                                        |
| `person.bio`                | string ≤ 2000              | Public biographical summary                                                          |
| `person.expertise`          | array of strings (max 12)  | Hyphenated tags                                                                      |
| `person.languages`          | array of ISO 639-1         | e.g. `["en", "fr"]`                                                                  |
| `current_roles`             | array                      | `{ title, organisation, organisation_url?, since, evidence_url? }`                   |
| `past_roles_band`           | enum                       | `"0"`, `"1-2"`, `"3-4"`, `"5+"` — count band, no full history on public              |
| `key_past_roles`            | array (max 5)              | Material roles only, with evidence URLs                                              |
| `credentials`               | array                      | Professional bodies (ICAEW, IoD, CFA, …) with verifiable IDs                         |
| `links`                     | object                     | Keyed URLs (linkedin, github, website, …)                                            |
| `evidence`                  | array                      | Same shape as on company profiles                                                    |
| `contact.preferred_channel` | enum                       | `email`, `form`, `private-mcp`, `none`                                               |
| `contact.private_mcp`       | URL                        | Pointer to your protected-tier MCP, if you run one                                   |

See [`examples/personal-public.json`](./examples/personal-public.json) for a complete profile.

---

## Personal · protected profile

Served from your private MCP, behind your auth, to principals you've explicitly authorised. Designed for the engagement-discovery use case: a recruiter, board chair, or portfolio CEO has been told about you, visits your public profile, requests access, and is then handed back the protected payload.

### Sections

| Section          | Purpose                                                                                |
| ---------------- | -------------------------------------------------------------------------------------- |
| `engagement`     | Availability bands, day rate band, hours-per-month band, current commitments           |
| `career`         | Full role history with figures (revenue grown, headcount built, budget owned)          |
| `portfolio`      | Investments / advisories with stake bands and outcomes                                  |
| `contact`        | Direct lines, calendar URLs, PA contact                                                 |
| `updates`        | Append-only updates the principal cares about                                          |

See [`examples/personal-protected.json`](./examples/personal-protected.json) for a complete profile.

---

## Banded enums

Public-tier numerical fields use **canonical bands** rather than raw numbers. The same band strings are reused across every numerical field that uses that scale.

### Money bands

```
"<100k", "100k-500k", "500k-1m", "1m-5m", "5m-10m",
"10m-25m", "25m-50m", "50m-100m", "100m-500m", ">500m",
"undisclosed"
```

### Headcount bands

```
"1-10", "11-50", "51-200", "201-500", "501-1000",
"1001-5000", ">5000"
```

### Growth bands (% YoY)

```
"negative", "flat", "0-20%", "20-100%", "100-300%", ">300%"
```

### Customer-count bands

```
"<10", "10-100", "100-1k", "1k-10k", "10k-100k", "100k-1m", ">1m"
```

### Past-roles bands (personal)

```
"0", "1-2", "3-4", "5+"
```

The full canonical lists are also encoded as JSON Schema `enum`s in [`schemas/`](./schemas/).

---

## Evidence

Material claims should carry `evidence` entries pointing at sources a third party can check independently. Each entry is `{ kind, url, title?, retrieved_at? }` where `kind` is one of `homepage`, `news-article`, `companies-house`, `lei-record`, `sec-filing`, `funding-announcement`, `crunchbase`, `linkedin`, `github`, `case-study`, `customer-logo`, `regulatory-filing`, `other`.

The directory's confidence score is keyed off `evidence` density. An empty `evidence` array caps the score, even on otherwise-complete profiles.

---

## Related conventions

We surveyed the existing well-knowns before claiming a slot:

| Convention                         | Describes                                                                                                  | Status (2026)                                                  |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `/.well-known/mcp.json`            | Your MCP server: endpoint, transport, tools, auth, capabilities, rate limits.                              | Proposed (SEP-1960 / SEP-2127, modelcontextprotocol working group) |
| `/.well-known/agent-card.json`     | An A2A-protocol agent: capabilities, identity, contact-on-behalf-of.                                       | **IANA-registered, permanent** (Linux Foundation, Aug 2025)    |
| `/llms.txt`                        | A Markdown index of your site for LLMs to read instead of crawling everything.                             | De-facto, mainly adopted by developer-tooling and documentation sites (Mintlify-hosted docs, OpenAI / Anthropic docs surface, FastAPI, Stripe docs). Useful for coding-agent / docs context, not as a general-purpose discovery surface for arbitrary structured data. |
| `/agents-brief.txt`                | What an AI agent is permitted to *do* on your site (book, buy, submit).                                    | Draft v0.4, early 2026                                         |
| `/.well-known/agentic-profile.json`| **Who is the company or person behind this site** — jurisdiction, registry, key people, banded financials, contact channel. | This standard, v0.1.0                                          |

The first four describe **protocol** or **content**; `agentic-first` describes the **publisher**. They are complementary. A company that runs an MCP server, has an A2A agent, and wants its corporate identity discoverable would publish all three.

We will pursue an IANA *provisional* registration for `agentic-profile.json` alongside the v0.2 schema bump.

### Belt-and-braces: also embed Schema.org JSON-LD

Search engines and most current LLM crawlers still look for [`Schema.org Organization`](https://schema.org/Organization) (or `Person`) JSON-LD on your home page. Drop it in a `<script type="application/ld+json">` block alongside your agentic-profile file. The two are not in conflict — Schema.org is for SEO and general discovery, agentic-first is for agent-native diligence.

See [`docs/landscape.md`](./docs/landscape.md) for deep dives on each convention.

---

## Validate and submit

Once your file is live, validate locally:

```bash
pip install agentic-first-schema
agentic-first-validate ./.well-known/agentic-profile.json
```

Or via stdin:

```bash
curl -sS https://your-domain.example/.well-known/agentic-profile.json \
  | agentic-first-validate -
```

Then point the directory at it. The `submit_website` MCP tool runs the full validator (structural + semantic + cross-reference + temporal) against your domain and either indexes you or returns a structured error report:

```bash
curl -sS -X POST https://directory.agentic-first.co/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call",
       "params":{"name":"submit_website",
                 "arguments":{"domain":"your-domain.example"}}}'
```

Or call `submit_website` from any MCP-aware client (Claude Desktop, Cursor, ChatGPT desktop) pointed at `https://directory.agentic-first.co/mcp`.

---

## Versioning and governance

The schema is SemVer'd. Breaking changes bump the major version and come with a 90-day deprecation window during which both versions validate. Minor and patch versions are additive only and never reject previously-valid documents.

Schema files are immutably versioned at stable URLs:

- `https://directory.agentic-first.co/schemas/company-profile/{version}.json`
- `https://directory.agentic-first.co/schemas/company-private-profile/{version}.json`
- `https://directory.agentic-first.co/schemas/personal-profile/{version}.json`
- `https://directory.agentic-first.co/schemas/personal-private-profile/{version}.json`

All four are served with `application/schema+json` and long-lived immutable cache headers — the URL itself is versioned, so the bytes never change. The same files are mirrored in this repo at [`schemas/`](./schemas/).

Decisions of consequence are recorded as ADRs in [`docs/adr/`](./docs/) once we have any worth recording. Disputes about a published profile go through the directory's `dispute` flow.
