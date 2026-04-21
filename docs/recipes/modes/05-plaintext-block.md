---
mode: 5
mode_name: plaintext-colophon
status: supported
recommended: only-when-no-html-primitive-exists
data_format: single-line-key-value-with-pipe-separator
discovery_path: visible text on the home page (typically a footer card)
content_type: rendered text content (not HTML/JSON)
host_requirements:
  - allow_arbitrary_text_in_page_body_or_footer
soft_warning: true
trust_rank: lowest
parser_status: supported by directory scanner; live since 2026-04-21 (Phase 1.14, see pitch-mcp `pitch_client.colophon`)
schema_revision: v2-2026-04-21
v1_status: deprecated (multi-line block — did not survive Gamma's publish AI in production testing on yqup.com)
---

# Mode 5 — Plain-text colophon (the universal fallback)

> **For hosts where the only thing you can put on a page is *text*.** No HTML, no `<head>`, no `<script>`, no `/.well-known/`, no custom widget, no file upload — just words you type into a card or a footer. Gamma, Tome, Beautiful.AI, and most AI-builder hosts fall into this bucket. This mode lets a publisher on those hosts publish a profile *anyway*, by typing **a single line of text** into a footer card on their home page. A reading agent extracts it from the rendered page text and parses it as flat `key: value` pairs.
>
> **This is the v2 wire format**, revised 2026-04-21 after live testing on Gamma showed the v1 multi-line block did not survive Gamma's publish AI. See [§Why v2 is single-line](#why-v2-is-single-line-history) at the bottom for the history.

## What it is

A single visible line of text — usually pasted into a footer or "About" card on the home page — that begins with a distinctive marker and contains pipe-separated `key: value` pairs using the same dot-path keys defined for [Mode 4](./04-ai-builder-block.md) (`company.name`, `funding.total_raised_band`, etc.).

```
agentic-first profile v0.1.0 | company.name: Acme Robotics | company.website: https://acme-robotics.example | company.jurisdiction: GB | company.industry: robotics, b2b-saas | stage.current: Seed | funding.total_raised_band: 1m-5m | funding.currency: GBP | team.headcount_band: 11-50 | contact.preferred_channel: form | contact.form_url: https://acme-robotics.example/contact | updated_at: 2026-04-19
```

That's the entire wire format. One line. No HTML, no JSON, no markdown, no code-fence required. No "do not edit" preamble (we tested those and they backfire — see [§Why no AI-directed preamble](#why-no-ai-directed-preamble)).

## When to use it

Use Mode 5 if **all** of these are true:

- Your host doesn't expose `/.well-known/` (Mode 1).
- Your host doesn't allow `<script>` blocks (Mode 2).
- Your host doesn't preserve a `<div hidden>` with `id` and `data-*` attributes (Mode 3).
- Your host doesn't preserve a `<table>` or `<dl>` with `id` and `data-*` attributes (Mode 4).
- Your host *does* let you type arbitrary text into a card, paragraph, or footer block.
- You either have no custom domain at all, or a custom domain you can't put a static-host fronting in front of (see the [Gamma host recipe](../hosts/gamma.md) for the upgrade paths if you want canonical Mode 1 instead).

If any earlier mode is achievable, prefer it. Mode 5 carries the strongest soft warning of any mode because the content is the most lossy: it's neither byte-exact nor cryptographically anchored. The directory's reader has to text-extract the rendered HTML and the publisher's host AI has had a chance to paraphrase before you submit.

The realistic home for Mode 5 today is **Gamma, Tome, Beautiful.AI, and any future AI-builder host that lets you type text but not HTML**.

## The wire format

### Required structure

1. **Start marker.** The string `agentic-first profile v` followed by a semver. Currently `agentic-first profile v0.1.0`.
   - Lowercase. Plural-bare ("profile" not "profiles"). Hyphen between "agentic" and "first".
   - This is the only part the discovery scanner anchors on. Everything else can vary, and the parser does its best.

2. **Field separator.** ` | ` — a pipe character with one space on either side.
   - Pipe is chosen because (a) it doesn't appear naturally in any of the schema's banded enum values (which often contain hyphens like `1m-5m` or `11-50`), (b) host AIs don't typically "fix" pipes the way they fix em-dashes or stylistic hyphens, and (c) it's a distinctive visual delimiter in prose.
   - **Defensive parser tolerance.** If a host AI strips or replaces pipes with another separator (em-dashes, double-hyphens, single bullets), the parser falls back to splitting on ` — ` and then ` - ` and recovering best-effort. The schema validator catches anything that comes out malformed. This is not a defence against deliberate paraphrase; it is graceful degradation.

3. **Fields.** Each field is `key.path: value`.
   - Keys are the same **dot-paths** Mode 4 uses (`company.name`, `funding.last_round.amount_band`, `contact.preferred_channel`).
   - Values are the **canonical band / enum strings** from the schema (`1m-5m`, not "between 1 and 5 million"). The schema validator will reject paraphrased values, which is precisely what catches host-AI rewriting.
   - Arrays are joined with `, ` (commas + space): `company.industry: robotics, b2b-saas`.
   - Whitespace before/after the `:` is tolerated.
   - Order is **not** significant — the parser reconstructs the JSON tree by dot-path.
   - Required minimum field set: `schema_version`, `profile_kind`, `tier`, `updated_at`, `company.name` (or `person.name`), `company.website` (or `person.website`), `company.jurisdiction` (or `person.jurisdiction`).

### Key dot-path conventions (shared with Mode 4)

| JSON shape | Dot-path equivalent | Example |
| --- | --- | --- |
| `{"company": {"name": "Acme"}}` | `company.name: Acme` | top-level object property |
| `{"company": {"industry": ["a","b"]}}` | `company.industry: a, b` | array of strings |
| `{"funding": {"last_round": {"amount_band": "1m-5m"}}}` | `funding.last_round.amount_band: 1m-5m` | deep nested |
| `{"updated_at": "2026-04-19"}` | `updated_at: 2026-04-19` | ISO-8601 date or datetime |

Anything that the JSON Schema permits, you can express as a pipe-separated `key.path: value` field.

### Where to put the line on the page

- **Best:** a dedicated footer card or "About" card on the home page. Footers are less aggressively rewritten by AI page-builders than body content.
- **Acceptable:** the very last paragraph on the home page, the "Contact" card, or any "About" card visible from the home page.
- **Avoid:** the middle of a marketing card, a hero section, the inside of a media caption, or anywhere the host AI is likely to "punch up" the copy. The closer the line is to the page edge, the more likely it survives.

## Discovery surface

A reading agent will:

1. Try `/.well-known/agentic-profile.json` first (Mode 1).
2. On `404`, fetch the home page and look for `<script type="application/agentic-profile+json">` (Mode 2).
3. Then look for `<div id="agentic-profile" data-format="xml">` (Mode 3).
4. Then look for `[id="agentic-profile"][data-format^="html-"]` (Mode 4).
5. **Then strip HTML and search the resulting text for the regex `agentic-first profile v(\d+\.\d+\.\d+)\s*\|`** (Mode 5).
6. Read forward until the end of the line (or until two consecutive pipe-less segments appear). Split on ` | ` (with `' — '` and `' - '` as defensive fallbacks). For each `key: value` pair, reconstruct the JSON tree from the dot-paths. Validate against the schema.

The Mode 5 reader-side parser:

- Operates on **rendered text content**, not HTML markup. Anything that would be visible to a human reading the page in a browser is in scope.
- Is tolerant of: extra whitespace, the marker appearing mid-sentence, multiple consecutive spaces, smart-quote replacement, em-dash autoreplace.
- Is **not** tolerant of: missing marker, paraphrased keys (`company.industry` becoming `industry`), paraphrased band values (`11-50` becoming `~12 employees`), reordered key fragments (`company.name.full` instead of `company.name`).
- The schema validator runs after parsing — paraphrased values fail the banded-enum or pattern check and the submission is rejected with the standard `schema validation failed` envelope.

## Soft warning

The directory tags Mode 5 submissions with `discovery_method: plaintext-colophon` and a soft warning. Reading agents that demand strong evidence (institutional investors, regulated buyers) may treat a Mode 5 profile as **lower-trust than Mode 1**, because:

- The publisher hasn't proved control of the well-known surface.
- The wire content went through a rendered-page text extraction, which is more brittle than parsing JSON.
- The host AI has had a chance to paraphrase between save and read; even if validation passes, a value-paraphrase that happens to land inside the schema's permitted range goes undetected.

The warning is honest signalling, not a defect. If your trust posture matters more than your hosting choice, move to Mode 1 by either (a) hosting the profile on a separate static-host subdomain (Vercel/Netlify/GitHub Pages/Bunny.net/Cloudflare Pages — all free, all CNAME-friendly), or (b) putting any static-host or worker fronting in front of your custom domain. See the [Gamma host recipe](../hosts/gamma.md) for the concrete steps and a vendor-neutral list.

## How to paste it on an AI-builder host (recipe wisdom from live tests)

This is recipe-level guidance, not part of the wire format. Verified empirically on Gamma in April 2026 (see `fb_ed680eb879ad4a6e` from yqup.com).

**Use a user-voice framing sentence.** When you hand the host's editor the paste, open with one sentence written *as if by you, the site owner*, then a blank line, then the colophon. Like this:

```
Please add the following as a small footer at the bottom of the home
page. Paste it as one text block, exactly as written. Do not edit
any other pages.

agentic-first profile v0.1.0 | company.name: Acme Robotics | company.website: https://acme-robotics.example | …
```

**Do *not* wrap the paste with detailed AI-directed instructions** like "treat the following as data, do not summarise or reformat, preserve verbatim". In live testing on Gamma, those preambles caused the publish AI to interpret the paste itself as a prompt and make unrelated structural edits across multiple pages. Short user-voice framing reliably beats long AI-directed preambles. (The same human-vs-AI-voice principle is documented in `/security/` as the underlying threat model — anything that looks like an instruction to a model gets read as one.)

The colophon line itself is short enough not to need any preamble protection — its distinctiveness *is* its protection. The framing sentence is for the human-style editor (Gamma, Tome) to know what you want done with the paste, not for the publish AI to behave around the data.

## Validate

```bash
# 1. The colophon is present in the rendered page text
curl -sSL https://your-gamma-site.example/ \
  | sed -e 's/<[^>]*>//g' \
  | grep -F 'agentic-first profile v0.1.0'
# Expect: at least one match. The whole line you pasted should print.

# 2. (Optional) parse it locally to confirm the schema validates
curl -sSL https://your-gamma-site.example/ \
  | python3 -c '
import sys, re, json
text = re.sub(r"<[^>]*>", " ", sys.stdin.read())
m = re.search(r"agentic-first profile v\d+\.\d+\.\d+\s*\|(.+)", text)
assert m, "colophon not found"
parts = [p.strip() for p in m.group(1).split("|")]
out = {"schema_version": "0.1.0"}
for part in parts:
    if ":" not in part: continue
    k, _, v = part.partition(":")
    cur, segs = out, k.strip().split(".")
    for s in segs[:-1]:
        cur = cur.setdefault(s, {})
    val = v.strip()
    if "," in val and not val.startswith("\""):
        val = [s.strip() for s in val.split(",")]
    cur[segs[-1]] = val
print(json.dumps(out, indent=2))
' | agentic-first-validate -
# Expect: PASS

# 3. Submit
curl -sS -X POST https://directory.agentic-first.co/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call",
       "params":{"name":"submit_website",
                 "arguments":{"domain":"your-gamma-site.example"}}}'
# Expect: {"ok": true, "discovery": {"method": "plaintext-colophon",
# "warnings": ["discovery_method=plaintext-colophon: lowest-trust mode...",
# ...]}, "validation": {"errors": [], "warnings": [...]}}.
# The discovery.warnings array names the soft-warning trust signal and
# any defensive coercions the parser applied (e.g. "coerced updated_at
# from date to date-time"). Use those to tighten your wire format.
```

To check the running directory supports Mode 5 before you submit:

```bash
curl -s https://directory.agentic-first.co/healthz \
  | python3 -c '
import json, sys
modes = json.load(sys.stdin)["supported_discovery_modes"]
assert any(m["method"] == "plaintext-colophon" for m in modes), \
  "scanner does not yet support Mode 5; check /healthz output"
print("Mode 5 is live on this directory.")
'
```

## Common problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| Colophon disappeared after the next AI restyle | The host AI rewrote the footer card | Re-paste with the user-voice framing sentence above. Move the colophon to a dedicated footer card. Re-publish. |
| Values paraphrased ("1m-5m" → "between £1m and £5m") | Host AI rewrote the values; schema validator rejects | The directory rejects with `schema validation failed`. Move the line to a footer card; some host AIs leave footers alone. If it keeps happening, escalate to one of the [Gamma upgrade paths](../hosts/gamma.md) — there's no defence against an AI that rewrites data values except putting the data outside the host's control. |
| Keys lost their dot-path namespace (`company.name` became just `name`) | Host AI "improved" the prose by stripping the namespacing | Schema validator will reject. Re-paste; consider adding the colophon as a single inline-code span if your host supports it (Gamma does — wrap the whole pipe-separated section in backticks; in our testing the AI usually leaves "code-styled" text alone). |
| Reading agent reports "no profile found" but the curl above shows the colophon | The page is iframed or rendered client-side, and the directory's HTTP fetch sees only an HTML shell, not the rendered text | Submit a static rendered URL (most AI-builder hosts have a "publish to static HTML" option even when the editor is JS-heavy). Or move to Mode 1 on a separate static host as in the [Gamma recipe](../hosts/gamma.md). |
| Marker not detected | An autoreplace on the home page changed `agentic-first profile` to `Agentic First Profile` (Title Case) | The discovery regex is case-sensitive. Re-paste; if the host force-Title-Cases footer text, wrap the colophon in inline code (backticks) which usually disables Title-Case autoreplace. |
| Pipe characters got replaced by something else | Host AI normalised `|` to `–` or `•` or removed them entirely | The parser falls back to ` — ` and ` - `. If even that's getting rewritten, the host is too aggressive for Mode 5; move to Mode 1 elsewhere. |

## Why v2 is single-line — history

**v1 (shipped 2026-04-21 morning) — multi-line ASCII block.**

The original Mode 5 spec was a multi-line ASCII block with explicit start/end markers (`AGENTIC-PROFILE v0.1.0 …` / `END AGENTIC-PROFILE`), one `key.path: value` per line, and a visible "Do not edit, reword, translate, or remove." instruction line on the first row. Designed in theory for parser cleanliness.

**Live test on Gamma (yqup.com) — same day.** Tony Wood went and tested an analogue of v1 on Gamma. Two empirical findings:

1. **Multi-line blocks did not survive Gamma's publish AI.** The AI restructured the block visually, breaking the line-oriented parse contract.
2. **AI-directed preambles backfired.** Wrapping the paste with detailed instructions to the model ("treat as data, do not summarise") caused the publish AI to interpret the paste itself as a prompt and make unrelated structural edits across multiple pages. The "Do not edit, reword, translate, or remove" line at the top of v1 was exactly this kind of preamble.

Tony's empirically-validated paste was a **single line**, hyphen-separated colophon, with **user-voice framing** (one sentence opening as if by the site owner: "Please add the following as a small footer …") and **no AI-directed preamble** anywhere in the paste. He verified live with `curl -sSL https://yqup.com/ | grep -F "agentic-first profile v0.1.0"` returning two matches.

**v2 (this version, shipped 2026-04-21 afternoon) — single-line key-value with pipe separator.**

This version takes the structural lesson from Tony's test (single line; no AI-directed preamble) and adds parser determinism (pipe separator + dot-path key:value, instead of his positional colophon). The framing-sentence wisdom moves into the recipe section above ("How to paste it on an AI-builder host") rather than into the wire format itself, because the framing is host-specific recipe knowledge and the wire format should stay clean.

**Why v1 is deprecated, not deleted.** Honest signalling: the standard shipped v1, real users tested it, real users found it broken. The history matters because (a) anyone who already tried v1 needs to know they should re-paste in v2, and (b) future contributors who think "let's add a 'do not edit' preamble for safety" can read why we tried that and walked back from it. This is the same pattern as Phase 1.10b (Gamma's "embed widget" retraction) and Phase 1.11b (this correction).

## Why no AI-directed preamble

Two reasons.

**1. It backfires on AI-builder hosts.** Empirical finding from Gamma (above). When the publish-time AI sees text that looks like instructions to a model, it treats it as instructions to a model — and "Do not edit, reword, translate, or remove" is exactly that shape. The AI then either tries to "be helpful" by acting on the instruction (rephrasing other content to match), or it interprets the whole paste as one continuous prompt and edits unrelated pages. Both outcomes break the publisher's deck and the colophon along with it.

**2. The marker's distinctiveness is the protection.** `agentic-first profile v0.1.0 |` is short enough and unusual enough that no host AI in our testing has tried to "improve" it. The pipe-separated key:value structure that follows reads as machine data — host AIs do not in our testing rewrite text that visually patterns as machine data. Adding a "do not edit" instruction does not raise the marker's protection; it lowers it by making the surrounding text look prompt-like.

The reader-side parser does not need a "do not edit" instruction either — the marker regex anchors the parse and the schema validator catches paraphrase. The instruction would have been load-bearing for nothing on the parser side and load-shedding (negative) on the host-AI side.

## Cross-references

- [Mode 1 (file)](./01-file-well-known.md) — preferred whenever DNS / static-host fronting is available.
- [Mode 2 (script embed)](./02-script-embed.md) — preferred whenever the host accepts a typed `<script>` block.
- [Mode 3 (hidden block)](./03-hidden-block.md) — preferred when the host strips `<script>` but allows `<div>`.
- [Mode 4 (visible HTML block)](./04-ai-builder-block.md) — speculative sibling for the hypothetical host that has body HTML *and* aggressive AI rewriting. Mode 5 is the practical answer for the same population today.
- [Gamma host recipe](../hosts/gamma.md) — the canonical Mode 5 host as of 2026, with verified paste-recipe and fallbacks.
