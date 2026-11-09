#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

app="${1:-dist/mac-arm64/Blue Hour.app}"
output="${2:-dist/Blue-Hour-arm64.dmg}"
[[ -d "$app" ]] || { echo "Build Blue Hour first." >&2; exit 1; }
[[ ! -e "$output" ]] || { echo "Output already exists: $output" >&2; exit 1; }

staging="$(mktemp -d)"
trap 'rm -rf "$staging"' EXIT
ditto "$app" "$staging/Blue Hour.app"
ln -s /Applications "$staging/Applications"
mkdir -p "$(dirname "$output")"
hdiutil create -volname 'Blue Hour' -srcfolder "$staging" -format UDZO "$output"
hdiutil verify "$output"
