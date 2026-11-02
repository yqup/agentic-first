import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { checkProfileValidator, validateProfiles } from "../scripts/check-company-profiles.mjs";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const profilePath = (base, domain) => path.join(base, "dist", domain, "www", ".well-known", "agentic-profile.json");
const profile = {
  schema_version: "0.2.0",
  updated_at: "2026-11-02T00:00:00Z",
  profile_kind: "company",
  tier: "public",
  company: { name: "Example", website: "https://example.com", jurisdiction: "GB" },
};

async function fixture(t, entries = { "example.com": profile }) {
  const base = await mkdtemp(path.join(tmpdir(), "company-profiles-"));
  t.after(() => rm(base, { recursive: true, force: true }));
  await writeFile(path.join(base, "sites.json"), JSON.stringify(Object.keys(entries).map((domain) => ({ domain }))));
  await mkdir(path.join(base, "dist"));
  for (const [domain, value] of Object.entries(entries)) {
    const target = profilePath(base, domain);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, JSON.stringify(value));
  }
  return base;
}

test("all ten generated profiles pass the canonical CLI", async () => {
  const sites = JSON.parse(await readFile(path.join(root, "sites.json"), "utf8"));
  assert.equal(sites.length, 10);
  const messages = [];
  await validateProfiles({ log: (message) => messages.push(message) });
  for (const { domain } of sites) {
    assert.ok(messages.some((message) => message.startsWith(`${domain}: PASS`)), domain);
  }
});

test("canonical warnings are visible but non-fatal", async (t) => {
  const base = await fixture(t);
  const messages = [];
  await validateProfiles({ root: base, log: (message) => messages.push(message) });
  assert.ok(messages.some((message) => message.includes("PASS")));
  assert.ok(messages.some((message) => message.includes("warning")));
  assert.ok(messages.some((message) => message.includes("warn")));
});

for (const field of ["access", "analytics", "briefing", "briefing_categories", "unexpected_field"]) {
  test(`canonical gate rejects top-level ${field}`, async (t) => {
    const base = await fixture(t, { "example.com": { ...profile, [field]: {} } });
    await assert.rejects(validateProfiles({ root: base, log: () => {} }), (error) => {
      assert.match(error.message, /Company profile validation failed/);
      assert.match(error.message, /Additional properties are not allowed/);
      assert.ok(error.message.includes(field));
      return true;
    });
  });
}

test("canonical gate rejects malformed JSON", async (t) => {
  const base = await fixture(t);
  await writeFile(profilePath(base, "example.com"), "{broken");
  await assert.rejects(validateProfiles({ root: base, log: () => {} }), /not valid JSON/);
});

test("canonical gate rejects invalid known fields", async (t) => {
  const base = await fixture(t, { "example.com": { ...profile, company: { ...profile.company, jurisdiction: "United Kingdom" } } });
  await assert.rejects(validateProfiles({ root: base, log: () => {} }), /jurisdiction/);
});

test("missing generated profile fails validation", async (t) => {
  const base = await fixture(t);
  await unlink(profilePath(base, "example.com"));
  await assert.rejects(validateProfiles({ root: base, log: () => {} }), /file not found/);
});

test("missing or unexpected site output fails instead of silently skipping", async (t) => {
  const base = await fixture(t, { "example.com": profile, "unexpected.example": profile });
  await writeFile(path.join(base, "sites.json"), JSON.stringify([{ domain: "example.com" }]));
  await assert.rejects(validateProfiles({ root: base, log: () => {} }), /output mismatch/);
  await rm(path.join(base, "dist", "example.com"), { recursive: true });
  await rm(path.join(base, "dist", "unexpected.example"), { recursive: true });
  await assert.rejects(validateProfiles({ root: base, log: () => {} }), /found: none/);
});

test("empty retired site directories do not block profile validation", async (t) => {
  const base = await fixture(t);
  await mkdir(path.join(base, "dist", "retired.example", "www"), { recursive: true });
  const messages = [];
  await validateProfiles({ root: base, log: (message) => messages.push(message) });
  assert.ok(messages.some((message) => message.includes("Company profiles OK for 1 sites")));
});

test("empty site lists cannot pass vacuously", async (t) => {
  const base = await fixture(t, {});
  await assert.rejects(validateProfiles({ root: base, log: () => {} }), /non-empty, unique site list/);
});

test("a failed profile does not skip checks for the remaining sites", async (t) => {
  const base = await fixture(t, {
    "a.example.com": { ...profile, analytics: {} },
    "b.example.com": profile,
  });
  const messages = [];
  await assert.rejects(validateProfiles({ root: base, log: (message) => messages.push(message) }), /failed for 1\/2 sites/);
  assert.ok(messages.some((message) => message.startsWith("b.example.com: PASS")));
});

test("missing validator gives actionable setup instructions", async (t) => {
  const base = await fixture(t);
  await assert.rejects(checkProfileValidator({ command: path.join(base, "missing-validator") }), /requirements-build\.txt/);
});

test("build fails before touching dist when the validator is unavailable", async (t) => {
  const base = await fixture(t);
  const sites = JSON.parse(await readFile(path.join(root, "sites.json"), "utf8"));
  const before = await Promise.all(sites.map(({ domain }) => readFile(profilePath(root, domain), "utf8")));
  await assert.rejects(execFileAsync(process.execPath, [path.join(root, "build-sites.mjs")], {
    env: { ...process.env, AGENTIC_FIRST_VALIDATE: path.join(base, "missing-validator") },
    timeout: 15000,
  }), (error) => {
    assert.match(error.stderr, /canonical agentic-first-validate CLI is required/);
    return true;
  });
  const after = await Promise.all(sites.map(({ domain }) => readFile(profilePath(root, domain), "utf8")));
  assert.deepEqual(after, before);
});

test("generated profiles stay minimal while analytics and authority context remain elsewhere", async () => {
  const sites = JSON.parse(await readFile(path.join(root, "sites.json"), "utf8"));
  for (const site of sites) {
    const www = path.join(root, "dist", site.domain, "www");
    const document = JSON.parse(await readFile(profilePath(root, site.domain), "utf8"));
    assert.deepEqual(Object.keys(document).sort(), ["company", "contact", "links", "profile_kind", "schema_version", "tier", "updated_at"]);
    const health = JSON.parse(await readFile(path.join(www, "healthz"), "utf8"));
    assert.ok(health.analytics.north_star);
    assert.ok(health.analytics.primary_conversion);
    const manifest = JSON.parse(await readFile(path.join(root, "dist", "manifest.json"), "utf8"));
    assert.ok(manifest.find((entry) => entry.domain === site.domain).analytics_north_star);
    const llms = await readFile(path.join(www, "llms.txt"), "utf8");
    assert.match(llms, /Access boundary: public information only/);
    assert.match(llms, /grant no authority to act/);
    assert.ok(!llms.includes('"analytics":'));
    assert.ok(!llms.includes('"access":'));
    if (site.mode === "cao") {
      assert.equal(document.links.for_agents, `https://${site.domain}/for-agents/`);
      assert.equal(document.links.llms, `https://${site.domain}/llms.txt`);
      assert.match(llms, /## Chief Agentic Officer Briefing/);
      assert.match(llms, /Categories:/);
      assert.match(await readFile(path.join(www, "for-agents", "index.html"), "utf8"), /Chief Agentic Officer/);
    }
  }
});
