import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer, request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const config = {
  "domain": "chiefagenticofficer.com",
  "mode": "cao",
  "gammaOrigin": "https://sites.gamma.app",
  "matomoLoaderPath": "/static/js/matomo-loader.js",
  "analyticsTag": "<script defer src=\"/static/js/matomo-loader.js\"></script>",
  "faviconTag": "<link rel=\"icon\" href=\"/favicon.svg\" type=\"image/svg+xml\">",
  "hostHoldingPages": [],
  "redirectWwwToApex": false,
  "forAgentsPage": true,
  "mcpProxy": {
    "path": "/mcp",
    "target": "http://172.25.0.1:8234",
    "targets": [
      "http://172.25.0.1:8234",
      "http://172.24.0.1:8234",
      "http://172.26.0.1:8234",
      "http://172.27.0.1:8234",
      "http://172.28.0.1:8234",
      "http://172.23.0.1:8234",
      "http://172.22.0.1:8234",
      "http://172.21.0.1:8234",
      "http://172.20.0.1:8234",
      "http://172.19.0.1:8234",
      "http://172.17.0.1:8234"
    ]
  },
  "mailerlite": {
    "signupEndpoint": "/api/briefing-signup",
    "groupId": "190738136197760503",
    "source": "chiefagenticofficer.com"
  }
};
const root = path.dirname(fileURLToPath(import.meta.url));
const listenPort = Number(process.env.PORT || 8080);
const listenHost = process.env.LISTEN_HOST || "0.0.0.0";
const hostHoldingHosts = new Set(config.hostHoldingPages.map((page) => String(page.host || "").toLowerCase()));
const localPageMode = ["holding", "country", "cao", "agentics_home", "ai_ops", "orchistra", "agentic_leader", "snaxk", "gamma"].includes(config.mode);

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".webp", "image/webp"],
]);

const server = createServer(async (req, res) => {
  try {
    await routeRequest(req, res);
  } catch (error) {
    console.error("request_error", error);
    if (!res.headersSent) {
      res.writeHead(500, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
    }
    res.end("internal server error\n");
  }
});

server.listen(listenPort, listenHost, () => {
  console.log("site_server_ready domain=" + config.domain + " mode=" + config.mode + " host=" + listenHost + " port=" + listenPort);
});

async function routeRequest(req, res) {
  const url = new URL(req.url || "/", "http://" + (req.headers.host || config.domain));
  const pathname = url.pathname;
  const requestHost = hostOnly(req.headers.host || "");

  if (config.redirectWwwToApex && requestHost === "www." + hostOnly(config.domain)) {
    redirectToApex(req, res, url);
    return;
  }
  if (isMcpProxyPath(pathname)) {
    await proxyMcp(req, res, url);
    return;
  }

  if (config.mailerlite?.signupEndpoint && pathname === config.mailerlite.signupEndpoint) {
    await handleMailerLiteSignup(req, res);
    return;
  }

  if (pathname === "/for-agents" || pathname === "/for-agents/") {
    await serveLocalFile(req, res, "/for-agents/index.html", "no-store");
    return;
  }

  if (isLocalStaticPath(pathname)) {
    const served = await serveLocalFile(req, res, pathname);
    if (!served) notFound(res);
    return;
  }

  if (hostHoldingHosts.has(requestHost)) {
    await serveLocalFile(req, res, "/hosts/" + requestHost + "/index.html", "no-store");
    return;
  }

  if (localPageMode) {
    await serveLocalFile(req, res, "/index.html", "no-store");
    return;
  }

  await proxyGamma(req, res);
}

function isLocalStaticPath(pathname) {
  return pathname === "/healthz"
    || pathname === "/llms.txt"
    || pathname === "/robots.txt"
    || pathname === "/favicon.svg"
    || pathname === "/matomo-config.json"
    || pathname.startsWith("/.well-known/")
    || pathname.startsWith("/assets/")
    || pathname.startsWith("/static/");
}

function isMcpProxyPath(pathname) {
  const proxyPath = config.mcpProxy?.path;
  return Boolean(proxyPath) && (pathname === proxyPath || pathname.startsWith(proxyPath + "/"));
}

async function serveLocalFile(req, res, requestPath, cacheControl = "public, max-age=300") {
  if (req.method !== "GET" && req.method !== "HEAD") {
    methodNotAllowed(res);
    return true;
  }

  const filePath = safeLocalPath(requestPath);
  if (!filePath) return false;

  let info;
  try {
    info = await stat(filePath);
  } catch {
    return false;
  }
  if (!info.isFile()) return false;

  const headers = {
    "content-type": contentTypeFor(filePath),
    "content-length": String(info.size),
    "cache-control": requestPath === "/healthz" ? "no-store" : cacheControl,
  };

  res.writeHead(200, headers);
  if (req.method === "HEAD") {
    res.end();
    return true;
  }

  createReadStream(filePath).on("error", () => {
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }).pipe(res);
  return true;
}

async function handleMailerLiteSignup(req, res) {
  if (req.method !== "POST") {
    res.writeHead(405, {
      "content-type": "application/json; charset=utf-8",
      "allow": "POST",
      "cache-control": "no-store",
    });
    res.end(JSON.stringify({ ok: false, message: "Signup endpoint accepts POST only." }));
    return;
  }

  if (!config.mailerlite?.groupId) {
    sendJson(res, 503, { ok: false, message: "MailerLite group is not configured for this site." });
    return;
  }

  const token = process.env.MAILERLITE_API_TOKEN || process.env.MAILERLITE_API_KEY;
  if (!token) {
    sendJson(res, 503, {
      ok: false,
      code: "missing_mailerlite_token",
      message: "MailerLite is not configured on this preview server yet.",
    });
    return;
  }

  const fields = await readSignupFields(req);
  if (fields.website) {
    sendJson(res, 200, { ok: true, message: "Thank you." });
    return;
  }

  const email = cleanField(fields.work_email || fields.email).toLowerCase();
  if (!isValidEmail(email)) {
    sendJson(res, 422, { ok: false, message: "Please enter a valid work email address." });
    return;
  }
  if (fields.consent !== "yes") {
    sendJson(res, 422, { ok: false, message: "Please confirm consent to receive the briefing." });
    return;
  }

  const fullFields = {
    name: cleanField(fields.name),
    country: cleanField(fields.country_market),
    role: cleanField(fields.role),
    board_issue: cleanField(fields.board_issue),
    signup_source: config.mailerlite.source || config.domain,
  };
  const safeFields = {
    name: fullFields.name,
    country: fullFields.country,
  };

  const basePayload = {
    email,
    status: "active",
    resubscribe: true,
    groups: [String(config.mailerlite.groupId)],
    fields: pruneEmpty(fullFields),
  };

  let result = await postMailerLiteSubscriber(token, basePayload);
  if (!result.ok && result.status === 422 && Object.keys(basePayload.fields || {}).some((field) => !["name", "country"].includes(field))) {
    result = await postMailerLiteSubscriber(token, {
      ...basePayload,
      fields: pruneEmpty(safeFields),
    });
    result.fieldWarning = "Some site-only fields were not sent because matching MailerLite custom fields may not exist yet.";
  }

  if (!result.ok) {
    console.error("mailerlite_signup_error", {
      status: result.status,
      code: result.body?.message || result.error || "unknown",
    });
    sendJson(res, result.status >= 400 && result.status < 500 ? 422 : 502, {
      ok: false,
      message: "MailerLite could not accept this signup yet.",
    });
    return;
  }

  sendJson(res, 200, {
    ok: true,
    message: "Thank you. Your Chief Agentic Officer Briefing signup has been received.",
    subscriber_id: result.body?.data?.id || null,
    warning: result.fieldWarning || null,
  });
}

function readSignupFields(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 32768) {
        reject(new Error("signup_body_too_large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("error", reject);
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      const contentType = String(req.headers["content-type"] || "").toLowerCase();
      if (contentType.includes("application/json")) {
        try {
          resolve(JSON.parse(body || "{}"));
        } catch {
          resolve({});
        }
        return;
      }
      const params = new URLSearchParams(body);
      const fields = {};
      for (const [key, value] of params.entries()) fields[key] = value;
      resolve(fields);
    });
  });
}

function postMailerLiteSubscriber(token, payload) {
  return new Promise((resolve) => {
    const body = Buffer.from(JSON.stringify(payload), "utf8");
    const apiReq = httpsRequest({
      protocol: "https:",
      hostname: "connect.mailerlite.com",
      method: "POST",
      path: "/api/subscribers",
      headers: {
        "authorization": "Bearer " + token,
        "accept": "application/json",
        "content-type": "application/json",
        "content-length": String(body.length),
      },
    }, (apiRes) => {
      const chunks = [];
      apiRes.on("data", (chunk) => chunks.push(chunk));
      apiRes.on("end", () => {
        const responseText = Buffer.concat(chunks).toString("utf8");
        let parsed = null;
        try {
          parsed = responseText ? JSON.parse(responseText) : null;
        } catch {
          parsed = { message: responseText.slice(0, 200) };
        }
        const status = apiRes.statusCode || 502;
        resolve({ ok: status >= 200 && status < 300, status, body: parsed });
      });
    });
    apiReq.on("error", (error) => resolve({ ok: false, status: 502, error: error.message }));
    apiReq.end(body);
  });
}

function cleanField(value) {
  return String(value || "").trim().slice(0, 240);
}

function pruneEmpty(fields) {
  const output = {};
  for (const [key, value] of Object.entries(fields)) {
    const cleaned = cleanField(value);
    if (cleaned) output[key] = cleaned;
  }
  return output;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));
}

function sendJson(res, status, payload) {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": String(body.length),
    "cache-control": "no-store",
  });
  res.end(body);
}

function safeLocalPath(requestPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(requestPath);
  } catch {
    return "";
  }

  const normalized = path.posix.normalize(decoded).replace(/^\/+/, "");
  const filePath = path.join(root, normalized);
  const relativePath = path.relative(root, filePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) return "";
  return filePath;
}

function contentTypeFor(filePath) {
  return contentTypes.get(path.extname(filePath).toLowerCase()) || "application/octet-stream";
}

function hostOnly(value) {
  return String(value).split(":")[0].trim().toLowerCase();
}

function redirectToApex(req, res, url) {
  res.writeHead(308, {
    "location": "https://" + config.domain + url.pathname + url.search,
    "cache-control": "public, max-age=300",
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  res.end("redirecting to https://" + config.domain + url.pathname + url.search + "\n");
}

function methodNotAllowed(res) {
  res.writeHead(405, {
    "content-type": "text/plain; charset=utf-8",
    "allow": "GET, HEAD",
    "cache-control": "no-store",
  });
  res.end("method not allowed\n");
}

function notFound(res) {
  res.writeHead(404, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
  res.end("not found\n");
}

async function proxyMcp(req, res, url) {
  const targets = (config.mcpProxy.targets || [config.mcpProxy.target]).filter(Boolean);
  const body = await readProxyBody(req, 1024 * 1024);
  let lastError = null;
  for (const targetValue of targets) {
    const result = await proxyMcpToTarget(req, res, url, body, targetValue);
    if (result.ok) return;
    lastError = result.error;
  }
  console.error("mcp_proxy_error", lastError || new Error("no MCP proxy target succeeded"));
  if (!res.headersSent) {
    res.writeHead(502, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
  }
  res.end("bad gateway\n");
}

function proxyMcpToTarget(req, res, url, body, targetValue) {
  return new Promise((resolve) => {
    const target = new URL(targetValue);
    const upstreamReq = httpRequest({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || 80,
      method: req.method,
      path: url.pathname + url.search,
      headers: mcpProxyHeaders(req, target),
    }, (upstreamRes) => {
      const statusCode = upstreamRes.statusCode || 502;
      const headers = responseHeaders(upstreamRes.headers);
      headers["x-cao-mcp-proxy"] = "top-level-sites";
      res.writeHead(statusCode, headers);
      if (req.method === "HEAD") {
        res.end();
        resolve();
        return;
      }
      upstreamRes.pipe(res);
      upstreamRes.on("end", () => resolve({ ok: true }));
    });

    upstreamReq.setTimeout(1200, () => {
      upstreamReq.destroy(new Error("MCP proxy target timed out: " + targetValue));
    });
    upstreamReq.on("error", (error) => {
      resolve({ ok: false, error });
    });

    if (body.length > 0) upstreamReq.write(body);
    upstreamReq.end();
  });
}

function readProxyBody(req, limitBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > limitBytes) {
        reject(new Error("proxy request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
    req.resume();
  });
}

function proxyGamma(req, res) {
  return new Promise((resolve) => {
    const upstreamUrl = new URL(req.url || "/", config.gammaOrigin);
    const upstreamReq = httpsRequest({
      protocol: upstreamUrl.protocol,
      hostname: upstreamUrl.hostname,
      port: upstreamUrl.port || 443,
      method: req.method,
      path: upstreamUrl.pathname + upstreamUrl.search,
      servername: upstreamUrl.hostname,
      headers: upstreamHeaders(req),
    }, (upstreamRes) => {
      const statusCode = upstreamRes.statusCode || 502;
      const headers = responseHeaders(upstreamRes.headers);
      const contentType = String(upstreamRes.headers["content-type"] || "");
      const canInject = Boolean(config.analyticsTag)
        && req.method !== "HEAD"
        && contentType.toLowerCase().includes("text/html");

      if (!canInject) {
        res.writeHead(statusCode, headers);
        if (req.method === "HEAD") {
          res.end();
          resolve();
          return;
        }
        upstreamRes.pipe(res);
        upstreamRes.on("end", resolve);
        return;
      }

      const chunks = [];
      upstreamRes.on("data", (chunk) => chunks.push(chunk));
      upstreamRes.on("end", () => {
        const html = Buffer.concat(chunks).toString("utf8");
        const body = Buffer.from(injectAnalytics(html), "utf8");
        headers["content-type"] = contentType || "text/html; charset=utf-8";
        headers["content-length"] = String(body.length);
        delete headers["content-security-policy"];
        res.writeHead(statusCode, headers);
        res.end(body);
        resolve();
      });
    });

    upstreamReq.on("error", (error) => {
      console.error("gamma_proxy_error", error);
      if (!res.headersSent) {
        res.writeHead(502, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
      }
      res.end("bad gateway\n");
      resolve();
    });

    req.pipe(upstreamReq);
  });
}

function upstreamHeaders(req) {
  const headers = { ...req.headers };
  for (const name of [
    "accept-encoding",
    "connection",
    "host",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
  ]) {
    delete headers[name];
  }
  headers.host = config.domain;
  headers["accept-encoding"] = "identity";
  headers["x-forwarded-host"] = req.headers.host || config.domain;
  return headers;
}

function mcpProxyHeaders(req, target) {
  const headers = { ...req.headers };
  for (const name of [
    "connection",
    "host",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
  ]) {
    delete headers[name];
  }
  headers.host = target.host;
  headers["x-forwarded-host"] = req.headers.host || config.domain;
  return headers;
}

function responseHeaders(source) {
  const headers = { ...source };
  for (const name of [
    "content-encoding",
    "content-length",
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
  ]) {
    delete headers[name];
  }
  headers["x-top-level-sites-container"] = "node";
  return headers;
}

function injectAnalytics(html) {
  let next = html;
  if (config.analyticsTag && !next.includes(config.matomoLoaderPath)) {
    next = injectBeforeHeadClose(next, config.analyticsTag);
  }
  if (config.faviconTag && !hasFaviconReference(next)) {
    next = injectBeforeHeadClose(next, config.faviconTag);
  }
  return next;
}

function hasFaviconReference(html) {
  return /rel=["'][^"']*(?:shortcut\s+)?icon[^"']*["']/i.test(html)
    || /rel=["']apple-touch-icon["']/i.test(html)
    || /\/favicon\./i.test(html);
}

function injectBeforeHeadClose(html, tag) {
  if (/<\/head\s*>/i.test(html)) {
    return html.replace(/<\/head\s*>/i, tag + "\n</head>");
  }
  return tag + "\n" + html;
}
