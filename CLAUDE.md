# Working on the GEPA prompt-optimization walkthrough

A single-file, offline walkthrough the speaker presents instead of slides, for the talk
**"Data Engineering for Prompt Optimization"** at NonStop io's Luma event "Data Engineering for the
Agentic AI Era" (Pune). It teaches how to set up the pipeline around a prompt optimizer (GEPA) and what to
check before believing its results. Read `docs/decisions.md` for what was decided and why, and what is open.

## Repository map

| Path | Responsibility |
|---|---|
| `src/template.html` | **The source.** Markup, styles, all screens, mocked data and scoring. Has three placeholders. |
| `build.py` | Fills the placeholders with Eklavya's tokens and mascot and writes `index.html` |
| `index.html` | Built output, committed so it opens with no build step. Never edit it by hand |
| `scripts/verify-numbers.js` | Recomputes every displayed score and compares it with the story |
| `src/CLAUDE.md` | How the template is structured and how to add a screen |
| `docs/decisions.md` | Decisions, verified facts with their sources, and open items |

## Commands

```bash
python3 build.py                              # rebuild index.html (--eklavya <path> if the checkout moved)
node scripts/verify-numbers.js                # must print "all numbers match"
open index.html                               # the presenter opens the file directly
```

## Rules

1. **Edit `src/template.html`, then rebuild.** A hand edit to `index.html` is lost on the next build.
2. **Honesty about data.** Everything on the toy screens is invented and mocked, and carries the
   "Example data" tag. Real numbers appear only on the "Real data" screen and come from Eklavya's dated
   result files, cited in `docs/decisions.md`. Never present a mocked number as a finding, and never
   write a claim the sources do not support. GEPA facts come from its README, with the date read.
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
   Full body only on the title. Expressions are the ones in `eklavya/web/public/brand/mascot/mascot.js`.
7. **Voice.** Direct and concrete, numbers over adjectives, "you". The speaker's other listed talk is
   "Building Data Platforms Agents Can Trust": do not use "trust", "reliable", "high-quality data",
   "context" or "governed" as framing words in titles, abstracts or slide headlines.
8. **No network except web fonts.** The page must work offline on stage.

## Required checks before calling a change done

1. `python3 build.py && node scripts/verify-numbers.js`.
2. Open it in a browser and step through every screen with Next only, then Previous. Use the Playwright
   MCP: serve with `python3 -m http.server 8765 --bind 127.0.0.1` from the repo root, navigate to
   `http://127.0.0.1:8765/index.html?fresh=N#K` (a same-URL navigation that changes only the hash does not
   reload, so the old code keeps running: always change `fresh`), and stop the server afterwards.
3. Check 1280×800 and 560×900: no page overflow (`document.documentElement.scrollWidth > innerWidth`),
   and note which steps scroll (`main.scrollHeight > main.clientHeight`). Take screenshots with no
   filename (Playwright limits where it may write).
4. Report any check you did not run. Never describe a planned check as done.

## Git

Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`). Commit only when asked. There is no remote;
do not push. End commit messages with the attribution line the session gives you.

## Communicating with the speaker

Lead with the answer in plain English. Corrections are one line, first. Close with
`What I need from you:` followed by actions or `Nothing`. Name unfinished work and skipped checks.
Recommend one option and give its reason and cost. The speaker is rehearsing for a live talk and
reviews on a projector-sized screen, so presentability matters as much as correctness.
