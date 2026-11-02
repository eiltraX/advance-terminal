const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('advanceTerminal', {
  getAppInfo: () => ipcRenderer.invoke('app:getInfo'),
  getRuntimeStats: () => ipcRenderer.invoke('app:getRuntimeStats'),
  windowAction: (action) => ipcRenderer.invoke('window:action', action),
  getWindowState: () => ipcRenderer.invoke('window:getState'),
  onWindowStateChanged: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('window:state-changed', listener);
    return () => ipcRenderer.removeListener('window:state-changed', listener);
  },

  getUpdateStatus: () => ipcRenderer.invoke('updates:getStatus'),
  checkForUpdates: (payload = {}) => ipcRenderer.invoke('updates:check', payload),
  installUpdateAndRestart: () => ipcRenderer.invoke('updates:install'),

  getSettings: () => ipcRenderer.invoke('settings:read'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  exportSettings: (settings) => ipcRenderer.invoke('settings:export', settings),
  importSettingsPreview: () => ipcRenderer.invoke('settings:importPreview'),
  importSettingsApply: () => ipcRenderer.invoke('settings:importApply'),
  cancelSettingsImport: () => ipcRenderer.invoke('settings:importCancel'),
  repairSettingsPreview: () => ipcRenderer.invoke('settings:repairPreview'),
  repairSettingsApply: () => ipcRenderer.invoke('settings:repairApply'),
  listSettingsRestorePoints: () => ipcRenderer.invoke('settings:restorePoints'),
  restoreSettingsPoint: (payload) => ipcRenderer.invoke('settings:restoreApply', payload),
  saveReportUsage: (reportUsage) => ipcRenderer.invoke('usage:save', reportUsage),
  getAiStatus: () => ipcRenderer.invoke('ai:getStatus'),
  saveAiApiKey: (payload) => ipcRenderer.invoke('ai:saveApiKey', payload),
  clearAiApiKey: () => ipcRenderer.invoke('ai:clearApiKey'),
  generateAiProjectReport: (payload) => ipcRenderer.invoke('report:generateAiProject', payload),

  selectPrivateKey: () => ipcRenderer.invoke('dialog:selectPrivateKey'),
  generateSshKey: (payload) => ipcRenderer.invoke('key:generate', payload),
  listSshKeys: () => ipcRenderer.invoke('key:list'),
  readPublicKey: (privateKeyPath) => ipcRenderer.invoke('key:readPublicKey', privateKeyPath),
  openSshKeyFolder: (payload) => ipcRenderer.invoke('key:openFolder', payload),
  archiveSshKey: (privateKeyPath) => ipcRenderer.invoke('key:archive', privateKeyPath),
  archiveAllSshKeys: () => ipcRenderer.invoke('key:archiveAll'),
  testConnectionHealth: (payload) => ipcRenderer.invoke('connection:testHealth', payload),

  createTerminal: (payload) => ipcRenderer.invoke('terminal:create', payload),
  writeTerminal: (payload) => ipcRenderer.invoke('terminal:write', payload),
  resizeTerminal: (payload) => ipcRenderer.invoke('terminal:resize', payload),
  closeTerminal: (payload) => ipcRenderer.invoke('terminal:close', payload),
  notifyTerminalActivityComplete: (payload) => ipcRenderer.send('terminal:activity-complete', payload),
  onTerminalNotificationOpen: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('terminal:notification-open', listener);
    return () => ipcRenderer.removeListener('terminal:notification-open', listener);
  },

  onTerminalData: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('terminal:data', listener);
    return () => ipcRenderer.removeListener('terminal:data', listener);
  },

  onTerminalExit: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('terminal:exit', listener);
    return () => ipcRenderer.removeListener('terminal:exit', listener);
  },

  onTerminalPasswordRequired: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('terminal:password-required', listener);
    return () => ipcRenderer.removeListener('terminal:password-required', listener);
  },

  onUpdateStatus: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('updates:status', listener);
    return () => ipcRenderer.removeListener('updates:status', listener);
  }
});
