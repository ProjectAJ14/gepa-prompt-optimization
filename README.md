# Data Engineering for Prompt Optimization

A walkthrough for a talk on setting up the pipeline around a prompt optimizer (GEPA). Press Next to step
through it: a prompt improves from a one-liner, meets GEPA (two plain-English screens with stick figures), then gets a score. The live screens run real model
calls: Haiku 4.5 acts (the Student), Haiku 5.5 grades, and Sonnet 5.5 coaches (rewrites the prompt), all through `claude -p`. From slide 7 on it runs one round of GEPA's loop by hand with those models, so nothing after the title is mocked.

```bash
node server.mjs                    # live: http://127.0.0.1:8787, real calls, answers cached in .cache/llm.json
node server.mjs --replay           # present from the cache, with no model calls
CACHE_DIR=/tmp/x node server.mjs   # keep the recordings somewhere else (for testing)
python3 build.py                   # rebuild index.html after editing src/template.html
node scripts/verify-numbers.js     # checks the scoring gates, the Coach-reply parser, the diff and the data split
```

On the title screen, **Warm up** fills in the live calls (reusing recordings), and **Start from empty** clears every recording (a backup is kept) so every call is live.

Keys: Next and Previous (arrow keys), Jump menu in the header, N for speaker notes.
Needs Node 18 or later and a logged-in `claude` CLI. Read `CLAUDE.md` before changing anything.
