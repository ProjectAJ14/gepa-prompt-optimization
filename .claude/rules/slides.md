---
paths:
  - "src/template.html"
  - "build.py"
---

# Slides: how every screen is built

Standing requirements from the speaker. They apply to every screen, including ones not written yet.

## Stepping

- Every screen is a list of steps. **Next adds one thing; Previous takes it back.** Nothing appears all at once.
- A prompt **grows**: new text is appended and highlighted green (`hot`), never shown whole. Show a finished prompt
  only after it has been built up, or when the point is the finished prompt.
- Techniques are added in this order, and **tags come last**: list the labels, show one example, name the edge cases,
  say the output format, tag the inputs. Tags are the payoff because they keep several inputs and sections apart.
- Each step has a companion hint and the screen has speaker notes. A new screen needs `steps`, `hints` (one per
  step), `notes`, `tag` and `render`; add `live: true` and an `effect` if it makes model calls.

## Motion

One entrance for everything, so Next always feels the same. The contract lives in `draw(motion)` and the `rise` keyframes.

- **The entrance is `rise`**: fade in and move up 10px, 320ms, the token easing (`--duration-slow`, `--ease`; `MOTION` in JS mirrors them).
  Nothing else enters: no slide-in, no zoom, no second style. Do not invent a new keyframe for a new element.
- **Next within a screen** (`draw("step")`): only what is new rises. A new card, row, list item or block takes the class `reveal`;
  new prompt text takes `add` (green). Whatever was already on screen stays still (`draw()` marks it `still` by comparing the
  element's HTML with the previous render), so earlier cards never flash again.
- **Next across a screen** (`go()` calls `draw("screen")`): the whole slide rises once; nothing inside it animates on top.
- **Previous, live results, Run now, row toggles, redraws** (`draw()` with no argument): no entrance. Going back is instant;
  a model result arriving does not replay the slide.
- When a step makes the vertically centred slide taller, it glides to its new position over the same 320ms.
- The companion's line rises only when its text changes. Loaders and spinners are the only looping motion.
- **Adding something new:** give new content the `reveal` class and call `draw("step")` from its Next handler. Never animate in `render()`,
  never time an animation by hand. Reduced motion switches all of it off (`prefers-reduced-motion`).

## Layout and presentability

- Slides are **centred**, vertically and horizontally. When only one thing is on screen it sits in the middle, and the
  layout re-centres as more arrives (`.cluster` for wrapping cards, the glide in `draw()` for height changes).
- A slide should fit a laptop viewport (1280×800) without scrolling. When it does not, make it denser first
  (`compact` tables, `dense` headings, a smaller prompt) or let one step replace the previous one's content, before
  accepting a scroll. Re-measure after every change and record which steps still scroll.
- Long text lives in a fixed-size, read-only, scrollable box, not in a growing card.
- A table of more than about a dozen rows (the 30-log score table) sits in `.tablebox`, a fixed-height scrollable box with a sticky header,
  so the slide itself never scrolls. Its height comes from the viewport (`calc(100vh - ...)`), and `draw()` keeps its scroll position
  across redraws so arriving model results do not throw the reader back to the top.
- **Use the window.** The speaker presents on large screens, so content must grow with the window instead of sitting in a
  laptop-sized column. The baseline is 1280×800, where everything must fit; above that, sizes scale. The slide is
  `min(1500px, 100vw - 168px)` wide (the gutter keeps the corner companion clear). Box heights and the text inside them come
  from `--boxh`, `--detailh` and `--monosz`, which equal the laptop values at 1280×800 and grow with the window. Never size a
  new box in fixed pixels; use those variables. Check 1280×800 (fits, unchanged) and 1600×1100 (fills the space, nothing
  overlaps the companion).
- No page-level horizontal overflow at 560, 900 and 1280 px.

## Look

- **Eklavya design tokens**, inlined by `build.py`. Components name role tokens, never a hex, `rgba()` or `--vd-*`.
  Square chrome, hairlines, the focus ring as the only `box-shadow`, sentence case, no emoji, visible focus, real
  `<button>`s. Circles only for dots, step numbers and the small loading ring. Run the design grep in `CLAUDE.md`.
- **The mascot is a companion.** A small face and one short line per step, with the expression that fits the moment
  (the set in `mascot.js`). Professional but light: never a joke, never on every sentence. The title screen has no mascot (speaker's call, 23 Oct).
  While calls run, the line says the model is working. When the slide is tall it keeps only the face.
- **Stick figures** (`stick(kind)`, roles teacher, student, grader, coach, judge) explain GEPA, one job each, drawn as inline SVG in role tokens (`--viz-*`). They are original drawings based on the speaker's explainer video, never frames or files from it. A figure's job on a slide must match what GEPA's README says; label analogies as analogies and say what each character is in GEPA.
- **No product or project names on slides** other than the subject (GEPA and the models). The header carries one logo, top right: NonStop io's, the speaker's employer (`src/nonstop-logo.svg`, the white-text version made for dark grounds, embedded as a data URI through `<img>`). No other brand mark or wordmark.
  Another project's results never appear on a slide. The loading critter (see `live-model-calls.md`) carries no text.

## Words

- Direct and concrete, numbers over adjectives. The other speaker's talk is "Building Data Platforms Agents Can Trust":
  do not frame anything with "trust", "reliable", "high-quality data", "context" or "governed".
- Facts about GEPA come from its README, with the date they were read. If a fact is not in the README, it does not go
  on a slide. List what is not verified in `docs/decisions.md`.

## Footer tags

`Live run` for real model calls, `Example data` for anything still mocked, `From the GEPA repo` for reference
screens. A screen with mixed content takes the weaker tag.
