#!/bin/sh
# Prints how well labels are placed on a crowded made-up sky over 60 simulated seconds.
set -eu

root="$(cd "$(dirname "$0")/.." && pwd)"
chrome="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
profile="$(mktemp -d)"
trap 'rm -rf "$profile"' EXIT

"$chrome" --headless=new --disable-gpu --allow-file-access-from-files --user-data-dir="$profile" \
	--virtual-time-budget=6000 --dump-dom "file://$root/tools/preview.html?busy" 2>/dev/null \
	| sed -n '/<pre id="out">/,/<\/pre>/p' | sed -e 's/<[^>]*>//g'
