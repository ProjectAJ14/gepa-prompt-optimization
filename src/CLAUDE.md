# `src/template.html`

One file: styles, markup shell, data, scoring, screens and navigation. `build.py` replaces
`/*TOKENS*/`, `/*MASCOT_CSS*/` and `/*MASCOT_JS*/` with Eklavya's files, and `/*LOADER_SVG*/` with `src/claude-loader.svg` (the
loading critter, embedded in a JS template string, so no backtick or `${` in it). and `/*LOGO_URI*/` with `src/nonstop-logo.svg` as a base64 data URI (the header logo). Keep those five markers.

## Order of things inside the script

1. **Data.** `LABELS` and `LOGS` (30 invented pipeline failure logs, 10 per split). Nothing is mocked: every model output comes from a call.
2. **Scoring.** `scoreReply(raw, expected)` applies three gates (`liveJudge` applies it to a real reply) (parses as JSON with `label` and `reason`, label is
   allowed, label is correct). All three pass gives `0.5 + 0.5 × quality` (quality 1 for a reason of 15 words
   or fewer, else 0.5). Any failed gate gives `passed/3 × 0.5`, always under 0.5. `liveMean(version, split)`
   averages a split; `miniMean(version)` averages the five-log minibatch.
3. **Splits are by pipeline, 10 logs each:** spark-clicks and dbt-finance train, airflow-orders and fivetran-crm val,
   kafka-events and beam-telemetry test. Ids run train 1-10, val 11-20, test 21-30.
4. **Prompts.** `TECH` is the five techniques in order (labels, example, edge cases, format, tags last).
   `v2Segs(k, rules, hotRule, flash)` builds the prompt after `k` techniques as segments; `hot` marks the text
   the newest step added. `rules` are optimizer rules and land inside the rules block above the format line.
   Pass `flash = false` on screens that show an already-built prompt, or the format line flashes wrongly.
5. **Live calls** (`R`, `ensure`, `liveJudge`, `runGrid`, `runNow`, `rerun`, `when`, `metaLine`). Versions 1 to 7 are real (7 is the last candidate the loop can write): `ensure(version, ids, withGrade)`
   asks the actor for each log and, when asked, the grader for each reply, four at a time, through
   `POST /api/act` and `/api/grade`. It skips what is done, running or failed, so a screen's `effect` can call it on
   every draw. Failures land in `R.err` and show a Retry button; nothing is retried silently. `R.status` is
   `checking`, `live` or `offline` (from `GET /api/health`), shown in the header chip. The prompt sent for v1 is
   `v2Segs(0)` and for v2 is `v2Segs(5)`, so the page shows exactly what the model received. `runGrid(version)` is the
   2×2 grid of the four sample runs, all visible at once: each cell has its exact prompt and full reply side by side in
   fixed-size read-only boxes, its time, and its own Run now; `detailRow` is the same three-part view inside an expanded score row. Both show the model, the date and
   time of the call (`metaLine`) and a **Run now** button: `rerun(kind, version, id)` calls `/api/act` or `/api/grade`
   with `fresh: true`, which makes the server skip its recording and replace it. Re-running an actor call deletes
   its grade so the score screen's `effect` grades it again. The rules for all of this are in `.claude/rules/`.
6. **Stick figures.** `STICK` and `stick(kind)` draw the five GEPA roles as inline SVG; the cast of `gepa-loop` and `cast`, and the GEPA figure on `gepa-what`, use them. `role` on a screen (a name or `(step) => name`) puts the active character bottom right.
7. **Screens.** `SCREENS` is an array of objects, then navigation.

## A screen

```js
{
  id: "unique-id", title: "Shown in the header and Jump menu",
  tag: "live" | "example" | "ref" | null,   // footer tag: Live run, Example data, From the GEPA repo
  live: true,                               // optional: the companion says "the model is working" while calls are pending
  effect: (st) => {},                       // optional: runs after each draw, e.g. start the live calls this step needs
  steps: 3,                                 // Next advances 0..steps, then moves to the next screen
  hints: [["curious", "Companion line for step 0"], ...],   // [expression, text], one per step; the last repeats
  notes: "Speaker notes, shown with N",
  render: (st) => `...`,                    // HTML for step `st`; use head(eyebrow, title, lede, dense)
}
```

Adding a screen needs nothing else: the Jump menu, dots and counter are generated from `SCREENS`.
Buttons inside a slide use `data-act`: `next`, `goto:N` (set this screen's step), `retry`, `rerun:...`, `row:...`, `warm`, `coachnow`, `reset`.

## Behaviour worth knowing

- State is `S.st[screenId]`, a step number per screen. Moving forward into a screen resets it to 0, going
  back lands on its last step, jumping keeps what was stored.
- The slide is vertically centred (`.slide { margin: auto }` in a flex stage). `draw()` measures the slide's
  top before and after a step on the same screen and animates the difference, so content growing does not
  jump. Reduced motion skips it.
- The companion (`#companion`) is hidden when the hint text is empty (the title and the closing slide).
- `.cluster` centres a wrapping row of cards, so one card sits in the middle and more reflow around it.
- Prompt blocks: `pre.prompt` (use `.small` when space is tight), `pre.term` for the terminal palette.
- Score rows open on click (`S.open` holds `version:logId` keys; `data-act="row:..."` on the `<tr>`, a real `<button class="rowbtn">` inside for the keyboard, focus restored after the redraw). The detail row shows the exact prompt sent, the full reply, the gate and score working, and the judge's verdict with its reason. Test-split rows stay closed.
- The companion drops its text bubble and keeps only the face when the slide reaches the bottom of the viewport (`crowded`).
- Screens that scroll slightly at 1280×800: re-measure after changes (see CLAUDE.md, required checks).
