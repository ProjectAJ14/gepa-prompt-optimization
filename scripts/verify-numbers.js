// Recomputes every MOCKED score the walkthrough displays (versions 2 to 4 and the rejected candidate) and compares it
// with the numbers the story claims. Versions 1 and 2 on the first screens are live model calls and are not checked here.
// Run after any change to the mocked outputs, the logs or the scoring: node scripts/verify-numbers.js
// Exits 1 on a mismatch. It does not open a browser; render checks are separate (see CLAUDE.md).
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);

// A fake DOM that accepts anything: the script draws on load, and we only want its data and scoring.
const stub = () => new Proxy({ innerHTML: "", textContent: "", className: "", hidden: false, value: "", style: {}, dataset: {},
  classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, appendChild() {}, setAttribute() {}, removeAttribute() {},
  querySelectorAll() { return []; }, querySelector() { return stub(); }, getBoundingClientRect() { return { top: 0, bottom: 0 }; } }, {});
const sandbox = {
  document: { getElementById: stub, addEventListener() {}, querySelectorAll: () => [], createElement: stub, querySelector: () => stub(), body: stub() },
  window: { addEventListener() {} }, location: { hash: "" }, history: { replaceState() {} },
  setTimeout, clearTimeout, setInterval, clearInterval, console, navigator: {},
  fetch: () => Promise.reject(new Error("offline")), requestAnimationFrame() {}, innerHeight: 800,
};
sandbox.window.document = sandbox.document;
vm.createContext(sandbox);
scripts.forEach((code, i) => {
  const last = i === scripts.length - 1;
  vm.runInContext(last ? code + "\n;globalThis.__X = { mean, judge, LOGS, OUT };" : code, sandbox);
});
const { mean, judge, LOGS, OUT } = sandbox.__X;

// [version, split, includes the two logs added on the "fix the data" screen, expected mean]
const EXPECTED = [
  ["v2", "train", false, 0.639], ["v2", "val", false, 0.778], ["v2", "test", false, 0.556],
  ["v3", "train", false, 1.0], ["v3", "val", false, 1.0], ["v3", "test", false, 0.778], ["v3", "train", true, 0.833],
  ["v4", "train", true, 1.0], ["v4", "val", false, 1.0], ["v4", "test", false, 0.917],
  ["B", "train", false, 0.75], ["B", "val", false, 0.75],
];
let bad = 0;
for (const [v, split, ext, want] of EXPECTED) {
  const got = Number(mean(v, split, ext).toFixed(3));
  const ok = got === want;
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "FAIL"} ${v.padEnd(3)} ${split.padEnd(5)} ext=${ext ? 1 : 0}  got ${got}  want ${want}`);
}
// Every log a version is scored on must have a mocked output, and no score may leave [0, 1].
for (const v of ["v2", "v3", "v4", "B"]) {
  const scored = LOGS.filter((l) => (v === "v2" ? !l.added : true));
  const missing = scored.filter((l) => !(l.id in OUT[v])).map((l) => l.id);
  const outOfRange = scored.filter((l) => { const s = judge(v, l).score; return !(s >= 0 && s <= 1); }).map((l) => l.id);
  if (missing.length || outOfRange.length) { bad++; console.log(`FAIL ${v}: missing ${missing} out-of-range ${outOfRange}`); }
}
console.log(bad ? `\n${bad} problem(s)` : "\nall numbers match");
process.exit(bad ? 1 : 0);
