# Contributing

This is a talk's walkthrough, so changes are judged on whether they keep it presentable and honest.

1. Read `CLAUDE.md` and `.claude/rules/`: they hold the rules (one step at a time, centred slides that fit 1280×800, every model call shows its prompt, output, verdict, time, tokens and a Run now button, nothing mocked).
2. Edit `src/template.html`, then rebuild: `python3 build.py --eklavya <path to a checkout of github.com/ProjectAJ14/eklavya>`. Never edit `index.html` by hand.
3. Run `EKLAVYA_DIR=<same path> scripts/check-all.sh`. It calls no model and costs nothing.
4. Look at it in a browser, Next only and then Previous, at 1280×800 and 560×900.

Commits use conventional prefixes (`feat:`, `fix:`, `docs:`, `chore:`).
