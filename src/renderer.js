const elements = {
  dropZone: document.getElementById("dropZone"),
  fileInput: document.getElementById("fileInput"),
  fileHint: document.getElementById("fileHint"),
  platformGrid: document.getElementById("platformGrid"),
  platformLimit: document.getElementById("platformLimit"),
  discordTiers: document.getElementById("discordTiers"),
  qualitySlider: document.getElementById("qualitySlider"),
  qualityValue: document.getElementById("qualityValue"),
  forceFit: document.getElementById("forceFit"),
  autoConvert: document.getElementById("autoConvert"),
  optimizeBtn: document.getElementById("optimizeBtn"),
  statePill: document.getElementById("statePill"),
  outName: document.getElementById("outName"),
  outOriginal: document.getElementById("outOriginal"),
  outTarget: document.getElementById("outTarget"),
  outEstimated: document.getElementById("outEstimated"),
  outCompression: document.getElementById("outCompression"),
  beforeInfo: document.getElementById("beforeInfo"),
  afterInfo: document.getElementById("afterInfo"),
  progressStage: document.getElementById("progressStage"),
  progressPct: document.getElementById("progressPct"),
  progressFill: document.getElementById("progressFill"),
  resultActions: document.getElementById("resultActions"),
  successBanner: document.getElementById("successBanner"),
  downloadBtn: document.getElementById("downloadBtn"),
  copyBtn: document.getElementById("copyBtn"),
  openFolderBtn: document.getElementById("openFolderBtn"),
  themeBtn: document.getElementById("themeBtn"),
  settingsBtn: document.getElementById("settingsBtn")
};

const platformLimitsMB = {
  discord: {
    free: 10,
    nitroBasic: 50,
    nitro: 500
  },
  whatsapp: 100,
  telegram: 2000,
  slack: 1000,
  signal: 100,
  viber: 200,
  wechat: 100
};

const state = {
  file: null,
  filePath: null,
  selectedPlatform: null,
  selectedDiscordTier: "free",
  estimatedBytes: 0,
  targetBytes: 0,
  processing: false,
  outputPath: null,
  stagedProgressTimer: null
};

function bytesToSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(value >= 100 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function extensionFromName(fileName) {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot).toLowerCase();
}

function isImageName(fileName) {
  return [".jpg", ".jpeg", ".png", ".webp", ".avif", ".heic", ".heif", ".tiff", ".bmp"].includes(
    extensionFromName(fileName)
  );
}

function resolveTargetLimitBytes() {
  if (!state.selectedPlatform) return 0;
  if (state.selectedPlatform === "discord") {
    return platformLimitsMB.discord[state.selectedDiscordTier] * 1024 * 1024;
  }
  return platformLimitsMB[state.selectedPlatform] * 1024 * 1024;
}

function getPlatformLabel(platform) {
  return platform.charAt(0).toUpperCase() + platform.slice(1);
}

function updatePlatformLimitLabel() {
  if (!state.selectedPlatform) {
    elements.platformLimit.textContent = "Select a platform";
    return;
  }

  const target = resolveTargetLimitBytes();
  const platformName = getPlatformLabel(state.selectedPlatform);
  const tierLabel =
    state.selectedPlatform === "discord"
      ? ` ${state.selectedDiscordTier === "nitroBasic" ? "Nitro Basic" : state.selectedDiscordTier.charAt(0).toUpperCase() + state.selectedDiscordTier.slice(1)}`
      : "";

  elements.platformLimit.textContent = `${platformName}${tierLabel} • ${bytesToSize(target)} limit`;
}

function estimateOutputBytes() {
  if (!state.file || !state.selectedPlatform) return 0;

  const quality = Number(elements.qualitySlider.value);
  const qualityFactor = 0.25 + (quality / 100) * 0.75;
  const convertBoost = elements.autoConvert.checked ? 0.88 : 1;
  const rawEstimate = state.file.size * qualityFactor * convertBoost;
  const target = resolveTargetLimitBytes();

  if (elements.forceFit.checked) {
    return Math.min(rawEstimate, target * 0.98);
  }

  return Math.min(rawEstimate, target * 1.05);
}

function updatePreview() {
  const target = resolveTargetLimitBytes();
  const estimate = estimateOutputBytes();
  const hasData = Boolean(state.file && state.selectedPlatform);
  state.targetBytes = target;
  state.estimatedBytes = estimate;

  elements.outName.textContent = state.file ? state.file.name : "-";
  elements.outOriginal.textContent = state.file ? bytesToSize(state.file.size) : "-";
  elements.outTarget.textContent = target ? bytesToSize(target) : "-";
  elements.outEstimated.textContent = hasData ? bytesToSize(estimate) : "-";

  if (hasData) {
    const compression = Math.max(0, 100 - (estimate / state.file.size) * 100);
    elements.outCompression.textContent = `${compression.toFixed(1)}% smaller`;
    elements.outCompression.classList.toggle("good", compression >= 15);
    elements.beforeInfo.textContent = `${bytesToSize(state.file.size)} • ${state.file.type || "Unknown format"}`;
    elements.afterInfo.textContent = `${bytesToSize(estimate)} • Fits ${bytesToSize(target)} target`;
  } else {
    elements.outCompression.textContent = "-";
    elements.beforeInfo.textContent = "Drop a file to preview details";
    elements.afterInfo.textContent = "Optimized output estimate appears here";
  }

  elements.optimizeBtn.disabled = !(state.file && state.selectedPlatform) || state.processing;
}

function resetProcessState() {
  if (state.stagedProgressTimer) {
    window.clearTimeout(state.stagedProgressTimer);
    state.stagedProgressTimer = null;
  }

  state.outputPath = null;
  elements.progressFill.style.width = "0%";
  elements.progressPct.textContent = "0%";
  elements.progressStage.textContent = "Idle";
  elements.statePill.textContent = "Waiting";
  elements.statePill.classList.remove("success");
  elements.resultActions.hidden = true;
  elements.successBanner.hidden = true;
  elements.successBanner.textContent = "Ready to send ✅";
}

function setFile(file) {
  state.file = file;
  state.filePath = file.path || null;
  elements.fileHint.textContent = file ? `${file.name} • ${bytesToSize(file.size)}` : "No file selected";
  resetProcessState();
  updatePreview();
}

function handleDrop(event) {
  event.preventDefault();
  elements.dropZone.classList.remove("drag-active");

  const dropped = event.dataTransfer?.files?.[0];
  if (!dropped) return;
  setFile(dropped);
}

function selectPlatform(platform) {
  state.selectedPlatform = platform;

  const pills = elements.platformGrid.querySelectorAll(".platform-pill");
  pills.forEach((pill) => {
    const active = pill.dataset.platform === platform;
    pill.classList.toggle("active", active);
    pill.setAttribute("aria-checked", String(active));
  });

  elements.discordTiers.classList.toggle("visible", platform === "discord");
  updatePlatformLimitLabel();
  resetProcessState();
  updatePreview();
}

function selectDiscordTier(tier) {
  state.selectedDiscordTier = tier;

  const tierPills = elements.discordTiers.querySelectorAll(".tier-pill");
  tierPills.forEach((pill) => {
    pill.classList.toggle("active", pill.dataset.tier === tier);
  });

  updatePlatformLimitLabel();
  updatePreview();
}

function startProcessingUI() {
  state.processing = true;
  elements.optimizeBtn.disabled = true;
  elements.resultActions.hidden = true;
  elements.successBanner.hidden = true;
  elements.statePill.textContent = "Processing";
  elements.statePill.classList.remove("success");

  const stages = [
    { stage: "Analyzing", pct: 18 },
    { stage: "Optimizing", pct: 53 },
    { stage: "Finalizing", pct: 82 }
  ];

  let idx = 0;
  const tick = () => {
    const step = stages[idx];
    if (!step) return;
    elements.progressStage.textContent = step.stage;
    elements.progressPct.textContent = `${step.pct}%`;
    elements.progressFill.style.width = `${step.pct}%`;
    idx += 1;
    if (idx < stages.length) {
      state.stagedProgressTimer = window.setTimeout(tick, 550);
    }
  };

  tick();
}

function finalizeProcessingUI({ optimizedSize, compressionPercent, outputPath }) {
  if (state.stagedProgressTimer) {
    window.clearTimeout(state.stagedProgressTimer);
    state.stagedProgressTimer = null;
  }

  state.processing = false;
  state.outputPath = outputPath || null;
  state.estimatedBytes = optimizedSize;

  elements.progressStage.textContent = "Done";
  elements.progressPct.textContent = "100%";
  elements.progressFill.style.width = "100%";

  elements.statePill.textContent = "Complete";
  elements.statePill.classList.add("success");
  elements.resultActions.hidden = false;
  elements.successBanner.hidden = false;
  elements.successBanner.textContent = "Ready to send ✅";
  elements.optimizeBtn.disabled = false;

  elements.outEstimated.textContent = bytesToSize(optimizedSize);
  elements.outCompression.textContent = `${compressionPercent.toFixed(1)}% smaller`;
  elements.outCompression.classList.toggle("good", compressionPercent >= 15);
  elements.afterInfo.textContent = `${bytesToSize(optimizedSize)} • Ready to send`;
}

function failProcessingUI(errorMessage) {
  if (state.stagedProgressTimer) {
    window.clearTimeout(state.stagedProgressTimer);
    state.stagedProgressTimer = null;
  }

  state.processing = false;
  elements.optimizeBtn.disabled = false;
  elements.progressStage.textContent = "Failed";
  elements.progressPct.textContent = "0%";
  elements.progressFill.style.width = "0%";
  elements.statePill.textContent = "Error";
  elements.successBanner.hidden = false;
  elements.successBanner.textContent = errorMessage;
}

async function runOptimization() {
  if (!state.file || !state.selectedPlatform || state.processing) return;
  if (!state.filePath || !window.desktopAPI?.optimizeFile) {
    failProcessingUI("Desktop file access unavailable. Please run this in Electron.");
    return;
  }

  startProcessingUI();

  const quality = Number(elements.qualitySlider.value);
  const payload = {
    filePath: state.filePath,
    fileName: state.file.name,
    targetBytes: state.targetBytes,
    quality,
    forceFit: elements.forceFit.checked,
    autoConvert: elements.autoConvert.checked,
    isImage: isImageName(state.file.name)
  };

  const result = await window.desktopAPI.optimizeFile(payload);

  if (!result?.ok) {
    const msg = result?.error || "Optimization failed.";
    failProcessingUI(msg);
    return;
  }

  finalizeProcessingUI({
    optimizedSize: result.optimizedSize,
    compressionPercent: result.compressionPercent,
    outputPath: result.outputPath
  });
}

async function triggerDownload() {
  if (!state.outputPath || !window.desktopAPI?.showItem) return;
  await window.desktopAPI.showItem(state.outputPath);
}

async function copySummary() {
  if (!state.file) return;
  const text = `${state.file.name}: ${bytesToSize(state.file.size)} -> ${bytesToSize(state.estimatedBytes)} (${elements.outCompression.textContent})`;

  try {
    await navigator.clipboard.writeText(text);
    elements.copyBtn.textContent = "Copied";
    window.setTimeout(() => {
      elements.copyBtn.textContent = "Copy to clipboard";
    }, 1200);
  } catch {
    elements.copyBtn.textContent = "Copy failed";
    window.setTimeout(() => {
      elements.copyBtn.textContent = "Copy to clipboard";
    }, 1200);
  }
}

async function openFolder() {
  if (window.desktopAPI?.openDownloads) {
    await window.desktopAPI.openDownloads();
    return;
  }
  window.alert("Downloads folder is only available in desktop mode.");
}

function initEvents() {
  elements.dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    elements.dropZone.classList.add("drag-active");
  });

  elements.dropZone.addEventListener("dragleave", () => {
    elements.dropZone.classList.remove("drag-active");
  });

  elements.dropZone.addEventListener("drop", handleDrop);

  elements.dropZone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      elements.fileInput.click();
    }
  });

  elements.fileInput.addEventListener("change", (event) => {
    const selected = event.target.files?.[0];
    if (selected) setFile(selected);
  });

  elements.platformGrid.addEventListener("click", (event) => {
    const target = event.target.closest(".platform-pill");
    if (!target) return;
    selectPlatform(target.dataset.platform);
  });

  elements.discordTiers.addEventListener("click", (event) => {
    const target = event.target.closest(".tier-pill");
    if (!target) return;
    selectDiscordTier(target.dataset.tier);
  });

  elements.qualitySlider.addEventListener("input", () => {
    elements.qualityValue.textContent = `${elements.qualitySlider.value}%`;
    updatePreview();
  });

  elements.forceFit.addEventListener("change", updatePreview);
  elements.autoConvert.addEventListener("change", updatePreview);
  elements.optimizeBtn.addEventListener("click", runOptimization);
  elements.downloadBtn.addEventListener("click", triggerDownload);
  elements.copyBtn.addEventListener("click", copySummary);
  elements.openFolderBtn.addEventListener("click", openFolder);

  elements.themeBtn.addEventListener("click", () => {
    document.body.classList.toggle("light");
  });

  elements.settingsBtn.addEventListener("click", () => {
    window.alert("Settings panel coming next: codec presets, bitrate controls, and output naming rules.");
  });
}

initEvents();
updatePlatformLimitLabel();
updatePreview();
