#!/bin/sh
# Every automated check, in the order .claude/rules/checks.md lists them. Stops at the first failure. No model is called and nothing is spent.
# The build step needs a checkout of https://github.com/ProjectAJ14/eklavya (design tokens and mascot). Point EKLAVYA_DIR at it, or keep it at
# ~/Workspace/ProjectAj14/eklavya. Without one the build is skipped and the committed index.html is checked as it is.
set -e
cd "$(dirname "$0")/.."
EK="${EKLAVYA_DIR:-$HOME/Workspace/ProjectAj14/eklavya}"
if [ -d "$EK/web/public" ]; then python3 -I build.py --eklavya "$EK"; else echo "build skipped: no Eklavya checkout at $EK (set EKLAVYA_DIR)"; fi
node scripts/verify-numbers.js | tail -1
node scripts/smoke-render.js | tail -1
OUT="$(mktemp)"
if node --test --test-reporter=spec --test-timeout=60000 scripts/test-server.mjs scripts/test-loop.js > "$OUT" 2>&1; then
  grep -E '^ℹ (tests|pass|fail)' "$OUT" || true
else
  cat "$OUT"; rm -f "$OUT"; echo "tests failed"; exit 1
fi
rm -f "$OUT"
if grep -nE '#[0-9a-fA-F]{3,8}\b|rgba?\(|--vd-' src/template.html | grep -v 'href\|&#\|data:image'; then echo "design grep: hits above"; exit 1; fi
echo "design grep: clean"
echo "all automated checks passed"
