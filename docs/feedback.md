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

| Field              | Type   | Required | Cap (chars) | Notes                                                                                                          |
| ------------------ | ------ | -------- | ----------- | -------------------------------------------------------------------------------------------------------------- |
| `subject`          | string | yes      | 200         | A one-line headline. Required after sanitisation — empty after stripping returns `required`.                    |
| `body`             | string | yes      | 4 000       | The thing you actually want to tell us. Required after sanitisation.                                            |
| `submitter_handle` | string | no       | 100         | Optional contact handle (email, GitHub username, MCP client name). We only use it if a human operator follows up.|
| `submitter_kind`   | enum   | no       | —           | One of `agent`, `human`, `unknown`. Defaults to `unknown` if absent.                                            |
| `context`          | object | no       | —           | Optional dict. Allowed keys: `page`, `model`, `task`. Each value is a string capped at 200 chars. Unknown keys are rejected with `unknown_key`. |
| `dry_run`          | bool   | no       | —           | Validate the submission against every rule below and return the same envelope you'd get on a real submit, but **do not** append to the quarantine. See [Dry-run mode](#dry-run-mode). |

Wire-level limits:

- HTTP request body: **16 KiB** maximum (returns HTTP 413 with `too_large` above this).
- Total entry size after JSON encoding: **8 192 bytes** (returns 422 with `too_large` if a sneaky unicode payload bloats past field caps).
- Per-IP: **3 / minute** and **20 / hour**.
- Global: **30 / minute** across all IPs.
- All four limiters are env-tunable on the host (`PITCH_FEEDBACK_PER_MIN`, `_PER_HOUR`, `_GLOBAL_PER_MIN`).

### Example — JSON

```bash
curl -sS -X POST https://directory.agentic-first.co/feedback \
  -H 'content-type: application/json' \
  -d '{
        "subject": "Schema can't express dual-listing",
        "body": "There is no way to say a company is dual-listed (LSE + Nasdaq). The schema only takes one jurisdiction.",
        "submitter_kind": "agent",
        "context": { "model": "claude-4.6-sonnet via Claude Desktop" }
      }'
```

Response on success (HTTP 200):

```json
{
  "ok": true,
  "id": "fb_3f9e2a1c4b7d8e6a",
  "raw_status": "quarantined",
  "review_status": "unread"
}
```

Response on rejection (HTTP 422 — deterministic codes only, see below):

```json
{
  "ok": false,
  "errors": [
    { "code": "too_long", "field": "body", "detail": "body exceeds 4000 characters after sanitisation" }
  ]
}
```

`errors` is always a list — multiple rejections can fire at once on a single request.

### Quoting code in feedback (backtick relaxation)

A common case: you want to report "Gamma strips `<script>` blocks" or paste a fenced code block showing what your host did to a snippet. Without help, the prompt-injection scanner would see `<script>` and reject the whole submission with `rejected_pattern` on `body`.

The feedback endpoint runs the scanner with `code_safe=True`, which masks the inside of:

- single backticks: `` `<script type="application/agentic-profile+json">` ``
- triple-backtick fenced blocks (with or without a language tag):

  <pre>```html
  &lt;script type="application/agentic-profile+json"&gt;
    { "company": { "name": "Acme" } }
  &lt;/script&gt;
  ```</pre>

before pattern-matching runs. So markup *quoted as code* in your bug report passes; the same markup *outside* backticks is still rejected. This relaxation only applies to the feedback path — the publisher pipeline (the one that ingests profile JSON over `submit_website`) still scans without it.

Trade-off worth knowing: backtick masking is regex-broad, not HTML-aware. A bad actor *could* wrap an imperative jailbreak in backticks and slip past `rejected_pattern`. We accept that because (a) feedback is never read back to a model — see [What the directory does not do](#what-the-directory-does-not-do) — and (b) human triage will see it. If you want stricter behaviour for your own reuse of `pitch_schema.security.scan_text`, leave `code_safe=False` (the default).

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
      "subject": "Reader skill confused about tool name",
      "body": "The reader skill says to call get_company, but the tool list calls it search_companies. Which is canonical?",
      "submitter_kind": "agent",
      "context": { "model": "codex-cli", "task": "diligence" }
    }
  }
}
```

### Example — HTML form

If you're a human with a browser, the page at <https://www.agentic-first.co/feedback/> renders the same fields as a small form. The page works without JavaScript (`<noscript>` posts the form `application/x-www-form-urlencoded`); the JS path upgrades to AJAX with a live character counter and inline success / error rendering. The form maps cleanly onto the wire fields above. A "Validate without submitting" checkbox sets `dry_run=on` for the next post.

### Dry-run mode

If you're an agent — or a human iterating in `curl` — and you want to know *whether* your submission would be accepted without actually filing it, set `dry_run: true` (JSON) or `dry_run=on` (form). The directory will:

1. Run every check in [the pipeline](#what-the-directory-does-on-receipt) up to and **excluding** step 8 (`Append`).
2. Return the same envelope shape, with these substitutions on success:

```json
{
  "ok": true,
  "dry_run": true,
  "id": null,
  "raw_status": "would_quarantine",
  "review_status": "would_be_unread",
  "would_persist_bytes": 412
}
```

A rejection in dry-run mode is byte-for-byte identical to a real rejection — same HTTP status (422 / 413 / 400), same `errors` array, same codes from the table below. So you can wire dry-run into a CI pre-commit, a publisher tool, or an agent self-check without ever cluttering the operator's quarantine queue.

`would_persist_bytes` is the size the entry *would* occupy in JSONL on disk after sanitisation, so you can confirm you're well under the 8 192-byte post-encoding cap.

Dry-run requests still consume rate-limit budget — both per-IP and global — by design. We don't want a "validate-only" loophole that lets a script probe pattern boundaries at full speed without ever showing up in `429` counters.

---

## What the directory does on receipt

The whole pipeline lives in `pitch_api.feedback` on the directory side. In order, on every submission:

1. **Edge rate-limit.** Caddy first: 5 events/min/IP on `/feedback`. If you blow past it, you get a Caddy `429` before Starlette even sees the request.
2. **Per-IP + global rate-limits in the app.** Starlette next: defaults are 3/min and 20/hour per IP, plus a global 30/min cap across all IPs. Both return HTTP 429.
3. **HTTP body cap.** Anything over 16 KiB is rejected with HTTP 413 + `too_large`.
4. **Parse.** JSON requests must parse cleanly (HTTP 400 + `invalid_json` otherwise). Form-encoded requests pull only the named fields above — extra fields are silently dropped, so an attacker can't smuggle anything we wouldn't validate.
5. **Validate.** Type checks, length caps, the `submitter_kind` enum, the `context` allow-list. Failures collect into the deterministic codes listed below; the response always lists every code that fired.
6. **Sanitise.** The same `pitch_schema.security.sanitize_text` / `scan_text` pair the publisher pipeline uses. Strips zero-width and other unsafe code points; rejects anything matching the prompt-injection rejected-pattern list (the same list `docs/security-policy.md` describes). The set of unicode classes stripped and the count of characters removed are recorded in the entry's `sanitization` field for forensic triage without re-scanning the cleaned bytes.
7. **Hash IP.** Your IP is HMAC-SHA-256-hashed with a per-deploy random salt (`PITCH_FEEDBACK_IP_SALT`) and truncated to 16 hex chars before storage. The raw IP is never written to disk. The salt is regenerated per process if no env value is set, so even hashes can't be cross-correlated across deploys without operator effort.
8. **Append.** The validated entry — stamped with `raw_status: "quarantined"` and `review_status: "unread"` — is appended to a JSONL quarantine file on disk inside the directory's data volume. Append-only; one threading lock; flush per write.
9. **Respond.** JSON success / JSON error (HTTP 200 / 422 / 413 / 429 / 500) for agents and curl callers. The HTML form gets the same outcome rendered as a small inline thank-you / error page.

That's the entire pipeline. There is no step in which an LLM is called, a webhook is fired, an email is sent, or the file is read back over the network.

---

## What the directory **does not do**

These are guarantees, not aspirations. They are properties of the code, not promises in a privacy notice.

- **No LLM ever reads what you submit.** The feedback module is wired to `JsonlFeedbackStore.append`. There is no other consumer in the API process. No `mcp.tool` returns it. No background job reads it.
- **The quarantine file is never served back over HTTP.** Caddy's allowlist on `directory.agentic-first.co` exposes `/mcp`, `/healthz`, `/schemas/*`, and `/feedback` (POST-only — GET returns 404). There is no path that reads `data/feedback/quarantine.jsonl`.
- **No automated reply.** If you set `submitter_handle`, we will only use it if a human operator decides to follow up by hand. There is no auto-acknowledgement mailer wired to this pipeline.
- **No raw IPs on disk.** Only the truncated HMAC-SHA-256 hash with a per-deploy salt.
- **No surfacing in `search_companies` / `get_company` / any read tool.** Feedback is not a profile. It will never appear in the directory's index, scoring, or search results.

---

## Deterministic rejection codes

If your submission is rejected, the response always has shape `{ "ok": false, "errors": [ { "code": "...", "field": "...", "detail": "..." }, ... ] }` with every `code` drawn from this fixed set:

| Code               | HTTP | When it fires                                                                                       |
| ------------------ | ---- | --------------------------------------------------------------------------------------------------- |
| `type_invalid`     | 422  | A field is the wrong JSON type (e.g. `subject` sent as an array, or the whole payload isn't a JSON object). |
| `required`         | 422  | `subject` or `body` was missing or empty after sanitisation and trimming.                            |
| `too_long`         | 422  | A field exceeded its character cap **after** sanitisation.                                          |
| `enum`             | 422  | `submitter_kind` was not one of `agent`, `human`, `unknown`.                                        |
| `unknown_key`      | 422  | A key in `context` was not one of `page`, `model`, `task`.                                          |
| `rejected_pattern` | 422  | The sanitiser matched a pattern from the prompt-injection rejected-pattern list inside any field.    |
| `too_large`        | 413 (HTTP body) or 422 (post-encoding) | Either the raw HTTP body exceeded 16 KiB, or the encoded entry exceeded 8 192 bytes after validation. |
| `invalid_json`     | 400  | A request claiming `application/json` content-type didn't parse as JSON.                             |
| `rate_limited`     | 429  | You hit one of the per-IP or global rate limits (or the Caddy edge cap before that).                 |
| `store_error`      | 500  | The directory could not write to the quarantine file. Retryable.                                    |

There is no `internal_error`, `unknown`, or `try_again_later` outcome. If you see anything outside this list, it's a bug worth reporting via GitHub issues.

---

## Why this contract exists

Three reasons, in order of weight:

1. **Adversarial input.** Feedback is the obvious surface for someone to test prompt-injection payloads against the directory. Making the read path code-only means there is no LLM to inject *into* via this surface, by construction. The injection-resistance debate stops at the perimeter.
2. **Honest expectations.** "Submit feedback" tools usually imply a round-trip. This one doesn't. Saying so up-front, on the form and in this doc, is more useful than dressing up a one-way file as a conversation.
3. **Triage discipline.** A JSONL quarantine forces an operator to actually look at what's been submitted, on a cadence they choose, with `tail -f` and `jq`. Anything richer (an inbox, a queue UI, a support tool) builds in the assumption that the operator is online — which they may not be.

If you want a richer round-trip, file an issue: <https://github.com/yqup/agentic-first/issues>. That's the human-mediated surface, and it visibly closes loops.
