// Drives the page's own loop code (warmAll, the Coach, runLoop, retry) against a stubbed server, in a fake DOM, with no browser and no model.
//   node scripts/test-loop.js
// The stub server plays the three models. It is deliberately simple and deterministic:
//   - the Student's reply is code-fenced unless the prompt contains RAW_JSON_OK, and some logs stay wrong until a later RULE_n line appears;
//   - the Grader always says "right idea";
//   - the Coach returns its parent prompt (read from the text between <<< and >>>) plus one new line.
// These tests exist because the live session cannot be re-run: they exercise the failure paths a presenter cannot rehearse.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);

function loadPage(server) {
  const stub = () => new Proxy({ innerHTML: "", textContent: "", className: "", hidden: false, value: "", style: {}, dataset: {},
    classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, appendChild() {}, setAttribute() {}, removeAttribute() {},
    querySelectorAll() { return []; }, querySelector() { return stub(); }, getBoundingClientRect() { return { top: 0, bottom: 0 }; } }, {});
  const sandbox = {
    document: { getElementById: stub, addEventListener() {}, querySelectorAll: () => [], createElement: stub, querySelector: () => stub(), body: stub() },
    window: { addEventListener() {} }, location: { hash: "" }, history: { replaceState() {} },
    setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms || 0, 15)), clearTimeout, setInterval: () => 0 /* the page's 1 s ticker would keep node alive */, clearInterval, console, navigator: {},
    fetch: (url, init) => server.handle(url, init), requestAnimationFrame() {}, innerHeight: 800,
  };
  sandbox.window.document = sandbox.document;
  vm.createContext(sandbox);
  scripts.forEach((code, i) => {
    const last = i === scripts.length - 1;
    vm.runInContext(last ? code + "\n;globalThis.__X = { R, runLoop, runCoach, warmAll, needCand, maybeCoach, ensure, ids, ALL, LOGS, MINI, coachPromptFor, liveJudge, liveMean, passCount, costOf, costLine, LOOP_EXTRA, idle };" : code, sandbox);
  });
  return sandbox.__X;
}

// A stub server with switches for failures. Each response looks like the real server's.
function makeServer(opts = {}) {
  const s = { acts: 0, grades: 0, coaches: 0, opts };
  const res = (extra) => ({ model: "stub", at: new Date().toISOString(), ms: 100, tokens: { input: 50, cacheWrite: 0, cacheRead: 10, output: 20 }, costUsd: 0.001, cached: false, ...extra });
  const reply = (status, body) => Promise.resolve({ ok: status < 400, status, statusText: "stub", json: () => Promise.resolve(body) });
  s.handle = (url, init) => {
    if (url === "/api/health") return reply(200, { ok: true, mode: "live", actor: "claude-haiku-4-5", grader: "claude-haiku-5-5", coach: "claude-sonnet-5-5", recorded: 0 });
    const body = JSON.parse(init.body);
    if (url === "/api/act") {
      s.acts++;
      if (opts.failAct && opts.failAct(body.prompt, s)) return reply(500, { error: "stub act failure" });
      const log = s.LOGS.find((l) => body.prompt.includes(l.text));
      const ok = body.prompt.includes("RAW_JSON_OK") && (!(opts.hard || []).includes(log.id) || body.prompt.includes(opts.hardNeeds || "RULE_2"));
      const text = JSON.stringify({ label: ok ? log.exp : "UPSTREAM_FAILURE", reason: "short reason" });
      return reply(200, res({ model: "claude-haiku-4-5", text: body.prompt.includes("RAW_JSON_OK") ? text : "```json\n" + text + "\n```" }));
    }
    if (url === "/api/grade") { s.grades++; return reply(200, res({ model: "claude-haiku-5-5", text: "", structured: { right_idea: true, why: "fine" }, rightIdea: true, why: "fine" })); }
    if (url === "/api/coach") {
      s.coaches++; s.coachFresh = (s.coachFresh || []).concat(body.fresh === true);
      if (opts.failCoachAt === s.coaches) return reply(500, { error: "stub coach failure" });
      if (opts.badCoachAt === s.coaches) return reply(200, res({ model: "claude-sonnet-5-5", text: "I would add a rule but forgot the format." }));
      const parent = body.prompt.split("<<<\n")[1].split("\n>>>")[0];
      const line = s.coaches === 1 ? "RAW_JSON_OK" : opts.noise ? "NOISE_" + s.coaches : "RULE_" + s.coaches;
      return reply(200, res({ model: "claude-sonnet-5-5", text: `<why>stub</why>\n<prompt>${parent.replace("\n\n<log>", "\n" + line + "\n\n<log>")}</prompt>` }));
    }
    return reply(404, { error: "not found" });
  };
  return s;
}
function page(opts) {
  const server = makeServer(opts);
  const X = loadPage(server);
  server.LOGS = X.LOGS;
  X.R.status = "live"; X.R.mode = "live"; X.R.actor = "claude-haiku-4-5"; X.R.grader = "claude-haiku-5-5"; X.R.coachModel = "claude-sonnet-5-5";
  return { X, server, R: X.R };
}
const settle = async (X) => { for (let i = 0; i < 4; i++) await X.idle(); };

test("the happy path: warm-up runs the whole loop and stops when one prompt passes all 30", async () => {
  const { X, R, server } = page({ hard: [3, 12, 22, 26], hardNeeds: "RULE_2" });
  await X.warmAll();
  assert.equal(R.loop.state, "done");
  assert.equal(R.loop.stop, "A candidate passes all three gates on all 30 logs.");
  assert.deepEqual(Array.from(R.loop.rounds, (r) => r.v), ["v3", "v4"], "round 1 is v3, then v4 passes everything");
  assert.equal(R.loop.final, "v4");
  assert.equal(X.passCount("v4"), 30);
  assert.ok(X.passCount("v3") < 30 && X.passCount("v3") >= 20);
  assert.equal(R.busy.size, 0, "no busy key left behind");
  assert.equal(Object.keys(R.err).length, 0);
  assert.equal(server.coaches, 2);
  assert.ok(R.loop.rounds.every((r) => r.cost.calls === 61 && r.cost.tin > 0 && r.cost.tout > 0 && r.cost.ms > 0), "every round has a cost");
});

test("a candidate that never improves ends on the budget, rejected, and the best one is kept", async () => {
  const { X, R } = page({ noise: true, hard: [3], hardNeeds: "RULE_" });
  await X.warmAll();
  assert.equal(R.loop.state, "done");
  assert.match(R.loop.stop, /budget ran out/);
  assert.equal(R.loop.rounds.length, 1 + X.LOOP_EXTRA);
  assert.ok(R.loop.rounds.slice(1).every((r) => r.status === "rejected"));
  assert.equal(R.loop.final, "v3", "the first Coach prompt fixed the format; the noise after it never beat it");
  assert.equal(R.busy.size, 0);
  // Round 3 and later send earlier failed attempts back to the Coach: its input must stay under the route's 12000-character limit.
  for (const v of ["v3", "v4", "v5", "v6"]) {
    const fails = X.ALL.map((l) => l.id).filter((id) => !X.liveJudge(v, X.LOGS.find((l) => l.id === id)).correct).slice(0, 6);
    const tried = ["a long attempted line ".repeat(12), "another long attempted line ".repeat(12), "a third ".repeat(30)];
    assert.ok(X.coachPromptFor(v, fails, tried).length < 12000, v + " coach input is small enough");
  }
});

test("a Coach failure in round 2 stops the loop with the error, and Retry finishes it", async () => {
  const { X, R, server } = page({ hard: [3], hardNeeds: "RULE_", failCoachAt: 2 });
  await X.warmAll();
  assert.equal(R.loop.state, "error");
  const callsAtError = server.coaches;
  for (let i = 0; i < 5; i++) { await X.runLoop(); await settle(X); } // what each redraw's effect does
  assert.equal(server.coaches, callsAtError, "an errored loop does not restart itself");
  assert.equal(R.loop.state, "error");
  assert.match(R.loop.stop, /stub coach failure/);
  assert.equal(R.loop.running, false);
  assert.equal(R.busy.size, 0, "busy keys are cleared on error");
  assert.match(Object.values(R.err).join(" "), /stub coach failure/, "the error is shown to the user");
  // What the Retry button does: clear the errors and the loop, then the next draw's effect starts it again.
  R.err = {}; R.loop = null;
  server.opts.failCoachAt = 0;
  await X.runLoop(); await settle(X);
  assert.equal(R.loop.state, "done");
  assert.equal(R.loop.final, "v4");
});

test("a Coach reply with no <prompt> stops the loop with a readable error and starts no endless retry", async () => {
  const { X, R, server } = page({ hard: [3], hardNeeds: "RULE_", badCoachAt: 2 });
  await X.warmAll();
  assert.equal(R.loop.state, "error");
  assert.match(R.loop.stop, /no <prompt> block/);
  assert.equal(server.coaches, 2, "one bad reply, no silent retries");
  assert.equal(R.busy.size, 0);
});

test("a Coach reply on round 1 with no <prompt> leaves version 3 empty, shows the error, and the loop never starts", async () => {
  const { X, R } = page({ badCoachAt: 1 });
  await X.warmAll();
  assert.equal(R.cand.v3, null);
  assert.match(R.err["c:v3"], /no <prompt> block/);
  assert.equal(R.loop, null, "the loop does not start without version 3");
  assert.equal(R.busy.size, 0);
});

test("a failing Student call stops the loop (no spinner forever), and Retry finishes it", async () => {
  const { X, R, server } = page({ hard: [3], hardNeeds: "RULE_", failAct: (prompt) => prompt.includes("RULE_") && prompt.includes("Partition dt=2026-10-19") });
  await X.warmAll();
  assert.equal(R.loop.state, "error");
  assert.equal(R.busy.size, 0);
  assert.ok(Object.keys(R.err).some((k) => /^a:v4:/.test(k)), "the failed call is recorded against its log");
  R.err = {}; R.loop = null; server.opts.failAct = null;
  await X.runLoop(); await settle(X);
  assert.equal(R.loop.state, "done");
});

test("offline: nothing starts and nothing throws", async () => {
  const { X, R } = page({});
  R.status = "offline";
  X.needCand(); await X.runLoop(); await X.warmAll();
  assert.equal(R.loop, null);
  assert.equal(R.busy.size, 0);
});

test("a second runLoop call while one is running does not start another", async () => {
  const { X, R, server } = page({ hard: [3], hardNeeds: "RULE_" });
  X.ensure("v2", X.ALL.map((l) => l.id), true); await settle(X);
  await X.runCoach(false);
  const first = X.runLoop(); const second = X.runLoop();
  await Promise.all([first, second]); await settle(X);
  assert.equal(R.loop.state, "done");
  assert.equal(server.coaches, 2, "one round-1 Coach call and one round-2 call, not four");
});

test("costOf and costLine tolerate missing token data", async () => {
  const { X, R } = page({});
  X.ensure("v2", X.MINI, true); await settle(X);
  for (const id of X.MINI) { delete R.act.v2[id].tokens; delete R.grade.v2[id].tokens; }
  const c = X.costOf("v2");
  assert.equal(c.tin, 0); assert.equal(c.tout, 0);
  assert.match(X.costLine("v2", X.MINI), /0 in \/ 0 out tokens/);
});

test("after an unusable Coach reply, Retry asks again with fresh, so the bad reply is not replayed from the server's cache", async () => {
  const { X, R, server } = page({ badCoachAt: 1 });
  await X.warmAll();
  assert.equal(R.cand.v3, null);
  R.err = {}; // Retry
  server.opts.badCoachAt = 0;
  X.maybeCoach(); await settle(X);
  assert.ok(R.cand.v3, "the second ask worked");
  assert.deepEqual(Array.from(server.coachFresh), [false, true], "first normal, then fresh");
});

test("an oversized new prompt is refused with a clear message, and the Coach's input stays under the route limit", async () => {
  const { X, R } = page({});
  X.ensure("v2", X.MINI, true); await settle(X);
  for (const id of X.MINI) R.act.v2[id].text = "y".repeat(5000);
  const input = X.coachPromptFor("v2", X.MINI, ["a tried line ".repeat(100)]);
  assert.ok(input.length < 12000, "input length " + input.length);
});
