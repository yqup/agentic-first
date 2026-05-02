# The standards landscape

> Before publishing yet another standard, we did the survey. There are a lot of good, mature, well-adopted conventions touching this problem — and three specific gaps none of them fill.

---

## The three gaps

We can't find an open, machine-readable, **publisher-controlled** standard for any of these:

### Gap 01 — Public general info about a company

Schema.org gets you a name, a URL, and a logo. There's nothing canonical for jurisdiction + registry ID + stage + headcount band + canonical contact channel — the things an investor agent actually needs in the first 30 seconds.

### Gap 02 — Public structured business info, beyond the regulators

XBRL covers regulated financial filings for listed companies. The other ~99% of companies have no equivalent — no banded revenue, no growth band, no traction summary, no consistent way to publish "here is our shape" in a non-promotional, FCA-aware form.

### Gap 03 — Private, diligence-grade info, on the company's terms

OAuth gates access. It doesn't tell you what's behind the gate. Verifiable Credentials cover individual claims, not whole company files. Nobody has standardised the **shape** of the deal-grade detail an investor wants once they've been let in.

`agentic-first` fills these three. Everything else mentioned below is complementary.

---

## What exists today, at a glance

All of these are in production somewhere; none of them, on its own, gives an agent the answer to *"who is this company, and what do they want a serious reader to know?"*

| Standard | Owner | Covers | Doesn't cover |
| --- | --- | --- | --- |
| **Schema.org `Organization` / `Person`** | Schema.org community (Google, Microsoft, Yahoo, Yandex) | Name, URL, logo, address, social profiles, simple contact info — for SEO and rich results | Stage, funding, banded financials, structured contact preference, evidence-backed claims, anything diligence-grade |
| **OpenGraph & Twitter Cards** | Meta, then de-facto | Social-share previews — title, image, description | Anything a machine wants to *act* on |
| **XBRL / iXBRL** | XBRL International + national filing regulators | Mandatory machine-readable financial filings for listed firms (SEC EDGAR, Companies House, ESEF) | Private companies, banded summaries, anything outside the statutory P&L / balance sheet |
| **OAuth 2.0 / OIDC** | IETF / OpenID Foundation | Token-based authentication and consent for accessing a protected resource | The *shape* of the resource itself — OAuth doesn't tell you what's behind the gate, only that one is there |
| **W3C Verifiable Credentials + DIDs** | W3C | Cryptographically signed, issuer-attested individual claims (your degree, your professional licence, your KYC) | A whole company profile object; the day-to-day "this company has 11–50 staff" non-credential information |
| **GLEIF / LEI (ISO 17442)** | Global Legal Entity Identifier Foundation | 20-character globally unique legal-entity identifier, mandated for financial counterparties since 2017 | Anything beyond the identifier itself — not a profile, not a schema |
| **Companies House & equivalents** (Delaware, EDGAR, BvD/Orbis) | National registries | Statutory filings, directors, share capital, accounts (where required) | Anything voluntary, current, marketing-shaped, or under NDA; foreign jurisdictions |
| **ISO 8000 (data quality)** | ISO | Process and quality framework for master data management | Specific schemas; nothing immediately implementable |
| **`/.well-known/mcp.json`** | modelcontextprotocol working group (SEP-1960 / SEP-2127) | Discovery of an MCP server: endpoint, transport, tools, auth, capabilities | Identity of the publisher running the MCP — covers *protocol*, not *who* |
| **`/.well-known/agent-card.json`** | A2A protocol (Linux Foundation, IANA-registered Aug 2025) | An A2A agent's capabilities, identity, contact-on-behalf-of | The company or individual *behind* the agent |
| **`/llms.txt`** | De-facto | A Markdown index of your site for LLMs to read instead of crawling everything | Structure — by design it's narrative Markdown, not data |
| **`/agents-brief.txt`** | Draft v0.4, early 2026 | What an AI agent is permitted to *do* on your site (book, buy, submit) | Identity; this is permissions, not content |
| **JSON-LD context** | W3C | Linked-data serialisation; the syntax Schema.org rides on | Specific company / person vocabulary — JSON-LD is a transport, not a schema |

---

## How they compose

The standards above are not in conflict with `agentic-first`. The opinionated stack we recommend looks like this:

```
home page
  ├── Schema.org JSON-LD          → SEO, Knowledge Panel, current LLM crawlers
  ├── OpenGraph + Twitter Cards   → social previews
  ├── <link rel="agentic-profile">→ explicit discovery for agent-native readers
  ├── <link rel="alternate" type="application/llms.txt"> → LLM site index
  └── (optional) <link rel="agent-card"> if you run an A2A agent

/.well-known/
  ├── agentic-profile.json        → THIS standard (who you are)
  ├── mcp.json                    → if you run an MCP server (what protocol)
  ├── agent-card.json             → if you run an A2A agent (what capabilities)
  └── (existing) security.txt, openid-configuration, etc.

your private MCP (if you run one)
  └── agentic-first protected tier → diligence-grade detail behind your auth
```

A profile that includes a verified `company.lei` or `company.registry.id` carries a stronger trust signal than one that doesn't. A profile that points to an A2A `agent-card.json` lets a counterparty agent know how to talk to you. A profile that exposes `contact.private_mcp` lets a serious reader request access to the protected tier.

---

## Side-by-side with the closest neighbours

### vs. Schema.org `Organization`

| Property                    | Schema.org Organization                                   | agentic-first company-profile                                              |
| --------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------- |
| Where it lives              | JSON-LD inline on the page                                | One JSON file at a known well-known path                                   |
| Audience                    | Crawlers (Google, social), LLM crawlers (Claude, GPT)      | Agent-native readers (MCP-aware clients, investor agents)                  |
| Identity (registry, LEI)    | `identifier` is generic                                    | First-class `registry`, `lei`                                              |
| Funding / stage             | None                                                       | First-class                                                                 |
| Banded vs raw figures       | Raw                                                        | Banded by design                                                            |
| Evidence model              | Implicit                                                   | First-class `evidence[]`                                                    |
| Tier separation             | None                                                       | Public / protected                                                          |
| Tooling                     | SEO panels, structured-data testers                        | `agentic-first-validate`, the directory MCP                                 |

**Recommendation:** publish both. Schema.org for SEO and current crawlers; agentic-first for everything agent-native. They sit happily on the same page.

### vs. XBRL

XBRL is **mandatory machine-readable financial reporting** for listed companies. It's authoritative for the figures it covers, and it's enormous. `agentic-first` is voluntary, banded, and covers the 99% of companies that don't file XBRL plus the marketing-shaped data XBRL never tries to model (stage, traction, contact channel, fundraise intent).

If you file XBRL: keep filing. Add `agentic-first` for the discovery / pitch surface. Reference your filings under `evidence[]`.

### vs. Verifiable Credentials (W3C VC + DIDs)

VCs are the right tool for **issuer-attested individual claims** — your professional licence, your degree, a KYC attestation, an ISO 27001 certificate. They are signed by a third party and verifiable cryptographically.

`agentic-first` is the right tool for **publisher-attested profile data** — the company says "we are at Seed stage with 11–50 staff" and signs nothing more than the request to host the file at a domain it controls. The two compose: a v0.2 schema bump will let `credentials[]` and `evidence[]` carry VC URIs alongside plain URLs.

### vs. GLEIF / LEI

LEI is a 20-character globally unique identifier. It is not a profile. `company.lei` is a first-class field in the agentic-first schema; if you have an LEI, publish it. The directory's verifier will cross-check against the GLEIF API.

### vs. `/.well-known/mcp.json`

mcp.json describes **your MCP server** (its endpoint, tools, transport). agentic-first describes **the publisher behind the MCP server** (jurisdiction, registry, key people). A company that runs an MCP and wants to be discovered should publish both.

### vs. `/.well-known/agent-card.json`

agent-card describes **a single A2A agent's capabilities and contact channel**. agentic-first describes **the company or person behind the agent**. Both can live on the same domain.

### vs. `/llms.txt`

llms.txt is a **narrative Markdown index** for LLMs. It is, in practice, mostly adopted by developer-tooling and documentation sites — the natural audience is a *coding* agent (Cursor, Claude Code, Codex CLI) reading your docs to write code that integrates with your product. It is **not** a general convention that arbitrary AI agents consult to discover identity or structured data, and treating it as one would overstate its reach.

agentic-first is the opposite: a **structured JSON profile** at a known well-known path, parsed deterministically by any reading agent that knows the standard. The two are complementary and non-conflicting:

- If you publish dev-facing docs, publish `/llms.txt` so coding agents find your reference material — and inside it link to `/.well-known/agentic-profile.json` so a coding agent that's been pointed at the agentic-first standard finds your profile too. (This repo's [`llms.txt`](../llms.txt) does exactly that.)
- If you don't publish docs, don't bother with `/llms.txt` — publish the agentic-first profile and add Schema.org `Organization` JSON-LD on the home page, which is what current LLM crawlers actually consume.

---

## Where agentic-first fits

```
              describes content            describes capability      describes identity
                                                                     (the publisher)
              ─────────────────────       ──────────────────────    ──────────────────────

  for humans  HTML, blog posts            buttons, contact forms     "About us" pages
              ↓                            ↓                          ↓
  for         Schema.org JSON-LD          mcp.json                   ███ agentic-first ███
  agents      OpenGraph                   agent-card.json
              llms.txt                    agents-brief.txt
              robots.txt                                              (this slot was empty)
```

The slot in the bottom-right is where `agentic-first` sits. Nothing else lives there today.

---

## A starting point, not a fait accompli

This is v0.1.0. The spec is open, the schemas are open, the validator is open, the directory is open. If you think we've mis-mapped a standard above — or named a standard that we missed — please open an issue or PR. Prior-art arguments are exactly the kind of feedback that makes a v0.2 better.
