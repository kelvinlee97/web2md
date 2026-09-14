#!/usr/bin/env bash
# store/package.sh — packages runtime files only
cd "$(dirname "$0")/.."
rm -f web2md-0.1.0.zip
zip -r web2md-0.1.0.zip \
  manifest.json background.js content.js \
  core ui icons \
  -x "*.DS_Store" -x "icons/gen_icon.py"
unzip -l web2md-0.1.0.zip
