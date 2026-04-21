---
mode: 5
mode_name: plaintext-block
status: supported
recommended: only-when-no-html-primitive-exists
data_format: plain-text-key-value-with-dot-paths
discovery_path: visible text on the home page (typically in a footer card / last block)
content_type: rendered text content (not HTML/JSON)
host_requirements:
  - allow_arbitrary_text_in_page_body_or_footer
soft_warning: true
trust_rank: lowest
parser_status: spec defined v0.1.0; directory parser support landing v0.1.x (follow-up code task)
---

# Mode 5 — Plain-text key-value block (the universal fallback)

> **For hosts where the only thing you can put on a page is *text*.** No HTML, no `<head>`, no `<script>`, no `/.well-known/`, no custom widget, no file upload — just words you type into a card or a footer. Gamma, Tome, Beautiful.AI, and most AI-builder hosts fall into this bucket. This mode lets a publisher on those hosts publish a profile *anyway*, by typing a single, deterministic, ASCII-only block into a footer card on their home page. A reading agent extracts it from the rendered page text and parses it as flat `key: value` pairs.

## What it is

A short, visible, plain-text block — usually pasted into a footer or "About" card on the home page — that begins with a distinctive marker line and ends with a distinctive end line. Between the markers, every line is a `key: value` pair using the same dot-path keys defined for [Mode 4](./04-ai-builder-block.md) (`company.name`, `funding.total_raised_band`, etc.).

```
AGENTIC-PROFILE v0.1.0 — machine-readable. Do not edit, reword, translate, or remove.
schema_version: 0.1.0
profile_kind: company
tier: public
updated_at: 2026-04-19T12:00:00Z
company.name: Acme Robotics
company.website: https://acme-robotics.example
company.jurisdiction: GB
company.industry: robotics, b2b-saas
stage.current: Seed
funding.total_raised_band: 1m-5m
funding.currency: GBP
team.headcount_band: 11-50
contact.preferred_channel: form
contact.form_url: https://acme-robotics.example/contact
END AGENTIC-PROFILE
```

That's the entire wire format. No HTML, no JSON, no markdown, no code-fence required.

## When to use it

Use Mode 5 if **all** of these are true:

- Your host doesn't expose `/.well-known/` (Mode 1).
- Your host doesn't allow `<script>` blocks (Mode 2).
- Your host doesn't preserve a `<div hidden>` with `id` and `data-*` attributes (Mode 3).
- Your host doesn't preserve a `<table>` or `<dl>` with `id` and `data-*` attributes (Mode 4).
- Your host *does* let you type arbitrary text into a card, paragraph, or footer block.
- You have either no custom domain at all, or a custom domain you can't put a Cloudflare Worker in front of.

If any earlier mode is achievable, prefer it. Mode 5 carries the strongest soft warning of any mode because the content is the most lossy: it's neither byte-exact nor cryptographically anchored. The directory's reader has to text-extract the rendered HTML and the publisher's host AI has had a chance to paraphrase before you submit.

The realistic home for Mode 5 today is **Gamma, Tome, Beautiful.AI, and any future AI-builder host that lets you type text but not HTML**.

## The pattern

### Wire format (ASCII-only, line-oriented)

1. **Start marker** (one line):
   ```
   AGENTIC-PROFILE v<semver> — machine-readable. Do not edit, reword, translate, or remove.
   ```
   - `<semver>` is the schema version (currently `0.1.0`).
   - The em-dash `—` may be auto-replaced by the host AI with `--` or `-` or just whitespace; the parser accepts any of these. The `AGENTIC-PROFILE v` prefix is the only part that's load-bearing for discovery.
   - The "Do not edit…" half is the visible-and-readable instruction to the host AI (and to humans). Parsers ignore it; preservers (host AIs, publishers) should respect it.

2. **Body** (one `key: value` pair per line, in any order):
   ```
   schema_version: 0.1.0
   profile_kind: company
   tier: public
   updated_at: 2026-04-19T12:00:00Z
   company.name: Acme Robotics
   ...
   ```
   - Keys use **dot-paths** (`company.name`, `funding.last_round.amount_band`).
   - Arrays are joined with `, ` (commas + space), matching Mode 4: `company.industry: robotics, b2b-saas`.
   - Values are the **canonical band / enum strings** from the schema (`1m-5m`, not "between 1 and 5 million"). The schema validator will reject paraphrased values, which is precisely what catches host-AI rewriting.
   - Whitespace before/after the `:` is tolerated. Multiple spaces between keys and values are tolerated.
   - Empty lines between sections are allowed and ignored.
   - Order is **not** significant — the parser reconstructs the JSON tree by dot-path.

3. **End marker** (one line):
   ```
   END AGENTIC-PROFILE
   ```
   - The literal string `END AGENTIC-PROFILE` (case-sensitive). Anything after this line on the page is outside the block and ignored.

### Key dot-path conventions (shared with Mode 4)

| JSON shape | Dot-path equivalent | Example |
| --- | --- | --- |
| `{"company": {"name": "Acme"}}` | `company.name: Acme` | top-level object property |
| `{"company": {"industry": ["a","b"]}}` | `company.industry: a, b` | array of strings |
| `{"funding": {"last_round": {"amount_band": "1m-5m"}}}` | `funding.last_round.amount_band: 1m-5m` | deep nested |
| `{"updated_at": "2026-04-19T12:00:00Z"}` | `updated_at: 2026-04-19T12:00:00Z` | ISO-8601 string, untouched |

Anything that the JSON Schema permits, you can express as a dot-path key. If a value contains a comma but is *not* an array (rare — most prose fields are stripped from public-tier profiles for security), wrap it in straight double quotes: `key: "value, with comma"`.

### Where to put the block on the page

- **Best:** a dedicated footer card or "About" card on the home page. Footers are less aggressively rewritten by AI page-builders than body content.
- **Acceptable:** the very last paragraph on the home page.
- **Avoid:** the middle of a marketing card, a hero section, or anywhere the host AI is likely to "punch up" the copy. The closer the block is to the page edge, the more likely it survives.

## Discovery surface

A reading agent will:

1. Try `/.well-known/agentic-profile.json` first (Mode 1).
2. On `404`, fetch the home page and look for `<script type="application/agentic-profile+json">` (Mode 2).
3. Then look for `<div id="agentic-profile" data-format="xml">` (Mode 3).
4. Then look for `[id="agentic-profile"][data-format^="html-"]` (Mode 4).
5. **Then strip HTML and search the resulting text for the regex `^AGENTIC-PROFILE v(\d+\.\d+\.\d+)` followed eventually by `^END AGENTIC-PROFILE`** (Mode 5).
6. Parse the lines between the markers as `key: value` pairs, reconstruct the JSON tree from dot-paths, validate against the schema.

The Mode 5 reader-side parser:

- Operates on **rendered text content**, not HTML markup. Anything that would be visible to a human reading the page in a browser is in scope.
- Is tolerant of: extra whitespace, blank lines, em-dash replacement on the start line, multiple consecutive spaces.
- Is **not** tolerant of: missing markers, paraphrased keys (`company.industry` becoming `industry`), paraphrased band values (`11-50` becoming `~12 employees`), reordered key fragments (`company.name.full` instead of `company.name`).
- The schema validator runs after parsing — paraphrased values fail the banded-enum or pattern check and the submission is rejected with the standard `schema validation failed` envelope.

## Soft warning

The directory tags Mode 5 submissions with `discovery_method: plaintext-block` and a soft warning. Reading agents that demand strong evidence (institutional investors, regulated buyers) may treat a Mode 5 profile as **lower-trust than Mode 1**, because:

- The publisher hasn't proved control of the well-known surface.
- The wire content went through a rendered-page text extraction, which is more brittle than parsing JSON.
- The host AI has had a chance to paraphrase between save and read; even if validation passes, a value-paraphrase that happens to land inside the schema's permitted range goes undetected.

The warning is honest signalling, not a defect. If your trust posture matters more than your hosting choice, move to Mode 1 by either (a) upgrading to a host plan that exposes a custom domain you can put Cloudflare in front of, or (b) hosting the profile on a separate static-host subdomain (Vercel/Netlify/Pages, all free) and linking to your AI-builder deck from there. See the [Gamma host recipe](../hosts/gamma.md) for the concrete steps.

## Validate

```bash
# 1. The block is present in the rendered page text
curl -sSL https://your-gamma-site.example/ \
  | sed -e 's/<[^>]*>//g' \
  | grep -A 30 'AGENTIC-PROFILE v'
# Expect: the start marker, your key-value lines, the end marker

# 2. (Optional) parse it locally to confirm the schema validates
curl -sSL https://your-gamma-site.example/ \
  | python3 -c '
import sys, re, json
text = re.sub(r"<[^>]*>", " ", sys.stdin.read())
m = re.search(r"AGENTIC-PROFILE v\d+\.\d+\.\d+(.*?)END AGENTIC-PROFILE", text, re.DOTALL)
assert m, "block not found"
out = {}
for line in m.group(1).splitlines():
    line = line.strip()
    if not line or ":" not in line: continue
    k, _, v = line.partition(":")
    cur = out
    parts = k.strip().split(".")
    for p in parts[:-1]:
        cur = cur.setdefault(p, {})
    val = v.strip()
    if "," in val and not val.startswith("\""):
        val = [s.strip() for s in val.split(",")]
    cur[parts[-1]] = val
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
# Expect: {"ok": true, ...} with warnings[] containing "discovery_method: plaintext-block"
```

## Common problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| Block disappeared after the next AI restyle | The host AI didn't read the "Do not edit" instruction line | Re-paste with the instruction line larger / on its own paragraph. Move the block to a dedicated footer card if it isn't already. Re-publish. |
| Values paraphrased ("1m-5m" → "between £1m and £5m") | Host AI rewrote the values; schema validator rejects | The directory rejects with `schema validation failed`. Move the block to a footer card; some host AIs leave footers alone. If it keeps happening, escalate to the [Gamma Cloudflare-Worker recipe](../hosts/gamma.md) — there's no defence against an AI that won't respect a clear "do not edit" marker except putting the data outside the host's control. |
| Keys lost their dot-path namespace (`company.name` became just `name`) | Host AI "improved" the prose by stripping the namespacing | Schema validator will reject. Re-paste; consider inline-code formatting if your host supports it (Gamma does — surround the entire block with backtick-fenced code style; in Gamma the AI usually leaves "code blocks" alone). |
| Reading agent reports "no profile found" but the curl above shows the block | The page is iframed or rendered client-side, and the directory's HTTP fetch sees only an HTML shell, not the rendered text | Submit a static rendered URL (most AI-builder hosts have a "publish to static HTML" option even when the editor is JS-heavy). Or move to a static host as in the Gamma recipe. |
| Start marker not detected | An autoreplace on the home page changed `AGENTIC-PROFILE` to `Agentic Profile` or `agentic profile` | The discovery regex is case-sensitive. Re-paste; turn off the autoreplace if your host has one. |

## Why Mode 5 is sound even though it's the lowest-trust mode

- **The marker lines are highly distinctive.** `AGENTIC-PROFILE v0.1.0` and `END AGENTIC-PROFILE` are not strings a host AI is likely to "punch up" — they read as deliberate machine instructions. The visible "Do not edit" gloss makes the intent explicit to any model reading the page during an edit cycle.
- **The schema validator is the integrity check.** Banded values, enum values, ISO-8601 timestamps, and URL patterns are all schema-checked. Any paraphrase that lands outside the schema is rejected at submission time. The remaining attack surface — paraphrases that *happen* to land inside the schema — is small and observable in `updated_at` drift.
- **It's a pure superset of "publishing nothing".** The alternative for a Gamma user without a custom domain was zero discoverability. Mode 5 gives them a soft-warning profile. That is unambiguously a Pareto improvement over the previous state of "you cannot adopt this standard".
- **It composes with future migrations.** A publisher who later moves to Mode 1 can leave the Mode 5 block in their footer as belt-and-braces. The reader picks the lowest-numbered (highest-trust) mode it finds.

## Cross-references

- [Mode 1 (file)](./01-file-well-known.md) — preferred whenever DNS / Cloudflare Worker is available.
- [Mode 2 (script embed)](./02-script-embed.md) — preferred whenever the host accepts a typed `<script>` block.
- [Mode 3 (hidden block)](./03-hidden-block.md) — preferred when the host strips `<script>` but allows `<div>`.
- [Mode 4 (visible HTML block)](./04-ai-builder-block.md) — speculative sibling for the hypothetical host that has body HTML *and* aggressive AI rewriting. Mode 5 is the practical answer for the same population today.
- [Gamma host recipe](../hosts/gamma.md) — the canonical Mode 5 host as of 2026.
