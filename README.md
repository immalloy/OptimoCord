# OptimoCord

OptimoCord is a desktop media optimizer for messaging platforms like Discord, WhatsApp, Telegram, Slack, and Signal.

It helps files fit upload limits automatically with a modern, fast-feeling UI.

## Features

- Drag-and-drop file upload
- Platform presets (including Discord tiers)
- Force Fit mode for strict size targets
- Quality slider and auto-convert option
- Output preview with size estimates and compression percentage
- Animated optimization progress
- Post-processing actions: Download, Copy to clipboard, Open folder

## Run Locally

```bash
./scripts/run.sh
```

Or manually:

```bash
npm install
npm run dev
```

## Optimization Engine

OptimoCord uses the published `optimo` npm package (not copied source) for actual media optimization.

- npm package: `optimo`
- Programmatic API: `optimo.file(...)`
- Output files are saved to your Downloads folder inside `OptimoCord/`

## System Requirements

- Node.js 22+ works, but `optimo` officially targets Node.js 24+
- External binaries should be available on your system PATH depending on media type:
  - `ffmpeg` (video)
  - `magick` (ImageMagick, common image formats)
  - `gifsicle`, `jpegtran`, `cjpeg`, `djpeg`, `svgo` (format-specific pipelines)

If a required binary is missing, the app will show a clear error with missing command names.

## Scripts

- `npm run dev` - Launch the Electron app
- `npm run start` - Alias of `dev`
- `npm run check` - Basic syntax check for app files
