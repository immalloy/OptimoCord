#!/usr/bin/env bash

set -euo pipefail

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required. Please install Node.js 18+ and try again."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "Warning: ffmpeg not found (video optimization may fail)."
fi

if ! command -v magick >/dev/null 2>&1; then
  echo "Warning: magick (ImageMagick) not found (image optimization may fail)."
fi

echo "Launching OptimoCord..."
npm run dev
