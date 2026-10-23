# Decisions, verified facts and open items

Written 23 Oct 2026 so a new session can continue without the earlier conversation.

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
  audience watches a prompt improve step by step. The runs are mocked to save time and tokens.

## Decisions

| Topic | Decision |
|---|---|
| Format | Every screen is stepped: Next adds one thing, Previous takes it back. Prompts grow by appending. |
| Techniques order | List the labels, show one example, name the edge cases, say the output format, **tag the inputs last**. Tags are the payoff: they keep several inputs and sections of one prompt apart. |
| Mock honesty | The speaker says at the start of the demo that the run is illustrative. Toy screens carry an "Example data" tag. Not revealed only at the end. |
| Toy task | Classify pipeline failure logs (12 invented logs, 4 pipelines, 5 labels). Fits a data-engineering audience. |
| One real screen | Real Eklavya numbers on a "Real data" screen, with a visible placeholder for the fixed evals. |
| Honest ending | After the test split is revealed and acted on, the v4 test number is marked "peeked": it is no longer a clean test. |
| Theory before GEPA | Three screens after the score: what GEPA is, how to install it, what the repository holds. |
| Design | Eklavya design system (tokens inlined), centred slides, a mascot companion with a short hint per step. |
| Browser checks | Playwright MCP. The browser-use plugin registered but failed to connect ("Connection closed"). |

## Screens, in order

1. Title (full mascot) · 2. Version 1, the one-liner · 3. Version 2, five techniques added one by one ·
4. We need a score (examples, answers, split, score v1 and v2) · 5. What is GEPA · 6. Install GEPA ·
7. The GEPA repository · 8. The pipeline around the optimizer (ETL) · 9. Optimizer run 1 ·
10. Version 3 and the test split · 11. Fix the data, run again · 12. A real run, from Eklavya · 13. The checklist

## Verified facts and where they come from

**Mocked scores** (recomputed by `scripts/verify-numbers.js`): v1 0.000 everywhere; v2 train 0.639, val 0.778,
test 0.556; v3 train 1.000, val 1.000, test 0.778; v4 val 1.000, test 0.917; rejected candidate B train and val 0.750.

**Real numbers on screen 12** (Eklavya repo, `eval/results/`):

| Claim | Source |
|---|---|
| Question-prompt candidate: validation 0.48 to 0.79, test 0.545 to 0.637; "selection, not generalisation"; do not ship | `2026-10-09-gepa-pilot.md` |
| Prompt-feedback candidate: timeouts 1/15 against 6/15, pass-every-gate 10/15 against 6/15, mean 0.718 against 0.456; not shipped | `2026-10-10-feedback.md` |
| `gepa==0.1.4` is what Eklavya's eval pins | `eval/gepa/requirements.txt` |

**GEPA facts on screens 5 to 7:** from the repository README at https://github.com/gepa-ai/gepa, fetched
23 Oct 2026 (a summary of the page, not the raw file). Covered: the one-line definition, the paper (*GEPA: Reflective
Prompt Evolution Can Outperform Reinforcement Learning*, Agrawal et al., 2025, arXiv 2507.19457), `pip install gepa` and
the install from `main`, the Claude Code skill commands, the entry points (`gepa.optimize`, `optimize_anything`,
`dspy.GEPA`), the folder list, the adapter and integration names, and the MIT licence.

## Not verified

- The exact argument names of `gepa.optimize`: the install screen lists its inputs and shows no code call.
- Whether the README has changed since 23 Oct 2026, and whether `pip install gepa` was run here (it was not).
- The 20-minute length: the event page states none.
- The mocked outputs are invented; they are not model output.

## Open items

- **More feedback from the speaker is coming in a new session.** Apply it through `src/template.html`.
- **Refresh the real screen** once Eklavya's evals are fixed (Eklavya issue #235: latency in the score, limits told
  to the reflection model, a decision rule before the run, an enforced test split). Optionally record one real
  small run and replay it, so nothing on screen is invented.
- Confirm the abstract text that was submitted, and learn the slot length and date.
- Check density on the real projector. Steps that scroll a little at 1280×800: score 3 and 4, Version 2 steps 5 and 6,
  Version 3 steps 3 and 4.
- No git remote is configured; nothing is pushed.
