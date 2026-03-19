const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopAPI", {
  openDownloads: () => ipcRenderer.invoke("open-downloads"),
  showItem: (filePath) => ipcRenderer.invoke("show-item", filePath),
  optimizeFile: (payload) => ipcRenderer.invoke("optimize-file", payload),
  checkBinaries: () => ipcRenderer.invoke("check-binaries")
});
