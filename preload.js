const {
	contextBridge,
	ipcRenderer
} = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
	onFileOpened: (callback) => ipcRenderer.on('file-opened', (event, data) => callback(data)),
	resizeWindow: (width, height) => ipcRenderer.send('resize-window', width, height),
	// ★追加：ダウンロード進捗を受け取る窓口
	onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (event, value) => callback(value)),
	openExternalLink: (url) => ipcRenderer.invoke('open-external', url),
	// 引数名をurlからauthResultに修正（実際のデータに合わせるため）
	onDiscordCallback: (callback) => ipcRenderer.on('discord-auth-callback', (event, authResult) => callback(authResult)),
	checkAutoLogin: () => ipcRenderer.invoke('check-auto-login'),
	// 裏側からのスプラッシュ終了の合図を受け取る窓口
	onMainWindowShown: (callback) => ipcRenderer.on('main-window-shown', () => callback()),
	readModelFile: (filePath) => ipcRenderer.invoke('read-model-file', filePath),
	// ★重複を整理：終了用と保存終了用の窓口をここにまとめました
	forceQuit: () => ipcRenderer.send('force-quit'),
	onTriggerSaveAndClose: (callback) => ipcRenderer.on('trigger-save-and-close', () => callback()),
	openProject: () => ipcRenderer.invoke('open-project'),
	saveProject: (projectData) => ipcRenderer.invoke('save-project', projectData), // ★ここを追加
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
	getFolderList: (targetPath) => ipcRenderer.invoke('get-folder-list', targetPath),
	cloneCarFolder: (sourcePath, targetPath) => ipcRenderer.invoke('clone-car-folder', sourcePath, targetPath),
	exportFilesToFolder: (baseDir, folderName, files, isOverwrite, sourcePath) => ipcRenderer.invoke('export-files-to-folder', baseDir, folderName, files, isOverwrite, sourcePath),
	checkFolderExists: (baseDir, folderName) => ipcRenderer.invoke('check-folder-exists', baseDir, folderName),
	onMenuRequestExport: (callback) => ipcRenderer.on('menu-request-export', () => callback()),
	onAppVersion: (callback) => ipcRenderer.on('send-app-version', (event, version) => callback(version)),
	setWindowTitle: (title) => ipcRenderer.invoke('set-window-title', title),
	onMenuImportFolderData: (callback) => ipcRenderer.on('menu-request-import-folder-data', (event, files) => callback(files)),
	// ★追加：マイドキュメントの view.ini とやり取りするための新しい窓口
	readViewIni: (carName) => ipcRenderer.invoke('read-view-ini', carName),
	saveViewIni: (carName, content) => ipcRenderer.invoke('save-view-ini', carName, content),
	syncBackupStart: (folderPath, files) => ipcRenderer.invoke('sync-backup-start', folderPath, files),
	syncRestoreEnd: (folderPath) => ipcRenderer.invoke('sync-restore-end', folderPath),
	setProjectLoaded: (status) => ipcRenderer.send('set-project-loaded', status),
	unpackKn5: (filePath) => ipcRenderer.invoke('unpack-kn5', filePath),
});