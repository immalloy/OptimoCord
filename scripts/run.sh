#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required. Please install Node.js 18+ and try again."
  exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [ "${NODE_MAJOR}" -lt 24 ]; then
  echo "Warning: Node.js 24+ is recommended for optimo (current: $(node -v))."
fi

if [ ! -d "${ROOT_DIR}/node_modules" ]; then
  echo "Installing dependencies..."
  npm install --prefix "${ROOT_DIR}"
fi

export PATH="${ROOT_DIR}/node_modules/.bin:${PATH}"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "Warning: ffmpeg not found (video optimization may fail)."
fi

if ! command -v magick >/dev/null 2>&1; then
  echo "Warning: magick (ImageMagick) not found (image optimization may fail)."
fi

if ! command -v gifsicle >/dev/null 2>&1; then
  echo "Warning: gifsicle not found (GIF optimization may fail)."
fi

if ! command -v jpegtran >/dev/null 2>&1; then
  echo "Warning: jpegtran not found (JPEG optimization may fail)."
fi

if ! command -v svgo >/dev/null 2>&1; then
  echo "Warning: svgo not found (SVG optimization may fail)."
  echo "Hint: npm install already includes a local svgo binary for this project."
fi

echo "Launching OptimoCord..."
npm run dev --prefix "${ROOT_DIR}"
