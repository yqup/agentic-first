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

## Agent-readable briefing context

The Chief Agentic Officer site exposes a public, agent-readable layer for the briefing:

- Main-page panel: `A version your agent can read`
- Human page: `https://chiefagenticofficer.com/for-agents/`
- Agent map: `https://chiefagenticofficer.com/llms.txt`
- Structured profile: `https://chiefagenticofficer.com/.well-known/agentic-profile.json`

The main-page panel should stay compact: it helps a reader pass the site to an assistant so the assistant understands the briefing, the signup categories, and why the briefing is UK/EU board-focused.

The generated public context is descriptive source material only. It does not grant private access, authority to act, or legal, regulatory, audit, disclosure, financial, data protection, director, or management judgement.

Current top-level-sites boundary:

- `/for-agents/`, `llms.txt`, and the agentic profile are served by the generated CAO site.
- The MailerLite signup route remains separate at `/api/briefing-signup`.
- This bundle no longer publishes or proxies a `/mcp` route for `chiefagenticofficer.com`; any future MCP service should be documented and deployed as a separate, explicit runtime.

## 2026-06-21 deployment note

The successful ANI deploy used release `top-level-sites-20260621T153854Z` from commit `4af180a` and wrote the receipt:

```text
/srv/deploy-state/top-level-sites/receipts/top-level-sites-20260621T153854Z.yaml
```

That release included the CAO `/mcp` edge route because the installed ANI deploy gate rejected release `top-level-sites-20260621T153732Z` with:

```text
ERROR: CAO Caddy fragment must include /mcp matcher
```

Afterwards, commit `ac1db11` reverted the `/mcp` route and returned the Agentic First top-level-sites source to the current boundary above: `/for-agents/`, `llms.txt`, and the structured profile are the public agent-readable surfaces in this bundle.

Before deploying the current source state, either update the ANI deploy gate so it no longer requires the CAO `/mcp` matcher, or intentionally restore an explicit CAO `/mcp` runtime and route. Do not treat this as a MailerLite change; the signup endpoint and server-side token handoff remain separate.
