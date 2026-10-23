# Data Engineering for Prompt Optimization

A walkthrough for a talk on setting up the pipeline around a prompt optimizer (GEPA). Press Next to step
through it: a prompt improves from a one-liner, meets GEPA (two plain-English screens with stick figures), then gets a score. The live screens run real model
calls: Haiku 4.5 acts (the Student), Haiku 5.5 grades, and Sonnet 5.5 coaches (rewrites the prompt), all through `claude -p`. From slide 7 on it runs one round of GEPA's loop by hand with those models, then slide 12 repeats it until all 30 logs pass. Nothing is mocked.

```bash
node server.mjs                    # live: http://127.0.0.1:8787, real calls, answers cached in .cache/llm.json
node server.mjs --replay           # present from the cache, with no model calls
CACHE_DIR=/tmp/x node server.mjs   # keep the recordings somewhere else (for testing)
python3 build.py                   # rebuild index.html after editing src/template.html
node scripts/verify-numbers.js     # checks the scoring gates, the Coach-reply parser, the diff and the data split
scripts/check-all.sh               # every automated check in one go (build, numbers, render, server tests, loop tests, design grep)
```

On the title screen, **Warm up** fills in the live calls (reusing recordings), and **Start from empty** clears every recording (a backup is kept) so every call is live.

## Before the talk

1. `scripts/check-all.sh` (no model is called). It must end with `all automated checks passed`.
2. `node server.mjs`, open the page, press **Warm up the live calls** on the title screen once. Everything already recorded is reused, so it takes seconds. Wait for the button to read "Warm up the live calls" again, then stop the server (Ctrl+C saves the last recording) before starting the next one.
3. Present with `node server.mjs --replay`. It never calls a model, so a dead connection or a slow model cannot hurt you. **Run now** and **Start from empty** are disabled in replay, on purpose.
4. A backup of the recordings is in `.cache/llm.talk-backup.json` (git-ignored). Restore it by copying it over `.cache/llm.json` with the server stopped.
5. Do not press the Coach's **Run now** (slide 8) on the real recordings: it asks the Coach again, which can write a different prompt and sends slide 12's loop through about 400 new calls. It is disabled in replay.

Keys: Next and Previous (arrow keys), Jump menu in the header, N for speaker notes.
Needs Node 18 or later and a logged-in `claude` CLI. Read `CLAUDE.md` before changing anything.
