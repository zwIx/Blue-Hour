#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ "$(uname -s)" != Darwin || "$(uname -m)" != arm64 ]]; then
  echo "Blue Hour currently builds on Apple silicon Macs." >&2
  exit 1
fi
if ! command -v uv >/dev/null; then
  echo "Install uv before setting up the download runtime." >&2
  exit 1
fi
if [[ ! -x node_modules/deno/deno ]]; then
  echo "Run npm ci first." >&2
  exit 1
fi

mkdir -p runtime/managed runtime/packages runtime/bin
uv python install 3.12.16 --install-dir runtime/managed --no-bin
python=runtime/managed/cpython-3.12.16-macos-aarch64-none/bin/python3.12
uv pip install --python "$python" --target runtime/packages -r runtime/requirements.txt

ffmpeg_package="$(mktemp -d)"
trap 'rm -rf "$ffmpeg_package"' EXIT
uv pip install --python "$python" --target "$ffmpeg_package" imageio-ffmpeg==0.6.0
install -m 755 "$ffmpeg_package/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v7.1" runtime/bin/ffmpeg
install -m 755 node_modules/deno/deno runtime/bin/deno
