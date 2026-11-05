#!/bin/sh
# Renders the demo sky to docs/demo.png, or to the path given.
set -eu

root="$(cd "$(dirname "$0")/.." && pwd)"
chrome="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
out="${1:-$root/docs/demo.png}"
profile="$(mktemp -d)"
trap 'rm -rf "$profile"' EXIT

"$chrome" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files \
	--force-device-scale-factor=2 --user-data-dir="$profile" --window-size=560,682 \
	--virtual-time-budget=6000 --screenshot="$out" "file://$root/tools/preview.html?shot" >/dev/null 2>&1

echo "$out"
