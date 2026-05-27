const {
	app,
	BrowserWindow,
	Menu,
	dialog,
	shell,
	ipcMain,
	protocol
} = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

const { exec } = require('child_process');
const https = require('https');

const IS_DEV_MODE = !app.isPackaged;
if (IS_DEV_MODE) {
	try {
		require('electron-reload')(__dirname);
	} catch (e) {
		console.log('electron-reload の読み込みをスキップしました');
	}
}
// ★追加：ビルドされた完成品（本番環境）の時だけ、ログ出力を空っぽ（無効）にする
if (!IS_DEV_MODE) {
	console.log = function() {};
	console.info = function() {};
	console.warn = function() {};
	// ※ console.error は致命的なクラッシュ原因を探るために残すことが多いです
}

// ==========================================
// ★ アプリ全体の設定管理（司令塔）
// ==========================================
const SERVER_CONFIG = {
	timing: {
		//splashDuration: 13000, // スプラッシュ画面を表示する時間（ミリ秒）
		splashDuration: 1000, // スプラッシュ画面を表示する時間（ミリ秒）
	},
	flow: {
		autoSkipLogin: true,      // トークンがあれば自動ログインを試みる
		showSplashAfterLogin: true // ログイン後にスプラッシュを表示する
	},
	auth: {
		trialDays: 7,              // 毎月の試用可能日数（合計7日間）
		trialFreeDays: 3,          // 完全無料枠（Discord参加のみ）の試用日数
		guildId: '838421006011990047', // DiscordサーバーのID
		roles: {
			// 手動付与（モニター・協力者など）
			permManual: ['1497866893871026216'],
			
			// YouTubeメンバーシップ「永続アクセス権」ランク（複数指定可能）
			permYoutube: [
				'1497853055469879337', // 私を支持する者（ランクA）
				'1499372842347794578'  // 手動永続権
			],
			
			// YouTubeメンバーシップ「毎月7日間」ランク（複数指定可能）
			trialYoutube: [
				'1496677743125856328', // 支援者（心の支え）
				'1497875383658221568'  // 新しく追加したテスト用や別ランク
			]
		}
	}
};
const PATHS = {
	token: path.join(app.getPath('userData'), 'discord_auth_token.json'),
	trial: path.join(app.getPath('userData'), 'trial_db.json'),
	recent: path.join(app.getPath('userData'), 'recent_projects.json'),
	root: path.join(app.getPath('documents'), 'AC_Generator_Projects')
};

let mainWindow;
let splash;
const PROTOCOL = 'ac-file-gen';
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
	app.quit();
} else {
	app.on('second-instance', (event, commandLine) => {
		if (mainWindow) {
			if (mainWindow.isMinimized()) mainWindow.restore();
			mainWindow.focus();
		}
	});
	if (process.defaultApp) {
		if (process.argv.length >= 2) {
			app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
		}
	} else {
		app.setAsDefaultProtocolClient(PROTOCOL);
	}
}

// --- 部品A：スプラッシュ画面 ---
function createSplashWindow() {
	splash = new BrowserWindow({
		width: 700, height: 1000, transparent: true, frame: false, alwaysOnTop: true, resizable: false,
		icon: path.join(__dirname, '/image/icon.png'),
		webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, webSecurity: false }
	});
	splash.loadFile('splash.html');
}

// --- 部品B：メインエディター画面 ---
function createMainWindow() {
	// ★追加：package.json からバージョン番号を自動取得する
	const appVersion = app.getVersion();

	mainWindow = new BrowserWindow({
		width: 1340, height: 750, minWidth: 1340, minHeight: 750,
		title: `AC FILE GENERATOR v${appVersion}`, // ★追加：タイトルバーに名前とバージョンを設定
		show: false, // ★安全のために最初は隠す（Aの強み）
		autoHideMenuBar: false, backgroundColor: '#ffffff',
		icon: path.join(__dirname, '/image/icon.png'),
		webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
	});

	// ★追加：index.html の <title> タグによってタイトルが上書きされるのを防ぐ
	// mainWindow.on('page-title-updated', (e) => {
	// 	e.preventDefault();
	// });

	mainWindow.on('close', (e) => {
		e.preventDefault();
		// ★修正：ボタンの並び順とテキストを変更
		const choice = dialog.showMessageBoxSync(mainWindow, {
			type: 'question',
			buttons: ['終了', '保存して終了', 'キャンセル'],
			defaultId: 1,
			cancelId: 2,
			title: 'AC FILE GENERATOR',
			message: 'プロジェクトを保存して終了しますか？',
			detail: '保存していない変更は失われます。',
			noLink: true // ← 左のアローを消す
		});
		// 0: 終了 (保存しない)
		// 1: 保存して終了
		// 2: キャンセル
		if (choice === 0) {
			app.exit();
		} else if (choice === 1) {
			mainWindow.webContents.send('trigger-save-and-close');
		}
		// キャンセルの場合は何もしない（ウィンドウを開いたままにする）
	});

	mainWindow.webContents.on('context-menu', (event, params) => {
		const menuTemplate = [];
		if (params.editFlags.canCut) menuTemplate.push({ role: 'cut', label: '切り取り' });
		if (params.editFlags.canCopy) menuTemplate.push({ role: 'copy', label: 'コピー' });
		if (params.editFlags.canPaste) menuTemplate.push({ role: 'paste', label: '貼り付け' });
		if (IS_DEV_MODE) {
			menuTemplate.push({ type: 'separator' });
			menuTemplate.push({ label: '要素を検証', click: () => { mainWindow.webContents.inspectElement(params.x, params.y); } });
		}
		if (menuTemplate.length > 0) Menu.buildFromTemplate(menuTemplate).popup();
	});

	mainWindow.setAspectRatio(16 / 10);
	mainWindow.loadFile('index.html');
	// ★ ここを追加：画面の読み込みが完了したら、バージョン番号を送る
	mainWindow.webContents.once('did-finish-load', () => {
		mainWindow.webContents.send('send-app-version', appVersion);
	});
}

const template = [
	{
		label: 'ファイル',
		submenu: [
			{ label: '新規プロジェクトを作成', accelerator: 'CmdOrCtrl+N', click: () => { if (mainWindow) mainWindow.webContents.send('menu-request-new'); } },
			{ label: '既存のプロジェクトを開く', accelerator: 'CmdOrCtrl+O', click: () => { if (mainWindow) mainWindow.webContents.send('menu-request-open'); } },
			{ type: 'separator' },
			{ label: '保存', accelerator: 'CmdOrCtrl+S', click: () => { if (mainWindow) mainWindow.webContents.send('menu-request-save'); } },
			{ label: '別名でプロジェクトを保存', accelerator: 'CmdOrCtrl+Shift+S', click: () => { if (mainWindow) mainWindow.webContents.send('menu-request-save-as'); } },
			{ label: '復元', click: () => { if (mainWindow) mainWindow.webContents.send('menu-request-restore'); } },
			{ label: '書き出し', accelerator: 'CmdOrCtrl+E', click: () => { if (mainWindow) mainWindow.webContents.send('menu-request-export'); } },
			{ type: 'separator' },
			{ role: 'quit', label: '終了' }
		]
	},
	{ 
		label: '編集', 
		submenu: [
			{ role: 'undo', label: '元に戻す' }, 
			{ role: 'redo', label: 'やり直す' }, 
			{ type: 'separator' }, 
			{ role: 'cut', label: '切り取り' }, 
			{ role: 'copy', label: 'コピー (Ctrl+C)' }, 
			{ role: 'paste', label: '貼り付け (Ctrl+V)' }, 
			{ role: 'selectAll', label: 'すべて選択 (Ctrl+A)' }
		] 
	}
];
// ★開発モード（npm start）の時だけ「開発」メニューを配列の最後に追加する
if (IS_DEV_MODE) {
	template.push({
		label: '開発',
		submenu: [
			{ role: 'reload', label: '再読み込み (Ctrl+R)' },
			{ role: 'toggleDevTools', label: 'デバッグツール (F12)' }
		]
	});
}
// ==========================================
// ★ 起動司令塔
// ==========================================
app.whenReady().then(async () => {
	let isUpdating = false; // ★追加：アップデート中かどうかを覚える旗
	
	protocol.registerFileProtocol('local-model', (request, callback) => {
		const url = request.url.replace('local-model://', '');
		try { return callback(decodeURIComponent(url)); } catch (error) { console.error(error); }
	});

	// ★ アップデート確認（Bのマイルドな警告）
	try {
		const currentVersion = app.getVersion();
		const CHECK_URL = 'https://gist.githubusercontent.com/takashi1128f-create/934c8931f8e2a39bc12596d5fbd1b0ed/raw/update.json';
		const response = await fetch(CHECK_URL + '?' + Date.now());
		const data = await response.json();

		if (data.latestVersion !== currentVersion) {
			const result = await dialog.showMessageBox({
				type: 'info',
				title: 'アップデートのお知らせ',
				message: `新しいバージョン（${data.latestVersion}）が公開されています！`,
				detail: `現在のバージョン：${currentVersion} -> 最新：${data.latestVersion}\n\n「今すぐ更新」を押すとダウンロードを開始し、インストーラーを起動します。`,
				buttons: ['今すぐ更新', '後で'],
				defaultId: 0,
				cancelId: 1
			});

			if (result.response === 0) {
				isUpdating = true; // 旗を揚げる
				
				// ★修正：普段使っているブラウザを開いて、そこにダウンロードを任せる
				shell.openExternal(data.downloadUrl);
				
				// ★修正：ブラウザが開いたら、このアプリ自体はスパッと終了させる
				app.exit();
			}
		}
	} catch (err) { 
		console.log('アップデート確認に失敗しました（オフライン等）'); 
	}
	
	if (isUpdating) return;

	// 外部ブラウザでリンクを開く窓口（エラー回避用）
	ipcMain.handle('open-external', (event, url) => shell.openExternal(url));

	// ★修正：ダウンロードしてインストーラーを起動する専用の箱（関数）
	function startBackgroundUpdate(url) {
		const tempPath = path.join(app.getPath('temp'), 'ac-generator-setup.exe');
		const file = fs.createWriteStream(tempPath);

		https.get(url, (response) => {
			// リダイレクト（Googleドライブなど）に対応
			if (response.statusCode === 301 || response.statusCode === 302) {
				startBackgroundUpdate(response.headers.location);
				return;
			}
			response.pipe(file);
			file.on('finish', () => {
				file.close();
				// ★修正：execよりも確実な shell.openPath でインストーラーを起動させます
				shell.openPath(tempPath).then(() => {
					app.exit(); // インストーラーに任せてアプリを完全に終了
				});
			});
		}).on('error', (err) => {
			if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
		});
	}
	
	Menu.setApplicationMenu(Menu.buildFromTemplate(template));
	createMainWindow();

	// ★ 賢い分岐ルート（Aの強み）
	const hasToken = fs.existsSync(PATHS.token);
	if (hasToken && SERVER_CONFIG.flow.autoSkipLogin) {
		startSplashFlow();
	} else {
		mainWindow.once('ready-to-show', () => {
			mainWindow.show();
			mainWindow.maximize();
		});
	}

	startAuthServer();
});

// スプラッシュ表示フロー（Aの強み）
function startSplashFlow() {
	createSplashWindow();
	mainWindow.once('ready-to-show', () => {
		setTimeout(() => {
			// 1. まず、スプラッシュ画面の「裏」でメイン画面をこっそり表示して合図を送る
			if (mainWindow && !mainWindow.isDestroyed()) {
				mainWindow.show();
				mainWindow.maximize();
				mainWindow.webContents.send('main-window-shown');
			}

			// 2. ★修正：一番手前にあるスプラッシュを、いきなり壊さずに「徐々に透明」にする
			if (splash && !splash.isDestroyed()) {
				let opacity = 1.0; // 最初の濃さ（100%）
				
				// 30ミリ秒ごとに、少しずつ透明にするタイマーを発動
				const fadeInterval = setInterval(() => {
					opacity -= 0.05; // 0.05ずつ薄くする
					
					if (opacity <= 0) {
						// 完全に透明になったら、タイマーを止めて窓を完全に破壊する
						clearInterval(fadeInterval);
						if (!splash.isDestroyed()) splash.destroy();
					} else {
						// まだ透明じゃなければ、薄さを更新する
						if (!splash.isDestroyed()) splash.setOpacity(opacity);
					}
				}, 30); // 約0.6秒かけてフワッと消えます
			}
		}, SERVER_CONFIG.timing.splashDuration);
	});
}

// ==========================================
// ★ 認証システムと自動ログイン
// ==========================================
const CLIENT_ID = '1496540447684952144';
const CLIENT_SECRET = '0cuEaDUXJ-6DCT00wRkPRTFROFlX-Elm';
const REDIRECT_URI = 'http://localhost:34567/auth';

const checkUserPlan = (roles, userId, username = "不明") => {
	if (!roles || !userId) return { success: false, reason: 'no_role' };

	// 1. 永続プラン
	const isPermanent = SERVER_CONFIG.auth.roles.permManual.some(r => roles.includes(r)) || 
	                    SERVER_CONFIG.auth.roles.permYoutube.some(r => roles.includes(r));
	if (isPermanent) return { success: true, plan: 'permanent' };
	
	// 2. プラン判定
	const isTrialYoutube = SERVER_CONFIG.auth.roles.trialYoutube.some(r => roles.includes(r));
	let currentPlan = isTrialYoutube ? 'trial' : 'free';
	let maxDays = isTrialYoutube ? SERVER_CONFIG.auth.trialDays : SERVER_CONFIG.auth.trialFreeDays;

	// 3. データ読み込み
	let db = {};
	if (fs.existsSync(PATHS.trial)) {
		try { db = JSON.parse(fs.readFileSync(PATHS.trial, 'utf8')); } catch (e) { db = {}; }
	}

	const now = new Date();
	const currentMonth = `${now.getFullYear()}-${now.getMonth() + 1}`;
	const todayStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

	// 新規ユーザー判定（月の記録を作成）
	if (!db[userId]) {
		db[userId] = { month: currentMonth, usedDates: [] };
	}

	// メンバー枠(trial)だけを毎月リセットし、Free版はリセットしない
	if (currentPlan === 'trial' && db[userId].month !== currentMonth) {
		db[userId].month = currentMonth;
		db[userId].usedDates = []; 
	}

	// 今日まだ使っていなければ追加して保存
	if (!db[userId].usedDates.includes(todayStr)) {
		if (db[userId].usedDates.length < maxDays) {
			db[userId].usedDates.push(todayStr);
			fs.writeFileSync(PATHS.trial, JSON.stringify(db, null, 2), 'utf8');
		}
	}

	const usedCount = db[userId].usedDates.length;

	if (usedCount <= maxDays && db[userId].usedDates.includes(todayStr)) {
		return { 
			success: true, 
			plan: currentPlan,
			daysLeft: (maxDays - usedCount + 1)
		};
	}

	return { success: false, reason: 'trial_expired' };
};

// ★ 詳細な監視カメラ（Bの強み）
ipcMain.handle('check-auto-login', async () => {
	// 開発中だけ無条件で成功を返すように一時的に書き換え
	if (IS_DEV_MODE) {
		console.log("【開発モード】Discord認証をスキップし、永続プランとして起動します");
		return { success: true, plan: 'permanent' };
	}
	try {
		if (!fs.existsSync(PATHS.token)) return { success: false, reason: 'no_token' };
		let data = JSON.parse(fs.readFileSync(PATHS.token, 'utf8'));
		let accessToken = data.accessToken;
		let memberResponse = await fetch(`https://discord.com/api/users/@me/guilds/${SERVER_CONFIG.auth.guildId}/member`, { headers: { Authorization: `Bearer ${accessToken}` } });

		if (!memberResponse.ok) {
			const refreshResponse = await fetch('https://discord.com/api/oauth2/token', {
				method: 'POST',
				body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: 'refresh_token', refresh_token: data.refreshToken }),
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			});
			if (!refreshResponse.ok) return { success: false, reason: 'token_expired' };
			const newTokens = await refreshResponse.json();
			accessToken = newTokens.access_token;
			fs.writeFileSync(PATHS.token, JSON.stringify({ accessToken: newTokens.access_token, refreshToken: newTokens.refresh_token }), 'utf8');
			memberResponse = await fetch(`https://discord.com/api/users/@me/guilds/${SERVER_CONFIG.auth.guildId}/member`, { headers: { Authorization: `Bearer ${accessToken}` } });
		}
		const memberData = await memberResponse.json();
		
		console.log("【裏側】Discordからの役職データ:", memberData.roles);
		const result = checkUserPlan(memberData.roles, memberData.user.id);
		console.log("【裏側】判定結果:", result);
		return result;

	} catch (error) {
		console.error('Auto login check failed:', error);
		return { success: false, reason: 'error' };
	}
});

function startAuthServer() {
	const authServer = http.createServer(async (req, res) => {
		if (req.url.startsWith('/auth')) {
			const urlParams = new URL(req.url, `http://${req.headers.host}`);
			const code = urlParams.searchParams.get('code');
			if (!code) return res.end('Code not found.');

			try {
				const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
					method: 'POST',
					body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: 'authorization_code', code: code, redirect_uri: REDIRECT_URI }),
					headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				});
				const tokenData = await tokenResponse.json();
				const memberResponse = await fetch(`https://discord.com/api/users/@me/guilds/${SERVER_CONFIG.auth.guildId}/member`, { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
				const memberData = await memberResponse.json();
				const authResult = checkUserPlan(memberData.roles, memberData.user.id);

				res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
				if (authResult.success) {
					fs.writeFileSync(PATHS.token, JSON.stringify({ accessToken: tokenData.access_token, refreshToken: tokenData.refresh_token }), 'utf8');
					if (mainWindow) mainWindow.webContents.send('discord-auth-callback', authResult);
					// ★削除（コメントアウト）：手動ログイン後にスプラッシュを再起動させない
					// if (SERVER_CONFIG.flow.showSplashAfterLogin) startSplashFlow();
					res.end(`
						<div style="text-align:center; font-family:sans-serif; margin-top:50px;">
							<h1 style="color:#51cf66;">認証成功！</h1>
							<p style="font-size:18px; font-weight:bold; color:#333;">
								アプリの認証が完了しました。<br>
								このブラウザタブの「×」ボタンを押して閉じ、アプリに戻ってください。
							</p>
						</div>
					`);
				} else {
					if (fs.existsSync(PATHS.token)) fs.unlinkSync(PATHS.token);
					res.end('<h1 style="color:#ff6b6b; text-align:center; font-family:sans-serif; margin-top:50px;">認証失敗</h1>');
				}
			} catch (error) { res.end('Error occurred.'); }
		}
	});
	authServer.listen(34567);
}

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
ipcMain.on('force-quit', () => { app.exit(); });

// ==========================================
// ★ プロジェクト管理システム
// ==========================================
const PROJECTS_ROOT = path.join(app.getPath('documents'), 'AC_Generator_Projects');
if (!fs.existsSync(PROJECTS_ROOT)) fs.mkdirSync(PROJECTS_ROOT, { recursive: true });

ipcMain.handle('open-project', async () => {
	const result = await dialog.showOpenDialog(mainWindow, { title: 'プロジェクトフォルダを選択', defaultPath: PROJECTS_ROOT, properties: ['openDirectory'] });
	if (mainWindow) mainWindow.focus(); // ★追加：ダイアログが閉じたらメイン画面にピントを強制的に戻す
	if (result.canceled || result.filePaths.length === 0) return { success: false };
	try {
		const filePath = path.join(result.filePaths[0], 'project.json');
		if (!fs.existsSync(filePath)) throw new Error('指定されたフォルダに project.json が見つかりません。');
		const projectData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
		saveToRecent(projectData.projectName || "名称未設定", filePath);
		return { success: true, data: projectData, path: filePath };
	} catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('load-project-path', async (event, filePath) => {
	try {
		const projectData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
		saveToRecent(projectData.projectName || "名称未設定", filePath);
		return { success: true, data: projectData, path: filePath };
	} catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('save-project', async (event, projectData) => {
	try {
		const targetDir = path.join(PROJECTS_ROOT, projectData.projectName);
		if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
		const jsonPath = path.join(targetDir, 'project.json');
		if (fs.existsSync(jsonPath)) fs.copyFileSync(jsonPath, path.join(targetDir, 'project.json.bak'));
		fs.writeFileSync(jsonPath, JSON.stringify(projectData, null, 2), 'utf8');
		return { success: true, path: jsonPath };
	} catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('restore-project', async (event, currentJsonPath) => {
	try {
		const backupPath = path.join(path.dirname(currentJsonPath), 'project.json.bak');
		if (!fs.existsSync(backupPath)) throw new Error("バックアップが見つかりません。");
		return { success: true, data: JSON.parse(fs.readFileSync(backupPath, 'utf8')) };
	} catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('get-recent-projects', async () => {
	try {
		if (!fs.existsSync(PROJECTS_ROOT)) return [];
		let list = [];
		fs.readdirSync(PROJECTS_ROOT).forEach(folderName => {
			const targetDir = path.join(PROJECTS_ROOT, folderName);
			const jsonPath = path.join(targetDir, 'project.json');
			if (fs.statSync(targetDir).isDirectory() && fs.existsSync(jsonPath)) {
				try { list.push({ name: folderName, path: jsonPath, mtime: fs.statSync(jsonPath).mtime }); } catch (e) {}
			}
		});
		return list.sort((a, b) => b.mtime - a.mtime);
	} catch (err) { return []; }
});

ipcMain.handle('delete-project', async (event, projectPath) => {
	try {
		const projectFolder = path.dirname(projectPath);
		if (fs.existsSync(projectFolder)) fs.rmSync(projectFolder, { recursive: true, force: true });
		if (fs.existsSync(PATHS.recent)) {
			let list = JSON.parse(fs.readFileSync(PATHS.recent, 'utf8')).filter(p => p.path !== projectPath);
			fs.writeFileSync(PATHS.recent, JSON.stringify(list, null, 2));
		}
		return { success: true };
	} catch (err) { return { success: false, error: err.message }; }
});

function saveToRecent(name, filePath) {
	let list = [];
	if (fs.existsSync(PATHS.recent)) { try { list = JSON.parse(fs.readFileSync(PATHS.recent, 'utf8')); } catch (e) {} }
	list = list.filter(p => p.path !== filePath);
	list.unshift({ name, path: filePath, date: new Date().toISOString() });
	fs.writeFileSync(PATHS.recent, JSON.stringify(list.slice(0, 10), null, 2));
}

ipcMain.handle('open-directory-dialog', async () => {
	const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
	if (mainWindow) mainWindow.focus(); // ★追加：ダイアログが閉じたらピントを戻す
	return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('export-files-to-folder', async (event, baseDir, folderName, files) => {
	try {
		const targetDir = path.join(baseDir, folderName);
		if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
		for (const file of files) fs.writeFileSync(path.join(targetDir, file.name), file.content, 'utf8');
		return { success: true, path: targetDir };
	} catch (error) { return { success: false, error: error.message }; }
});
ipcMain.handle('check-folder-exists', async (event, baseDir, folderName) => fs.existsSync(path.join(baseDir, folderName)));
ipcMain.handle('set-window-title', (event, projectName) => {
	if (mainWindow) {
		// 裏側は自分のバージョンを確実に知っているので、ここで安全に合体させる
		const appVersion = app.getVersion();
		mainWindow.setTitle(`AC FILE GENERATOR v${appVersion} - ${projectName}`);
	}
});
function sendDiscordLog() {
    // Webhookなどは行わないが、呼び出されてもエラーにならないようにする
}
// 【追加】フロントエンドからの要求に応じて安全にモデルファイルを読み込む処理
ipcMain.handle('read-model-file', async (event, filePath) => {
	const fs = require('fs');
	try {
		// 指定された絶対パスからファイルをバイナリ（Buffer）としてダイレクトに読み込む
		const buffer = fs.readFileSync(filePath);
		return buffer; // レンダラープロセス側には自動的に Uint8Array として渡されます
	} catch (error) {
		console.error('【裏側】モデルファイルの読み込みに失敗しました:', error);
		throw error;
	}
});
// 【追加】dataフォルダ内の指定されたini/lutファイルを一括で読み込む処理
// 【追加】ACのdataフォルダ内から、指定された主要ファイルと、tyres.iniに書かれたLUTを自動で芋づる式に読み込む処理
ipcMain.handle('read-ac-data-folder', async (event, folderPath) => {
	const fs = require('fs');
	const path = require('path');
	const result = { success: true, files: {} };

	// ユーザー様からご指定いただいた、間違いなく読み込んで欲しい11ファイルの一覧
	const targetFiles = [
		'aero.ini',
		'cameras.ini',
		'car.ini',
		'colliders.ini',
		'drivetrain.ini',
		'engine.ini',
		'final.rto',
		'power.lut',
		'setup.ini',
		'suspensions.ini',
		'tyres.ini'
	];

	try {
		// 1. まず指定された11ファイルを順番にスキャンして読み込む
		for (const fileName of targetFiles) {
			const fullPath = path.join(folderPath, fileName);
			if (fs.existsSync(fullPath)) {
				result.files[fileName] = fs.readFileSync(fullPath, 'utf-8');
			} else {
				result.files[fileName] = null; // フォルダ内に存在しないファイルはnull
			}
		}

		// 2. ★超重要：tyres.ini が存在する場合、その中身から追加のタイヤLUTファイルを芋づる式に自動検出する
		if (result.files['tyres.ini']) {
			const tyresText = result.files['tyres.ini'];
			const lines = tyresText.split(/\r?\n/);
			
			// .lut という文字が含まれる行（PERFORMANCE_CURVE=tcurve_front.lut など）を自動サーチ
			for (const line of lines) {
				if (line.includes('.lut') && line.includes('=')) {
					const parts = line.split('=');
					let lutName = parts[1].split(';')[0].split('//')[0].trim(); // コメント等を排除してピュアなファイル名を取り出す
					
					// まだ読み込んでいない新しいタイヤLUTファイルであれば、自動で追加読み込みを行う
					if (lutName && !result.files[lutName] && lutName !== 'power.lut') {
						const lutFullPath = path.join(folderPath, lutName);
						if (fs.existsSync(lutFullPath)) {
							console.log(`【裏側】tyres.iniからタイヤ専用LUTを芋づる検出しました: ${lutName}`);
							result.files[lutName] = fs.readFileSync(lutFullPath, 'utf-8');
						}
					}
				}
			}
		}

		return result;
	} catch (error) {
		console.error('【裏側】dataフォルダの一括読み込みに失敗しました:', error);
		return { success: false, error: error.message };
	}
});

// 【追加】元データを「backup_data」フォルダに1世代だけ安全に退避させてから、新しいデータを上書き保存する処理
ipcMain.handle('save-ac-data-folder', async (event, folderPath, fileDataMap) => {
	const fs = require('fs');
	const path = require('path');
	
	try {
		// 1. dataフォルダの中に「backup_data」フォルダがあるか確認し、無ければ自動で作る
		const backupFolderPath = path.join(folderPath, 'backup_data');
		if (!fs.existsSync(backupFolderPath)) {
			fs.mkdirSync(backupFolderPath, { recursive: true });
		}

		// 2. 画面側から送られてきた各ファイルを書き出す前に、元のファイルを1世代だけコピー（退避）する
		for (const fileName in fileDataMap) {
			const targetFilePath = path.join(folderPath, fileName);
			const backupFilePath = path.join(backupFolderPath, fileName);

			// 元のファイルがすでに存在する場合のみバックアップ領域へ退避
			if (fs.existsSync(targetFilePath)) {
				fs.copyFileSync(targetFilePath, backupFilePath);
			}

			// 3. 安全装置が働いたのを確認して、新しいデータを元の場所に上書き保存する
			fs.writeFileSync(targetFilePath, fileDataMap[fileName], 'utf-8');
		}

		return { success: true };
	} catch (error) {
		console.error('【裏側】バックアップ作成または上書き保存に失敗しました:', error);
		return { success: false, error: error.message };
	}
});