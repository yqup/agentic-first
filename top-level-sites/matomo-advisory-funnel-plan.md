# TonyWood Analytics North Star

The North Star for the top-level sites is simple: move qualified visitors from Tony Wood's owned topical domains to Tonywood.org advisory, so public ideas become useful advisory conversations.

Every source site keeps its own meaning, but the shared commercial destination is:

```text
https://www.tonywood.org/advisory/
```

## Measurement Shape

Use Matomo-native campaign parameters on links from each source site to Tonywood.org:

- `mtm_campaign`: source-specific campaign, for example `aiperations_com_to_tonywood_advisory`
- `mtm_source`: source domain, for example `aiperations.com`
- `mtm_medium`: `referral`
- `mtm_content`: click placement, for example `final_review_workflow`

Locally rendered CTAs also emit a Matomo event:

- Category: `TonyWood north star funnel`
- Action: `source_to_tonywood_advisory` or `source_to_tonywood_writing`
- Label: source, campaign, and click placement

This keeps the funnel readable before any advanced Matomo configuration, while still giving campaign, source, medium, content, and event dimensions.

## Source Map

| Source site | Matomo site ID | Primary conversion | Site-specific goal |
| --- | ---: | --- | --- |
| YQUP | 5 | `qualified_consulting_enquiry` | Consulting conversations with CEOs and boards who need clarity on AI, governance, and agentic work. |
| SNAXK | 6 | `judgement_boundary_conversation` | Conversations about judgement, judgement boundaries, evaluation, and decision support for long-running agentic systems. |
| My Agentic | 7 | `agentic_url_interest` | Qualified interest in URL homes, profiles, owners, boundaries, and status pages for agentics. |
| Chief Agentic Officer | 8 | `cao_role_advisory_conversation` | Demand for Chief Agentic Officer as an accountable role for agentic AI ownership, boundaries, tools, cadence, and board confidence. |
| Agentic Leader | 9 | `agentic_leadership_learning_progression` | Help current and next-generation leaders learn how to work with agentics. |
| AIperations | 10 | `ai_operations_workflow_review` | Operations conversations around turning AI pilots into SOP-backed workflows, owners, gates, review cadence, and measurable outcomes. |
| Agentic Board | 11 | `agentic_board_advisory_conversation` | Board-level conversations about agentic board members, governance, oversight, assurance, and board-ready practice. |
| Dilijenz | 12 | `governance_diligence_interest` | Governance and diligence interest around simpler board evidence, routine checks, risk visibility, and ongoing assurance. |
| Syndesy | 13 | `capital_raise_advisory_conversation` | Consulting conversations with businesses that need help preparing, evidencing, and telling a capital-raising story. |
| Orchistra | 14 | `agentic_coordination_product_interest` | Interest in a field map for signals, agent coordination, channel history, audit trail, and human-visible oversight. |
| Tonywood.org | 1 | receives campaign traffic | Advisory landing, contact, and follow-on conversion surface. |

## Funnel Stages

1. Source-site pageview: visitor lands on one of the topical domains.
2. Source-site intent click: visitor clicks a tracked Tonywood CTA or writing link.
3. Tonywood campaign landing: visitor reaches Tonywood.org with `mtm_*` parameters.
4. Advisory action: visitor clicks the primary advisory/contact route or consumes the next advisory material on Tonywood.org.
5. Qualified conversation: manually classify whether the resulting conversation is consulting, judgement boundaries, CAO role, AI operations, board governance, diligence, capital raising, agent coordination, or agentic leadership.

## Matomo Setup

Create one dashboard that compares:

- Source-site visits by site ID: 5 through 14.
- Source-site outbound clicks and `TonyWood north star funnel` events.
- Tonywood.org campaign visits for campaigns ending `_to_tonywood_advisory`.
- Tonywood.org advisory-page conversion actions.
- Manually qualified conversations by source campaign.

Create source-site goals:

- `Tonywood outbound click`: triggered by an outlink to `https://www.tonywood.org/`.
- `Tonywood advisory outbound click`: triggered by an outlink to `https://www.tonywood.org/advisory/`.
- `Tonywood writing progression`: triggered by event action `source_to_tonywood_writing`.

Create Tonywood.org goals:

- `Advisory campaign landing`: page URL contains `/advisory/` and campaign contains `_to_tonywood_advisory`.
- `Advisory CTA click`: click on the primary advisory/contact route.
- `Checklist interest`: click or pageview for any advisory checklist route.

## Weekly Review

Review weekly for signal quality, not vanity traffic:

- Which source gets attention?
- Which source produces the highest Tonywood.org arrival rate?
- Which source produces the most concrete advisory conversations?
- Which CTA placement works best?
- Which topic is pulling people toward writing but not yet advisory?
- Which source needs clearer copy, a stronger CTA, or a different Tonywood landing path?

Then refine page copy around qualified conversations, not raw visits.
