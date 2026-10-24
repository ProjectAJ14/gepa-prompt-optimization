# Working on the GEPA prompt-optimization walkthrough

A walkthrough the speaker presents instead of slides (one HTML file, plus a small local server for the live model calls), for the talk
**"Data Engineering for Prompt Optimization"** at NonStop io's Luma event "Data Engineering for the
Agentic AI Era" (Pune). It teaches how to set up the pipeline around a prompt optimizer (GEPA) and what to
check before believing its results. Read `docs/decisions.md` for what was decided and why, and what is open.

## Repository map

| Path | Responsibility |
|---|---|
| `src/template.html` | **The source.** Markup, styles, all screens, the logs, scoring and the loop code. Has six placeholders. |
| `build.py` | Fills the placeholders with Eklavya's tokens and mascot and writes `index.html` |
| `index.html` | Built output, committed so it opens with no build step. Never edit it by hand |
| `server.mjs` | Local server: serves the page and runs the live model calls through `claude -p`, with a cache and a replay mode |
| `recordings/llm.json` | One recorded run (464 calls) shipped for `--replay`: a fresh clone replays it with no account and no cost |
| `.github/` | CI, Dependabot, issue and pull request templates. `README.md`, `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md` and `CODE_OF_CONDUCT.md` are the public-facing files |
| `scripts/check-all.sh` | Runs every automated check in order: build, `verify-numbers.js`, `smoke-render.js`, `test-server.mjs`, `test-loop.js`, the design grep |
| `scripts/test-server.mjs` | Tests `server.mjs` against a fake `claude`: validation, cache, replay, reset, failures, no leaked slots. No model is called |
| `scripts/test-loop.js` | Drives the page's loop code in a fake DOM against a stub server: the happy path, every failure path, Retry |
| `scripts/verify-numbers.js` | Checks the scoring gates, the Coach-reply parser, the diff and the data split (no mocked scores exist) |
| `scripts/smoke-render.js` | Renders every step of every screen in a fake DOM and reports any that throw |
| `.claude/rules/` | The speaker's standing requirements, one file per area: `slides.md`, `live-model-calls.md`, `checks.md` |
| `src/claude-loader.svg` | The loading critter shown while a model call runs; `build.py` inlines it. Replace the file to change it |
| `src/linkedin-qr.svg` | The QR code on the closing slide, linking to the speaker's LinkedIn profile. `build.py` embeds it. Made by `scripts/make-qr.py` (no dependencies); regenerate it there and **scan the slide with a phone** before presenting |
| `src/nonstop-logo.svg` | The logo in the header's top right, on every screen. `build.py` embeds it as a data URI |
| `src/CLAUDE.md` | How the template is structured and how to add a screen |
| `docs/decisions.md` | Decisions, what the live runs showed, verified facts with their sources, and open items |
| `.cache/llm.json` | Recorded model calls (git-ignored). Lets `--replay` present with no model calls |

## Standing rules

The speaker's requirements are written down in `.claude/rules/`, so they apply to anything added later without
being repeated. Read the file for the area you are touching, and **when the speaker states a new standing
preference, add it to the matching rule file in the same change.**

- `slides.md`: stepping, centred layout, density, the mascot companion, the look, words, footer tags.
- `live-model-calls.md`: how every model call is made, what it must show (prompt, output box, grader verdict and
  reason, date and time, **Run now**), expandable rows, honesty, recording and replay.
- `checks.md`: the checks to run, and the short list for adding a screen or a call.

## Commands

```bash
python3 build.py                              # rebuild index.html (--eklavya <path> if the design-token checkout moved)
node scripts/verify-numbers.js                # must print "all numbers match"
node server.mjs                               # live: serves http://127.0.0.1:8787 and makes real model calls
node server.mjs --replay                      # stage-safe: answers only from .cache/llm.json, never calls a model
open index.html                               # works for every screen except the live ones, which say so
```

## Rules

1. **Edit `src/template.html`, then rebuild.** A hand edit to `index.html` is lost on the next build.
2. **Honesty about data.** Screens tagged **Live run** show real model replies: Haiku 4.5 acts (the Student),
   Haiku 5.5 grades, Sonnet 5.5 coaches, all through `claude -p`. Never replace a live result with an invented one,
   and never hide a failure: if the server is not running, the screen says so. Nothing is mocked now (screens 7 to 11
   run one round of GEPA's loop by hand, and say so: it is not the `gepa` package). If a mocked number is ever added back,
   it carries the **Example data** tag and never appears as a finding. GEPA facts come from its README, with the date read. Every live call
   shows its input prompt, its full output in a fixed-size read-only box, the grader's verdict and reason, when
   it happened, and a **Run now** button (`.claude/rules/live-model-calls.md`).
3. **Interaction model.** Every screen is a list of steps: Next adds one thing, Previous takes it back.
   Nothing should appear all at once. Prompts grow: new text is appended and highlighted, never shown whole.
4. **Layout.** Slides are centred and sparse content stays centred as more arrives. No page-level
   horizontal overflow at 560, 900 and 1280 px. Dense tables use the `compact` class and a `dense` heading.
5. **Eklavya design system** (`eklavya/.claude/skills/eklavya-design/SKILL.md`; values in
   `eklavya/web/public/tokens.css`). Components name role tokens, never a hex, `rgba()` or `--vd-*` step.
   Square chrome (`border-radius: 0`; circles only for dots). Hairlines, not shadows; the focus ring is
   the one allowed `box-shadow`. Sentence case, no emoji. Visible focus on every control; real `<button>`s.
   Check with: `grep -nE '#[0-9a-fA-F]{3,8}\b|rgba?\(|--vd-' src/template.html` (only prose may match).
6. **The mascot is a companion, not decoration.** Archer Cloak, a small face with one short line per step,
   the right expression for the moment, professional but light. Never jokes, never on every line of text.
   No mascot on the title screen. Expressions are the ones in `eklavya/web/public/brand/mascot/mascot.js`.
7. **Voice.** Direct and concrete, numbers over adjectives, "you". The speaker's other listed talk is
   "Building Data Platforms Agents Can Trust": do not use "trust", "reliable", "high-quality data",
   "context" or "governed" as framing words in titles, abstracts or slide headlines.
8. **Network.** The page talks only to its own local server (`/api/...`) and loads web fonts. Live calls need
   `node server.mjs` and a working `claude` login, so before a talk run the screens once to fill the cache
   and present with `--replay`. The server binds to 127.0.0.1, checks the Host header, needs a custom header
   on every POST, and runs the model with no tools, no hooks, no MCP servers and no saved session.
9. **No product or project names on slides** other than the subject (GEPA, the models). The one brand mark in the page
   chrome is NonStop io's logo, top right. The small mascot companion and the design tokens stay as the look.

## Required checks before calling a change done

1. `python3 build.py && node scripts/verify-numbers.js && node scripts/smoke-render.js`. The full list, including
   the browser steps, is in `.claude/rules/checks.md`.
2. Open it in a browser and step through every screen with Next only, then Previous. Use the Playwright
   MCP against the real server: `node server.mjs` and navigate to `http://127.0.0.1:8787/?fresh=N#K`
   (a same-URL navigation that changes only the hash does not reload, so the old code keeps running:
   always change `fresh`). Use `--replay` for repeatable runs, and stop the server afterwards.
   A static `python3 -m http.server` is enough only for the screens that make no model call.
3. Check 1280×800 and 560×900: no page overflow (`document.documentElement.scrollWidth > innerWidth`),
   and note which steps scroll (`main.scrollHeight > main.clientHeight`). Take screenshots with no
   filename (Playwright limits where it may write).
4. Report any check you did not run. Never describe a planned check as done.

## Git

Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`). **Standing instruction from the speaker (23 Oct): keep committing
as work lands, and update the docs, `CLAUDE.md` and `.claude/rules/` in the same change.** Commit each finished change with
the checks passing; code and its docs go together. The public remote is https://github.com/ProjectAJ14/gepa-prompt-optimization (`origin`); push only when the speaker asks. CI runs `scripts/check-all.sh` and checks that the committed `index.html` is what the build produces. End commit messages with the attribution line the session gives you.

## Communicating with the speaker

Lead with the answer in plain English. Corrections are one line, first. Close with
`What I need from you:` followed by actions or `Nothing`. Name unfinished work and skipped checks.
Recommend one option and give its reason and cost. The speaker is rehearsing for a live talk and
reviews on a projector-sized screen, so presentability matters as much as correctness.
