// Renders every step of every screen in a fake DOM and reports any that throw (a missing helper, a typo in a template).
// It cannot see layout or the live calls; it exists because a render error blanks a slide and nothing else catches it.
// Run: node scripts/smoke-render.js
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
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
scripts.forEach((code, i) => vm.runInContext(i === scripts.length - 1 ? code + "\n;globalThis.__X = { SCREENS, R };" : code, sandbox));

const { SCREENS, R } = sandbox.__X;
let steps = 0;
const bad = [];
// Once with no server, and once as if live with nothing answered yet: the two states a slide can be in at the start of a talk.
for (const status of ["offline", "live"]) {
  R.status = status;
  for (const sc of SCREENS) {
    for (let st = 0; st <= sc.steps; st++) {
      try { sc.render(st); steps++; } catch (e) { bad.push(`${status} · ${sc.id} step ${st}: ${e.message}`); }
    }
  }
}
console.log(bad.length ? bad.join("\n") + `\n\n${bad.length} render error(s)` : `rendered ${steps} steps in two states: no render errors`);
process.exit(bad.length ? 1 : 0);
