// Minimal SMTP client for operator contact notifications.
// Port 465 uses implicit TLS; port 587 (or secure="starttls") upgrades with STARTTLS.
// Built on node:net and node:tls only, so the site gains no new dependency.
import { connect as netConnect } from "node:net";
import { connect as tlsConnect } from "node:tls";

export function smtpSecurity(port, secure) {
  const mode = String(secure || "").trim().toLowerCase();
  if (mode === "starttls" || mode === "ssl" || mode === "tls") return mode === "starttls" ? "starttls" : "ssl";
  return Number(port) === 587 ? "starttls" : "ssl";
}

function replyReader(socket) {
  let buffer = "";
  const waiting = [];
  const ready = [];
  socket.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    let index;
    while ((index = buffer.indexOf("\r\n")) >= 0) {
      const line = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      if (/^\d{3} /.test(line)) {
        const next = waiting.shift();
        if (next) next(line); else ready.push(line);
      }
    }
  });
  return () => new Promise((resolve) => {
    if (ready.length) resolve(ready.shift()); else waiting.push(resolve);
  });
}

export async function sendSmtpMessage({
  host, port = 465, secure, user, password, from, to, raw, timeoutMs = 20000,
  connect = tlsConnect, plainConnect = netConnect, upgrade = tlsConnect,
}) {
  const security = smtpSecurity(port, secure);
  let socket = security === "ssl" ? connect({ host, port, servername: host }) : plainConnect({ host, port });
  let failed = null;
  const guard = (s) => {
    s.setTimeout(timeoutMs, () => { failed = new Error("smtp_timeout"); s.destroy(); });
    s.on("error", () => { failed = failed || new Error("smtp_connection_failed"); });
  };
  guard(socket);
  let read = replyReader(socket);
  const expect = async (code, step) => {
    const line = await Promise.race([
      read(),
      new Promise((_, reject) => socket.once("close", () => reject(failed || new Error("smtp_closed")))),
    ]);
    // Never echo server text that could include credentials; codes only.
    if (Number(line.slice(0, 3)) !== code) throw new Error(`smtp_unexpected_${line.slice(0, 3)}_at_${step}`);
    return line;
  };
  const send = (line) => socket.write(line + "\r\n");
  try {
    await expect(220, "greeting");
    send("EHLO chiefagenticofficer.com"); await expect(250, "ehlo");
    if (security === "starttls") {
      send("STARTTLS"); await expect(220, "starttls");
      socket.removeAllListeners("data");
      socket = upgrade({ socket, servername: host });
      guard(socket);
      read = replyReader(socket);
      send("EHLO chiefagenticofficer.com"); await expect(250, "ehlo_tls");
    }
    send(`AUTH PLAIN ${Buffer.from(`\u0000${user}\u0000${password}`).toString("base64")}`);
    await expect(235, "auth");
    send(`MAIL FROM:<${from}>`); await expect(250, "mail_from");
    send(`RCPT TO:<${to}>`); await expect(250, "rcpt_to");
    send("DATA"); await expect(354, "data");
    send(dotStuff(raw) + "\r\n.");
    const queued = await expect(250, "message");
    send("QUIT");
    socket.end();
    return { accepted: true, reply: queued.slice(0, 120) };
  } catch (error) {
    socket.destroy();
    throw error;
  }
}

export function dotStuff(raw) {
  return String(raw).replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..");
}
