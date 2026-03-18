const elements = {
  dropZone: document.getElementById("dropZone"),
  fileInput: document.getElementById("fileInput"),
  fileHint: document.getElementById("fileHint"),
  platformRadios: document.querySelectorAll('input[name="platform"]'),
  platformLimit: document.getElementById("platformLimit"),
  discordTiersWrap: document.getElementById("discordTiers"),
  discordTierRadios: document.querySelectorAll('input[name="discordTier"]'),
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
  settingsBtn: document.getElementById("settingsBtn"),
  srStatus: document.getElementById("srStatus"),
  srAlert: document.getElementById("srAlert")
};

const platformLimitsMB = {
  discord: { free: 10, nitroBasic: 50, nitro: 500 },
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

function announceStatus(message) {
  elements.srStatus.textContent = "";
  window.setTimeout(() => {
    elements.srStatus.textContent = message;
  }, 10);
}

function announceAlert(message) {
  elements.srAlert.textContent = "";
  window.setTimeout(() => {
    elements.srAlert.textContent = message;
  }, 10);
}

function bytesToSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(value >= 100 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function getPlatformLabel(platform) {
  return platform.charAt(0).toUpperCase() + platform.slice(1);
}

function getSelectedRadioValue(radios) {
  const checked = [...radios].find((radio) => radio.checked);
  return checked ? checked.value : null;
}

function resolveTargetLimitBytes() {
  if (!state.selectedPlatform) return 0;
  if (state.selectedPlatform === "discord") {
    return platformLimitsMB.discord[state.selectedDiscordTier] * 1024 * 1024;
  }
  return platformLimitsMB[state.selectedPlatform] * 1024 * 1024;
}

function updatePlatformLimitLabel() {
  if (!state.selectedPlatform) {
    elements.platformLimit.textContent = "Select a platform to see upload limit";
    return;
  }

  const target = resolveTargetLimitBytes();
  const platformName = getPlatformLabel(state.selectedPlatform);
  const tierLabel =
    state.selectedPlatform === "discord"
      ? ` ${state.selectedDiscordTier === "nitroBasic" ? "Nitro Basic" : state.selectedDiscordTier.charAt(0).toUpperCase() + state.selectedDiscordTier.slice(1)}`
      : "";

  elements.platformLimit.textContent = `${platformName}${tierLabel} limit: ${bytesToSize(target)}`;
}

function estimateOutputBytes() {
  if (!state.file || !state.selectedPlatform) return 0;

  const quality = Number(elements.qualitySlider.value);
  const qualityFactor = 0.25 + (quality / 100) * 0.75;
  const convertBoost = elements.autoConvert.checked ? 0.88 : 1;
  const rawEstimate = state.file.size * qualityFactor * convertBoost;
  const target = resolveTargetLimitBytes();

  if (elements.forceFit.checked) return Math.min(rawEstimate, target * 0.98);
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

  if (!hasData) {
    elements.outCompression.textContent = "-";
    elements.outCompression.classList.remove("good");
    elements.beforeInfo.textContent = "Drop a file to preview details";
    elements.afterInfo.textContent = "Optimized output estimate appears here";
  } else {
    const compression = Math.max(0, 100 - (estimate / state.file.size) * 100);
    elements.outCompression.textContent = `${compression.toFixed(1)}% smaller`;
    elements.outCompression.classList.toggle("good", compression >= 15);
    elements.beforeInfo.textContent = `${bytesToSize(state.file.size)} • ${state.file.type || "Unknown format"}`;
    elements.afterInfo.textContent = `${bytesToSize(estimate)} • Fits ${bytesToSize(target)} limit`;
  }

  elements.optimizeBtn.disabled = !(state.file && state.selectedPlatform) || state.processing;
}

function setProgressPercent(percent) {
  const clamped = Math.max(0, Math.min(100, percent));
  elements.progressFill.style.transform = `scaleX(${clamped / 100})`;
  elements.progressPct.textContent = `${clamped}%`;
}

function resetProcessState() {
  if (state.stagedProgressTimer) {
    window.clearTimeout(state.stagedProgressTimer);
    state.stagedProgressTimer = null;
  }

  state.outputPath = null;
  elements.statePill.textContent = "Waiting";
  elements.statePill.classList.remove("success");
  elements.progressStage.textContent = "Idle";
  setProgressPercent(0);

  elements.resultActions.hidden = true;
  elements.successBanner.hidden = true;
  elements.successBanner.textContent = "Ready to send";
  elements.successBanner.classList.remove("error");
}

function setFile(file) {
  state.file = file;
  state.filePath = file.path || null;
  elements.fileHint.textContent = `${file.name} • ${bytesToSize(file.size)}`;
  resetProcessState();
  updatePreview();
  announceStatus(`Loaded ${file.name}`);
}

function handleDrop(event) {
  event.preventDefault();
  elements.dropZone.classList.remove("drag-active");
  const dropped = event.dataTransfer?.files?.[0];
  if (dropped) setFile(dropped);
}

function syncSelectedPlatform() {
  state.selectedPlatform = getSelectedRadioValue(elements.platformRadios);
  elements.discordTiersWrap.hidden = state.selectedPlatform !== "discord";

  updatePlatformLimitLabel();
  resetProcessState();
  updatePreview();

  if (state.selectedPlatform) {
    announceStatus(`${getPlatformLabel(state.selectedPlatform)} selected`);
  }
}

function syncDiscordTier() {
  state.selectedDiscordTier = getSelectedRadioValue(elements.discordTierRadios) || "free";
  updatePlatformLimitLabel();
  updatePreview();
  announceStatus(`Discord ${state.selectedDiscordTier} selected`);
}

function startProcessingUI() {
  state.processing = true;
  elements.optimizeBtn.disabled = true;
  elements.resultActions.hidden = true;
  elements.successBanner.hidden = true;
  elements.successBanner.classList.remove("error");

  elements.statePill.textContent = "Processing";
  elements.statePill.classList.remove("success");

  const stages = [
    { stage: "Analyzing", pct: 20 },
    { stage: "Compressing", pct: 55 },
    { stage: "Finalizing", pct: 82 }
  ];

  let index = 0;
  const tick = () => {
    const step = stages[index];
    if (!step) return;
    elements.progressStage.textContent = step.stage;
    setProgressPercent(step.pct);
    index += 1;
    if (index < stages.length) {
      state.stagedProgressTimer = window.setTimeout(tick, 520);
    }
  };

  tick();
  announceStatus("Optimization started");
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
  setProgressPercent(100);

  elements.statePill.textContent = "Complete";
  elements.statePill.classList.add("success");

  elements.resultActions.hidden = false;
  elements.successBanner.hidden = false;
  elements.successBanner.classList.remove("error");
  elements.successBanner.textContent = "Ready to send";

  elements.optimizeBtn.disabled = false;
  elements.outEstimated.textContent = bytesToSize(optimizedSize);
  elements.outCompression.textContent = `${compressionPercent.toFixed(1)}% smaller`;
  elements.outCompression.classList.toggle("good", compressionPercent >= 15);
  elements.afterInfo.textContent = `${bytesToSize(optimizedSize)} • Ready to send`;

  announceStatus("Optimization complete. File is ready.");
}

function failProcessingUI(errorMessage) {
  if (state.stagedProgressTimer) {
    window.clearTimeout(state.stagedProgressTimer);
    state.stagedProgressTimer = null;
  }

  state.processing = false;
  elements.optimizeBtn.disabled = false;
  elements.statePill.textContent = "Error";
  elements.statePill.classList.remove("success");
  elements.progressStage.textContent = "Failed";
  setProgressPercent(0);

  elements.successBanner.hidden = false;
  elements.successBanner.classList.add("error");
  elements.successBanner.textContent = errorMessage;

  announceAlert(errorMessage);
}

async function runOptimization() {
  if (!state.file || !state.selectedPlatform || state.processing) return;

  if (!state.filePath || !window.desktopAPI?.optimizeFile) {
    failProcessingUI("Desktop file access unavailable. Please run this app in Electron.");
    return;
  }

  startProcessingUI();

  const payload = {
    filePath: state.filePath,
    fileName: state.file.name,
    targetBytes: state.targetBytes,
    quality: Number(elements.qualitySlider.value),
    forceFit: elements.forceFit.checked,
    autoConvert: elements.autoConvert.checked
  };

  const result = await window.desktopAPI.optimizeFile(payload);

  if (!result?.ok) {
    failProcessingUI(result?.error || "Optimization failed.");
    return;
  }

  finalizeProcessingUI({
    optimizedSize: result.optimizedSize,
    compressionPercent: result.compressionPercent,
    outputPath: result.outputPath
  });
}

async function showOutputFile() {
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
      elements.copyBtn.textContent = "Copy summary";
    }, 1000);
    announceStatus("Summary copied to clipboard");
  } catch {
    failProcessingUI("Could not copy summary to clipboard.");
  }
}

async function openFolder() {
  if (!window.desktopAPI?.openDownloads) return;
  await window.desktopAPI.openDownloads();
}

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.body.classList.toggle("dark", isDark);
  elements.themeBtn.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
}

function toggleTheme() {
  const next = document.body.classList.contains("dark") ? "light" : "dark";
  localStorage.setItem("optimocord-theme", next);
  applyTheme(next);
}

function initTheme() {
  const saved = localStorage.getItem("optimocord-theme");
  applyTheme(saved === "dark" ? "dark" : "light");
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

  elements.fileInput.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) setFile(file);
  });

  elements.platformRadios.forEach((radio) => {
    radio.addEventListener("change", syncSelectedPlatform);
  });

  elements.discordTierRadios.forEach((radio) => {
    radio.addEventListener("change", syncDiscordTier);
  });

  elements.forceFit.addEventListener("change", updatePreview);
  elements.autoConvert.addEventListener("change", updatePreview);

  elements.qualitySlider.addEventListener("input", () => {
    elements.qualityValue.textContent = `${elements.qualitySlider.value}%`;
    updatePreview();
  });

  elements.optimizeBtn.addEventListener("click", runOptimization);
  elements.downloadBtn.addEventListener("click", showOutputFile);
  elements.copyBtn.addEventListener("click", copySummary);
  elements.openFolderBtn.addEventListener("click", openFolder);
  elements.themeBtn.addEventListener("click", toggleTheme);

  elements.settingsBtn.addEventListener("click", () => {
    announceStatus("Settings panel is not built yet.");
  });
}

initTheme();
initEvents();
updatePlatformLimitLabel();
updatePreview();
