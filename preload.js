// Preload: expose a tiny, whitelisted API to the setup page.
// contextIsolation stays on; the page can only call these three functions.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dshAPI', {
  saveApiKey: (key) => ipcRenderer.invoke('save-api-key', key),
  getSetupStatus: () => ipcRenderer.invoke('get-setup-status'),
  restart: () => ipcRenderer.invoke('restart-app'),
});
