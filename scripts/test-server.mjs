#!/usr/bin/env node
// Tests for server.mjs with a fake `claude` CLI, so no model is called and nothing is spent.
//   node scripts/test-server.mjs
// The fake claude answers like `claude -p --output-format json`: it echoes the model and prompt, and fails on a magic word in the prompt.
// Each test uses its own throwaway cache directory. The real .cache is never touched.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const work = fs.mkdtempSync(path.join(os.tmpdir(), "gepa-server-test-"));
const bin = path.join(work, "bin");
fs.mkdirSync(bin);
const callLog = path.join(work, "calls.log");
fs.writeFileSync(path.join(bin, "claude"), `#!/usr/bin/env node
const fs = require("fs");
const args = process.argv.slice(2);
const model = args[args.indexOf("--model") + 1];
const structured = args.includes("--json-schema");
let input = "";
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  fs.appendFileSync(${JSON.stringify(callLog)}, model + "\\n");
  if (input.includes("FAIL_JSON")) { process.stdout.write("not json at all"); return; }
  if (input.includes("NULL_OUT")) { process.stdout.write("null"); return; }
  const done = (out) => setTimeout(() => process.stdout.write(JSON.stringify(out)), input.includes("SLOW_CALL") ? 700 : 0);
  if (input.includes("FAIL_EXIT")) { process.stdout.write(JSON.stringify({ type: "result", subtype: "error_during_execution", is_error: true, result: "boom" })); return; }
  const out = { type: "result", subtype: "success", is_error: false, result: "echo " + model + ": " + input.slice(0, 40), duration_ms: 12, total_cost_usd: 0.001,
    usage: { input_tokens: 10, cache_creation_input_tokens: 0, cache_read_input_tokens: 5, output_tokens: 7 } };
  if (input.includes("EMPTY_REPLY")) out.result = "";
  if (structured && !input.includes("NO_VERDICT")) out.structured_output = { right_idea: true, why: "fine" };
  done(out);
});
`, { mode: 0o755 });
const calls = () => (fs.existsSync(callLog) ? fs.readFileSync(callLog, "utf8").trim().split("\n").filter(Boolean).length : 0);

let nextPort = 8800 + Math.floor(Math.random() * 100);
const children = [];
async function start({ replay = false, cacheDir } = {}) {
  const port = nextPort++;
  const dir = cacheDir || fs.mkdtempSync(path.join(work, "cache-"));
  const args = [path.join(ROOT, "server.mjs"), "--port", String(port)].concat(replay ? ["--replay"] : []);
  const child = spawn(process.execPath, args, { env: { ...process.env, PATH: bin + path.delimiter + process.env.PATH, CACHE_DIR: dir }, stdio: ["ignore", "pipe", "pipe"] });
  children.push(child);
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("server did not start")), 8000);
    child.stdout.on("data", (d) => { if (String(d).includes("Walkthrough:")) { clearTimeout(t); resolve(); } });
    child.on("exit", (c) => { clearTimeout(t); reject(new Error("server exited " + c)); });
  });
  const exited = new Promise((r) => child.on("exit", r));
  return { port, dir, stop: () => { child.kill(); return exited; } };
}
after(() => { for (const c of children) c.kill(); fs.rmSync(work, { recursive: true, force: true }); });

function request(port, { method = "GET", url = "/", headers = {}, body, host } = {}) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : typeof body === "string" ? body : JSON.stringify(body);
    const h = { host: host || `127.0.0.1:${port}`, ...headers };
    if (data !== null) h["content-length"] = Buffer.byteLength(data);
    const req = http.request({ host: "127.0.0.1", port, method, path: url, headers: h }, (res) => {
      let text = "";
      res.on("data", (d) => (text += d));
      res.on("end", () => { let json = null; try { json = JSON.parse(text); } catch { /* not json */ } resolve({ status: res.statusCode, text, json, headers: res.headers }); });
    });
    req.on("error", reject);
    if (data !== null) req.write(data);
    req.end();
  });
}
const post = (port, url, body, extra = {}) => request(port, { method: "POST", url, body, headers: { "content-type": "application/json", "x-walkthrough": "1", ...extra } });

test("health reports the three models, the mode and the cache size", async () => {
  const s = await start();
  const r = await request(s.port, { url: "/api/health" });
  assert.equal(r.status, 200);
  assert.deepEqual(Object.keys(r.json).sort(), ["actor", "coach", "grader", "mode", "ok", "recorded"]);
  assert.equal(r.json.mode, "live");
  assert.equal(r.json.recorded, 0);
  assert.notEqual(r.json.actor, r.json.grader);
  assert.notEqual(r.json.coach, r.json.grader);
  s.stop();
});

test("serves the page and refuses unknown paths and traversal", async () => {
  const s = await start();
  assert.equal((await request(s.port, { url: "/" })).status, 200);
  assert.match((await request(s.port, { url: "/" })).text, /<title>/);
  assert.equal((await request(s.port, { url: "/nope" })).status, 404);
  assert.equal((await request(s.port, { url: "/../server.mjs" })).status, 404);
  assert.equal((await request(s.port, { url: "/api/act" })).status, 404, "GET on a POST route");
  s.stop();
});

test("a wrong Host header is refused, so a DNS-rebinding page gets nothing", async () => {
  const s = await start();
  for (const host of ["evil.example", `evil.example:${s.port}`, "127.0.0.1", `127.0.0.1.evil.example:${s.port}`]) {
    assert.equal((await request(s.port, { url: "/api/health", host })).status, 403, host);
  }
  assert.equal((await request(s.port, { url: "/api/health", host: `localhost:${s.port}` })).status, 200);
  s.stop();
});

test("POST needs the custom header and a JSON content type", async () => {
  const s = await start();
  const body = { prompt: "hello" };
  assert.equal((await request(s.port, { method: "POST", url: "/api/act", body, headers: { "content-type": "application/json" } })).status, 400, "no x-walkthrough");
  assert.equal((await request(s.port, { method: "POST", url: "/api/act", body, headers: { "x-walkthrough": "1" } })).status, 400, "no content type");
  assert.equal((await request(s.port, { method: "POST", url: "/api/act", body, headers: { "x-walkthrough": "1", "content-type": "text/plain" } })).status, 400, "text/plain");
  assert.equal(calls(), 0, "no model call was made by a refused request");
  s.stop();
});

test("input validation: act, grade and coach", async () => {
  const s = await start();
  for (const body of [{}, { prompt: "" }, { prompt: 5 }, { prompt: "x".repeat(4001) }]) assert.equal((await post(s.port, "/api/act", body)).status, 400, JSON.stringify(body).slice(0, 40));
  const g = { log: "a log", reply: "a reply", expected: "LATE_DATA" };
  for (const bad of [{ ...g, expected: "NOPE" }, { ...g, log: "" }, { ...g, reply: undefined }, { ...g, expected: undefined }, { ...g, log: "x".repeat(1001) }]) assert.equal((await post(s.port, "/api/grade", bad)).status, 400, JSON.stringify(bad).slice(0, 50));
  for (const body of [{}, { prompt: "" }, { prompt: "x".repeat(12001) }]) assert.equal((await post(s.port, "/api/coach", body)).status, 400);
  assert.equal(calls(), 0, "nothing invalid reached the model");
  s.stop();
});

test("malformed or oversized JSON gives a clear error, not a hang or a crash", async () => {
  const s = await start();
  const h = { "content-type": "application/json", "x-walkthrough": "1" };
  for (const raw of ["{not json", "null", "[]", "5", '"text"']) {
    const bad = await request(s.port, { method: "POST", url: "/api/act", body: raw, headers: h });
    assert.equal(bad.status, 400, raw);
    assert.ok(bad.json && bad.json.error, "has an error message: " + raw);
  }
  const big = await request(s.port, { method: "POST", url: "/api/act", body: JSON.stringify({ prompt: "x".repeat(40000) }), headers: { "content-type": "application/json", "x-walkthrough": "1" } });
  assert.equal(big.status, 413);
  assert.equal((await request(s.port, { url: "/api/health" })).status, 200, "still alive");
  s.stop();
});

test("act: result shape, cache hit, and fresh re-calls the model", async () => {
  const s = await start();
  const before = calls();
  const a = await post(s.port, "/api/act", { prompt: "classify this" });
  assert.equal(a.status, 200);
  assert.equal(a.json.cached, false);
  assert.ok(a.json.at && !Number.isNaN(Date.parse(a.json.at)), "ISO timestamp");
  assert.ok(a.json.model && a.json.text.startsWith("echo "));
  assert.equal(a.json.ms, 12);
  assert.deepEqual(a.json.tokens, { input: 10, cacheWrite: 0, cacheRead: 5, output: 7 });
  assert.equal(a.json.costUsd, 0.001);
  const b = await post(s.port, "/api/act", { prompt: "classify this" });
  assert.equal(b.json.cached, true);
  assert.equal(b.json.at, a.json.at, "a recorded answer keeps its original time");
  assert.equal(calls() - before, 1, "second call came from the cache");
  const c = await post(s.port, "/api/act", { prompt: "classify this", fresh: true });
  assert.equal(c.json.cached, false);
  assert.equal(calls() - before, 2, "fresh calls the model again");
  assert.equal((await request(s.port, { url: "/api/health" })).json.recorded, 1, "one key, replaced");
  s.stop();
});

test("act, grade and coach use three different models", async () => {
  const s = await start();
  const a = await post(s.port, "/api/act", { prompt: "p" });
  const g = await post(s.port, "/api/grade", { log: "l", reply: "r", expected: "LATE_DATA" });
  const c = await post(s.port, "/api/coach", { prompt: "p" });
  assert.equal(new Set([a.json.model, g.json.model, c.json.model]).size, 3);
  assert.equal(g.json.rightIdea, true);
  assert.equal(g.json.why, "fine");
  s.stop();
});

test("a failing model call returns an error and does not leak a slot", async () => {
  const s = await start();
  for (let i = 0; i < 6; i++) {
    const r = await post(s.port, "/api/act", { prompt: "FAIL_JSON " + i });
    assert.equal(r.status, 500);
    assert.ok(r.json.error && r.json.error.length > 3);
    const e = await post(s.port, "/api/act", { prompt: "FAIL_EXIT " + i });
    assert.equal(e.status, 500);
    assert.match(e.json.error, /boom/);
  }
  const ok = await post(s.port, "/api/act", { prompt: "after the failures" });
  assert.equal(ok.status, 200, "more failures than parallel slots, and the next call still runs");
  assert.equal((await request(s.port, { url: "/api/health" })).json.recorded, 1, "failures are never recorded");
  s.stop();
});

test("many calls at once all complete", async () => {
  const s = await start();
  const rs = await Promise.all(Array.from({ length: 12 }, (_, i) => post(s.port, "/api/act", { prompt: "parallel " + i })));
  assert.ok(rs.every((r) => r.status === 200));
  assert.equal(new Set(rs.map((r) => r.json.text)).size, 12);
  s.stop();
});

test("reset backs up the recordings, empties them, and the next call is live", async () => {
  const s = await start();
  await post(s.port, "/api/act", { prompt: "one" });
  await post(s.port, "/api/act", { prompt: "two" });
  const r = await post(s.port, "/api/reset", {});
  assert.equal(r.status, 200);
  assert.equal(r.json.cleared, 2);
  assert.match(r.json.backup, /^llm\..*\.json$/);
  assert.equal(Object.keys(JSON.parse(fs.readFileSync(path.join(s.dir, r.json.backup), "utf8"))).length, 2, "backup holds both calls");
  assert.equal((await request(s.port, { url: "/api/health" })).json.recorded, 0);
  const before = calls();
  assert.equal((await post(s.port, "/api/act", { prompt: "one" })).json.cached, false);
  assert.equal(calls() - before, 1);
  assert.equal((await post(s.port, "/api/reset", {})).json.cleared, 1);
  assert.equal((await post(s.port, "/api/reset", {})).json.backup, null, "nothing to back up when already empty");
  s.stop();
});

test("recordings survive a restart, and a corrupt cache file does not stop the server", async () => {
  const dir = fs.mkdtempSync(path.join(work, "cache-"));
  const s1 = await start({ cacheDir: dir });
  await post(s1.port, "/api/act", { prompt: "persist me" });
  await new Promise((r) => setTimeout(r, 500)); // the cache is written 200 ms after the call
  await s1.stop();
  const s2 = await start({ cacheDir: dir });
  assert.equal((await request(s2.port, { url: "/api/health" })).json.recorded, 1);
  assert.equal((await post(s2.port, "/api/act", { prompt: "persist me" })).json.cached, true);
  await s2.stop();
  fs.writeFileSync(path.join(dir, "llm.json"), "{ this is not json");
  const s3 = await start({ cacheDir: dir });
  assert.equal((await request(s3.port, { url: "/api/health" })).json.recorded, 0, "starts empty instead of crashing");
  assert.ok(fs.readdirSync(dir).some((f) => f.startsWith("llm.corrupt-")), "the damaged file is kept, not overwritten");
  await s3.stop();
});

test("replay mode answers only from the recording and never calls a model", async () => {
  const dir = fs.mkdtempSync(path.join(work, "cache-"));
  const live = await start({ cacheDir: dir });
  await post(live.port, "/api/act", { prompt: "recorded" });
  await post(live.port, "/api/coach", { prompt: "recorded coach" });
  await new Promise((r) => setTimeout(r, 500));
  live.stop();
  const before = calls();
  const rp = await start({ replay: true, cacheDir: dir });
  assert.equal((await request(rp.port, { url: "/api/health" })).json.mode, "replay");
  const hit = await post(rp.port, "/api/act", { prompt: "recorded" });
  assert.equal(hit.status, 200);
  assert.equal(hit.json.cached, true);
  const miss = await post(rp.port, "/api/act", { prompt: "never recorded" });
  assert.equal(miss.status, 503);
  assert.match(miss.json.error, /not recorded/);
  const fresh = await post(rp.port, "/api/act", { prompt: "recorded", fresh: true });
  assert.equal(fresh.status, 503, "Run now is refused in replay");
  assert.equal((await post(rp.port, "/api/coach", { prompt: "recorded coach" })).status, 200);
  assert.equal((await post(rp.port, "/api/reset", {})).status, 503, "replay never changes the recording");
  assert.equal(calls(), before, "no model was called in replay");
  rp.stop();
});

test("a grader or actor that answers with nothing is an error, never a recorded verdict", async () => {
  const s = await start();
  const g = await post(s.port, "/api/grade", { log: "NO_VERDICT log", reply: "r", expected: "LATE_DATA" });
  assert.equal(g.status, 502);
  assert.match(g.json.error, /no verdict/);
  const a = await post(s.port, "/api/act", { prompt: "EMPTY_REPLY please" });
  assert.equal(a.status, 502);
  assert.match(a.json.error, /empty reply/);
  const c = await post(s.port, "/api/coach", { prompt: "EMPTY_REPLY coach" });
  assert.equal(c.status, 502);
  assert.equal((await request(s.port, { url: "/api/health" })).json.recorded, 0, "nothing was recorded");
  s.stop();
});

test("a model that prints JSON null does not crash the server", async () => {
  const s = await start();
  const r = await post(s.port, "/api/act", { prompt: "NULL_OUT" });
  assert.equal(r.status, 500);
  assert.equal((await request(s.port, { url: "/api/health" })).status, 200, "still alive");
  s.stop();
});

test("a grade request accepts a long actor reply (up to 20000 characters) and says which field is wrong", async () => {
  const s = await start();
  assert.equal((await post(s.port, "/api/grade", { log: "l", reply: "x".repeat(12000), expected: "LATE_DATA" })).status, 200);
  const bad = await post(s.port, "/api/grade", { log: "l", reply: "x".repeat(20001), expected: "LATE_DATA" });
  assert.equal(bad.status, 400);
  assert.match(bad.json.error, /reply/);
  s.stop();
});

test("identical calls that are already running share one model call", async () => {
  const s = await start();
  const before = calls();
  const rs = await Promise.all([1, 2, 3].map(() => post(s.port, "/api/act", { prompt: "SLOW_CALL share me" })));
  assert.ok(rs.every((r) => r.status === 200));
  assert.equal(calls() - before, 1, "three requests, one model call");
  s.stop();
});

test("a call that finishes after a reset does not write into the emptied cache", async () => {
  const s = await start();
  const slow = post(s.port, "/api/act", { prompt: "SLOW_CALL straddles the reset" });
  await new Promise((r) => setTimeout(r, 200));
  assert.equal((await post(s.port, "/api/reset", {})).status, 200);
  assert.equal((await slow).status, 200, "the caller still gets its answer");
  await new Promise((r) => setTimeout(r, 400));
  assert.equal((await request(s.port, { url: "/api/health" })).json.recorded, 0, "but the cache stays empty");
  s.stop();
});

test("a replay miss names the call, and a stop signal saves the last recording", async () => {
  const dir = fs.mkdtempSync(path.join(work, "cache-"));
  const live = await start({ cacheDir: dir });
  await post(live.port, "/api/act", { prompt: "saved on exit" });
  await live.stop(); // SIGTERM straight after the call: the 200 ms debounce must not lose it
  assert.equal(Object.keys(JSON.parse(fs.readFileSync(path.join(dir, "llm.json"), "utf8"))).length, 1);
  const rp = await start({ replay: true, cacheDir: dir });
  const miss = await post(rp.port, "/api/act", { prompt: "Version 9 of the prompt, never recorded" });
  assert.equal(miss.status, 503);
  assert.match(miss.json.error, /act/);
  assert.match(miss.json.error, /Version 9 of the prompt/);
  rp.stop();
});

test("replay mode with a corrupt recording stops with a message instead of serving nothing", async () => {
  const dir = fs.mkdtempSync(path.join(work, "cache-"));
  fs.writeFileSync(path.join(dir, "llm.json"), "{ truncated");
  await assert.rejects(() => start({ replay: true, cacheDir: dir }), /exited/);
  assert.ok(fs.readdirSync(dir).some((f) => f.startsWith("llm.corrupt-")), "the damaged file is kept");
});
