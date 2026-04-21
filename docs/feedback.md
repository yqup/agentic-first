# Feedback ingest

> **Tell us what's missing or broken without trusting us first.** The directory at `directory.agentic-first.co` accepts free-text feedback through one HTTP endpoint and one MCP tool. The pipeline is **deterministic, code-only**: nothing you submit is ever passed to a model, served back over HTTP, used to generate an automated reply, or surfaced through the directory's read tools. Triage is human-only.

This page is the contract that promise makes. If anything below is not true of the running directory, it's a bug — please report it the same way.

---

## TL;DR

| You are…                                | Use this                                                                                                                |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **A human with a browser**              | <https://www.agentic-first.co/feedback/>                                                                                |
| **An agent inside an MCP session**      | Call the `submit_feedback` tool on `https://directory.agentic-first.co/mcp` (same endpoint as `submit_website` etc.)    |
| **A script / curl / non-MCP client**    | `POST https://directory.agentic-first.co/feedback` with JSON or `application/x-www-form-urlencoded`                     |
| **You want a round-trip you can see**   | File an issue at <https://github.com/yqup/agentic-first/issues> instead — that surface is human-mediated and visible    |

---

## What you submit

A single JSON object (or form payload) with these fields:

| Field           | Type     | Required | Cap        | Notes                                                                                              |
| --------------- | -------- | -------- | ---------- | -------------------------------------------------------------------------------------------------- |
| `message`       | string   | yes      | 4 000 chars | Free-text. The thing you actually want to tell us.                                                 |
| `category`      | enum     | no       | —          | One of `missing-field`, `wrong-info`, `bug`, `confused`, `other`. Anything else returns `enum_invalid`. |
| `email`         | string   | no       | 200 chars  | Optional contact address. We only use it if we need to clarify what you sent.                      |
| `domain`        | string   | no       | 253 chars  | The profile / domain your feedback is about, if any.                                               |
| `agent`         | string   | no       | 200 chars  | Free-text identifier of the agent / model / tool you were using when this came up. Helps triage.    |
| `submitted_via` | string   | no       | 50 chars   | `web`, `mcp`, `curl`, etc. Set automatically by the HTML form and the MCP tool; you can override.   |

The total request body is capped at 16 KiB regardless of which fields you fill in.

### Example — JSON

```bash
curl -sS -X POST https://directory.agentic-first.co/feedback \
  -H 'content-type: application/json' \
  -d '{
        "category": "missing-field",
        "message": "There is no way to express that a company is dual-listed (LSE + Nasdaq). The schema only takes one jurisdiction.",
        "agent": "claude-4.6-sonnet via Claude Desktop",
        "submitted_via": "curl"
      }'
```

Response on success:

```json
{ "ok": true, "id": "fb_2026-04-21T18-41-09Z_3f9e2a" }
```

Response on rejection (deterministic codes only — see below):

```json
{ "ok": false, "error": { "code": "too_long", "field": "message", "detail": "message exceeds 4000 characters after sanitisation" } }
```

### Example — MCP tool

If you're already inside a session against `https://directory.agentic-first.co/mcp`, use the `submit_feedback` tool. The argument shape is identical to the JSON body above and the response envelope is identical.

```jsonc
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "submit_feedback",
    "arguments": {
      "category": "confused",
      "message": "The reader skill says to call get_company, but the directory's tool list calls it search_companies. Which is canonical?",
      "agent": "codex-cli"
    }
  }
}
```

---

## What the directory does on receipt

The whole pipeline lives in `pitch_api.feedback` on the directory side. In order, on every submission:

1. **Edge rate-limit.** Caddy first: 5 events/min/IP on `/feedback`. If you blow past it, you get a Caddy `429` before Starlette even sees the request.
2. **Body cap.** Anything over 16 KiB is rejected with `body_too_large`.
3. **Per-IP + global rate-limits.** Starlette next: defaults are 3/min and 20/hour per IP, plus a global 30/min cap across all IPs. All four are env-tunable on the host (`PITCH_FEEDBACK_PER_MIN`, `_PER_HOUR`, `_GLOBAL_PER_MIN`).
4. **Validate.** Length caps, type checks, the `category` enum. Failures return one of the deterministic codes listed below.
5. **Sanitise.** The same `pitch_schema.security.sanitize_text` / `scan_text` pair the publisher pipeline uses. Strips zero-width and other unsafe code points; rejects anything matching the prompt-injection rejected-pattern list (the same list `docs/security-policy.md` describes).
6. **Hash IP.** Your IP is HMAC-SHA-256-hashed with a per-deploy random salt (`PITCH_FEEDBACK_IP_SALT`) before storage. The raw IP is never written to disk. The salt is rotated per deploy by default, so even hashes can't be cross-correlated across deploys.
7. **Append.** The validated entry, plus an audit record of which unicode classes the sanitiser stripped (so the operator can see at triage time what got silently scrubbed), is appended to a JSONL quarantine file on disk inside the directory's data volume. Append-only; fsync per write.
8. **Respond.** JSON success / JSON error for agents and curl callers. The HTML form gets the same outcome rendered as a small inline thank-you / error page.

That's the entire pipeline. There is no step in which an LLM is called, a webhook is fired, an email is sent, or the file is read back over the network.

---

## What the directory **does not do**

These are guarantees, not aspirations. They are properties of the code, not promises in a privacy notice.

- **No LLM ever reads what you submit.** The feedback module is wired to `JsonlFeedbackStore.append`. There is no other consumer in the API process. No `mcp.tool` returns it. No background job reads it.
- **The quarantine file is never served back over HTTP.** Caddy's allowlist on `directory.agentic-first.co` exposes `/mcp`, `/healthz`, `/schemas/*`, and `/feedback` (POST only). There is no path that reads `data/feedback/quarantine.jsonl`.
- **No automated reply.** If you set `email`, we will only use it if a human operator decides to follow up by hand. There is no auto-acknowledgement mailer wired to this pipeline.
- **No raw IPs on disk.** Only the HMAC-SHA-256 hash with a per-deploy salt.
- **No surfacing in `search_companies` / `get_company` / any read tool.** Feedback is not a profile. It will never appear in the directory's index, scoring, or search results.

---

## Deterministic rejection codes

If your submission is rejected, the response always has shape `{ "ok": false, "error": { "code": "...", "field": "...", "detail": "..." } }` with `code` drawn from this fixed set:

| Code               | When it fires                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| `type_invalid`     | A field is the wrong JSON type (e.g. `category` sent as a number).                              |
| `too_long`         | A field exceeded its character cap **after** sanitisation.                                      |
| `enum_invalid`     | `category` was not one of the allowed values.                                                   |
| `rejected_pattern` | The sanitiser matched a pattern from the prompt-injection rejected-pattern list inside any field. |
| `body_too_large`   | Total request body exceeded 16 KiB.                                                             |
| `rate_limited`     | You hit one of the per-IP or global rate limits.                                                |

There is no `internal_error`, `unknown`, or `try_again_later` outcome. If you see anything outside this list, it's a bug worth reporting via GitHub issues.

---

## Why this contract exists

Three reasons, in order of weight:

1. **Adversarial input.** Feedback is the obvious surface for someone to test prompt-injection payloads against the directory. Making the read path code-only means there is no LLM to inject *into* via this surface, by construction. The injection-resistance debate stops at the perimeter.
2. **Honest expectations.** "Submit feedback" tools usually imply a round-trip. This one doesn't. Saying so up-front, on the form and in this doc, is more useful than dressing up a one-way file as a conversation.
3. **Triage discipline.** A JSONL quarantine forces an operator to actually look at what's been submitted, on a cadence they choose, with `tail -f` and `jq`. Anything richer (an inbox, a queue UI, a support tool) builds in the assumption that the operator is online — which they may not be.

If you want a richer round-trip, file an issue: <https://github.com/yqup/agentic-first/issues>. That's the human-mediated surface, and it visibly closes loops.
