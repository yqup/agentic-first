# agentic-first

> A small, open JSON contract that companies and individuals publish on their own website so AI agents can read who they are without scraping.

Agents are becoming the primary consumer of company information. The existing structured-data conventions (Schema.org, OpenGraph) describe **content**, not **identity** or **capability**. The people best placed to describe a company or a person are the company or the person themselves — not a third-party data broker.

`agentic-first` is the smallest, opinionated JSON contract that fills that gap. You publish one file at a known location on your domain, agents fetch it, you stay in control.

```
https://your-company.example/.well-known/agentic-profile.json
```

That's it. There's a public tier (anyone can read) and a protected tier (served from your own MCP behind your own auth). The directory at [directory.agentic-first.co](https://directory.agentic-first.co/mcp) crawls the public tier and never touches the protected tier.

---

## In 60 seconds

```jsonc
{
  "schema_version": "0.1.0",
  "updated_at": "2026-04-19T00:00:00Z",
  "profile_kind": "company",
  "tier": "public",
  "company": {
    "name": "Acme Robotics",
    "website": "https://acme-robotics.example",
    "jurisdiction": "GB",
    "registry": {
      "type": "companies-house",
      "id": "12345678",
      "url": "https://find-and-update.company-information.service.gov.uk/company/12345678"
    },
    "industry": ["robotics", "b2b-saas"],
    "tagline": "Vision-language models for warehouse pick-and-place."
  },
  "stage":   { "current": "Seed" },
  "funding": { "total_raised_band": "1m-5m", "currency": "GBP" },
  "team":    { "headcount_band": "11-50" },
  "metrics": { "revenue_band": "100k-500k", "growth_band": "100-300%" },
  "contact": {
    "preferred_channel": "form",
    "form_url": "https://acme-robotics.example/contact",
    "private_mcp": "https://private-mcp.acme-robotics.example/mcp"
  }
}
```

The public-tier metrics use **bands** (e.g. `"1m-5m"`, `"11-50"`) rather than precise figures. This is deliberate: it keeps the public surface clear of UK FCA financial-promotion rules while still letting an AI agent answer "is this company at my stage?".

If you want to share precise figures, fundraise detail, NDA-protected logos, references, or live pipeline data, you serve the **protected tier** from your own MCP server, behind your own auth, to principals you've explicitly authorised. The directory never sees it.

---

## Pick your starting point

| If you want to...                                                              | Read                                                                                                                                                                                |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Publish a profile manually** (copy-paste, edit fields, drop on your website) | [`SPEC.md`](./SPEC.md) and one of the [`examples/`](./examples/)                                                                                                                    |
| **Have an AI agent generate the file with you**                                | Pick a skill from [`skills/`](./skills/) and feed it to your agent                                                                                                                  |
| **Build a reading agent** (one that consumes profiles)                         | Pick a `*-reader` skill from [`skills/`](./skills/) and read [`docs/reader-handling.md`](./docs/reader-handling.md)                                                                  |
| **Validate a profile in code**                                                 | `pip install agentic-first-schema` &nbsp;&middot;&nbsp; see [`python/agentic_first_schema/`](./python/agentic_first_schema/)                                                        |
| **Validate a profile from the shell**                                          | `pip install agentic-first-schema && agentic-first-validate ./agentic-profile.json`                                                                                                 |
| **Embed your profile (every popular host: Squarespace, Wix, WP, Shopify, …)**  | [`docs/embed-recipes.md`](./docs/embed-recipes.md)                                                                                                                                  |
| **See how `agentic-first` relates to LEI / XBRL / VCs / Schema.org / mcp.json** | [`docs/landscape.md`](./docs/landscape.md)                                                                                                                                          |
| **Understand the security model** (publisher rules, prompt-injection defence)   | [`docs/security-policy.md`](./docs/security-policy.md)                                                                                                                              |

---

## The four schemas

| Schema                       | Tier      | Lives where                                  | Crawled by directory? |
| ---------------------------- | --------- | -------------------------------------------- | --------------------- |
| `company-profile`            | public    | `/.well-known/agentic-profile.json`          | Yes                   |
| `personal-profile`           | public    | `/.well-known/agentic-profile.json`          | Yes                   |
| `company-private-profile`    | protected | Your private MCP, behind auth                | No, ever              |
| `personal-private-profile`   | protected | Your private MCP, behind auth                | No, ever              |

All four are immutably versioned at canonical URLs:

```
https://directory.agentic-first.co/schemas/company-profile/0.1.0.json
https://directory.agentic-first.co/schemas/personal-profile/0.1.0.json
https://directory.agentic-first.co/schemas/company-private-profile/0.1.0.json
https://directory.agentic-first.co/schemas/personal-private-profile/0.1.0.json
```

Same schemas live in this repo at [`schemas/`](./schemas/) — pick whichever source is cheaper for your toolchain.

---

## Repo layout

```
agentic-first/
├── README.md                     this file
├── SPEC.md                       the full written standard
├── LICENSE                       MIT
├── llms.txt                      machine-readable index for AI agents
├── schemas/                      4 canonical JSON Schemas (versioned)
├── skills/                       drop-in skills for AI agents
│   ├── agentic-first.agent-prompt.md            generic, any LLM (publisher)
│   ├── agentic-first-reader.agent-prompt.md     generic, any LLM (reader)
│   ├── claude/agentic-first/SKILL.md            Claude (publisher)
│   ├── claude/agentic-first-reader/SKILL.md     Claude (reader)
│   ├── codex/agentic-first/SKILL.md             Codex (publisher)
│   └── codex/agentic-first-reader/SKILL.md      Codex (reader)
├── examples/                     4 example profiles (one per schema)
├── docs/
│   ├── security-policy.md        threat model, publisher rules, rejected patterns
│   ├── reader-handling.md        how a reading agent should treat profile prose
│   ├── embed-recipes.md          how to host on every major platform
│   └── landscape.md              relationship to LEI / XBRL / VCs / Schema.org / mcp.json
└── python/agentic_first_schema/  Python validator + `agentic-first-validate` CLI
```

---

## The directory

The directory at [`directory.agentic-first.co`](https://directory.agentic-first.co/mcp) is an MCP-native registry of every public profile that has been submitted. It exposes:

| Tool / endpoint               | What it does                                                                              |
| ----------------------------- | ----------------------------------------------------------------------------------------- |
| `submit_website` (MCP tool)   | Validate a website's `/.well-known/agentic-profile.json` and add it to the index          |
| `search_profiles` (MCP tool)  | Find profiles by industry, jurisdiction, stage, etc.                                      |
| `get_profile` (MCP tool)      | Fetch a single profile by domain                                                          |
| `GET /healthz`                | Liveness JSON (directory version, schema version, indexed count)                          |
| `GET /schemas/...`            | The four canonical schemas, immutably versioned                                           |

You can call `submit_website` from any MCP-aware client (Claude Desktop, Cursor, etc.) pointed at `https://directory.agentic-first.co/mcp`, or directly via curl:

```bash
curl -sS -X POST https://directory.agentic-first.co/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call",
       "params":{"name":"submit_website",
                 "arguments":{"domain":"your-domain.example"}}}'
```

The directory itself is a small Python service. It's not in this repo (yet). The standard, schemas, validator, and skills — everything you need to **publish, read, validate, and adopt** — are.

---

## Versioning

Schemas are SemVer. Breaking changes bump the major version with a 90-day deprecation window during which both versions validate. Minor and patch versions are additive only and never reject previously-valid documents. The schema URL itself carries the version, so the bytes never change.

The current schema version is **0.1.0** (every example, every skill, every doc in this repo).

---

## Contributing

Issues and PRs welcome. The smallest useful contribution is **publishing your own profile** and submitting it to the directory — that's the validation the standard most needs right now.

Decisions of consequence will land as ADRs in [`docs/adr/`](./docs/) once we have any worth recording.

## License

MIT. See [`LICENSE`](./LICENSE).
