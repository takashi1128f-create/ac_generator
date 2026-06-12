const { app, BrowserWindow, Menu, dialog, shell, ipcMain, protocol } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const http = require('http');
const {
	exec
} = require('child_process');
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
		autoSkipLogin: true, // トークンがあれば自動ログインを試みる
		showSplashAfterLogin: true // ログイン後にスプラッシュを表示する
	},
	auth: {
		trialDays: 7, // 毎月の試用可能日数（合計7日間）
		trialFreeDays: 3, // 完全無料枠（Discord参加のみ）の試用日数
		guildId: '838421006011990047', // DiscordサーバーのID
		roles: {
			// 手動付与（モニター・協力者など）
			permManual: ['1497866893871026216'],
			// YouTubeメンバーシップ「永続アクセス権」ランク（複数指定可能）
			permYoutube: ['1497853055469879337', // 私を支持する者（ランクA）
				'1499372842347794578' // 手動永続権
			],
			// YouTubeメンバーシップ「毎月7日間」ランク（複数指定可能）
			trialYoutube: ['1496677743125856328', // 支援者（心の支え）
				'1497875383658221568' // 新しく追加したテスト用や別ランク
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
		width: 700,
		height: 1000,
		transparent: true,
		frame: false,
		alwaysOnTop: true,
		resizable: false,
		icon: path.join(__dirname, '/image/icon.png'),
		webPreferences: {
			preload: path.join(__dirname, 'preload.js'),
			contextIsolation: true,
			webSecurity: false
		}
	});
	splash.loadFile('splash.html');
}
// --- 部品B：メインエディター画面 ---
function createMainWindow() {
	// ★追加：package.json からバージョン番号を自動取得する
	const appVersion = app.getVersion();
	mainWindow = new BrowserWindow({
		width: 1340,
		height: 750,
		minWidth: 1340,
		minHeight: 750,
		title: `AC FILE GENERATOR v${appVersion}`, // ★追加：タイトルバーに名前とバージョンを設定
		show: false, // ★安全のために最初は隠す（Aの強み）
		autoHideMenuBar: false,
		backgroundColor: '#ffffff',
		icon: path.join(__dirname, '/image/icon.png'),
		webPreferences: {
			preload: path.join(__dirname, 'preload.js'),
			contextIsolation: true
		}
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
		// ★「終了（保存しない）」なら、連動中であれば【復元】してから終了する
		if (activeSyncFolderPath) {
			cleanupSyncBackup(activeSyncFolderPath, true);
		}
		app.exit();
	} else if (choice === 1) {
		// 「保存して終了」の場合はプロジェクト保存後に force-quit が来るので、そちらで処理します
		mainWindow.webContents.send('trigger-save-and-close');
	}
		// キャンセルの場合は何もしない（ウィンドウを開いたままにする）
	});
	mainWindow.webContents.on('context-menu', (event, params) => {
		const menuTemplate = [];
		if (params.editFlags.canCut) menuTemplate.push({
			role: 'cut',
			label: '切り取り'
		});
		if (params.editFlags.canCopy) menuTemplate.push({
			role: 'copy',
			label: 'コピー'
		});
		if (params.editFlags.canPaste) menuTemplate.push({
			role: 'paste',
			label: '貼り付け'
		});
		if (IS_DEV_MODE) {
			menuTemplate.push({
				type: 'separator'
			});
			menuTemplate.push({
				label: '要素を検証',
				click: () => {
					mainWindow.webContents.inspectElement(params.x, params.y);
				}
			});
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
const template = [{
	label: 'ファイル',
	submenu: [{
		label: '新規プロジェクトを作成',
		accelerator: 'CmdOrCtrl+N',
		click: () => {
			if (mainWindow) mainWindow.webContents.send('menu-request-new');
		}
	}, {
		label: '既存のプロジェクトを開く',
		accelerator: 'CmdOrCtrl+O',
		click: () => {
			if (mainWindow) mainWindow.webContents.send('menu-request-open');
		}
	}, {
		type: 'separator'
	}, {
		label: 'dataフォルダを一括読込',
		click: async () => {
			if (!mainWindow) return;
			const result = await dialog.showOpenDialog(mainWindow, {
				properties: ['openDirectory'],
				title: 'dataフォルダを選択してください'
			});
			if (result.canceled || result.filePaths.length === 0) return;
			const folderPath = result.filePaths[0];
			const ALLOWED_FILES = ['aero.ini', 'cameras.ini', 'car.ini', 'colliders.ini', 'drivetrain.ini', 'engine.ini', 'final.rto', 'power.lut', 'setup.ini', 'suspensions.ini', 'tyres.ini'];
			const filesToSend = [];
			try {
				const files = fs.readdirSync(folderPath);
				for (const file of files) {
					const lowerFile = file.toLowerCase();
					// ① 通常の設定ファイル（テキスト）の場合
					if (ALLOWED_FILES.includes(lowerFile)) {
						const fullPath = path.join(folderPath, file);
						if (fs.statSync(fullPath).isFile()) {
							const content = fs.readFileSync(fullPath, 'utf8');
							filesToSend.push({
								name: file,
								content: content,
								path: fullPath
							});
						}
					} else if (lowerFile.endsWith('.glb') || lowerFile.endsWith('.fbx')) {
						const fullPath = path.join(folderPath, file);
						if (fs.statSync(fullPath).isFile()) {
							filesToSend.push({
								name: file,
								path: fullPath,
								isModel: true
							});
						}
					}
				}
				mainWindow.webContents.send('menu-request-import-folder-data', filesToSend);
			} catch (err) {
				console.error("裏側でのフォルダ一括読込に失敗しました:", err);
			}
		}
	}, {
		type: 'separator'
	}, {
		label: '保存',
		accelerator: 'CmdOrCtrl+S',
		click: () => {
			if (mainWindow) mainWindow.webContents.send('menu-request-save');
		}
	}, {
		label: '別名でプロジェクトを保存',
		accelerator: 'CmdOrCtrl+Shift+S',
		click: () => {
			if (mainWindow) mainWindow.webContents.send('menu-request-save-as');
		}
	}, {
		label: '復元',
		click: () => {
			if (mainWindow) mainWindow.webContents.send('menu-request-restore');
		}
	}, {
		label: '書き出し',
		accelerator: 'CmdOrCtrl+E',
		click: () => {
			if (mainWindow) mainWindow.webContents.send('menu-request-export');
		}
	}, {
		type: 'separator'
	}, {
		role: 'quit',
		label: '終了'
	}]
}, {
	label: '編集',
	submenu: [{
		role: 'undo',
		label: '元に戻す'
	}, {
		role: 'redo',
		label: 'やり直す'
	}, {
		type: 'separator'
	}, {
		role: 'cut',
		label: '切り取り'
	}, {
		role: 'copy',
		label: 'コピー (Ctrl+C)'
	}, {
		role: 'paste',
		label: '貼り付け (Ctrl+V)'
	}, {
		role: 'selectAll',
		label: 'すべて選択 (Ctrl+A)'
	},
]
}];
// ★開発モード（npm start）の時だけ「開発」メニューを配列の最後に追加する
if (IS_DEV_MODE) {
	template.push({
		label: '開発',
		submenu: [{
			role: 'reload',
			label: '再読み込み (Ctrl+R)'
		}, {
			role: 'toggleDevTools',
			label: 'デバッグツール (F12)'
		}]
	});
}
// ==========================================
// ★ 起動司令塔
// ==========================================
app.whenReady().then(async () => {
	protocol.registerFileProtocol('local-model', (request, callback) => {
		const url = request.url.replace('local-model://', '');
		try {
			return callback(decodeURIComponent(url));
		} catch (error) {
			console.error(error);
		}
	});

	// ★ ルートB：自動アップデート機能（electron-updater）
	// アップデートが見つかった時の動作
	autoUpdater.on('update-available', (info) => {
		dialog.showMessageBox({
			type: 'info',
			title: 'アップデートのお知らせ',
			message: `新しいバージョン（${info.version}）が見つかりました。\nバックグラウンドでダウンロードを開始します。`,
			noLink: true,
			buttons: ['OK'],
			defaultId: 0,
			cancelId: 0
		});
		autoUpdater.downloadUpdate();
	});
	// アップロードされた進捗をメインプロセスで受け取り、フロントエンドへ転送する
	autoUpdater.on('download-progress', (progressObj) => {
		// mainWindowが存在し、読み込み済みであることを確認
		if (mainWindow && !mainWindow.isDestroyed()) {
			// 進捗率（percent）をフロントエンドへ送信
			mainWindow.webContents.send('download-progress', Math.round(progressObj.percent));
		} else {
			console.log('進捗イベント: mainWindowがまだ準備されていません');
		}
	});

	// ダウンロードが完了した時の動作
	autoUpdater.on('update-downloaded', () => {
		const result = dialog.showMessageBoxSync({
			type: 'info',
			title: 'ダウンロード完了',
			message: '最新バージョンのダウンロードが完了しました。\n今すぐ再起動してインストールしますか？',
			buttons: ['今すぐ再起動', '後で']
		});
		if (result === 0) {
			autoUpdater.quitAndInstall(); // 勝手に再起動してインストールします
		}
	});

	// エラー発生時（開発用ログ出力）
	autoUpdater.on('error', (err) => {
		console.log('アップデート確認エラー:\n' + err);
	});

	// アプリ起動時にアップデートを確認（開発モード時はスキップされます）
	// if (!IS_DEV_MODE) {
	// 	autoUpdater.checkForUpdates();
	// }

	// 修正後（強制実行）
	autoUpdater.checkForUpdates();

	// 外部ブラウザでリンクを開く窓口（エラー回避用）
	ipcMain.handle('open-external', (event, url) => shell.openExternal(url));

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
	if (!roles || !userId) return {
		success: false,
		reason: 'no_role'
	};
	// 1. 永続プラン
	const isPermanent = SERVER_CONFIG.auth.roles.permManual.some(r => roles.includes(r)) || SERVER_CONFIG.auth.roles.permYoutube.some(r => roles.includes(r));
	if (isPermanent) return {
		success: true,
		plan: 'permanent'
	};
	// 2. プラン判定
	const isTrialYoutube = SERVER_CONFIG.auth.roles.trialYoutube.some(r => roles.includes(r));
	let currentPlan = isTrialYoutube ? 'trial' : 'free';
	let maxDays = isTrialYoutube ? SERVER_CONFIG.auth.trialDays : SERVER_CONFIG.auth.trialFreeDays;
	// 3. データ読み込み
	let db = {};
	if (fs.existsSync(PATHS.trial)) {
		try {
			db = JSON.parse(fs.readFileSync(PATHS.trial, 'utf8'));
		} catch (e) {
			db = {};
		}
	}
	const now = new Date();
	const currentMonth = `${now.getFullYear()}-${now.getMonth() + 1}`;
	const todayStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
	// 新規ユーザー判定（月の記録を作成）
	if (!db[userId]) {
		db[userId] = {
			month: currentMonth,
			usedDates: []
		};
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
	return {
		success: false,
		reason: 'trial_expired'
	};
};
// ★ 詳細な監視カメラ（Bの強み）
ipcMain.handle('check-auto-login', async () => {
	// 開発中だけ無条件で成功を返すように一時的に書き換え
	if (IS_DEV_MODE) {
		console.log("【開発モード】Discord認証をスキップし、永続プランとして起動します");
		return {
			success: true,
			plan: 'permanent'
		};
	}
	try {
		if (!fs.existsSync(PATHS.token)) return {
			success: false,
			reason: 'no_token'
		};
		let data = JSON.parse(fs.readFileSync(PATHS.token, 'utf8'));
		let accessToken = data.accessToken;
		let memberResponse = await fetch(`https://discord.com/api/users/@me/guilds/${SERVER_CONFIG.auth.guildId}/member`, {
			headers: {
				Authorization: `Bearer ${accessToken}`
			}
		});
		if (!memberResponse.ok) {
			const refreshResponse = await fetch('https://discord.com/api/oauth2/token', {
				method: 'POST',
				body: new URLSearchParams({
					client_id: CLIENT_ID,
					client_secret: CLIENT_SECRET,
					grant_type: 'refresh_token',
					refresh_token: data.refreshToken
				}),
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded'
				},
			});
			if (!refreshResponse.ok) return {
				success: false,
				reason: 'token_expired'
			};
			const newTokens = await refreshResponse.json();
			accessToken = newTokens.access_token;
			fs.writeFileSync(PATHS.token, JSON.stringify({
				accessToken: newTokens.access_token,
				refreshToken: newTokens.refresh_token
			}), 'utf8');
			memberResponse = await fetch(`https://discord.com/api/users/@me/guilds/${SERVER_CONFIG.auth.guildId}/member`, {
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});
		}
		const memberData = await memberResponse.json();
		console.log("【裏側】Discordからの役職データ:", memberData.roles);
		const result = checkUserPlan(memberData.roles, memberData.user.id);
		console.log("【裏側】判定結果:", result);
		return result;
	} catch (error) {
		console.error('Auto login check failed:', error);
		return {
			success: false,
			reason: 'error'
		};
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
					body: new URLSearchParams({
						client_id: CLIENT_ID,
						client_secret: CLIENT_SECRET,
						grant_type: 'authorization_code',
						code: code,
						redirect_uri: REDIRECT_URI
					}),
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded'
					},
				});
				const tokenData = await tokenResponse.json();
				const memberResponse = await fetch(`https://discord.com/api/users/@me/guilds/${SERVER_CONFIG.auth.guildId}/member`, {
					headers: {
						Authorization: `Bearer ${tokenData.access_token}`
					}
				});
				const memberData = await memberResponse.json();
				const authResult = checkUserPlan(memberData.roles, memberData.user.id);
				res.writeHead(200, {
					'Content-Type': 'text/html; charset=utf-8'
				});
				if (authResult.success) {
					fs.writeFileSync(PATHS.token, JSON.stringify({
						accessToken: tokenData.access_token,
						refreshToken: tokenData.refresh_token
					}), 'utf8');
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
			} catch (error) {
				res.end('Error occurred.');
			}
		}
	});
	authServer.listen(34567);
}
app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') app.quit();
});
ipcMain.on('force-quit', () => {
	// ★「保存して終了」した場合は、復元はせず【バックアップを破棄】して終了する
	if (activeSyncFolderPath) {
		cleanupSyncBackup(activeSyncFolderPath, false);
	}
	app.exit();
});
// ==========================================
// ★ プロジェクト管理システム
// ==========================================
const PROJECTS_ROOT = path.join(app.getPath('documents'), 'AC_Generator_Projects');
if (!fs.existsSync(PROJECTS_ROOT)) fs.mkdirSync(PROJECTS_ROOT, {
	recursive: true
});
ipcMain.handle('open-project', async () => {
	const result = await dialog.showOpenDialog(mainWindow, {
		title: 'プロジェクトフォルダを選択',
		defaultPath: PROJECTS_ROOT,
		properties: ['openDirectory']
	});
	if (mainWindow) mainWindow.focus(); // ★追加：ダイアログが閉じたらメイン画面にピントを強制的に戻す
	if (result.canceled || result.filePaths.length === 0) return {
		success: false
	};
	try {
		const filePath = path.join(result.filePaths[0], 'project.json');
		if (!fs.existsSync(filePath)) throw new Error('指定されたフォルダに project.json が見つかりません。');
		const projectData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
		saveToRecent(projectData.projectName || "名称未設定", filePath);
		return {
			success: true,
			data: projectData,
			path: filePath
		};
	} catch (err) {
		return {
			success: false,
			error: err.message
		};
	}
});
ipcMain.handle('load-project-path', async (event, filePath) => {
	try {
		const projectData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
		saveToRecent(projectData.projectName || "名称未設定", filePath);
		return {
			success: true,
			data: projectData,
			path: filePath
		};
	} catch (err) {
		return {
			success: false,
			error: err.message
		};
	}
});
ipcMain.handle('save-project', async (event, projectData) => {
	try {
		const targetDir = path.join(PROJECTS_ROOT, projectData.projectName);
		if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, {
			recursive: true
		});
		const jsonPath = path.join(targetDir, 'project.json');
		if (fs.existsSync(jsonPath)) fs.copyFileSync(jsonPath, path.join(targetDir, 'project.json.bak'));
		fs.writeFileSync(jsonPath, JSON.stringify(projectData, null, 2), 'utf8');
		return {
			success: true,
			path: jsonPath
		};
	} catch (err) {
		return {
			success: false,
			error: err.message
		};
	}
});
ipcMain.handle('restore-project', async (event, currentJsonPath) => {
	try {
		const backupPath = path.join(path.dirname(currentJsonPath), 'project.json.bak');
		if (!fs.existsSync(backupPath)) throw new Error("バックアップが見つかりません。");
		return {
			success: true,
			data: JSON.parse(fs.readFileSync(backupPath, 'utf8'))
		};
	} catch (err) {
		return {
			success: false,
			error: err.message
		};
	}
});
ipcMain.handle('get-recent-projects', async () => {
	try {
		if (!fs.existsSync(PROJECTS_ROOT)) return [];
		let list = [];
		fs.readdirSync(PROJECTS_ROOT).forEach(folderName => {
			const targetDir = path.join(PROJECTS_ROOT, folderName);
			const jsonPath = path.join(targetDir, 'project.json');
			if (fs.statSync(targetDir).isDirectory() && fs.existsSync(jsonPath)) {
				try {
					list.push({
						name: folderName,
						path: jsonPath,
						mtime: fs.statSync(jsonPath).mtime
					});
				} catch (e) {}
			}
		});
		return list.sort((a, b) => b.mtime - a.mtime);
	} catch (err) {
		return [];
	}
});
ipcMain.handle('delete-project', async (event, projectPath) => {
	try {
		const projectFolder = path.dirname(projectPath);
		if (fs.existsSync(projectFolder)) fs.rmSync(projectFolder, {
			recursive: true,
			force: true
		});
		if (fs.existsSync(PATHS.recent)) {
			let list = JSON.parse(fs.readFileSync(PATHS.recent, 'utf8')).filter(p => p.path !== projectPath);
			fs.writeFileSync(PATHS.recent, JSON.stringify(list, null, 2));
		}
		return {
			success: true
		};
	} catch (err) {
		return {
			success: false,
			error: err.message
		};
	}
});

function saveToRecent(name, filePath) {
	let list = [];
	if (fs.existsSync(PATHS.recent)) {
		try {
			list = JSON.parse(fs.readFileSync(PATHS.recent, 'utf8'));
		} catch (e) {}
	}
	list = list.filter(p => p.path !== filePath);
	list.unshift({
		name,
		path: filePath,
		date: new Date().toISOString()
	});
	fs.writeFileSync(PATHS.recent, JSON.stringify(list.slice(0, 10), null, 2));
}
ipcMain.handle('open-directory-dialog', async () => {
	const result = await dialog.showOpenDialog({
		properties: ['openDirectory']
	});
	if (mainWindow) mainWindow.focus(); // ★追加：ダイアログが閉じたらピントを戻す
	return result.canceled ? null : result.filePaths[0];
});
// ★引数を (event, baseDir, folderName, files, isOverwrite, sourcePath) であることを確認
ipcMain.handle('export-files-to-folder', async (event, baseDir, folderName, files, isOverwrite, sourcePath) => {
	try {
		let targetDir = "";
		if (isOverwrite) {
			// 🔄 【スイッチON：元のデータに上書き】
			if (!sourcePath) {
				// ★修正：パスを知らない（手動読み込み等）場合は、エラーで止めずに「上書き先」を聞く専用ダイアログを出す！
				const result = await dialog.showOpenDialog({
					properties: ['openDirectory'],
					title: '上書き先のデータフォルダ（dataフォルダなど）を選択してください'
				});
				if (result.canceled || result.filePaths.length === 0) {
					return {
						success: false,
						error: 'キャンセルされました'
					};
				}
				targetDir = result.filePaths[0];
			} else {
				targetDir = sourcePath; // パスを知っていればダイアログを出さずに即座に上書き
			}
			// ★修正：上書き用バックアップフォルダの準備
			const backupDir = path.join(targetDir, 'data_backup');
			if (!fs.existsSync(backupDir)) {
				fs.mkdirSync(backupDir, {
					recursive: true
				});
			}
			// ★修正：送られてきた「書き出し予定のファイル」だけを狙い撃ちしてバックアップ（GLBなどは無視）
			for (const file of files) {
				const srcFile = path.join(targetDir, file.name);
				const destFile = path.join(backupDir, file.name);
				// 元のフォルダにそのファイルが存在しており、かつ「まだバックアップされていない」場合のみコピー
				if (fs.existsSync(srcFile) && !fs.existsSync(destFile)) {
					if (fs.statSync(srcFile).isFile()) {
						fs.copyFileSync(srcFile, destFile);
					}
				}
			}
		} else {
			// 💾 【スイッチOFF：新規書き出し】
			// バックアップは絶対に作らない
			if (!baseDir) {
				const result = await dialog.showOpenDialog({
					properties: ['openDirectory', 'createDirectory'],
					title: '保存先の親フォルダを選択してください'
				});
				if (result.canceled || result.filePaths.length === 0) {
					return {
						success: false,
						error: 'キャンセルされました'
					};
				}
				targetDir = path.join(result.filePaths[0], folderName);
			} else {
				targetDir = path.join(baseDir, folderName);
			}
		}
		// 📁 共通：ファイルの書き出し処理
		if (!fs.existsSync(targetDir)) {
			fs.mkdirSync(targetDir, {
				recursive: true
			});
		}
		for (const file of files) {
			const fullPath = path.join(targetDir, file.name);
			// ratios.rto がすでに存在する場合はスキップ
			if (file.name === 'ratios.rto' && fs.existsSync(fullPath)) {
				continue;
			}
			try {
				fs.writeFileSync(fullPath, file.content, 'utf8');
			} catch (writeErr) {
				console.error(`ファイル ${file.name} の書き込みに失敗しました:`, writeErr.message);
			}
		}
		return {
			success: true,
			path: targetDir
		};
	} catch (error) {
		return {
			success: false,
			error: error.message
		};
	}
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
// ==========================================
// ★ マイドキュメントの view.ini との通信処理（詳細な探索ログ出力版）
// ==========================================
// ヘルパー関数：本物の Assetto Corsa フォルダを探し出す
function getAssettoCorsaCfgPath(carName) {
	// ★追加：アセットコルサの仕様（マイドキュメント内はすべて小文字）に自動で強制変換する
	if (carName) carName = carName.toLowerCase();
	const profile = process.env.USERPROFILE || '';
	// 可能性のある「ドキュメント」のパスをすべてリストアップ
	const possibleDocs = [
		app.getPath('documents'), // 1. ElectronがOSから聞いた標準
		path.join(profile, 'Documents'), // 2. ローカルのドキュメント強制
		path.join(profile, 'OneDrive', 'Documents'), // 3. OneDrive (英語名)
		path.join(profile, 'OneDrive', 'ドキュメント') // 4. OneDrive (日本語名)
	];
	console.log(`\n--- 🔍 [裏側] ${carName} のマイドキュメントフォルダ探索を開始 ---`);
	for (const docs of possibleDocs) {
		const testPath = path.join(docs, 'Assetto Corsa', 'cfg', 'cars', carName);
		// ★追加：どこを探しているかすべてログに出す
		console.log(`[探索] チェック中... : ${testPath}`);
		// もしこの場所にフォルダが実在していれば、そこが「本物」！
		if (fs.existsSync(testPath)) {
			console.log(`✅ [発見] ここに実在しました！ : ${testPath}\n`);
			return testPath;
		}
	}
	// どこにも無ければ、とりあえず標準の場所を返す（新規作成時用）
	const fallbackPath = path.join(app.getPath('documents'), 'Assetto Corsa', 'cfg', 'cars', carName);
	console.log(`❌ [失敗] フォルダがどこにも見つかりませんでした。デフォルトの場所を返します: ${fallbackPath}\n`);
	return fallbackPath;
}
ipcMain.handle('read-view-ini', async (event, carName) => {
	try {
		const targetDir = getAssettoCorsaCfgPath(carName);
		const targetFile = path.join(targetDir, 'view.ini');
		console.log(`【裏側】最終的に読み込みに挑戦する view.ini のパス: ${targetFile}`);
		if (fs.existsSync(targetFile)) {
			const content = fs.readFileSync(targetFile, 'utf8');
			console.log(`【裏側】✅ view.ini の読み込みに成功しました！`);
			return {
				success: true,
				content: content
			};
		}
		console.log(`【裏側】⚠️ パスは特定しましたが、中に view.ini というファイル自体が存在しませんでした。`);
		return {
			success: false,
			reason: 'not_found'
		};
	} catch (error) {
		console.error(`【裏側】❌ view.ini の読み込み処理自体がエラーでクラッシュしました:`, error);
		return {
			success: false,
			error: error.message
		};
	}
});
ipcMain.handle('save-view-ini', async (event, carName, content) => {
	try {
		const targetDir = getAssettoCorsaCfgPath(carName);
		// 1. 保存先のフォルダが無ければ自動で作る
		if (!fs.existsSync(targetDir)) {
			fs.mkdirSync(targetDir, {
				recursive: true
			});
		}
		const targetFile = path.join(targetDir, 'view.ini');
		// 2. 既に古いファイルが存在する場合は、安全のために「.bak」をつけてバックアップ
		if (fs.existsSync(targetFile)) {
			fs.copyFileSync(targetFile, path.join(targetDir, 'view.ini.bak'));
		}
		// 3. 新しい設定データを書き込む
		fs.writeFileSync(targetFile, content, 'utf8');
		return {
			success: true,
			path: targetFile
		};
	} catch (error) {
		console.error(`【裏側】view.ini の保存に失敗:`, error);
		return {
			success: false,
			error: error.message
		};
	}
});
// ★追加：裏側でも現在連動中のフォルダパスを覚えておく変数
let activeSyncFolderPath = null;

// ★共通の後片付け（復元・削除）関数
function cleanupSyncBackup(folderPath, shouldRestore) {
	try {
		const backupDir = path.join(folderPath, 'sync_backup');
		if (fs.existsSync(backupDir)) {
			if (shouldRestore) {
				// 「終了（保存しない）」の場合は、バックアップから元に戻す
				const files = fs.readdirSync(backupDir);
				files.forEach(f => {
					const src = path.join(backupDir, f);
					const dest = path.join(folderPath, f);
					if (fs.existsSync(src)) fs.copyFileSync(src, dest);
				});
				console.log("🧹 [LIVE SYNC] 元のデータを復元しました。");
			}
			// いずれの場合も一時的なバックアップフォルダを消す
			fs.rmSync(backupDir, { recursive: true, force: true });
			console.log("🧹 [LIVE SYNC] sync_backup フォルダを削除しました。");
		}
		activeSyncFolderPath = null;
		return true;
	} catch (e) {
		console.error("❌ LIVE SYNC 後片付けに失敗:", e.message);
		return false;
	}
}

// ★前回追加した sync-backup-start を少し書き換えて、パスを記憶するようにします
ipcMain.handle('sync-backup-start', async (event, folderPath, files) => {
	try {
		const backupDir = path.join(folderPath, 'sync_backup');
		activeSyncFolderPath = folderPath; // ★重要：パスを記憶
		if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
		
		files.forEach(fileName => {
			const src = path.join(folderPath, fileName);
			if (fs.existsSync(src)) fs.copyFileSync(src, path.join(backupDir, fileName));
		});
		return { success: true };
	} catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('sync-restore-end', async (event, folderPath) => {
	return { success: cleanupSyncBackup(folderPath, true) };
});
