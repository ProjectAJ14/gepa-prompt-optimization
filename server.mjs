#!/usr/bin/env node
// Serves the walkthrough and runs its live model calls through `claude -p`. No dependencies.
//
//   node server.mjs                 live: calls are made, and every answer is cached in .cache/llm.json
//   node server.mjs --replay        stage-safe: answers only from the cache, never calls a model
//   node server.mjs --port 8788
//
// One model acts (runs the prompt), a different one grades, a third coaches (reads the failures and rewrites the prompt).
// Override with ACTOR_MODEL, GRADER_MODEL and COACH_MODEL.
// Calls use your Claude login, not an API key (ANTHROPIC_API_KEY is removed from the child's environment).
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (name, fallback) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : fallback; };
const PORT = Number(opt("--port", process.env.PORT || 8787));
const REPLAY = argv.includes("--replay");
const ACTOR = process.env.ACTOR_MODEL || "claude-haiku-4-5";
const GRADER = process.env.GRADER_MODEL || "claude-haiku-5-5";
const COACH = process.env.COACH_MODEL || "claude-sonnet-5-5";
const ACTOR_SYSTEM = "You are a helpful assistant.";
const COACH_SYSTEM = "You improve prompts. You change only what the evidence justifies.";
const GRADER_SYSTEM = "You grade pipeline failure classifiers. Judge only what the reply says.";
const LABELS = ["SCHEMA_DRIFT", "LATE_DATA", "RESOURCE_EXHAUSTED", "DATA_QUALITY", "UPSTREAM_FAILURE"];
const GRADE_SCHEMA = {
  type: "object",
  properties: { right_idea: { type: "boolean" }, why: { type: "string" } },
  required: ["right_idea", "why"],
  additionalProperties: false,
};
const TIMEOUT_MS = 100_000;
const MAX_PARALLEL = 4;
const MAX_BODY = 32 * 1024;
const MAX_TEXT = 6000;

/* ---------- cache: one JSON file, written atomically ---------- */
const CACHE_DIR = process.env.CACHE_DIR ? path.resolve(process.env.CACHE_DIR) : path.join(ROOT, ".cache");
const CACHE_FILE = path.join(CACHE_DIR, "llm.json");
let cache = {};
if (fs.existsSync(CACHE_FILE)) {
  try {
    cache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
    if (!cache || typeof cache !== "object" || Array.isArray(cache)) throw new Error("the file is not a JSON object");
  } catch (e) {
    // Never overwrite recordings we cannot read: keep the damaged file beside the new one, and say so.
    const kept = path.join(CACHE_DIR, `llm.corrupt-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    try { fs.renameSync(CACHE_FILE, kept); } catch { /* best effort */ }
    console.error(`WARNING: ${CACHE_FILE} could not be read (${e.message}). Moved to ${kept}. Starting with no recordings.`);
    cache = {};
    if (REPLAY) { console.error("Replay mode needs recordings: stopping."); process.exit(1); }
  }
}
let saveTimer = null;
let generation = 0; // bumped by /api/reset, so a call that was already running cannot write into the emptied cache
function flushCache() {
  clearTimeout(saveTimer);
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const tmp = CACHE_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(cache));
  fs.renameSync(tmp, CACHE_FILE);
}
function saveCache() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushCache, 200);
}
const keyOf = (...parts) => crypto.createHash("sha256").update(parts.join("\u0000")).digest("hex");

/* ---------- running claude -p: a plain model call, nothing else ---------- */
const live = new Set(); // running child processes, killed on shutdown
let running = 0;
const waiting = [];
const slot = () => new Promise((resolve) => { if (running < MAX_PARALLEL) { running++; resolve(); } else waiting.push(resolve); });
const release = () => { const next = waiting.shift(); if (next) next(); else running--; };

function claudeCall({ model, system, prompt, schema }) {
  const args = [
    "-p", "--model", model, "--output-format", "json", "--system-prompt", system,
    "--tools", "", "--strict-mcp-config", "--no-session-persistence",
    // No plugins, hooks, MCP servers or CLAUDE.md: the prompt under test is the whole input.
    "--safe-mode", "--settings", JSON.stringify({ disableAllHooks: true, apiKeyHelper: null }),
  ];
  if (schema) args.push("--json-schema", JSON.stringify(schema));
  const env = { ...process.env };
  for (const name of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "CLAUDE_CODE_USE_BEDROCK", "CLAUDE_CODE_USE_VERTEX"]) delete env[name];
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const child = spawn("claude", args, { env, cwd: os.tmpdir(), stdio: ["pipe", "pipe", "pipe"], detached: true });
    live.add(child);
    let out = "", err = "", done = false;
    const finish = (fn, value) => { if (done) return; done = true; clearTimeout(timer); fn(value); };
    const kill = () => { try { process.kill(-child.pid, "SIGKILL"); } catch { /* already gone */ } };
    const timer = setTimeout(() => { kill(); finish(reject, new Error(`claude -p timed out after ${TIMEOUT_MS / 1000} s`)); }, TIMEOUT_MS);
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { err = (err + d).slice(-1500); });
    child.on("error", (e) => finish(reject, new Error(e.code === "ENOENT" ? "the claude CLI was not found on PATH" : e.message)));
    child.on("close", () => {
      live.delete(child);
      let j;
      try { j = JSON.parse(out); } catch { return finish(reject, new Error("claude -p printed no JSON: " + (err.trim() || out.slice(0, 200)))); }
      if (!j || typeof j !== "object") return finish(reject, new Error("claude -p printed JSON that is not an object: " + out.slice(0, 100)));
      if (j.is_error || j.subtype !== "success") return finish(reject, new Error(String(j.result || j.subtype || "claude -p failed").slice(0, 300)));
      const u = j.usage || {};
      finish(resolve, {
        text: typeof j.result === "string" ? j.result : "",
        structured: j.structured_output ?? null,
        model,
        ms: j.duration_ms ?? Date.now() - started,
        costUsd: j.total_cost_usd ?? null,
        tokens: { input: u.input_tokens ?? 0, cacheWrite: u.cache_creation_input_tokens ?? 0, cacheRead: u.cache_read_input_tokens ?? 0, output: u.output_tokens ?? 0 },
      });
    });
    child.stdin.end(prompt);
  });
}

// `fresh` skips the recording and calls the model again (the new answer replaces the recorded one).
// Identical calls that are already running share one model call. `label` names the call in a replay miss.
const inflight = new Map();
function cached(key, make, fresh = false, label = "") {
  if (!fresh && cache[key]) return Promise.resolve({ ...cache[key], cached: true });
  if (REPLAY) return Promise.reject(Object.assign(new Error(fresh ? "replay mode never calls a model" : `not recorded: ${label || "this call"}. Run without --replay once to record it`), { status: 503 }));
  if (!fresh && inflight.has(key)) return inflight.get(key);
  const run = (async () => {
    await slot();
    const gen = generation;
    try {
      const result = { ...(await make()), at: new Date().toISOString() };
      if (gen === generation) { cache[key] = result; saveCache(); }
      return { ...result, cached: false };
    } finally { release(); }
  })();
  if (!fresh) { inflight.set(key, run); const clear = () => inflight.delete(key); run.then(clear, clear); }
  return run;
}

const snippet = (t) => JSON.stringify(String(t).slice(0, 60));
const act = ({ prompt, fresh }) => cached(keyOf("act", ACTOR, ACTOR_SYSTEM, prompt), async () => {
  const r = await claudeCall({ model: ACTOR, system: ACTOR_SYSTEM, prompt });
  if (!r.text.trim()) throw Object.assign(new Error("the model returned an empty reply"), { status: 502 });
  return r;
}, fresh === true, `${ACTOR} act ${snippet(prompt)}`);

// The page builds the coach's whole input (so it can show the exact text) and the server only runs it.
const coach = ({ prompt, fresh }) => cached(keyOf("coach", COACH, COACH_SYSTEM, prompt), async () => {
  const r = await claudeCall({ model: COACH, system: COACH_SYSTEM, prompt });
  if (!r.text.trim()) throw Object.assign(new Error("the Coach returned an empty reply"), { status: 502 });
  return r;
}, fresh === true, `${COACH} coach ${snippet(prompt)}`);

function gradePrompt({ log, expected, reply }) {
  return [
    "A model was asked to classify a data-pipeline failure log. Decide whether its reply identifies the correct kind of failure.",
    "Ignore format, length and style. Judge only the idea.",
    "", `Allowed kinds: ${LABELS.join(", ")}`, `Log: ${log}`, `Correct kind: ${expected}`, "", "Model reply:", reply, "",
    "Answer with right_idea (true or false) and why (at most 12 words).",
  ].join("\n");
}
const grade = async (b) => {
  const prompt = gradePrompt(b);
  const r = await cached(keyOf("grade", GRADER, GRADER_SYSTEM, prompt), async () => {
    const x = await claudeCall({ model: GRADER, system: GRADER_SYSTEM, prompt, schema: GRADE_SCHEMA });
    // A grader that answers without a verdict must not be recorded as "wrong idea": that would be a false finding replayed forever.
    if (!x.structured || typeof x.structured.right_idea !== "boolean") throw Object.assign(new Error("the grader returned no verdict"), { status: 502 });
    return x;
  }, b.fresh === true, `${GRADER} grade ${snippet(b.log)}`);
  const s = r.structured || {};
  return { ...r, rightIdea: s.right_idea === true, why: String(s.why || "") };
};

/* ---------- http ---------- */
const send = (res, status, body, type = "application/json; charset=utf-8") => {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
const str = (v, max = MAX_TEXT) => typeof v === "string" && v.length > 0 && v.length <= max;
const hostOk = (req) => ["127.0.0.1:" + PORT, "localhost:" + PORT].includes(req.headers.host || "");

const server = http.createServer(async (req, res) => {
  try {
    if (!hostOk(req)) return send(res, 403, { error: "bad host" });
    const url = new URL(req.url, "http://x");
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      return send(res, 200, fs.readFileSync(path.join(ROOT, "index.html")), "text/html; charset=utf-8");
    }
    if (req.method === "GET" && url.pathname === "/api/health") {
      return send(res, 200, { ok: true, mode: REPLAY ? "replay" : "live", actor: ACTOR, grader: GRADER, coach: COACH, recorded: Object.keys(cache).length });
    }
    if (req.method === "POST" && url.pathname.startsWith("/api/")) {
      // A custom header plus JSON makes a cross-site form post impossible: it would need a CORS preflight, which we never grant.
      if (req.headers["x-walkthrough"] !== "1" || !String(req.headers["content-type"] || "").startsWith("application/json")) return send(res, 400, { error: "bad request" });
      const chunks = []; let size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > MAX_BODY) return send(res, 413, { error: "request body too large" }); chunks.push(chunk); }
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch { return send(res, 400, { error: "the request body is not valid JSON" }); }
      if (!body || typeof body !== "object" || Array.isArray(body)) return send(res, 400, { error: "the request body must be a JSON object" });
      if (url.pathname === "/api/reset") {
        // Start from empty: forget every recorded call, keeping a timestamped backup beside it.
        if (REPLAY) return send(res, 503, { error: "replay mode never changes the recording" });
        const cleared = Object.keys(cache).length;
        let backup = null;
        fs.mkdirSync(CACHE_DIR, { recursive: true });
        if (cleared) { backup = `llm.${new Date().toISOString().replace(/[:.]/g, "-")}.json`; fs.writeFileSync(path.join(CACHE_DIR, backup), JSON.stringify(cache)); }
        cache = {};
        generation++;
        inflight.clear();
        clearTimeout(saveTimer);
        fs.writeFileSync(CACHE_FILE, "{}");
        return send(res, 200, { cleared, backup });
      }
      if (url.pathname === "/api/act") {
        if (!str(body.prompt, 4000)) return send(res, 400, { error: "prompt must be 1 to 4000 characters" });
        return send(res, 200, await act(body));
      }
      if (url.pathname === "/api/coach") {
        if (!str(body.prompt, 12000)) return send(res, 400, { error: "prompt must be 1 to 12000 characters" });
        return send(res, 200, await coach(body));
      }
      if (url.pathname === "/api/grade") {
        if (!str(body.log, 1000)) return send(res, 400, { error: "log must be 1 to 1000 characters" });
        if (!str(body.reply, 20000)) return send(res, 400, { error: "reply must be 1 to 20000 characters" });
        if (!LABELS.includes(body.expected)) return send(res, 400, { error: "expected must be one of the allowed labels" });
        return send(res, 200, await grade(body));
      }
    }
    return send(res, 404, { error: "not found" });
  } catch (e) {
    return send(res, e.status || 500, { error: String(e.message || e) });
  }
});
// Save the last recordings and stop the model processes on Ctrl+C or a stop signal.
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => {
  for (const c of live) { try { process.kill(-c.pid, "SIGKILL"); } catch { /* gone */ } }
  try { if (!REPLAY) flushCache(); } catch { /* nothing to save */ }
  process.exit(0);
});
server.listen(PORT, "127.0.0.1", () => {
  console.log(`Walkthrough: http://127.0.0.1:${PORT}   (${REPLAY ? "replay only" : "live"})`);
  console.log(`Actor  ${ACTOR}\nGrader ${GRADER}\nCoach  ${COACH}\nCache  ${Object.keys(cache).length} recorded call(s) in ${CACHE_FILE}`);
});
