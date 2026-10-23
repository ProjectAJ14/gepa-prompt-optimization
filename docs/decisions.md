# Decisions, verified facts and open items

First written 23 Oct 2026; updated the same day when the first screens moved from mocked to live model calls.

## The talk

- **Title (chosen):** Data Engineering for Prompt Optimization.
- **Event:** "Data Engineering for the Agentic AI Era", hosted by NonStop io at its Kharadi office in Pune.
  The Luma page (read 19 Oct 2026) states no date, slot length, format or call for speakers.
- **Another listed talk:** Shivam Arya, "Building Data Platforms Agents Can Trust". Do not reuse his
  framing words (see `CLAUDE.md`, rule 7). Ours is one concrete case; his is the broad principle.
- **Abstract as drafted** (the speaker submitted a version; confirm the exact text before quoting it):
  > Most prompts get edited by feel: someone reads a bad output, changes a sentence and hopes. GEPA is an
  > optimizer that automates that loop. It runs your prompt on examples, reads what failed and proposes an
  > edit. It only works if the pipeline around it is sound, and that pipeline is mostly data engineering.
  > I'll show how I built one for a real tool: where the examples come from, how to score answers so the
  > optimizer can tell how they failed, how to split the data so a gain means something, and what a run
  > costs. If you have a prompt you keep tweaking by hand, this is a way to stop.
- **One-sentence takeaway:** build the eval and the baseline before the optimizer, and make the score
  measure everything the product cannot tolerate.
- **Why a walkthrough tool and not slides:** the speaker controls pace with Next and Previous, and the
  audience watches a prompt improve step by step.

## Decisions

| Topic | Decision |
|---|---|
| Format | Every screen is stepped: Next adds one thing, Previous takes it back. Prompts grow by appending. |
| Techniques order | List the labels, show one example, name the edge cases, say the output format, **tag the inputs last**. Tags are the payoff: they keep several inputs and sections of one prompt apart. |
| **Live, not mocked** (23 Oct) | The speaker changed their mind about mock data. Where the page needs a model, it makes a real `claude -p` call. **Phase 1 (done): versions 1 and 2 and the score screen.** Phase 2 (open): the optimizer, version 3, fix-the-data and the test reveal. |
| Models | **Haiku 4.5 acts** (runs the prompt), **Haiku 5.5 grades**. Different models, so nothing grades itself. Override with `ACTOR_MODEL` and `GRADER_MODEL`. |
| Grader's job | Reads each reply for meaning and says whether it names the right failure, ignoring format. It is a second opinion next to the three code gates, so the screen can show where they disagree. |
| How calls run | `server.mjs` (Node, no dependencies) serves the page and runs `claude -p` with no tools, hooks, MCP servers or saved session, from a temp directory. Answers are cached in `.cache/llm.json`; `--replay` presents from the cache only. |
| Run view | A 2×2 grid of the four sample runs, all visible at once (speaker's call, 23 Oct; replaced one-log-at-a-time tabs). Each cell has its own exact prompt and the model's full output side by side in fixed-size read-only boxes, its time, and Run now. |
| Expandable score rows | Click a row to see the prompt, the full reply, how the score was worked out, and the judge's verdict with its reason. Test-split rows stay closed. |
| Every call is dated | Each call shows its model, local date and time, and duration, and "recorded" when it came from the cache. |
| Run now | Every call has a one-click re-run that ignores the recording; a graded call also has "Run judge now". Disabled in replay mode and when offline. |
| Standing rules | The speaker's requirements live in `.claude/rules/` (slides, live model calls, checks) so later additions follow them. |
| Header logo | NonStop io's logo sits top right on every screen (speaker's call, 23 Oct). Downloaded 23 Oct 2026 from https://nonstopio.com/wp-content/uploads/2026/06/NONSTOP-LOGO-LIGHT.svg (13 KB). Inspected first: no scripts and no external references. It is the white-text version, made for dark grounds; it would vanish on a light one, which this page never uses. Embedded through `<img>` as a data URI, so nothing inside it can run. |
| Title screen | No mascot on the title (speaker's call, 23 Oct). The small companion stays on the other screens. |
| Start from empty | A second option on the title screen: forget every recorded call so nothing from a previous run is used (speaker's call, 23 Oct). Two clicks to confirm. The server keeps a timestamped backup in `.cache/` and empties the cache; the page clears its results, open rows and steps. Disabled in replay mode. |
| Use the window | Slides and boxes scale with the window instead of staying laptop-sized (speaker's call, 23 Oct, from a large screen with much unused space). Slide width `min(1500px, 100vw - 168px)`; run-grid and detail boxes grow with the window's height; text inside them grows with its width. At 1280×800 nothing changes. |
| Motion | One entrance everywhere (speaker's call, 23 Oct): `rise`, 320ms. Next animates only the new element; a new screen rises as a whole; Previous and live results do not animate. Rule in `.claude/rules/slides.md`, code in `draw(motion)`. Before this, every `reveal` card replayed on every Next. |
| Loading indicator | While a call runs: the output box shows a small orange pixel critter working (hopping legs, typing arms, blinking), what it waits for and the elapsed seconds; small waits use a ring spinner; the corner companion swaps to the critter. The speaker asked for the Claude mascot. **It is an original stand-in, not Anthropic's artwork**: nothing was downloaded, and an official asset can replace `src/claude-loader.svg`. |
| 30 logs, 10 per split | Speaker asked for 10 per split (23 Oct), up from 12 logs in all. Ids: train 1-10 (spark-clicks, dbt-finance), val 11-20 (airflow-orders, fivetran-crm), test 21-30 (kafka-events, beam-telemetry), added 31-32 (flink-sessions). The 30-row table sits in a scrollable box. All 120 live calls (30 logs, 2 versions, act and grade) were recorded 23 Oct. The mocked screens got new mocked outputs for the new logs and their numbers were recomputed. |
| Toy task | Classify pipeline failure logs (30 invented logs, 10 per split, 6 pipelines, 5 labels; speaker asked for 10 each on 23 Oct, up from 12). Fits a data-engineering audience. |
| Honest ending | After the test split is revealed and acted on, the v4 test number is marked "peeked": it is no longer a clean test. (Mocked today; phase 2 redoes it live.) |
| GEPA before the score | Superseded 23 Oct (speaker's call): GEPA is introduced right after version 2, in **two screens** that replace the old three (what, install, repository). Screen 4 defines it in plain English with a stick figure (one step); screen 5 shows the process as a cast of five. Install, repository and the Claude plugin sit under the illustration on screen 4. The plugin commands are from the README's "Use GEPA as an Agent Skill" section (read 23 Oct 2026): `/plugin marketplace add gepa-ai/gepa` then `/plugin install gepa-optimize-anything@gepa`. The score screen now follows as "what you hand over". The characters come from the speaker's own explainer video (`~/.hyperframes-studio/New video`), redrawn as original SVG in the design tokens. |
| Design | Centred slides, the Eklavya design tokens inlined, the archer mascot as a companion with a short hint per step. **No Eklavya wordmark and no other product names on any slide** (speaker's call, 23 Oct); the one exception is the NonStop io logo in the header. |
| Real-results screen | **Removed** (23 Oct). It showed another project's results. The live runs become the real data. |
| Browser checks | Playwright MCP. The browser-use plugin registered but failed to connect ("Connection closed"). |
| Mock honesty | Superseded: nothing on the live screens is mocked. Screens still tagged "Example data" are mocked and will be replaced. |

## Screens, in order

1. Title (no mascot, Warm-up button) · 2. Version 1, the one-liner **(live)** · 3. Version 2, five techniques added one by one,
then run **(live)** · 4. What is GEPA (one step: the weak prompt and GEPA rewriting it, with install, repository and the Claude plugin underneath; the "reads the why", "what is a candidate" and separate "open source" steps were removed on 23 Oct at the speaker's request) ·
5. How GEPA works (the cast: Teacher, Student, Grader, Coach, Judge, then the loop) · 6. We need a score: examples, answers, split,
score v1 and v2 **(live, with a judge column)** · 7. The pipeline around the optimizer (ETL) ·
8. Optimizer run 1 *(mock)* · 9. Version 3 and the test split *(mock)* · 10. Fix the data, run again *(mock)* · 11. The checklist

## What the first live runs showed (23 Oct 2026, Haiku 4.5 acting, Haiku 5.5 grading; the original 12-log set, so counts are out of 9)

These are real, but one run each: replies vary, and the cache pins what the speaker will see.

- **Version 1 (the one-liner):** every reply is a long markdown report (headings, tables, severity ratings). The judge says
  7 of 9 train and validation replies name the right failure. The script can parse 0 of 9, so 0 pass the gates.
  That is the "reads fine, a script cannot use it" moment, and it is real.
- **Version 2 (five techniques, tags last):** Haiku 4.5 wrapped every JSON reply in a ```json code fence, despite
  "Reply with JSON only". A strict parser rejects them: 0 of 9 parse. The judge says 8 of 9 have the right idea.
  This is the natural first thing an optimizer would find ("do not wrap the reply in a code fence").
- **Cost and speed:** about 7 s per actor call, 4 in parallel, so 12 logs took roughly 25 s per version including grading (the first set; 30 logs take about 1 minute).
  A call costs a fraction of a cent. Repeat runs are served from the cache in under a second.
- The judge marked log 2 (a sensor timing out waiting for a file) as the wrong idea for version 1, which is an
  arguable call: it is a place where the grader and the gates, or two graders, could disagree.

## Verified facts and where they come from

**Mocked scores** (recomputed by `scripts/verify-numbers.js`; versions 2 to 4 and the rejected candidate, screens 8 to 10):
v2 train 0.717, val 0.867, test 0.667; v3 train 1.000, val 1.000, test 0.800; v4 val 1.000, test 0.975; rejected candidate B train and
val 0.750 (recomputed for the 30-log set). **These v2 numbers no longer match the live v2 results above**, which is why phase 2 exists.

**GEPA facts on screens 4 and 5:** from the repository README at https://github.com/gepa-ai/gepa, fetched
23 Oct 2026 (a summary of the page, not the raw file). Covered: the one-line definition, the paper (*GEPA: Reflective
Prompt Evolution Can Outperform Reinforcement Learning*, Agrawal et al., 2025, arXiv 2507.19457), `pip install gepa` and
the install from `main`, the Claude Code skill commands, the entry points (`gepa.optimize`, `optimize_anything`,
`dspy.GEPA`), the folder list, the adapter and integration names, and the MIT licence.

## Not verified

- **"Candidate" is now used on screen 5 ("the pool of candidates") without being defined**, since the speaker removed that step from screen 4. Say it aloud: a candidate is one version of the prompt.
- **The cast on screen 5 is an analogy, not GEPA's terms.** Each card has a plain-English "Who" line (23 Oct): Teacher is you, Student is the AI model that follows the prompt, Grader is the check you write, Coach is a second AI model, Judge is the keep-or-drop rule, "not a person or a model". That last claim is my reading of "add to the pool if improved"; the README does not say how the check is implemented. Mapping used: Teacher = your train and validation sets; Student = the task model and its traces; Grader = your metric (a score plus feedback text); Coach = the reflection model; Judge = the pool of candidates (Pareto frontier). The README does not define "candidate" in words (it shows a dictionary with a `system_prompt` key), says nothing on how the final best candidate is chosen (it only shows `result.best_candidate`), and does not say what "improved" is measured on. The video says "best average test score wins" and "three practice cards"; neither is on a slide.

- The exact argument names of `gepa.optimize`: the install screen lists its inputs and shows no code call.
- Whether the README has changed since 23 Oct 2026, and whether `pip install gepa` was run here (it was not).
- `gepa==0.1.4` on the install screen is given as an example pin, not as the current release.
- The 20-minute length: the event page states none.
- The live numbers above come from one run. Re-run before quoting them.

## Open items

- The live v1 and v2 numbers on the score screen are for the 30-log set: v2 parses 0 of 20 train and validation replies (code fences), the judge says 18 of 20 have the right idea.
- **Recordings made before 23 Oct 2026, 19:24 have no timestamp** and show "time not recorded" until each call is re-run
  with Run now. A "re-run all" button is not built; it would cost about 50 calls.
- **Decide how strict the parser is.** Today a reply wrapped in a code fence fails the JSON gate. That is honest
  and sets up the optimizer well, but it makes version 2 look broken. The alternative is to strip a code fence
  before parsing, which is what many pipelines do. Phase 2 depends on this choice.
- **Phase 2: make the rest live.** Optimizer run 1, version 3, fix-the-data and the test reveal still use mocked
  outputs built around invented failures. Rebuild them from the real failures (the code fence first), using the
  same actor and grader, and re-derive the "validation looked perfect, test did not" moment from real runs
  or drop it if the real runs do not show it. Then delete `OUT` and `scripts/verify-numbers.js`' mock checks.
- **More feedback from the speaker is coming in a new session.** Apply it through `src/template.html`.
- Before the talk: run every live screen once to fill the cache, then present with `node server.mjs --replay`,
  and decide whether to commit `.cache/llm.json` so the recorded run survives (it is git-ignored today).
- Confirm the abstract text that was submitted, and learn the slot length and date.
- Check density on the real projector, and re-measure which steps scroll at 1280×800.
- No git remote is configured; nothing is pushed.
