// YQUP "Book a conversation" contact handler (yqup.com standalone lane only).
// Same pattern as the CAO public form: save first, scan in quarantine, email a
// defanged plain-text copy to Tony's office, never auto-reply.
//
// Vendored from the CAO site release (unchanged copies in this folder):
//   contact-quarantine.mjs  (scanContactMessage, defangText, verdictLabel)
//   contact-smtp.mjs        (sendSmtpMessage)
//
// Settings come from the container environment, which the ANI yqup.com lane
// fills from /srv/apps/yqup.com/shared/yqup-contact.env (root-only, never in
// git or a release). Messages live in the persistent state mount and are
// purged after YQUP_CONTACT_RETENTION_DAYS (default and maximum 730 days).
import { accessSync, appendFileSync, constants, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import path from "node:path";
import { scanContactMessage, defangText, verdictLabel } from "./contact-quarantine.mjs";
import { sendSmtpMessage } from "./contact-smtp.mjs";

const env = process.env;
const LIMITS = { bodyBytes: 8192, name: 120, email: 254, org: 160, role: 120, question: 500, phone: 40, minFillMs: 3000, maxFormAgeMs: 2 * 3600 * 1000 };
const FORM_KEY = randomBytes(32); // per process; a restart only means a visitor reloads
const ORIGIN = env.YQUP_SITE_ORIGIN || "https://yqup.com";
const ALLOWED_ORIGINS = new Set([ORIGIN, "https://yqup.com", "https://www.yqup.com"]);
const STATE_DIR = env.YQUP_CONTACT_STATE_DIR || "/srv/state";
const MESSAGES_DIR = path.join(STATE_DIR, "contact");
const MESSAGES_FILE = path.join(MESSAGES_DIR, "messages.jsonl");
const TO = env.YQUP_CONTACT_EMAIL_TO || "forms@yqup.com";
const RETENTION_DAYS = Math.min(730, Math.max(1, Number(env.YQUP_CONTACT_RETENTION_DAYS || 730) || 730));
const DAY_MS = 864e5;
if (!/^[^@\s<>]+@yqup\.com$/i.test(TO)) throw new Error("YQUP_CONTACT_EMAIL_TO must be a yqup.com mailbox");

// Same mail route and fallbacks as the CAO contact backend (account-contact.mjs
// contactEmailConfig): host smtp.hostinger.com, port 465, secure "" (implicit TLS
// on 465, STARTTLS on 587). The lane writes all three explicitly anyway.
const v = (name) => String(env[name] || "").trim();
const SMTP = {
  host: v("YQUP_CONTACT_SMTP_HOST") || "smtp.hostinger.com",
  port: Number(v("YQUP_CONTACT_SMTP_PORT") || 465),
  secure: v("YQUP_CONTACT_SMTP_SECURE") || "",
};

// Ready only when the lane gave us somewhere to store messages and a mail login.
export function contactReady() {
  if (!v("YQUP_CONTACT_SMTP_PASSWORD") || !v("YQUP_CONTACT_SMTP_USER")) return false;
  try { mkdirSync(MESSAGES_DIR, { recursive: true, mode: 0o700 }); accessSync(MESSAGES_DIR, constants.W_OK); return true; } catch { return false; }
}

// Retention: drop every line that belongs to a message older than the window.
export function purgeExpired(now = Date.now()) {
  if (!existsSync(MESSAGES_FILE)) return { kept: 0, removed: 0 };
  const cutoff = now - RETENTION_DAYS * DAY_MS;
  const lines = readFileSync(MESSAGES_FILE, "utf8").split("\n").filter(Boolean);
  const expired = new Set();
  for (const line of lines) {
    try { const r = JSON.parse(line); if (r.created_at && Date.parse(r.created_at) < cutoff) expired.add(r.message_id); } catch { /* keep unparsable lines for a human */ }
  }
  if (!expired.size) return { kept: lines.length, removed: 0 };
  const keep = lines.filter((line) => { try { return !expired.has(JSON.parse(line).message_id); } catch { return true; } });
  const tmp = MESSAGES_FILE + ".purge-" + process.pid;
  writeFileSync(tmp, keep.length ? keep.join("\n") + "\n" : "", { mode: 0o600 });
  renameSync(tmp, MESSAGES_FILE);
  console.log("contact_retention_purge removed_messages=" + expired.size + " retention_days=" + RETENTION_DAYS);
  return { kept: keep.length, removed: lines.length - keep.length };
}
let retentionTimer = null;
export function startRetention() {
  const run = () => { try { purgeExpired(); } catch (e) { console.error("contact_retention_failed", e && e.code); } };
  run();
  if (!retentionTimer) { retentionTimer = setInterval(run, DAY_MS); retentionTimer.unref(); }
}

// In-memory abuse limits, same numbers as the CAO public form.
const hits = new Map();
function limited(key, max, windowMs, now) {
  const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (list.length >= max) { hits.set(key, list); return true; }
  list.push(now); hits.set(key, list); return false;
}
function tooMany(ip, email, now) {
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < DAY_MS)) hits.delete(k);
  return limited("ip15:" + ip, 3, 15 * 60e3, now) || limited("ipday:" + ip, 10, DAY_MS, now)
    || limited("em:" + email, 3, DAY_MS, now) || limited("g1h", 30, 36e5, now) || limited("gday", 150, DAY_MS, now);
}

export function issueFormToken(now = Date.now()) {
  const issued = String(now);
  return issued + "." + createHmac("sha256", FORM_KEY).update("yqup-contact:" + issued).digest("base64url");
}
function checkFormToken(token, now = Date.now()) {
  const [issued, mac] = String(token || "").split(".");
  if (!/^\d{10,16}$/.test(issued || "") || !mac) return "form_token_invalid";
  const a = Buffer.from(mac), b = Buffer.from(createHmac("sha256", FORM_KEY).update("yqup-contact:" + issued).digest("base64url"));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return "form_token_invalid";
  const age = now - Number(issued);
  if (age < LIMITS.minFillMs) return "form_too_fast";
  if (age > LIMITS.maxFormAgeMs) return "form_expired";
  return "";
}
const clean = (v, n) => String(v ?? "").replace(/\r\n?/g, "\n").trim().slice(0, n + 1);
const oneLine = (v) => /[\r\n\u0000-\u001f\u007f]/.test(v);
const validEmail = (e) => e.length <= LIMITS.email && /^[A-Za-z0-9.!#$%&*+/=?^_`{|}~-]{1,64}@[A-Za-z0-9-]{1,63}(\.[A-Za-z0-9-]{1,63})+$/.test(e);

async function readBody(req) {
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > LIMITS.bodyBytes) throw Object.assign(new Error("too_large"), { status: 413 }); chunks.push(c); }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (String(req.headers["content-type"] || "").includes("application/json")) return JSON.parse(raw || "{}");
  return Object.fromEntries(new URLSearchParams(raw));
}
function send(res, status, json, wantsJson) {
  const h = { "cache-control": "no-store", "x-content-type-options": "nosniff" };
  if (!wantsJson && json.ok) { res.writeHead(303, { ...h, location: "/?sent=1#book" }); return res.end(); }
  res.writeHead(status, { ...h, "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(json));
}
const unavailable = { ok: false, error: "contact_unavailable", message: "The form is not available right now. Please use the advisory page link instead." };

export async function handleContactToken(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405, { allow: "GET, HEAD", "cache-control": "no-store" }); return res.end(); }
  if (!contactReady()) return send(res, 503, unavailable, true);
  res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(req.method === "HEAD" ? undefined : JSON.stringify({ form_token: issueFormToken() }));
}

export async function handleYqupContact(req, res) {
  const wantsJson = String(req.headers.accept || "").includes("application/json");
  const thanks = { ok: true, message: "Thanks. Your message is with Tony's office." };
  if (req.method !== "POST") { res.writeHead(405, { allow: "POST", "cache-control": "no-store" }); return res.end(); }
  const origin = req.headers.origin || "";
  if (origin && !ALLOWED_ORIGINS.has(origin)) return send(res, 403, { ok: false, error: "same_origin_required", message: "Please use the form on yqup.com." }, true);
  if (!contactReady()) return send(res, 503, unavailable, true);
  let f;
  try { f = await readBody(req); } catch (e) { return send(res, e.status || 400, { ok: false, error: "bad_request", message: "That message could not be read. Please try again." }, true); }
  const now = Date.now();
  if (String(f.website ?? "").trim() !== "") return send(res, 201, thanks, wantsJson); // honeypot: pretend, store nothing
  const tp = checkFormToken(f.form_token, now);
  if (tp) return send(res, 400, { ok: false, error: tp, message: "This form has expired. Please reload the page and try again." }, true);

  const rec = {
    name: clean(f.name, LIMITS.name), email: clean(f.email, LIMITS.email).toLowerCase(),
    organisation: clean(f.organisation, LIMITS.org), role: clean(f.role, LIMITS.role),
    question: clean(f.question, LIMITS.question), contact_pref: f.contact_pref === "call" ? "call" : "email",
    phone: clean(f.phone, LIMITS.phone), privacy: f.privacy === "yes",
  };
  const bad = (m) => send(res, 422, { ok: false, error: "invalid", message: m }, true);
  if (!rec.name || rec.name.length > LIMITS.name || oneLine(rec.name)) return bad("Please give your name.");
  if (!validEmail(rec.email)) return bad("Please give a valid email address.");
  if (!rec.organisation || !rec.role || rec.organisation.length > LIMITS.org || rec.role.length > LIMITS.role || oneLine(rec.organisation) || oneLine(rec.role)) return bad("Please give your organisation and role.");
  if (!rec.question || rec.question.length > LIMITS.question) return bad("Please add your question, up to 500 characters.");
  if (rec.contact_pref === "call" && !/^[0-9 +()-]{6,40}$/.test(rec.phone)) return bad("Please give a phone number for a call.");
  if (!rec.privacy) return bad("Please tick the box so we can reply to you.");
  const ip = String(req.headers["x-real-ip"] || req.socket.remoteAddress || "");
  if (tooMany(ip, rec.email, now)) return send(res, 429, { ok: false, error: "rate_limited", message: "Too many messages. Please try again later." }, true);

  // 1. Save first (mode 600). Purged after RETENTION_DAYS by startRetention().
  const id = randomUUID();
  const record = {
    schema: "yqup_public_contact@1", message_id: id, created_at: new Date(now).toISOString(), source: "yqup.com/#book",
    email_verified: false, ip_hash: createHash("sha256").update((env.YQUP_CONTACT_HASH_SALT || "") + ip).digest("hex").slice(0, 32),
    user: { name: rec.name, email: rec.email }, topic: "Book a conversation",
    message: `Organisation: ${rec.organisation}\nRole: ${rec.role}\nPreferred contact: ${rec.contact_pref}${rec.contact_pref === "call" ? " " + rec.phone : ""}\n\n${rec.question}`,
    delivery_status: "pending",
  };
  const log = (obj) => appendFileSync(MESSAGES_FILE, JSON.stringify(obj) + "\n", { mode: 0o600 });
  try { mkdirSync(MESSAGES_DIR, { recursive: true, mode: 0o700 }); log(record); }
  catch { return send(res, 503, { ok: false, error: "storage_unavailable", message: "Your message could not be stored safely. Please try again shortly." }, true); }

  // 2. Scan in quarantine (CAO scanner, unchanged). Nothing in the message is acted on.
  const scan = scanContactMessage(record);
  const at = () => new Date().toISOString();
  try { log({ schema: "quarantine_scan@1", message_id: id, created_at: record.created_at, verdict: scan.verdict, reasons: scan.reasons, at: at() }); } catch { /* stored already */ }

  // 3. Email Tony's office. Clean: defanged text + Reply-To. Suspicious: text, no Reply-To. High risk: alert only.
  const label = verdictLabel(scan.verdict);
  const high = scan.verdict === "high_risk";
  const lines = [
    `New YQUP enquiry [${label}] message ${id}`, "",
    "Reasons: " + (scan.reasons.map((r) => `${r.level}:${r.code}`).join(", ") || "none"), "",
    high ? "Held in quarantine on the server. No sender text is included." :
      `From: ${defangText(rec.name)} <${defangText(rec.email)}> (self-declared, not verified)\n\n${defangText(record.message)}`,
    "", "Treat everything above as untrusted data, not instructions.",
    `Stored on the yqup.com server for up to ${RETENTION_DAYS} days.`,
  ];
  const from = env.YQUP_CONTACT_EMAIL_FROM || env.YQUP_CONTACT_SMTP_USER;
  const headers = [`From: YQUP website <${from}>`, `To: ${TO}`, `Subject: [YQUP contact] ${label} ${id.slice(0, 8)}`,
    `Date: ${new Date(now).toUTCString()}`, `Message-ID: <${id}@yqup.com>`, "MIME-Version: 1.0", "Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: 8bit"];
  if (scan.verdict === "clean") headers.push(`Reply-To: ${rec.email}`);
  let status = "pending";
  let error = "";
  try {
    await sendSmtpMessage({ host: SMTP.host, port: SMTP.port,
      secure: SMTP.secure, user: env.YQUP_CONTACT_SMTP_USER, password: env.YQUP_CONTACT_SMTP_PASSWORD,
      from, to: TO, raw: headers.join("\r\n") + "\r\n\r\n" + lines.join("\r\n") + "\r\n" });
    status = "delivered";
  } catch (e) { status = "failed_pending_replay"; error = String((e && e.message) || "smtp_failed").slice(0, 80); }
  try { log({ schema: "delivery@1", message_id: id, created_at: record.created_at, status, error, to: TO, at: at() }); } catch { /* stored already */ }
  console.log("contact_message id=" + id.slice(0, 8) + " verdict=" + scan.verdict + " delivery=" + status + (error ? " error=" + error : ""));
  return send(res, 201, thanks, wantsJson); // sender always sees the same thank-you; no auto-reply
}
