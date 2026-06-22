const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // メインプロセスからのファイル通知を受け取る
  onFileOpened: (callback) => ipcRenderer.on('file-opened', (event, value) => callback(value))
});

contextBridge.exposeInMainWorld('electronAPI', {
  // ウィンドウサイズ変更
  resizeWindow: (width, height) => ipcRenderer.send('resize-window', width, height),
  // ファイルが開かれた時の通知を受け取る
  onFileOpened: (callback) => ipcRenderer.on('file-opened', (event, value) => callback(value))
});