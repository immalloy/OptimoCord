#!/usr/bin/env node
'use strict'

const https = require('https')
const fs = require('fs')
const path = require('path')

const BIN_DIR = path.join(__dirname, '..', 'bin')
fs.mkdirSync(BIN_DIR, { recursive: true })

// ─── Copy npm-provided binaries ──────────────────────────────
function copyBin(srcPath, destName) {
  const dest = path.join(BIN_DIR, destName)
  fs.copyFileSync(srcPath, dest)
  fs.chmodSync(dest, 0o755)
  console.log(`  copied  ${destName}`)
}

try {
  copyBin(require('ffmpeg-static'), 'ffmpeg')
} catch (e) {
  console.warn('  warning: ffmpeg-static not found:', e.message)
}

try {
  const gifsicle = require('gifsicle')
  copyBin(gifsicle.default ?? gifsicle, 'gifsicle')
} catch (e) {
  console.warn('  warning: gifsicle not found:', e.message)
}

try {
  const jpegtranBin = require('jpegtran-bin')
  copyBin(jpegtranBin.default ?? jpegtranBin, 'jpegtran')
} catch (e) {
  console.warn('  warning: jpegtran-bin not found:', e.message)
}

// ─── Download static magick binary ───────────────────────────
const MAGICK_DEST = path.join(BIN_DIR, 'magick')

if (fs.existsSync(MAGICK_DEST)) {
  const size = fs.statSync(MAGICK_DEST).size
  if (size > 1024 * 1024) {
    console.log('  magick  already present, skipping download')
    process.exit(0)
  }
}

const MAGICK_URL = 'https://imagemagick.org/archive/binaries/magick'

console.log('  downloading magick static binary...')

function download(url, dest, depth = 0) {
  if (depth > 5) {
    console.error('  too many redirects, aborting')
    process.exit(1)
  }
  https.get(url, res => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      return download(res.headers.location, dest, depth + 1)
    }
    if (res.statusCode !== 200) {
      console.error(`  HTTP ${res.statusCode} — could not download magick`)
      console.error('  Install ImageMagick 7 manually: sudo apt install imagemagick')
      process.exit(1)
    }
    const file = fs.createWriteStream(dest)
    res.pipe(file)
    file.on('finish', () => {
      file.close()
      fs.chmodSync(dest, 0o755)
      const mb = (fs.statSync(dest).size / 1024 / 1024).toFixed(1)
      console.log(`  magick  downloaded (${mb} MB)`)
    })
  }).on('error', err => {
    try { fs.unlinkSync(dest) } catch {}
    console.error('  download failed:', err.message)
    console.error('  Install ImageMagick 7 manually: sudo apt install imagemagick')
    process.exit(1)
  })
}

download(MAGICK_URL, MAGICK_DEST)
