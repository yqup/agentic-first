# Agentic First

Agentic First is an operating stance for organisations preparing for a world where agents read, reason, and act alongside humans.

The practical idea is simple: humans should set intent, judgement, trust boundaries, and approval points. Agents should be able to find clean, source-owned information and use well-governed interfaces without scraping, guessing, or copying stale data between systems.

The first implementation in this repo is the Agentic First Directory, now kept under [`directory/`](./directory/).

## Why this exists

Websites were built for human browsing. Agentic workflows need something more durable:

- public facts that are structured and machine-readable
- sensitive facts behind explicit authentication and audit trails
- clear provenance for material claims
- stable interfaces agents can call safely
- human review where stakes are high

Agentic First is not "automate everything." It is a way to make organisations legible to agents while keeping accountability with people.

## Directory

The directory is the open profile standard and validator for companies and people who want to publish agent-readable facts from their own domain.

- Directory docs: [`directory/README.md`](./directory/README.md)
- Full standard: [`directory/SPEC.md`](./directory/SPEC.md)
- Schemas: [`directory/schemas/`](./directory/schemas/)
- Examples: [`directory/examples/`](./directory/examples/)
- Python validator: [`directory/python/agentic_first_schema/`](./directory/python/agentic_first_schema/)
- Migration notes: [`MIGRATION.md`](./MIGRATION.md)
- Routing plan: [`ROUTING.md`](./ROUTING.md)

Target public routes:

- `https://agentic-first.co/` - Agentic First umbrella site
- `https://agentic-first.co/directory/` - Directory product and standard
- `https://agentic-first.co/directory/mcp` - Directory MCP endpoint

Legacy compatibility:

- `https://agent-first.co/*` should redirect to `https://agentic-first.co/*`
- `https://directory.agentic-first.co/mcp` should proxy or redirect to `https://agentic-first.co/directory/mcp`

For MCP clients, proxying the legacy endpoint first is safer than an immediate redirect because some clients do not follow HTTP redirects reliably.

## Source Material

The broader Agentic First framing is developed in Tony Wood's writing:

- [Stop Paying The Data Tax](https://www.tonywood.org/white-papers/stop-paying-the-data-tax-the-agentic-first-website-playbook-leaders-are-quietly-switching-to/)
- [Why Your Company Website Should Become An AI-Readable Data Room](https://www.tonywood.org/writing/why-your-company-website-should-become-an-ai-readable-data-room-and-not-another-brochure-my-words-cleaned/)
- [Agent-First Is The New Survival Skill](https://www.tonywood.org/writing/your-business-is-about-to-enter-the-api-desert-agent-first-is-the-new-survival-skill/)

## Operational Notes

This repo prepares the content, standard, schemas, skills, and packaging for the new structure. DNS, redirects, and MCP proxying must be applied in the deployed routing layer after confirming the target environment.

Do not remove the legacy directory endpoint until access logs show it is quiet.
