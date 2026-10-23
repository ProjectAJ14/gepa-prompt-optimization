# Checks before a change is done

Run these in order. Report any you did not run, and never describe a planned check as done.

1. `python3 build.py` rebuilds `index.html` from `src/template.html`. Never edit `index.html` by hand.
2. `node scripts/verify-numbers.js` must print "all numbers match". It checks the scoring gates, the parsing of the Coach's reply, the diff, and the shape of the data (nothing is mocked any more).
3. `node scripts/smoke-render.js` must print "no render errors". It renders every step of every screen, and it
   exists because one missing helper blanked a slide and nothing else noticed.
4. Open the real server and step through every screen with **Next only**, then **Previous**. Use the Playwright MCP:
   `node server.mjs`, then `http://127.0.0.1:8787/?fresh=N#K`. Change `fresh` on every navigation: a URL that
   differs only in its hash does not reload, so old code keeps running. Take screenshots with no filename. Read
   `browser_console_messages` at the error level.
5. At 1280×800 and 560×900 check page overflow (`document.documentElement.scrollWidth > innerWidth`) and list which
   steps scroll (`main.scrollHeight > main.clientHeight`).
6. For anything that makes a model call, click **Run now** on it once and confirm the time updated, the button
   showed "Running…", and a dependent grade was redone.
7. With the server stopped, open the page: live steps must say so and nothing may throw.
8. Stop every server you started (`pkill -f "node server.mjs"`, `pkill -f "http.server"`) and close the browser tab.

## Adding something new: the short list

- New screen: follow `.claude/rules/slides.md`. Update the screen list in `docs/decisions.md` and the count anywhere
  it is stated.
- New model call: follow `.claude/rules/live-model-calls.md`: prompt, output box, grader verdict, date and time,
  Run now, expandable row if it is per item.
- New standing preference from the speaker: write it into the matching file in `.claude/rules/` in the same
  change, so the next session knows it without being told.
- Commit each finished change once the checks pass (speaker's standing instruction, 23 Oct), with docs, `CLAUDE.md` and rules updated in the same commit. Conventional commits, no push.
