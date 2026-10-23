#!/usr/bin/env python3
"""Build index.html from src/template.html.

The template holds five placeholders. This script fills them with Eklavya's design
tokens and Archer Cloak mascot, the loading critter from src/claude-loader.svg and the
header logo from src/nonstop-logo.svg, so the finished page is one file that works offline
(only the web fonts are fetched; offline, system fonts take over).

    python3 build.py                      # Eklavya checkout at the default path
    python3 build.py --eklavya /path/to/eklavya
"""
import argparse
import base64
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent
DEFAULT_EKLAVYA = pathlib.Path.home() / "Workspace" / "ProjectAj14" / "eklavya"

ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
ap.add_argument("--eklavya", default=str(DEFAULT_EKLAVYA), help="path to the Eklavya checkout (default: %(default)s)")
args = ap.parse_args()

pub = pathlib.Path(args.eklavya) / "web" / "public"
sources = {
    "/*TOKENS*/": pub / "tokens.css",
    "/*MASCOT_CSS*/": pub / "brand" / "mascot" / "mascot.css",
    "/*MASCOT_JS*/": pub / "brand" / "mascot" / "mascot.js",
}
missing = [str(p) for p in sources.values() if not p.is_file()]
if missing:
    sys.exit("Eklavya design files not found:\n  " + "\n  ".join(missing) + "\nPass --eklavya /path/to/eklavya")

# The loading critter is a project file, not an Eklavya one: replace src/claude-loader.svg to change it.
sources["/*LOADER_SVG*/"] = ROOT / "src" / "claude-loader.svg"
# The header logo goes in through <img> as a data URI, so nothing inside the SVG can run. Replace src/nonstop-logo.svg to change it.
sources["/*LOGO_URI*/"] = ROOT / "src" / "nonstop-logo.svg"

page = (ROOT / "src" / "template.html").read_text(encoding="utf-8")
for marker, path in sources.items():
    if marker not in page:
        sys.exit(f"placeholder {marker} is missing from src/template.html")
    text = path.read_text(encoding="utf-8")
    if marker == "/*LOGO_URI*/":
        text = "data:image/svg+xml;base64," + base64.b64encode(path.read_bytes()).decode("ascii")
    if marker == "/*LOADER_SVG*/":
        if "`" in text or "${" in text:
            sys.exit("src/claude-loader.svg must not contain a backtick or ${ (it is embedded in a JS template string)")
        text = " ".join(text.split())
    page = page.replace(marker, text)

(ROOT / "index.html").write_text(page, encoding="utf-8")
print(f"index.html written ({len(page):,} bytes)")
