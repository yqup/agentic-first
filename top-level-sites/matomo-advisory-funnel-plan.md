# TonyWood Advisory Funnel Plan

This funnel turns the top-level idea sites into measurable paths back to TonyWood.org advisory.

## Measurement Shape

Use Matomo-native campaign parameters on every link from a source site to TonyWood advisory:

- `mtm_campaign`: source-specific campaign, for example `chiefagenticofficer_to_tonywood_advisory`
- `mtm_source`: source domain, for example `chiefagenticofficer.com`
- `mtm_medium`: `referral`
- `mtm_content`: click placement, for example `hero_discuss_implementation`

This keeps the funnel readable even before any advanced Matomo campaign plugin is configured, while still giving source, medium, and content dimensions if Matomo Marketing Campaigns Reporting is enabled.

## Current Source Sites

| Source site | Matomo site ID | Campaign | Primary TonyWood path |
| --- | ---: | --- | --- |
| Chief Agentic Officer | 8 | `chiefagenticofficer_to_tonywood_advisory` | `/advisory/` |
| AIperations | 10 | `aiperations_to_tonywood_advisory` | `/advisory/` |
| Orchistra | 14 | `orchistra_to_tonywood_advisory` | `/advisory/` |
| TonyWood.org | 1 | receives campaign traffic | `/advisory/` |

## Funnel Stages

1. Source-site pageview: visitor lands on CAO, AIperations, or Orchistra.
2. Source-site intent click: visitor clicks a TonyWood advisory CTA; Matomo link tracking and a custom event record the click on the source site.
3. TonyWood campaign landing: visitor reaches `https://www.tonywood.org/advisory/` with `mtm_*` parameters.
4. Advisory action: visitor clicks `Discuss advisory`, gets the checklist, or takes the next contact action on TonyWood.org.
5. Qualified conversation: manually classify whether the resulting conversation is CAO implementation, AI operations, Orchistra/agent coordination, board governance, or other.

## Matomo Setup

Create one dashboard that compares:

- Source-site visits by site ID: 8, 10, 14.
- Source-site outbound clicks to `https://www.tonywood.org/advisory/`.
- TonyWood.org campaign visits for campaigns ending `_to_tonywood_advisory`.
- TonyWood.org advisory-page conversion actions.

Create source-site goals:

- `TonyWood advisory outbound click`: triggered by an outlink to `https://www.tonywood.org/advisory/`.
- Optional: segment by Matomo site ID so each source site can be compared separately.

Create TonyWood.org goals:

- `Advisory campaign landing`: page URL contains `/advisory/` and campaign contains `_to_tonywood_advisory`.
- `Advisory CTA click`: click on the primary advisory/contact route.
- `Checklist interest`: click or pageview for the checklist route.

## Marketing Use

Treat each source site as a specific entry point:

- CAO: role definition and implementation help.
- AIperations: one AI workflow, ownership, release gate, and operating value.
- Orchistra: agent coordination, visibility, audit trail, and practical oversight.

Use the first month to learn which source creates the best advisory conversation, not just the most visits. Review weekly:

- Which source gets attention?
- Which source produces the highest advisory-page arrival rate?
- Which CTA placement performs best?
- Which resulting conversations are most concrete?

Then refine page copy around the source that produces qualified advisory conversations, not vanity traffic.
