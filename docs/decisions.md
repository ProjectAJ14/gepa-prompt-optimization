# Decisions, verified facts and open items

First written 23 Oct 2026; updated the same day when the screens moved from mocked to live model calls (all of them, from slide 7 on).

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
| **Live, not mocked** (23 Oct) | The speaker changed their mind about mock data. Where the page needs a model, it makes a real `claude -p` call. **Done for every screen**: phase 1 was versions 1 and 2 and the score screen; phase 2 (the same day) rebuilt everything after the score as one live round of the loop, and deleted the mocked outputs, the invented failures and the "fix the data" screen. |
| Models | **Haiku 4.5 acts** (the Student), **Haiku 5.5 grades**, **Sonnet 5.5 coaches** (my choice: the speaker named no Coach model; a stronger model suits reading failures and rewriting a prompt). Different models, so nothing grades itself. Override with `ACTOR_MODEL`, `GRADER_MODEL` and `COACH_MODEL`. |
| **The loop, from slide 7** (23 Oct) | Speaker's call: rethink everything after the score slide around the five roles and run it for real. **One round, by hand, labelled as such: it is not the `gepa` package** (not installed, and it would need API keys this setup avoids). Teacher = the 30 logs; Student = Haiku 4.5; Grader = three code gates plus Haiku 5.5's note; Coach = Sonnet 5.5 via `/api/coach`; Judge = a rule in code. The minibatch is five train logs, one per label (ids 1, 2, 3, 6, 7). Slides: who plays whom, Student and Grader on the five, the Coach rewrites, the Student tries again, the Judge decides (rule one: beat the parent on the same five; rule two: the winner on the ten validation logs), the test once. |
| Strict JSON parsing kept | Assumed, not decided by the speaker: a code-fenced reply fails the JSON gate. It is what gives the Coach something real to find (see the live findings). Fence-tolerant parsing remains an open question. |
| The loop, repeated (slide 12) | Speaker's call, 23 Oct: loop until the prompt passes all 30, then show the final prompt. Two steps: the loop runs (starts by itself on arrival; rows appear as rounds finish), then the final prompt as a diff against version 2. **This spends the test split**, because the Coach has to read failures from every split to get to 30 of 30; the slide says so and says a fresh pipeline would be needed to claim the number. Cached, the loop replays in about a second. |
| Closing slide | Static (speaker's call, 23 Oct): nine separate cards at the top, each with the mascot's face in a fitting expression (focused, thinking, curious, neutral, confused, worried, happy, wink, surprised), and a big "Questions?" at the bottom. The speaker says thank you and opens the floor; nothing is read aloud. The companion is hidden on it. |
| Role figure | Each slide from the score slide on shows the active character, bottom right (speaker's call, 23 Oct). |
| Grader's job | Reads each reply for meaning and says whether it names the right failure, ignoring format. It is a second opinion next to the three code gates, so the screen can show where they disagree. |
| How calls run | `server.mjs` (Node, no dependencies) serves the page and runs `claude -p` with no tools, hooks, MCP servers or saved session, from a temp directory. Answers are cached in `.cache/llm.json`; `--replay` presents from the cache only. |
| Run view | A 2×2 grid of the four sample runs, all visible at once (speaker's call, 23 Oct; replaced one-log-at-a-time tabs). Each cell has its own exact prompt and the model's full output side by side in fixed-size read-only boxes, its time, and Run now. |
| Expandable score rows | Click a row to see the prompt, the full reply, how the score was worked out, and the judge's verdict with its reason. Test-split rows stay closed. |
| Tokens and time on every call (23 Oct) | Speaker's call: every call shows its duration and its tokens, and every group of calls shows the sums. `metaLine()` carries both on each call; the score screen, the Judge, the test and the loop rows end with `costLine()`; slide 13's table has Tokens in / out and Model time per round plus a total row. "Model time" is the sum of call times (four run at once), not the wall clock; the page says so. Tokens come from `claude -p`'s own usage figures; "in" adds fresh, cached and cache-written input. Cost in dollars is in the hover text, not in a column. |
| Every call is dated | Each call shows its model, local date and time, and duration, and "recorded" when it came from the cache. |
| Run now | Every call has a one-click re-run that ignores the recording; a graded call also has "Run judge now". Disabled in replay mode and when offline. |
| Standing rules | The speaker's requirements live in `.claude/rules/` (slides, live model calls, checks) so later additions follow them. |
| Header logo | NonStop io's logo sits top right on every screen (speaker's call, 23 Oct). Downloaded 23 Oct 2026 from https://nonstopio.com/wp-content/uploads/2026/06/NONSTOP-LOGO-LIGHT.svg (13 KB). Inspected first: no scripts and no external references. It is the white-text version, made for dark grounds; it would vanish on a light one, which this page never uses. Embedded through `<img>` as a data URI, so nothing inside it can run. |
| Title screen | No mascot on the title (speaker's call, 23 Oct). The small companion stays on the other screens. |
| Start from empty | A second option on the title screen: forget every recorded call so nothing from a previous run is used (speaker's call, 23 Oct). Two clicks to confirm. The server keeps a timestamped backup in `.cache/` and empties the cache; the page clears its results, open rows and steps. Disabled in replay mode. |
| Use the window | Slides and boxes scale with the window instead of staying laptop-sized (speaker's call, 23 Oct, from a large screen with much unused space). Slide width `min(1500px, 100vw - 168px)`; run-grid and detail boxes grow with the window's height; text inside them grows with its width. At 1280×800 nothing changes. |
| Motion | One entrance everywhere (speaker's call, 23 Oct): `rise`, 320ms. Next animates only the new element; a new screen rises as a whole; Previous and live results do not animate. Rule in `.claude/rules/slides.md`, code in `draw(motion)`. Before this, every `reveal` card replayed on every Next. |
| Loading indicator | While a call runs: the output box shows a small orange pixel critter working (hopping legs, typing arms, blinking), what it waits for and the elapsed seconds; small waits use a ring spinner; the corner companion swaps to the critter. The speaker asked for the Claude mascot. **It is an original stand-in, not Anthropic's artwork**: nothing was downloaded, and an official asset can replace `src/claude-loader.svg`. |
| 30 logs, 10 per split | Speaker asked for 10 per split (23 Oct), up from 12 logs in all. Ids: train 1-10 (spark-clicks, dbt-finance), val 11-20 (airflow-orders, fivetran-crm), test 21-30 (kafka-events, beam-telemetry). The 30-row table sits in a scrollable box. All 120 live calls (30 logs, 2 versions, act and grade) were recorded 23 Oct.  |
| Toy task | Classify pipeline failure logs (30 invented logs, 10 per split, 6 pipelines, 5 labels; speaker asked for 10 each on 23 Oct, up from 12). Fits a data-engineering audience. |
| Honest ending | The test split is opened once, at the end (slide 11), and the slide says what that costs: change the prompt because of the number and it is no longer clean. |
| GEPA before the score | Superseded 23 Oct (speaker's call): GEPA is introduced right after version 2, in **two screens** that replace the old three (what, install, repository). Screen 4 defines it in plain English with a stick figure (one step); screen 5 shows the process as a cast of five. Install, repository and the Claude plugin sit under the illustration on screen 4. The plugin commands are from the README's "Use GEPA as an Agent Skill" section (read 23 Oct 2026): `/plugin marketplace add gepa-ai/gepa` then `/plugin install gepa-optimize-anything@gepa`. The score screen now follows as "what you hand over". The characters come from the speaker's own explainer video (`~/.hyperframes-studio/New video`), redrawn as original SVG in the design tokens. |
| Design | Centred slides, the Eklavya design tokens inlined, the archer mascot as a companion with a short hint per step. **No Eklavya wordmark and no other product names on any slide** (speaker's call, 23 Oct); the one exception is the NonStop io logo in the header. |
| Real-results screen | **Removed** (23 Oct). It showed another project's results. The live runs become the real data. |
| Browser checks | Playwright MCP. The browser-use plugin registered but failed to connect ("Connection closed"). |
| Mock honesty | Superseded: nothing is mocked. |

## Screens, in order

1. Title (no mascot, Warm-up button) · 2. Version 1, the one-liner **(live)** · 3. Version 2, five techniques added one by one,
then run **(live)** · 4. What is GEPA (one step, with install, repository and the Claude plugin) ·
5. How GEPA works (the cast: Teacher, Student, Grader, Coach, Judge, the loop, and a last step that gives the five their real models and data for this talk) · 6. We need a score: examples, answers, split,
score v1 and v2 **(live, with a judge column)** · 7. Student and Grader: the first try, on five logs **(live)** ·
8. The Coach rewrites the prompt **(live)** · 9. The Student tries again **(live)** · 10. The Judge decides **(live)** · 11. The test, once **(live)** · 12. Round after round: the loop until all 30 pass, then the final prompt **(live)** · 13. The checklist (static: nine mascot cards and "Questions?")

Slides 6 to 12 show the role figure bottom right. ("Who plays whom" was its own slide 7 until 24 Oct; the speaker merged it into slide 5 as a last step, because it repeated what slides 5 and 6 had already shown.)

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

## What the first full round showed (23 Oct 2026; Haiku 4.5 Student, Haiku 5.5 Grader, Sonnet 5.5 Coach; one run, recorded)

Real, one run each, pinned by the cache. Re-run before quoting.

- **Version 2 scores 0.000 on all 30 logs under strict gates:** every reply is wrapped in a code fence, so none parses.
- **The Coach found it in about 6 s.** Its reason: all five replies had the right label, but each was code-fenced, so the JSON check failed. It added one line to the rules block: output raw JSON only, no code fence or backticks, first character `{`, last `}`. Nothing else changed.
- **Version 3 (round 1):** the five logs 0.717; validation 0.000 to 0.783; test 0.000 to 0.633; 23 of 30 logs pass all three gates (failing: logs 3, 5, 8, 12, 22, 25, 26). Version 2 was code-fenced on 10 of 10 test replies, version 3 on 2 of 10. (The numbers moved from an earlier run because the Coach's input wording changed from "five examples" to a count, which made a new Coach call; the cache keys on the exact prompt.)
- **What this does and does not show:** the gain is real and comes from a formatting fix, not from smarter classification (the Grader said "right idea" on version 2's replies all along). It is one round, one run, ten logs per split, and a second Coach run may write a different prompt.
- **The loop (slide 12):** round 2 (version 4) passes 29 of 30, round 3 (version 5) passes 30 of 30, and the loop stops. Version 5 scores train 0.775, validation 0.850, test 0.775 (not 1.000: a reply over 15 words keeps a passing log under 1). The Coach added rules for code fences, LATE_DATA and SCHEMA_DRIFT.
- **History of the loop's rules, so nobody re-derives them:** a first version let the Coach read only train failures and ran four rounds. Rounds 2 to 5 were identical, because a dropped child left the parent unchanged and the cached Coach call returned the same text. A second version (accept on train score) stopped after one round: version 4 passed every train log (28 of 30 overall) and the Coach may not read validation or test. The speaker wants all 30 to pass, so the final rule is: the Coach reads failures from all 30 logs, the Judge accepts a child that passes more logs (ties: higher mean score), earlier failed attempts go back into the Coach's input so rounds differ, and the loop stops at 30 of 30 or after five rounds.
- **Cost and speed:** the Coach call is 3 to 6 s. A candidate run on all 30 logs is 60 calls, about 90 s live. A full warm-up of every call the walkthrough makes is about 400 calls and several minutes.

- **Replay works for the whole loop.** Checked on `--replay`: the Coach slide and the test slide answer from the cache with no model call (171 recorded calls).
- **Scroll at 1280×800:** every step fits except small overruns that are only the mascot's reserved gap (slide 7 step 5 +15 px, slide 9 step 2 +23, slide 11 step 1 +14, slide 12 step 1 +17). Not checked at 560×900.

## The pre-talk review (24 Oct 2026)

Three independent reviewers (server, slides 7 to 14 runtime, all content and rules) and a Playwright pass over the whole deck. What was found and fixed:

- **Loop (blockers, reproduced):** an errored loop restarted itself on every redraw (150 Coach calls in 1.5 s in a stub); Retry while the loop ran left it stuck on "running"; an unusable Coach reply was cached by the server and replayed forever on Retry. Fixed: an errored loop waits for Retry, the loop is wrapped so any throw becomes a visible error, Retry is ignored while it runs, an unusable reply is re-asked with `fresh`. Also: Coach input kept under the route's 12000-character limit, new prompts over 3500 characters refused, empty actor replies handled, Run now on the Coach and Start from empty ignored while calls run.
- **Server:** a grader or actor that answers with nothing is now a 502, never a recorded verdict; invalid or non-object JSON is a 400; a `null` from the CLI no longer crashes the server; a corrupt `llm.json` is kept as `llm.corrupt-*.json` instead of being overwritten (and replay refuses to start on it); a call that finishes after a reset cannot write into the emptied cache; identical calls in flight share one model call; Ctrl+C saves the last recording and stops child processes; replay misses name the call; grade replies up to 20000 characters.
- **Content:** the judge slide could say "winner: version 3" after rule one dropped it; the test slide's "mostly a format fix" and caption branches were typed, not computed; "candidate 0" and "never sees validation or test" were not scoped or not in the README; the loop's hint asserted an outcome; the cast slide carried a "Live run" tag with no calls; two checklist cards named things the talk never showed; stale docs and comments.
- **Found by the browser pass, missed by every reviewer:** the tokens added to each call's meta line pushed the version 1 and 2 run grids past the footer at 1280×800 (fixed: shorter boxes); offline, slides 2 and 3 showed a loader forever and said nothing (fixed: they say so); the closing slide's "Questions?" was wider than a 560 px window; the role figure's label touched the slide at 1600 px.
- **Left as is, on purpose:** the plugin card names Claude Code (the README does; the speaker asked for it). The 120 px gap under the slide for the mascot is dropped on tall slides, so nothing scrolls.

Tests added: `scripts/test-server.mjs` (20 tests, the server against a fake `claude`), `scripts/test-loop.js` (11 tests, the page's loop code against a stub server, every failure path), more checks in `verify-numbers.js`; `scripts/check-all.sh` runs all of it. Playwright, 24 Oct: every one of the 44 steps walked Next-only and Previous at 1280×800 with the live server (no overflow, no scroll, no errors), cold jumps to slides 10, 12 and 13, 560×900 (no sideways overflow), 1600×1100 (nothing under the footer or the role figure), the whole deck in replay (Run now disabled everywhere), the whole deck offline (every live slide says so), Run now and Start from empty live on a throwaway cache, and Warm-up on the real cache (3 s, zero new calls, loop identical).

## Verified facts and where they come from

**Scores** are no longer stored anywhere: every number on a slide comes from a recorded or live call. `scripts/verify-numbers.js` checks the code around them (gates, parser, diff, data split).

**GEPA facts on screens 4 and 5:** from the repository README at https://github.com/gepa-ai/gepa, fetched
23 Oct 2026 as a summary, and re-checked against the raw file on 24 Oct 2026 by a reviewer (every slide claim matched). Covered: the one-line definition, the paper (*GEPA: Reflective
Prompt Evolution Can Outperform Reinforcement Learning*, Agrawal et al., 2025, arXiv 2507.19457), `pip install gepa` and
the install from `main`, the Claude Code skill commands, the entry points (`gepa.optimize`, `optimize_anything`,
`dspy.GEPA`), the folder list, the adapter and integration names, and the MIT licence.

## Not verified

- **"Candidate" is now used on screen 5 ("the pool of candidates") without being defined**, since the speaker removed that step from screen 4. Say it aloud: a candidate is one version of the prompt.
- **The cast on screen 5 (and its last step, with real names) is an analogy, not GEPA's terms.** Each card has a plain-English "Who" line (23 Oct): Teacher is you, Student is the AI model that follows the prompt, Grader is the check you write, Coach is a second AI model, Judge is the keep-or-drop rule, "not a person or a model". That last claim is my reading of "add to the pool if improved"; the README does not say how the check is implemented. Mapping used: Teacher = your train and validation sets; Student = the task model and its traces; Grader = your metric (a score plus feedback text); Coach = the reflection model; Judge = the pool of candidates (Pareto frontier). The README does not define "candidate" in words (it shows a dictionary with a `system_prompt` key), says nothing on how the final best candidate is chosen (it only shows `result.best_candidate`), and does not say what "improved" is measured on. The video says "best average test score wins" and "three practice cards"; neither is on a slide.

- The exact argument names of `gepa.optimize`: no slide shows a code call.
- Whether the README has changed since 23 Oct 2026, and whether `pip install gepa` was run here (it was not).
- The 20-minute length: the event page states none.
- The live numbers above come from one run. Re-run before quoting them.

## Open items

- The live v1 and v2 numbers on the score screen are for the 30-log set: v2 parses 0 of 20 train and validation replies (code fences), the judge says 18 of 20 have the right idea.
- **Recordings made before 23 Oct 2026, 19:24 have no timestamp** and show "time not recorded" until each call is re-run
  with Run now. A "re-run all" button is not built; it would cost about 50 calls.
- **Decide how strict the parser is.** Today a code-fenced reply fails the JSON gate, which makes version 2 score 0.000 and gives the Coach its finding. The alternative (strip the fence before parsing) would make version 2 look better and leave the Coach less to find.
- **Real `gepa` package.** Screens 7 to 11 are the loop by hand. Running the actual package is not done and not verified here.
- **More feedback from the speaker is coming in a new session.** Apply it through `src/template.html`.
- Before the talk: run every live screen once to fill the cache, then present with `node server.mjs --replay`,
  and decide whether to commit `.cache/llm.json` so the recorded run survives (it is git-ignored today).
- Confirm the abstract text that was submitted, and learn the slot length and date.
- Check density on the real projector, and re-measure which steps scroll at 1280×800.
- No git remote is configured; nothing is pushed.
