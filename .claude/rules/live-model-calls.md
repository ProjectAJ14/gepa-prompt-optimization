---
paths:
  - "src/**"
  - "server.mjs"
  - "scripts/**"
---

# Live model calls

The speaker wants the walkthrough to use real model calls wherever a model is needed. These rules apply to every
call that exists now and to any call added later.

## Where calls come from

- **Every call goes through `server.mjs`**, which runs `claude -p`. The page never calls an API directly and never
  holds a key. A new kind of call is a new `/api/...` route in the server plus a helper in the template.
- **Three different models, one per role.** The actor / Student (runs the prompt under test) is **Haiku 4.5** (`claude-haiku-4-5`). The grader
  (judges the actor's reply) is **Haiku 5.5** (`claude-haiku-5-5`). The Coach (reads the failures and rewrites the prompt) is **Sonnet 5.5**
  (`claude-sonnet-5-5`). `ACTOR_MODEL`, `GRADER_MODEL` and `COACH_MODEL` override them. The Coach sees only the five training results,
  never validation or test.
  A model never grades its own output.
- The child process gets no tools, no hooks, no MCP servers and no saved session. Do not loosen that.
- A new route validates its input (type, length, allowed values), requires the `x-walkthrough: 1` header and a JSON
  body, and carries the same `Host` check. Test it with `curl`, including a request without the header.
- Every result gets `at` (an ISO timestamp, set by the server when the call is made), the model name, the duration
  and the token and cost figures. Recorded answers keep their original `at`.

## What every call shows on screen

Any slide that shows a model call must show all of these. Do not ship a call that hides one.

1. **The input prompt**: the exact text sent, with the real input substituted for the placeholder.
2. **The model output**: the full reply in a **fixed-size, read-only, scrollable box** (`.cell pre` or `.dbox pre`,
   a `<pre tabindex="0">`, never a `<textarea>`). Never an auto-growing card: four of those stacked pushed the
   slide off the screen.
3. **The grader's verdict and its reason**, when the call is graded.
4. **When it happened**: model, local date and time down to the second (`when()`), duration, and "recorded" when the
   answer came from the cache. Older recordings without a time say "time not recorded"; do not invent one.
5. **A "Run now" button** (`runNow()` and `rerun()`): one click calls the model again and ignores the recording
   (the server's `fresh` flag), then replaces the recorded answer. Every call has one, and a graded call has a second
   "Run judge now". Re-running an actor call clears its stale grade so it is re-graded. The button reads "Running…"
   and is disabled while the call is in flight, and is disabled with an explanation in replay mode and when the
   server is not connected.

## While a call is in flight

Never a bare line of text. Every wait shows motion, what it is waiting for, and how long it has taken.

- **The output box** is replaced by the loader: the working critter (`claudeLoader()`, drawn in `src/claude-loader.svg`),
  a line such as "Haiku 4.5 is answering…", and the elapsed seconds (`data-since`, ticking without a redraw).
- **Small waits** (a Run now button, a table cell, the warm-up button) use the ring `spinner`.
- **The corner companion** swaps its face for the critter while any call on a live screen is running.
- The critter is an original stand-in drawn for the talk, not Anthropic's artwork, and carries no text or logo. To use
  official artwork the speaker must supply the file: a self-contained SVG with a `viewBox`, no backtick and no `${`,
  saved over `src/claude-loader.svg`. Do not download artwork from the internet.
- Reduced motion stops the animation; the text and the seconds still show.

**Several runs of the same prompt are shown as a grid, all at once**, not as tabs or steps: `runGrid()` makes one cell per run
(2×2 for four), and each cell holds its own prompt and output side by side, its time, and its own Run now. The prompt box
starts scrolled to its end, where the log line differs. A takeaway sentence goes above the grid, so it is never pushed off screen.

Per-item calls in a table are **expandable rows**: the row is a real button, `aria-expanded`, state in `S.open`, focus
restored after the redraw, and the detail shows the three things above. Rows whose results must stay hidden (the test
split) stay closed.

## Honesty

- Never replace a live result with an invented one, and never hide a failure. A failed call shows its error and a Retry
  button; nothing is retried silently. If the server is not running, the slide says so.
- Nothing is mocked. If a mocked number is ever added, it keeps the **Example data** tag and is never mixed into a sentence about a live one.
- **Screens 7 to 12 are GEPA's loop run by hand, one round.** Say so on screen; it is not the `gepa` package. Each role on screen is a real
  actor: Teacher = the logs, Student = the actor, Grader = gates plus the judge's note, Coach = `/api/coach`, Judge = a rule in code.
- **Slide 13 repeats the loop** (`runLoop()`): up to five rounds, each candidate run on all 30 logs, stop at 30 of 30. It starts on arrival, is deterministic when cached, and is part of Warm-up. The Coach reads failures from every split there, which spends the test split; the slide must keep saying so.
- The Coach's input is built by the page (`coachPrompt()`), so the slide shows the exact text sent. Its reply must contain a `<prompt>` with
  `{{log}}` exactly once (`parseCoach`), or the screen shows the error and a Retry. Test split calls run only when the Teacher's seal is opened.
- Captions that describe results are computed from the data (`scoreNote`, the v2 note), never typed as if the outcome
  were known. The first live run showed a model can ignore "JSON only", so write nothing the data might contradict.
- Gates are strict. A reply wrapped in a code fence fails the JSON gate. Changing that is a decision for the speaker
  (see `docs/decisions.md`), not a quiet fix.

## Recording and replay

- Answers are cached in `.cache/llm.json` (git-ignored), keyed by model, system text and exact prompt. Changing a
  prompt, the grader wording or a model therefore means new calls.
- Before a talk: run every live screen once, then present with `node server.mjs --replay`, which never calls a model.
- `Warm up the live calls` on the title screen fills the cache for the screens that exist today. If a new live screen
  is added, add its calls to that button.
- **`Start from empty`** on the title screen forgets every recorded call so nothing from a previous run is used. It takes
  two clicks (the second reads "Clear N recorded calls and start empty", with Cancel). The server (`POST /api/reset`) writes a
  timestamped backup, `.cache/llm.<time>.json`, then empties the cache; the page clears its results, its open rows and
  every screen's step, and returns to the title. It is disabled in replay mode. Test it on a throwaway cache
  (`CACHE_DIR=<temp dir> node server.mjs --port 8788`), never on the real recordings.
