# `src/template.html`

One file: styles, markup shell, data, scoring, screens and navigation. `build.py` replaces
`/*TOKENS*/`, `/*MASCOT_CSS*/` and `/*MASCOT_JS*/` with Eklavya's files. Keep those three markers.

## Order of things inside the script

1. **Data.** `LABELS`, `LOGS` (12 invented pipeline failure logs plus two `added: true` logs that only join
   training on the "fix the data" screen), `OUT` (fixed model outputs per prompt version: `v1` free text,
   `v2`, `v3`, `v4`, and `B`, a rejected rambling candidate). Nothing calls a model.
2. **Scoring.** `judge(version, log)` applies three gates (parses as JSON with `label` and `reason`, label is
   allowed, label is correct). All three pass gives `0.5 + 0.5 × quality` (quality 1 for a reason of 15 words
   or fewer, else 0.5). Any failed gate gives `passed/3 × 0.5`, always under 0.5. `mean(version, split, ext)`
   averages by split; `ext` includes the two added logs.
3. **Splits are by pipeline:** spark-clicks and dbt-finance train, airflow-orders val, kafka-events test,
   flink-sessions (added) train.
4. **Prompts.** `TECH` is the five techniques in order (labels, example, edge cases, format, tags last).
   `v2Segs(k, rules, hotRule, flash)` builds the prompt after `k` techniques as segments; `hot` marks the text
   the newest step added. `rules` are optimizer rules and land inside the rules block above the format line.
   Pass `flash = false` on screens that show an already-built prompt, or the format line flashes wrongly.
5. **Screens.** `SCREENS` is an array of objects, then navigation.

## A screen

```js
{
  id: "unique-id", title: "Shown in the header and Jump menu",
  tag: "example" | "real" | "ref" | null,   // footer tag: Example data, Real data, From the GEPA repo
  steps: 3,                                 // Next advances 0..steps, then moves to the next screen
  hints: [["curious", "Companion line for step 0"], ...],   // [expression, text], one per step; the last repeats
  notes: "Speaker notes, shown with N",
  render: (st) => `...`,                    // HTML for step `st`; use head(eyebrow, title, lede, dense)
}
```

Adding a screen needs nothing else: the Jump menu, dots and counter are generated from `SCREENS`.
Buttons inside a slide use `data-act`: `next`, `goto:N` (set this screen's step), `run1` (the timed optimizer run).

## Behaviour worth knowing

- State is `S.st[screenId]`, a step number per screen. Moving forward into a screen resets it to 0, going
  back lands on its last step, jumping keeps what was stored.
- The slide is vertically centred (`.slide { margin: auto }` in a flex stage). `draw()` measures the slide's
  top before and after a step on the same screen and animates the difference, so content growing does not
  jump. Reduced motion skips it.
- The companion (`#companion`) is hidden when the hint text is empty, which is only the title screen.
- `.cluster` centres a wrapping row of cards, so one card sits in the middle and more reflow around it.
- Prompt blocks: `pre.prompt` (use `.small` when space is tight), `pre.term` for the terminal palette.
- Screens that scroll slightly at 1280×800 today: score steps 3 and 4, Version 2 steps 5 and 6, Version 3 steps 3 and 4.
