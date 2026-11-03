#!/usr/bin/env bash
# Baut das Upload-ZIP für den Chrome Web Store → dist/mind-console-<version>.zip
set -euo pipefail
cd "$(dirname "$0")"
V=$(python3 -c "import json;print(json.load(open('manifest.json'))['version'])")
mkdir -p dist
OUT="dist/mind-console-$V.zip"
rm -f "$OUT"
zip -r -X "$OUT" manifest.json background.js content.js sidepanel.html sidepanel.css sidepanel.js profiles icons \
  PROMPT-Profile-Generator.md PROMPT-Profile-Generator.de.md examples -x "*.DS_Store"
echo "OK: $OUT"; unzip -l "$OUT" | tail -1
