const { app, BrowserWindow, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let splash;

function createWindow() {
  splash = new BrowserWindow({
    width: 500, height: 300, transparent: true, frame: false, alwaysOnTop: true, resizable: false
  });
  splash.loadFile('splash.html');

  mainWindow = new BrowserWindow({
    width: 1280, height: 720,
    minWidth: 1280, minHeight: 720,
    maxWidth: 1920, maxHeight: 1080,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#1a1a1a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.setAspectRatio(16 / 9);
  mainWindow.loadFile('ini-lut-test.html');

  mainWindow.once('ready-to-show', () => {
    setTimeout(() => {
      if (splash) splash.destroy();
      mainWindow.show();
    }, 2500); 
  });

  mainWindow.on('resize', () => {
    const [width] = mainWindow.getSize();
    if (width > 1600) {
      mainWindow.setMenuBarVisibility(true);
      mainWindow.setAutoHideMenuBar(false);
    } else {
      mainWindow.setMenuBarVisibility(false);
      mainWindow.setAutoHideMenuBar(true);
    }
  });
}

// ショートカット(Ctrl+O)の設定
const template = [
  {
    label: 'ファイル',
    submenu: [
      {
        label: 'ファイルを開く...',
        accelerator: 'CmdOrCtrl+O',
        click: () => {
          dialog.showOpenDialog(mainWindow, {
            properties: ['openFile'],
            filters: [{ name: 'AC Files', extensions: ['ini', 'lut'] }]
          }).then(result => {
            if (!result.canceled && result.filePaths.length > 0) {
              const content = fs.readFileSync(result.filePaths[0], 'utf-8');
              const type = result.filePaths[0].toLowerCase().endsWith('.lut') ? 'lut' : 'ini';
              
              // 画面側（Renderer）にデータを送信
              if (mainWindow) {
                mainWindow.webContents.send('file-opened', { content, type });
              }
            }
          });
        }
      },
      { type: 'separator' },
      { label: '終了', role: 'quit' }
    ]
  },
  { label: '編集', role: 'editMenu' }
];

app.whenReady().then(() => {
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});