#!/usr/bin/env bash

set -euo pipefail

if ! command -v apt >/dev/null 2>&1; then
  echo "This installer is for Ubuntu/Debian (apt-based systems)."
  exit 1
fi

echo "Installing system dependencies for OptimoCord..."
sudo apt update
sudo apt install -y \
  ffmpeg \
  imagemagick \
  gifsicle \
  libjpeg-turbo-progs

echo "Done. Installed binaries should include:"
echo "- ffmpeg"
echo "- magick"
echo "- gifsicle"
echo "- jpegtran / cjpeg / djpeg"

echo
echo "Next steps:"
echo "1) npm install"
echo "2) ./scripts/run.sh"
