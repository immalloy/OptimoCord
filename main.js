const path = require("path");
const os = require("os");
const fs = require("fs/promises");
const { randomUUID } = require("crypto");
const { app, BrowserWindow, ipcMain, shell } = require("electron");
const optimo = require("optimo");

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".heic", ".heif", ".tiff", ".bmp"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".m4v", ".mov", ".webm", ".mkv", ".avi", ".ogv"]);

function normalizeFormat(format) {
  if (!format) return null;
  const normalized = String(format).trim().toLowerCase().replace(/^\./, "");
  return normalized || null;
}

function getOutputPath(filePath, format) {
  const normalizedFormat = normalizeFormat(format);
  if (!normalizedFormat) return filePath;
  const parsed = path.parse(filePath);
  return path.join(parsed.dir, `${parsed.name}.${normalizedFormat}`);
}

async function ensureUniquePath(filePath) {
  const parsed = path.parse(filePath);
  let candidate = filePath;
  let counter = 1;

  while (true) {
    try {
      await fs.access(candidate);
      candidate = path.join(parsed.dir, `${parsed.name}-${counter}${parsed.ext}`);
      counter += 1;
    } catch {
      return candidate;
    }
  }
}

function decideFormat(inputPath, autoConvert) {
  if (!autoConvert) return null;

  const extension = path.extname(inputPath).toLowerCase();
  if (IMAGE_EXTENSIONS.has(extension)) return "webp";
  if (VIDEO_EXTENSIONS.has(extension) && extension !== ".mp4") return "mp4";
  return null;
}

function computeResize({ inputSize, targetBytes, forceFit, isImage }) {
  if (!forceFit || !targetBytes) return null;
  if (isImage) {
    const mb = Math.max(0.01, targetBytes / (1024 * 1024));
    return `${mb.toFixed(2)}mb`;
  }

  const ratio = Math.max(0.05, Math.min(1, targetBytes / inputSize));
  return `${Math.round(ratio * 100)}%`;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 980,
    minHeight: 700,
    backgroundColor: "#0b0e14",
    title: "OptimoCord",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile("index.html");
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.handle("open-downloads", async () => {
  const downloadsPath = app.getPath("downloads") || os.homedir();
  const openedPath = await shell.openPath(downloadsPath);
  return openedPath || downloadsPath;
});

ipcMain.handle("show-item", async (_event, filePath) => {
  if (!filePath) return false;
  shell.showItemInFolder(filePath);
  return true;
});

ipcMain.handle("optimize-file", async (_event, payload) => {
  const { filePath, fileName, targetBytes, quality, forceFit, autoConvert } = payload || {};
  if (!filePath || !path.isAbsolute(filePath)) {
    return { ok: false, error: "Invalid input file path." };
  }

  const sourceStat = await fs.stat(filePath);
  const inputSize = sourceStat.size;
  const extension = path.extname(filePath).toLowerCase();
  const isImage = IMAGE_EXTENSIONS.has(extension);

  const format = decideFormat(filePath, autoConvert);
  const resize = computeResize({ inputSize, targetBytes, forceFit, isImage });
  const losy = Number(quality) < 96;

  const tempRoot = path.join(app.getPath("temp"), "optimocord-jobs");
  const jobDir = path.join(tempRoot, randomUUID());
  const inputCopyPath = path.join(jobDir, path.basename(filePath));

  await fs.mkdir(jobDir, { recursive: true });
  await fs.copyFile(filePath, inputCopyPath);

  const expectedOutputPath = getOutputPath(inputCopyPath, format);

  try {
    const result = await optimo.file(inputCopyPath, {
      dryRun: false,
      losy,
      resize,
      format,
      mute: false
    });

    if (Array.isArray(result?.missingBinaries) && result.missingBinaries.length > 0) {
      await fs.rm(jobDir, { recursive: true, force: true });
      return {
        ok: false,
        error: `Missing required binaries: ${result.missingBinaries.join(", ")}`,
        missingBinaries: result.missingBinaries
      };
    }

    const optimizedPath = expectedOutputPath;
    const optimizedStat = await fs.stat(optimizedPath);

    const outputDir = path.join(app.getPath("downloads"), "OptimoCord");
    await fs.mkdir(outputDir, { recursive: true });

    const outputNameBase = fileName || path.basename(optimizedPath);
    const outputName = format
      ? `${path.parse(outputNameBase).name}.${normalizeFormat(format)}`
      : path.basename(optimizedPath);

    const destinationPath = await ensureUniquePath(path.join(outputDir, outputName));
    await fs.copyFile(optimizedPath, destinationPath);
    await fs.rm(jobDir, { recursive: true, force: true });

    const compressionPercent =
      inputSize > 0 ? Math.max(0, ((inputSize - optimizedStat.size) / inputSize) * 100) : 0;

    return {
      ok: true,
      outputPath: destinationPath,
      originalSize: inputSize,
      optimizedSize: optimizedStat.size,
      compressionPercent
    };
  } catch (error) {
    await fs.rm(jobDir, { recursive: true, force: true });
    return {
      ok: false,
      error: error?.message || "Optimization failed."
    };
  }
});
