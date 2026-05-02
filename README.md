# Agentic First

Agentic First is an operating stance for organisations preparing for a
world where agents read, reason, and act alongside humans.

The practical idea is simple: humans set intent, judgement, trust
boundaries, and approval points. Agents find clean, source-owned
information and use well-governed interfaces without scraping, guessing,
or copying stale data between systems.

This repo now owns the **top-level Agentic First site and route map**.
The Directory product, standard, schemas, validator, examples, skills,
MCP service, and Directory static pages live in the sibling
[`pitch-mcp`](https://github.com/yqup/pitch-mcp) repo.

## Routes

- `https://agentic-first.co/` - umbrella site for the broader stance.
- `https://agentic-first.co/directory/` - Directory product area, served from `pitch-mcp`.
- `https://agentic-first.co/directory/mcp` - Directory MCP endpoint, served from `pitch-mcp`.
- `https://agent-first.co/*` - memorable alternate domain; redirects to the same path on `agentic-first.co`.

Keep `https://directory.agentic-first.co/mcp` available during the
migration. Proxying is safer than redirecting for MCP clients until
client compatibility is confirmed.

## Repo Layout

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

Deployments are handoff-only. See [`deploy/README.md`](./deploy/README.md)
for the required Annie message format and the rule that Agentic First
does not request SSH, sudo, Docker, Caddy, DNS, or secrets.
