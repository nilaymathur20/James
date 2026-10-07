const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Get the backend URL (from env or default)
  getBackendUrl: () => ipcRenderer.invoke('get-backend-url'),

  // Open a file/folder in the OS file explorer
  openPath: (p) => ipcRenderer.invoke('open-path', p),

  // Listen for backend-ready events
  onBackendReady: (callback) => {
    ipcRenderer.on('backend-ready', (_event, data) => callback(data));
  },

  // Listen for backend status events
  onBackendStatus: (callback) => {
    ipcRenderer.on('backend-status', (_event, data) => callback(data));
  },

  // Platform info
  platform: process.platform,
  isDev: !require('electron').app.isPackaged,

  // App version
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // Quit the app
  quit: () => ipcRenderer.invoke('app-quit'),

  // Reload the window
  reload: () => ipcRenderer.reload(),
});
