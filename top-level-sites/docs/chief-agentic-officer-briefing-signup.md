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
