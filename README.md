# Agentic First

Agentic First is an operating stance for organisations preparing for a
world where agents read, reason, and act alongside humans.

The practical idea is simple: humans set intent, judgement, trust
boundaries, and approval points. Agents find clean, source-owned
information and use well-governed interfaces without scraping, guessing,
or copying stale data between systems.

This repo now owns the **top-level Agentic First route map** for
company-first agentic creation.
The product surfaces live in the sibling
[`pitch-mcp`](https://github.com/yqup/pitch-mcp) repo:

- **Open Company Information** at `/companies/` - source-owned company/person
  profiles, schemas, validation, examples, skills, feedback, health, and MCP.
  This is the way companies and people put public information online so agents
  can find, verify, and use the right facts.
- **Open Tool Directory** at `/directory/` - the agentic tool catalog for
  tools, standards, models, runtimes, protocols, and operations surfaces.

## Routes

- `https://agentic-first.co/` - top-level Agentic First route map.
- `https://agentic-first.co/companies/` - Open Company Information, served from `pitch-mcp`.
- `https://agentic-first.co/companies/mcp` - company/profile MCP endpoint, served from `pitch-mcp`.
- `https://agentic-first.co/companies/healthz` - company/profile health endpoint, served from `pitch-mcp`.
- `https://agentic-first.co/companies/schemas/` - company/profile schemas, served from `pitch-mcp`.
- `https://agentic-first.co/companies/feedback` - company/profile feedback endpoint, served from `pitch-mcp`.
- `https://agentic-first.co/directory/` - Open Tool Directory, served from `pitch-mcp`.
- `https://agentic-first.co/directory/llms.txt` - Open Tool Directory machine index, served from `pitch-mcp`.
- `https://agent-first.co/*` - memorable alternate domain; redirects to the same path on `agentic-first.co`.

Keep `https://directory.agentic-first.co/mcp` available during the
migration. Proxying is safer than redirecting for MCP clients until
client compatibility is confirmed.

## Repo Layout

- `BRAND-GUIDELINES.md` - visual system and Pitch implementation handoff.
- `www/` - top-level static site for `agentic-first.co`.
- `www/llms.txt` - machine-readable index for agents.
- `deploy/` - deployment contract, release archives, and handoff rules.
- `deploy-request.yaml` - current release request for Annie/Kody/Codex.
- `ROUTING.md` - canonical route plan and migration guardrails.
- `MIGRATION.md` - notes from the first restructure and deployment discovery.

## Source Material

The broader Agentic First framing is developed in Tony Wood's writing:

- [Stop Paying The Data Tax](https://www.tonywood.org/white-papers/stop-paying-the-data-tax-the-agentic-first-website-playbook-leaders-are-quietly-switching-to/)
- [Why Your Company Website Should Become An AI-Readable Data Room](https://www.tonywood.org/writing/why-your-company-website-should-become-an-ai-readable-data-room-and-not-another-brochure-my-words-cleaned/)
- [Agent-First Is The New Survival Skill](https://www.tonywood.org/writing/your-business-is-about-to-enter-the-api-desert-agent-first-is-the-new-survival-skill/)

## Operational Notes

This repo should stay small. Product-specific standards, schemas,
validators, services, and adoption docs should live with their product
repos and be mounted into the public site by route.

Top-level static releases may self-deploy only through the app-specific
Ani deployment gate after publishing an immutable GitHub release archive.
That gate is not normal SSH; it accepts only `deploy <release-id>
<sha256>` and can update only the existing `agentic-first` static site.

Any change to `/companies/*`, `/directory/*`, `pitch-mcp`, Caddy, DNS,
public routes, ports, secrets, containers, or another app still needs Tony/top-level
approval and an operator handoff. See [`deploy/README.md`](./deploy/README.md)
for the deployment contract and handoff format.

Before packaging homepage changes, run the bundled link checker:

```bash
python3 deploy/check-homepage-links.py --root www
```
