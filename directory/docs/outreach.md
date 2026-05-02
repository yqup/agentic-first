# First-cohort outreach

Standards die without a first 50 publishers. The point of this doc is
to give a polished, copy-paste ask you can send to specific people in
your network without retyping it for each one. Internal-facing only -
this lives in the public repo because anyone running their own standard
will want the same playbook.

The five-line shape, every time:

1. **What it is.** One sentence. Plain English.
2. **Why you, specifically.** One sentence. Concrete reason this person.
3. **What "yes" means.** A 10-minute action with a measurable outcome.
4. **The single link.** Either `https://agentic-first.co/directory/how/`
   or the GitHub repo - never both.
5. **A graceful out.** Something like "happy to do the JSON for you if
   you'd rather just paste it" or "no obligation, this is a standards
   land-grab and I'm picking the first 50 carefully."

## Templates by audience

### Founder, seed/Series-A B2B SaaS

> Hi <name>, two-line ask. I'm shipping the v0.1 of an open standard
> for machine-readable company profiles - the bit that PitchBook
> and Crunchbase have always done by scraping you. The v0.1 spec
> wants 50 founders publishing their own profile on their own domain
> by end of the month. <Their company> is on the list. Ten minutes,
> one JSON file at `/.well-known/agentic-profile.json`, and you
> become the canonical source of truth on yourself for every agent
> hitting your domain. Walkthrough: <https://agentic-first.co/directory/how/>.
> Happy to do the file for you if it's faster - send me your last
> deck and I'll send you the JSON to paste.

### NED / fractional / advisor

> Hi <name>, niche ask. I'm publishing v0.1 of an open standard for
> machine-readable personal profiles for people whose work isn't
> well-described by a LinkedIn page (multi-board NEDs, fractional
> CTOs/CFOs, advisors). The shape is the same as the company one but
> tuned for "current roles + banded past-roles count + credentials
> + evidence". I'd love your profile to be one of the first 20 live.
> Walkthrough: <https://agentic-first.co/directory/how/>. Ten minutes, one
> JSON file on your own site, indexed by the open directory.

### Developer / agent builder

> Hi <name>, technical ask. I've shipped v0.1 of an open standard for
> machine-readable company and personal profiles. The schemas, the
> Python validator, and three ready-made author skills (generic prompt,
> Claude SKILL.md, Codex SKILL.md) are all on GitHub:
> <https://github.com/yqup/agentic-first>. There's a live directory
> MCP at `agentic-first.co/directory/mcp` - no auth for read.
> Two asks: (1) skim the SPEC and tell me what I got wrong, and
> (2) drop one of the author skills into your own agent and try it
> against your own company's site. Bug reports as GitHub issues, please.

### Accelerator / VC platform team

> Hi <name>, structural ask. We've shipped v0.1 of an open standard
> for machine-readable company profiles. It's the missing layer between
> Schema.org (content) and XBRL (regulated financial filings) - the
> bit you'd want every portfolio company to publish so your sourcing
> agent doesn't have to scrape. There's a directory MCP that any
> agent can hit; portfolio comparisons across cohorts become structured
> queries, not Notion docs. The fastest possible adoption is one batch
> publish across <fund> portfolio - 30 companies all at once, same
> JSON file at `/.well-known/agentic-profile.json` on each of their
> sites. Walkthrough: <https://agentic-first.co/directory/how/>. Happy to
> do the heavy lifting on the first cohort.

## Tracking

Keep a simple table in your usual notes app. The five columns:

| Person | Sent | Replied | Published | Notes |
|---|---|---|---|---|

The point of `Published` is to give yourself permission to follow up
once and then stop. Asks-published ratio across the first 100 will
tell you whether the standard is land-grabbed-able or whether the
incentive needs sharpening.

## Anti-patterns

- **Don't send the SPEC link to a non-developer.** They will bounce.
  Send `/how/` instead.
- **Don't ask for "thoughts" or "feedback".** Ask for a 10-minute
  publish or a 30-minute call. Anything fuzzier is read as "I'm not
  sure what I want from you" and goes to the bottom of an inbox.
- **Don't promise distribution.** "Get on our directory" is the
  benefit, but the directory has zero readers on day one. Pitch
  the canonical-control angle (you stop being a broker's row), not
  the discovery angle (which doesn't exist yet).
- **Don't open-source the outreach list.** Aggregating prospect names
  with permission status anywhere public is a GDPR problem. Keep this
  in your notes app, not in this repo.
