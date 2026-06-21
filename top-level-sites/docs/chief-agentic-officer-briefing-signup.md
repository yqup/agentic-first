# Chief Agentic Officer briefing signup

Date: 2026-06-20

## What changed

`chiefagenticofficer.com` now leads with the Chief Agentic Officer Briefing, uses a simplified signup form, and posts consented signups to MailerLite through the generated `/api/briefing-signup` endpoint.

Relevant commits:

- `0570c23` - simplified briefing funnel and signup form.
- `117b647` - top-level-sites runtime secret handoff for MailerLite.
- `b24a8bb` - consented CAO briefing signups are sent as active subscribers.

## MailerLite setup

- Group: `Chief Agentic Officer Briefing`
- Group id: `190738136197760503`
- Embedded form id: `190738240719816107`
- Runtime env variable: `CHIEFAGENTICOFFICER_MAILERLITE_API_TOKEN`
- Server container env variable: `MAILERLITE_API_TOKEN`

The MailerLite embedded form existed but was inactive/empty during testing, so the site uses the subscriber API directly.

## Fields

The site sends:

- `name`
- `country`
- `role`
- `board_issue`
- `signup_source`

MailerLite custom fields created to match the site payload:

- `role`
- `board_issue`
- `signup_source`

## Test result

Test subscriber verified in MailerLite:

- Email: `tony@yqup.com`
- Status: `active`
- Group: `Chief Agentic Officer Briefing`
- Fields: `Tony Wood`, `United Kingdom`, `C-suite / executive`, `AI governance`, `chiefagenticofficer.com`

## Learning

MailerLite API signups defaulted to `unconfirmed` when the request did not explicitly include active status. Because the site has its own consent checkbox, the endpoint now sends `status: active` and `resubscribe: true` after consent validation passes.

Keep MailerLite tokens out of git. On ANI, store the production token in:

```text
/srv/apps/top-level-sites/shared/.env
```

with:

```text
CHIEFAGENTICOFFICER_MAILERLITE_API_TOKEN=<token>
```

## Public MCP and agent-readable context

The Chief Agentic Officer site also exposes public, agent-readable context for the briefing:

- Human page: `https://chiefagenticofficer.com/for-agents/`
- Agent map: `https://chiefagenticofficer.com/llms.txt`
- Structured profile: `https://chiefagenticofficer.com/.well-known/agentic-profile.json`
- Public MCP: `https://chiefagenticofficer.com/mcp`

The main page panel, "A version your agent can read", should tell readers to pass the site to their assistant so it can understand the briefing, the categories, why the briefing is UK/EU board-focused, and how to use the public MCP when supported.

The copied agent prompt should lead with the MCP path:

```text
If your assistant supports MCP, connect to https://chiefagenticofficer.com/mcp first. Then read /for-agents/, /llms.txt, and /.well-known/agentic-profile.json.
```

The MCP is public, read-only context for the Chief Agentic Officer Briefing. It helps agents search and read public briefing context, understand categories, and cite the site correctly. It does not grant private access, authority to act, or legal, regulatory, audit, disclosure, financial, data protection, director, or management judgement.

Deployment notes:

- The generated edge Caddy config routes `/mcp` to the public CAO MCP service.
- The generated site still serves `/for-agents/`, `llms.txt`, and the agentic profile as static public context.
- The MailerLite signup route is separate and should remain unchanged by MCP copy or routing work.
