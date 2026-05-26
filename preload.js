const {
  contextBridge,
  ipcRenderer
} = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onFileOpened: (callback) => ipcRenderer.on('file-opened', (event, data) => callback(data)),
  resizeWindow: (width, height) => ipcRenderer.send('resize-window', width, height),
  openExternalLink: (url) => ipcRenderer.invoke('open-external', url),
  // 引数名をurlからauthResultに修正（実際のデータに合わせるため）
  onDiscordCallback: (callback) => ipcRenderer.on('discord-auth-callback', (event, authResult) => callback(authResult)),
  checkAutoLogin: () => ipcRenderer.invoke('check-auto-login'),
  // 裏側からのスプラッシュ終了の合図を受け取る窓口
  onMainWindowShown: (callback) => ipcRenderer.on('main-window-shown', () => callback()),
  saveProject: (payload) => ipcRenderer.invoke('save-project', payload),
  
  // ★重複を整理：終了用と保存終了用の窓口をここにまとめました
  forceQuit: () => ipcRenderer.send('force-quit'),
  onTriggerSaveAndClose: (callback) => ipcRenderer.on('trigger-save-and-close', () => callback()),

  openProject: () => ipcRenderer.invoke('open-project'),
  getRecentProjects: () => ipcRenderer.invoke('get-recent-projects'),
  loadProjectPath: (path) => ipcRenderer.invoke('load-project-path', path),
  deleteProject: (path) => ipcRenderer.invoke('delete-project', path),
  loadProjectByPath: (path) => ipcRenderer.invoke('load-project-path', path),
  restoreProject: (path) => ipcRenderer.invoke('restore-project', path),
  onMenuSave: (callback) => ipcRenderer.on('menu-request-save', callback),
  onMenuSaveAs: (callback) => ipcRenderer.on('menu-request-save-as', callback),
  onMenuRestore: (callback) => ipcRenderer.on('menu-request-restore', callback),
  onMenuNew: (callback) => ipcRenderer.on('menu-request-new', callback),
  onMenuOpen: (callback) => ipcRenderer.on('menu-request-open', callback),
  openDirectoryDialog: () => ipcRenderer.invoke('open-directory-dialog'),
  exportFilesToFolder: (baseDir, folderName, files) => ipcRenderer.invoke('export-files-to-folder', baseDir, folderName, files),
  checkFolderExists: (baseDir, folderName) => ipcRenderer.invoke('check-folder-exists', baseDir, folderName),
  onMenuRequestExport: (callback) => ipcRenderer.on('menu-request-export', () => callback()),
  onAppVersion: (callback) => ipcRenderer.on('send-app-version', (event, version) => callback(version)),
  setWindowTitle: (title) => ipcRenderer.invoke('set-window-title', title)
});