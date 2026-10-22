// Quarantine scanner for contact-form messages.
// Every message is stored first, then scanned here. Nothing in a message is ever
// acted on: the scan only produces a verdict, reasons and a defanged plain-text copy.

export const VERDICTS = { CLEAN: "clean", SUSPICIOUS: "suspicious", HIGH: "high_risk" };
export const MAX_SCAN_MESSAGE_CHARS = 2000;
export const MAX_SCAN_LINE_CHARS = 1000;
export const MAX_SCAN_TOPIC_CHARS = 100;

const OWN_DOMAIN = "chiefagenticofficer.com";
const SHORTENERS = new Set([
  "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly", "rebrand.ly",
  "cutt.ly", "shorturl.at", "tiny.cc", "rb.gy", "t.ly", "s.id", "lnkd.in", "bl.ink",
]);

const INJECTION_PATTERNS = [
  [/\b(ignore|disregard|forget|override)\b[^.\n]{0,40}\b(previous|prior|above|earlier|all|your|system)\b[^.\n]{0,30}\b(instructions?|prompts?|rules?|directions?|guidelines?)/i, "ignore_instructions"],
  [/\b(system prompt|developer message|jailbreak|DAN mode|act as (an? )?(ai|assistant|admin))\b/i, "ai_role_manipulation"],
  [/\byou are (now )?(an? |the )?(ai|assistant|agent|chatbot|llm|chatgpt|claude|grok|gemini)\b/i, "ai_role_manipulation"],
  [/\b(dear|attention|note to|instructions? for)( the)? (ai|assistant|agent|llm|model|bot)\b/i, "addresses_ai_directly"],
  [/<\|im_start\|>|<\|system\|>|\[INST\]|\[\/INST\]|<<SYS>>|###\s*(system|instruction)/i, "model_control_tokens"],
  [/\b(send|forward|email|reply|cc|bcc)\b[^.\n]{0,30}\b(an? )?(email|message|this|copy|it|them|everything|list)\b[^.\n]{0,20}\bto\b\s*\S+@\S+/i, "send_email_request"],
  [/\b(send|forward|email)\s+(an?\s+)?(email|message)\s+to\b/i, "send_email_request"],
  // A request to run something: the verb must be followed by what to run, so phrases
  // like "a local run of the code" stay clean.
  [/\b(run|execute|exec|eval)\s+(this|that|these|the|my|our|a|following|below)?\s*(following\s+)?(command|script|shell|code|snippet|curl|wget|bash|powershell|python|sudo|rm -rf)\b/i, "command_request"],
  [/(^|\s)(sudo |rm -rf |curl |wget |powershell |cmd\.exe|bash -c|\$\(|`[^`]+`)/i, "command_text"],
  [/\b(use|call|invoke|trigger)\b[^.\n]{0,20}\b(tool|function|plugin|api|webhook|mcp)\b/i, "tool_request"],
  [/\b(delete|export|dump|download)\b[^.\n]{0,30}\b(subscribers?|database|all (users|accounts|emails)|customer list)\b/i, "data_exfiltration_request"],
];
const SECRET_BAIT_PATTERNS = [
  [/\b(send|share|give|tell|provide|confirm|verify|reset|enter)\b[^.\n]{0,25}\b(password|passcode|api ?key|access token|secret|2fa|otp|one[- ]time code|verification code|login details|credentials|recovery code|seed phrase|private key)\b/i, "credential_request", "high"],
  [/\b(bank details|card number|cvv|wire transfer|gift cards?|bitcoin|crypto wallet|invoice attached|urgent payment)\b/i, "payment_bait", "suspicious"],
];
const SPOOF_PATTERNS = [
  [/\b(this is|i am|i'm|it's|from|signed|regards,?)\s+tony( wood)?\b/i, "claims_to_be_tony"],
  [/\bon behalf of tony\b|\btony (asked|told|wants|authori[sz]ed) (me|you)\b/i, "claims_tony_authority"],
  [/\b(cao|chief agentic officer|chiefagenticofficer)\s+(team|staff|support|admin|security|billing)\b/i, "claims_to_be_staff"],
  [/\b(i am|i'm|this is)( the| an?)? (admin|administrator|staff member|support team|security team|site owner|moderator)\b/i, "claims_to_be_staff"],
];
const HTML_HIGH = /<\s*\/?\s*(script|iframe|object|embed|form|meta|base|link|style)\b|javascript\s*:|vbscript\s*:|\bon[a-z]{3,15}\s*=/i;
const HTML_ANY = /<\s*\/?\s*[a-z][a-z0-9]*(\s[^<>]*)?>|&#x?[0-9a-f]+;/i;
const HEADER_LINE = /^(bcc|cc|to|from|subject|reply-to|content-type|mime-version|x-[a-z-]+)\s*:/im;
const HIDDEN_HIGH = /[\u202A-\u202E\u2066-\u2069]|[\u{E0000}-\u{E007F}]/u;
const HIDDEN_ANY = /[\u00AD\u180E\u200B-\u200F\u2060-\u2064\uFEFF]/u;
const URL_RE = /\b((?:h[tx]{2}ps?|ftp):\/\/[^\s<>"')\]]+|www\.[^\s<>"')\]]+|data:[a-z]+\/[a-z0-9.+-]+[;,][^\s]*)/gi;
const BARE_DOMAIN_RE = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|net|org|io|co|ai|app|xyz|top|info|biz|ru|cn|tk|uk|eu|me|ly|gd|link|click|site|online)\b(?:\/[^\s]*)?/gi;

function add(reasons, level, code, detail) {
  if (!reasons.some((r) => r.code === code && r.detail === detail)) reasons.push({ level, code, detail });
}

export function hostOf(url) {
  const cleaned = url.replace(/^hxxp/i, "http").replace(/\[\.\]/g, ".");
  try {
    return new URL(/^[a-z]+:\/\//i.test(cleaned) ? cleaned : `http://${cleaned}`).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function classifyUrl(url) {
  const out = [];
  if (/^data:/i.test(url)) return [["high", "data_uri"]];
  const raw = url.replace(/^[a-z]+:\/\//i, "").split(/[/?#]/)[0];
  const host = hostOf(url);
  if (/@/.test(raw)) out.push(["high", "url_userinfo_trick"]);
  if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(raw) || /^\[[0-9a-f:]+\]/i.test(raw) || /^(0x[0-9a-f]+|\d{8,10})$/i.test(host)) out.push(["high", "ip_address_link"]);
  if (SHORTENERS.has(host.replace(/^www\./, ""))) out.push(["suspicious", "url_shortener"]);
  if (/(^|\.)xn--/i.test(host) || /(^|\.)xn--/i.test(raw) || /[^\x00-\x7f]/.test(raw)) out.push(["high", "punycode_or_unicode_domain"]);
  const own = host === OWN_DOMAIN || host.endsWith(`.${OWN_DOMAIN}`);
  const squashed = host.replace(/[^a-z0-9]/g, "").replace(/0/g, "o").replace(/1/g, "l");
  if (!own && /chiefagentic|agenticofficer|chiefagentlc|chlefagentic/.test(squashed)) out.push(["high", "lookalike_domain"]);
  if (/^ftp:/i.test(url)) out.push(["suspicious", "non_web_link"]);
  return out;
}

export function defangUrl(url) {
  return url
    .replace(/^https?/i, (m) => m.replace(/t/gi, "x"))
    .replace(/^ftp/i, "fxp")
    .replace(/:\/\//, "[://]")
    .replace(/\./g, "[.]");
}

export function revealHidden(text) {
  return String(text).replace(/[\u00AD\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]|[\u{E0000}-\u{E007F}]/gu,
    (ch) => `[U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}]`);
}

export function defangText(text) {
  const revealed = revealHidden(text);
  const parts = [];
  let last = 0;
  for (const match of revealed.matchAll(new RegExp(URL_RE.source, "gi"))) {
    parts.push(defangBare(revealed.slice(last, match.index)), defangUrl(match[0]));
    last = match.index + match[0].length;
  }
  parts.push(defangBare(revealed.slice(last)));
  return parts.join("").replace(/\r\n?/g, "\n");
}

function defangBare(segment) {
  return segment.replace(new RegExp(BARE_DOMAIN_RE.source, "gi"), (m) => m.replace(/\./g, "[.]"));
}

export function findUrls(text) {
  const plain = String(text).normalize("NFKC");
  const urls = [...plain.matchAll(new RegExp(URL_RE.source, "gi"))].map((m) => m[0]);
  const stripped = plain.replace(new RegExp(URL_RE.source, "gi"), " ");
  const bare = [...stripped.matchAll(new RegExp(BARE_DOMAIN_RE.source, "gi"))]
    .map((m) => m[0])
    .filter((d) => !/@/.test(stripped.slice(Math.max(0, stripped.indexOf(d) - 1), stripped.indexOf(d))));
  return [...new Set([...urls, ...bare])];
}

export function scanContactMessage(record) {
  const reasons = [];
  const topic = String(record?.topic ?? "");
  // The self-declared organisation is scanned with the message so it cannot carry instructions.
  const message = String(record?.message ?? "") + (record?.organisation ? `\n${record.organisation}` : "");
  const email = String(record?.user?.email ?? "");
  const name = String(record?.user?.name ?? "");
  const organisation = String(record?.organisation ?? "");
  const normalised = message.normalize("NFKC").replace(/[\u00AD\u200B-\u200F\u2060-\u2064\uFEFF]/g, "");

  // Size.
  if (message.length > MAX_SCAN_MESSAGE_CHARS) add(reasons, "high", "oversize_message", `${message.length} characters`);
  if (topic.length > MAX_SCAN_TOPIC_CHARS) add(reasons, "high", "oversize_topic", `${topic.length} characters`);
  if (message.split(/\r?\n/).some((line) => line.length > MAX_SCAN_LINE_CHARS)) add(reasons, "suspicious", "oversize_line", `a line over ${MAX_SCAN_LINE_CHARS} characters`);

  // Header injection: control characters where a header could be built.
  for (const [field, value] of [["topic", topic], ["account email", email], ["account name", name], ["organisation", organisation]]) {
    if (/[\r\n\u0000\u0085\u2028\u2029]/.test(value)) add(reasons, "high", "header_injection", `line break in ${field}`);
  }
  if (HEADER_LINE.test(message)) add(reasons, "suspicious", "header_like_lines", "message contains email header lines");
  if (/\u0000|[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(message)) add(reasons, "suspicious", "control_characters", "non-printing control characters");

  // HTML and script.
  if (HTML_HIGH.test(message)) add(reasons, "high", "script_or_active_html", "script, frame, event handler or javascript: link");
  else if (HTML_ANY.test(message)) add(reasons, "suspicious", "html_markup", "HTML tags or entities");

  // Hidden text.
  if (HIDDEN_HIGH.test(message)) add(reasons, "high", "hidden_text", "bidirectional override or invisible tag characters");
  if (HIDDEN_ANY.test(message)) add(reasons, "suspicious", "zero_width_text", "zero-width or soft-hyphen characters");
  if (message.normalize("NFKC") !== message && /[\uFF01-\uFF5E]/.test(message)) add(reasons, "suspicious", "fullwidth_obfuscation", "full-width look-alike letters");

  // Encoded payloads.
  if (/[A-Za-z0-9+/]{40,}={0,2}/.test(normalised) && !/^[a-z]+$/i.test(normalised.match(/[A-Za-z0-9+/]{40,}={0,2}/)[0])) add(reasons, "suspicious", "encoded_payload", "long base64-like run");
  if (/\b(?:0x)?[0-9a-f]{48,}\b/i.test(normalised)) add(reasons, "suspicious", "encoded_payload", "long hex run");
  if (/(%[0-9a-f]{2}){5,}/i.test(normalised)) add(reasons, "suspicious", "encoded_payload", "percent-encoded run");
  if (/(\\u[0-9a-f]{4}|\\x[0-9a-f]{2}){4,}/i.test(normalised)) add(reasons, "suspicious", "encoded_payload", "escaped character run");
  if (/\b(base64|rot13|decode this|atob\()/i.test(normalised)) add(reasons, "suspicious", "decode_request", "asks for decoding");

  // AI instructions and actions.
  for (const [pattern, code] of INJECTION_PATTERNS) {
    if (reasons.some((r) => r.code === code)) continue;
    const match = normalised.match(pattern);
    if (match) add(reasons, "high", code, `"${match[0].slice(0, 60)}"`);
  }

  // Credential bait and scams.
  for (const [pattern, code, level] of SECRET_BAIT_PATTERNS) {
    const match = normalised.match(pattern);
    if (match) add(reasons, level, code, `"${match[0].slice(0, 60)}"`);
  }

  // Spoofing Tony or staff.
  for (const [pattern, code] of SPOOF_PATTERNS) {
    const match = normalised.match(pattern);
    if (match) add(reasons, "high", code, `"${match[0].slice(0, 60)}"`);
  }
  if (/\btony\b|\b(admin|support|staff)\b/i.test(name)) {
    add(reasons, "suspicious", "spoofed_display_name", `account name "${name.slice(0, 40)}"`);
  }

  // Public submissions: the sender address was typed in, not verified.
  if (record?.email_verified === false) add(reasons, "info", "self_declared_email", "sender email is self-declared and not verified; treat it as untrusted");

  // Links.
  const urls = findUrls(message);
  for (const url of urls) {
    const flags = classifyUrl(url);
    for (const [level, code] of flags) add(reasons, level, code, defangUrl(url));
    if (!flags.length) add(reasons, "info", "link_present", defangUrl(url));
  }

  const verdict = reasons.some((r) => r.level === "high")
    ? VERDICTS.HIGH
    : reasons.some((r) => r.level === "suspicious") ? VERDICTS.SUSPICIOUS : VERDICTS.CLEAN;
  return { verdict, reasons, link_count: urls.length };
}

export function verdictLabel(verdict) {
  return verdict === VERDICTS.HIGH ? "HIGH RISK" : verdict === VERDICTS.SUSPICIOUS ? "SUSPICIOUS" : "CLEAN";
}
