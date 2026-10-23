// Checks the code around the model calls that needs no model: the three scoring gates and the score, the parsing of the Coach's reply,
// the diff of a new prompt, and the shape of the 30 logs. Nothing on the slides is mocked, so there are no stored scores to compare.
// Run after any change to scoring, parsing or the logs: node scripts/verify-numbers.js. Exits 1 on a problem. It does not open a browser.
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
  vm.runInContext(last ? code + "\n;globalThis.__X = { scoreReply, parseCoach, diffSegs, LOGS, LABELS, SCREENS, ROLE_NAME };" : code, sandbox);
});
const { scoreReply, parseCoach, diffSegs, LOGS, LABELS, SCREENS, ROLE_NAME } = sandbox.__X;

// Nothing on the live screens is mocked any more, so there are no stored scores to compare. What can go wrong without a model is
// the code around it: the three gates and the score, the parsing of the Coach's reply, the diff, and the data itself.
let bad = 0;
const check = (name, ok, detail = "") => { if (!ok) bad++; console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : "  " + detail}`); };
const near = (a, b) => Math.abs(a - b) < 1e-9;
const good = JSON.stringify({ label: "LATE_DATA", reason: "The source stopped producing offsets." });

check("correct, short reason scores 1", near(scoreReply(good, "LATE_DATA").score, 1));
check("correct, 16-word reason scores 0.75", near(scoreReply(JSON.stringify({ label: "LATE_DATA", reason: "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen" }), "LATE_DATA").score, 0.75));
check("wrong but allowed label passes 2 of 3 gates: 2/3 of 0.5", near(scoreReply(good, "SCHEMA_DRIFT").score, (2 / 3) * 0.5));
check("invented label passes 1 of 3 gates: 1/3 of 0.5", near(scoreReply(JSON.stringify({ label: "DUPLICATES", reason: "x" }), "LATE_DATA").score, (1 / 3) * 0.5));
check("a code-fenced reply fails the JSON gate and scores 0", scoreReply("```json\n" + good + "\n```", "LATE_DATA").score === 0);
check("prose scores 0", scoreReply("This is a late data problem.", "LATE_DATA").score === 0);
check("any failed gate stays under 0.5", [good, "x", JSON.stringify({ label: "NOPE", reason: "x" })].every((r) => scoreReply(r, "SCHEMA_DRIFT").score < 0.5));

const okPrompt = "<why>All fenced.</why>\n<prompt>Rules\n<log>\n{{log}}\n</log></prompt>";
check("parseCoach reads prompt and why", parseCoach(okPrompt).prompt.includes("{{log}}") && parseCoach(okPrompt).why === "All fenced.");
check("parseCoach refuses a reply with no prompt block", !!parseCoach("<why>x</why>").error);
check("parseCoach refuses a prompt that lost {{log}}", !!parseCoach("<prompt>no placeholder</prompt>").error);
check("parseCoach refuses a prompt over 3500 characters (the actor route takes 4000)", !!parseCoach("<prompt>" + "x".repeat(3600) + "{{log}}</prompt>").error);
check("parseCoach refuses a prompt with {{log}} twice", !!parseCoach("<prompt>{{log}} {{log}}</prompt>").error);

const d = diffSegs("a\nb\n{{log}}", "a\nnew line\n{{log}}");
check("diffSegs marks the new line, counts one added and one dropped", d.added === 1 && d.removed === 1 && d.segs.some((x) => x.hot && x.t === "new line") && !d.segs.some((x) => x.hot && x.t === "a"));

const by = (k) => LOGS.reduce((m, l) => ((m[l[k]] = (m[l[k]] || 0) + 1), m), {});
check("30 logs, 10 per split", LOGS.length === 30 && Object.values(by("split")).every((n) => n === 10), JSON.stringify(by("split")));
check("ids are 1 to 30 and unique", new Set(LOGS.map((l) => l.id)).size === 30 && LOGS.every((l, i) => l.id === i + 1));
check("every label is allowed", LOGS.every((l) => LABELS.includes(l.exp)));
check("a pipeline sits in one split only", Object.values(LOGS.reduce((m, l) => ((m[l.pipe] = m[l.pipe] || new Set()).add(l.split), m), {})).every((x) => x.size === 1));
check("each split has every label at least once", ["train", "val", "test"].every((sp) => LABELS.every((lb) => LOGS.some((l) => l.split === sp && l.exp === lb))));
check("the five-log minibatch has one log per label", (() => { const ids = [1, 2, 3, 6, 7]; const ls = ids.map((i) => LOGS.find((l) => l.id === i)); return ls.every((l) => l.split === "train") && new Set(ls.map((l) => l.exp)).size === 5; })());
// Who is on screen at each step: the character whose turn it is, and two or three when several act at once (the Student runs the model
// while the Grader marks it). A wrong figure on a step misleads the audience, so every step with a role is pinned here.
const roleAt = (id, st) => { const sc = SCREENS.find((x) => x.id === id); const r = typeof sc.role === "function" ? sc.role(st) : sc.role; return [].concat(r || []).filter(Boolean).join("+") || "-"; };
const ROLES = {
  score: ["teacher", "teacher", "teacher", "student+grader", "student+grader"],
  cast: ["teacher", "student", "grader", "coach", "judge", "-"],
  "student-grader": ["teacher", "student", "grader", "grader"],
  coach: ["coach", "coach", "coach"],
  retry: ["student+grader", "grader"],
  judge: ["judge", "student+grader+judge"],
  test: ["teacher", "student+grader+judge"],
  checklist: ["-"],
};
for (const [id, want] of Object.entries(ROLES)) check(`roles on "${id}": ${want.join(" | ")}`, want.every((w, st) => roleAt(id, st) === w), want.map((w, st) => roleAt(id, st)).join(" | "));
check("every role name is a known character", Object.values(ROLES).flat().flatMap((x) => x.split("+")).filter((x) => x !== "-").every((x) => ROLE_NAME[x]));
check("screens with no role show none", ["title", "v1", "v2", "gepa-what", "gepa-loop"].every((id) => roleAt(id, 0) === "-"));
console.log(bad ? `\n${bad} problem(s)` : "\nall numbers match");
process.exit(bad ? 1 : 0);
