// Timeline's server. No dependencies, no database, no logs of what people write.
// It serves the page and, only if MODEL_API_KEY is set, one opt-in route that asks
// Muse Spark (Meta Model API) to turn a cleaned story into timeline moments.
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const guard = require("../src/guard.js");
const gen = require("../src/gen.js");

const WEB = path.join(__dirname, "..", "web");
const PORT = Number(process.env.PORT || 8080);
const BASE = (process.env.MODEL_BASE_URL || "https://api.meta.ai/v1").replace(/\/+$/, "");
const MODEL = process.env.MUSE_MODEL || "muse-spark-1.3";
const museReady = () => Boolean(process.env.MODEL_API_KEY);
const PER_MIN = Number(process.env.MUSE_PER_MIN || 4), PER_DAY = Number(process.env.MUSE_PER_DAY || 30), ALL_DAY = Number(process.env.MUSE_ALL_PER_DAY || 600);

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".wasm": "application/wasm", ".txt": "text/plain; charset=utf-8", ".json": "application/json" };
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob:",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  // Llama's weights come from Hugging Face and its WebGPU kernels from GitHub, straight to the visitor's browser
  "connect-src 'self' https://huggingface.co https://*.huggingface.co https://*.hf.co https://cdn-lfs.huggingface.co https://cdn-lfs-us-1.huggingface.co https://cas-bridge.xethub.hf.co https://raw.githubusercontent.com",
  "object-src 'none'", "base-uri 'none'", "form-action 'none'", "frame-ancestors 'none'"
].join("; ");
const SEC = {
  "content-security-policy": CSP,
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  "cross-origin-opener-policy": "same-origin",
  "strict-transport-security": "max-age=31536000"
};

function send(res, code, body, type = "application/json; charset=utf-8", extra = {}) {
  res.writeHead(code, { ...SEC, "content-type": type, "cache-control": "no-store", ...extra });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

// rate limits, in memory only: they reset when the server restarts
const hits = new Map(); let dayCount = 0, dayKey = new Date().toDateString();
function allow(ip) {
  const now = Date.now(), today = new Date().toDateString();
  if (today !== dayKey) { dayKey = today; dayCount = 0; hits.clear(); }
  const h = hits.get(ip) || { min: [], day: 0 };
  h.min = h.min.filter((t) => now - t < 60000);
  if (h.min.length >= PER_MIN || h.day >= PER_DAY || dayCount >= ALL_DAY) return false;
  h.min.push(now); h.day++; dayCount++; hits.set(ip, h);
  if (hits.size > 5000) hits.delete(hits.keys().next().value);
  return true;
}
const clientIp = (req) => {
  const xf = String(req.headers["x-forwarded-for"] || "").split(",").map((s) => s.trim()).filter(Boolean);
  return (process.env.TRUST_PROXY === "1" && xf.length ? xf[xf.length - 1] : req.socket.remoteAddress) || "?";
};

function readBody(req, max) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > max) { reject(Object.assign(new Error("too big"), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function extractJSON(text) {
  const fenced = String(text).match(/```(?:json)?\s*([\s\S]*?)```/i), body = fenced ? fenced[1] : String(text), start = body.indexOf("{");
  if (start < 0) throw new Error("no JSON object");
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < body.length; i++) {
    const c = body[i];
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true; else if (c === "{") depth++; else if (c === "}" && --depth === 0) return JSON.parse(body.slice(start, i + 1));
  }
  throw new Error("unfinished JSON");
}

async function askMuse(story, fetchImpl = fetch) {
  const messages = [{ role: "system", content: gen.SYSTEM }, { role: "user", content: gen.userPrompt(story) }];
  let last;
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 45000);
    try {
      const r = await fetchImpl(`${BASE}/chat/completions`, {
        method: "POST", signal: ctrl.signal,
        headers: { "content-type": "application/json", authorization: `Bearer ${process.env.MODEL_API_KEY}` },
        body: JSON.stringify({ model: MODEL, messages, temperature: 0.4, max_tokens: 1400, response_format: { type: "json_object" } })
      });
      if (!r.ok) { const e = new Error(`Muse answered ${r.status}`); e.status = r.status; throw e; }
      const j = await r.json();
      const checked = gen.checkMoments(extractJSON(j.choices?.[0]?.message?.content || ""));
      if (checked.moments.length >= 2) return checked;
      last = new Error("too few moments");
      messages.push({ role: "user", content: "That answer had too few valid moments. Reply with only the JSON object." });
    } catch (e) {
      last = e; if (e.status && e.status < 500) break;
    } finally { clearTimeout(t); }
  }
  throw last;
}

async function handle(req, res) {
  const url = new URL(req.url, "http://x");
  const p = url.pathname;
  if (p === "/api/health" && req.method === "GET") return send(res, 200, { ok: true, muse: museReady(), model: museReady() ? MODEL : null });
  if (p === "/api/muse") {
    if (req.method !== "POST") return send(res, 405, { error: "Use POST." }, undefined, { allow: "POST" });
    if (!museReady()) return send(res, 503, { error: "Muse isn't switched on for this site. Use Llama on your device or the quiz." });
    if (!/^application\/json\b/i.test(req.headers["content-type"] || "")) return send(res, 415, { error: "Send JSON." });
    const origin = req.headers.origin;
    if (origin && new URL(origin).host !== req.headers.host) return send(res, 403, { error: "Not from this site." });
    if (!allow(clientIp(req))) return send(res, 429, { error: "That's a lot of scrolls. Wait a minute, or use Llama on your device." });
    let body;
    try { body = JSON.parse(await readBody(req, 6 * 1024)); } catch (e) { return send(res, e.status || 400, { error: e.status === 413 ? "That story is too long." : "That wasn't valid JSON." }); }
    const c = guard.clean(body && body.story);
    if (c.empty) return send(res, 400, { error: "Write a sentence or two first." });
    try {
      const out = await askMuse(c.text);
      return send(res, 200, { moments: out.moments, dropped: out.dropped, cut: c.removed.length });
    } catch (e) {
      return send(res, 502, { error: e.status === 401 || e.status === 403 ? "Muse refused this site's key. The site owner needs to check it." : "Muse didn't answer in time. Try again, or use Llama on your device." });
    }
  }
  if (p.startsWith("/api/")) return send(res, 404, { error: "Not found." });
  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, { error: "Read only." }, undefined, { allow: "GET, HEAD" });
  // static files, no directory listing, no dotfiles, no escaping the web folder
  let rel = decodeURIComponent(p).replace(/\\/g, "/");
  if (rel.endsWith("/")) rel += "index.html";
  const file = path.normalize(path.join(WEB, rel));
  if (!file.startsWith(WEB + path.sep) || /\/\./.test(rel)) return send(res, 404, "Not found", "text/plain; charset=utf-8");
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, "Not found", "text/plain; charset=utf-8");
    const ext = path.extname(file), type = TYPES[ext];
    if (!type) return send(res, 404, "Not found", "text/plain; charset=utf-8");
    res.writeHead(200, { ...SEC, "content-type": type, "content-length": st.size, "cache-control": ext === ".html" ? "no-cache" : "public, max-age=86400" });
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

function start(port = PORT) {
  const server = http.createServer((req, res) => handle(req, res).catch(() => send(res, 500, { error: "Something broke." })));
  server.requestTimeout = 60000; server.headersTimeout = 15000;
  return new Promise((r) => server.listen(port, () => r(server)));
}
if (require.main === module) start().then(() => console.log(`Timeline on http://localhost:${PORT}  Muse: ${museReady() ? "on (opt-in)" : "off (no MODEL_API_KEY)"}`));
module.exports = { start, askMuse, allow, extractJSON };
