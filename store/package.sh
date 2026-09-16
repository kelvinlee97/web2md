#!/usr/bin/env bash
# store/package.sh — packages runtime files only
cd "$(dirname "$0")/.."
VERSION=$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])")
rm -f "web2md-$VERSION.zip"
zip -r "web2md-$VERSION.zip" \
  manifest.json background.js content.js \
  core ui icons \
  -x "*.DS_Store" -x "icons/gen_icon.py"
unzip -l "web2md-$VERSION.zip"
