const {
	app,
	BrowserWindow,
	Menu,
	dialog,
	shell,
	ipcMain,
	protocol,
	net
} = require('electron');
const {
	autoUpdater
} = require('electron-updater');
autoUpdater.autoDownload = false;
//：プレリリース版の検知を許可
autoUpdater.allowPrerelease = true;
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
		splashDuration: 13000, // スプラッシュ画面を表示する時間（ミリ秒）
		// splashDuration: 1000, // スプラッシュ画面を表示する時間（ミリ秒）
	},
	flow: {
		autoSkipLogin: true, // トークンがあれば自動ログインを試みる
		showSplashAfterLogin: true // ログイン後にスプラッシュを表示する
	},
	auth: {
		trialDays: 7, // 毎月の試用可能日数（合計7日間）
		trialFreeDays: 7, // 完全無料枠（Discord参加のみ）の試用日数
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
let isProjectLoaded = false;
let isUpdating = false;
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
	splash.setIgnoreMouseEvents(true);
}
// --- 部品B：メインエディター画面 ---
function createMainWindow() {
	// package.json からバージョン番号を自動取得する
	const appVersion = app.getVersion();
	mainWindow = new BrowserWindow({
		width: 1340,
		height: 750,
		minWidth: 1340,
		minHeight: 750,
		title: `AC FILE GENERATOR v${appVersion}`, // ★追加：タイトルバーに名前とバージョンを設定
		show: false, // ★安全のために最初は隠す
		autoHideMenuBar: false,
		backgroundColor: '#ffffff',
		icon: path.join(__dirname, '/image/icon.png'),
		webPreferences: {
			preload: path.join(__dirname, 'preload.js'),
			contextIsolation: true
		}
	});
	mainWindow.on('close', (e) => {
		console.log('--- closeイベント発生 ---');
		console.log('isProjectLoadedの値:', isProjectLoaded);
		if (isUpdating) return;
		if (!isProjectLoaded) return;
		e.preventDefault();
		// ボタンの並び順とテキストを変更
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
	// mainWindow.webContents.on('context-menu', (e, props) => {
	// 	const { x, y } = props;
	// 	Menu.buildFromTemplate([{
	// 		label: '要素を検証',
	// 		click: () => { mainWindow.webContents.inspectElement(x, y); }
	// 	}]).popup(mainWindow);
	// });
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
	}]
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
	protocol.handle('local-file', (request) => {
		// 1. URLからパス部分を抽出
		const url = new URL(request.url);
		// 2. pathname は先頭に "/" がつくため、それを除去して取得
		// 例: "/D:/フォント・ソフト/..." -> "D:/フォント・ソフト/..."
		const filePath = decodeURIComponent(url.pathname.slice(1));
		// 3. ログで最終的なパスを確認（デバッグ用）
		console.log("🔍 [Protocol] 確定パス:", filePath);
		// 4. file:// プロトコルとして返却
		return net.fetch('file://' + filePath);
	});
	// ★ ルートB：自動アップデート機能（electron-updater）
	// アップデートが見つかった時の動作
	autoUpdater.on('update-available', (info) => {
		const result = dialog.showMessageBoxSync({
			type: 'info',
			title: 'アップデートのお知らせ',
			message: `新しいバージョン（v${info.version}）が見つかりました。\nダウンロードしてアップデートを開始しますか？`,
			noLink: true,
			buttons: ['はい', 'いいえ'],
			defaultId: 0,
			cancelId: 1
		});
		if (result === 0) {
			autoUpdater.downloadUpdate();
		}
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
	autoUpdater.removeAllListeners('update-downloaded');
	autoUpdater.on('update-downloaded', (info) => {
		isUpdating = true;
		autoUpdater.quitAndInstall();
	});
	// エラー発生時（開発用ログ出力）
	autoUpdater.on('error', (err) => {
		console.log('アップデート確認エラー:\n' + err);
	});
	// 外部ブラウザでリンクを開く窓口（エラー回避用）
	ipcMain.handle('open-external', (event, url) => shell.openExternal(url));
	Menu.setApplicationMenu(Menu.buildFromTemplate(template));
	createMainWindow();
	// ★ 賢い分岐ルート
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
// スプラッシュ表示フロー
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
						autoUpdater.checkForUpdates();
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
ipcMain.handle('unpack-kn5', async (event, kn5Path) => {
	// アプリ同梱ツールのパス
	const sdkExe = path.join(__dirname, 'tools-folder', 'lib', 'kunossdk.exe');
	// 100%の事実に基づく修正：ツールは「fbx」というフォルダを作ってその中に保存します [cite: 759]
	const kn5Dir = path.dirname(kn5Path); // .kn5 があるフォルダ（車両フォルダ）を取得
	const kn5Name = path.basename(kn5Path, '.kn5'); // ファイル名（例：nissan_silvia_s13）を取得
	const outputFbxPath = path.join(kn5Dir, 'fbx', `${kn5Name}.fbx`); // 「fbx」フォルダ内のパスを組み立て
	return new Promise((resolve) => {
		if (!fs.existsSync(sdkExe)) {
			resolve({
				success: false,
				error: "展開ツール(kunossdk.exe)が見つかりません。"
			});
			return;
		}
		// コマンド実行（.kn5 を渡すと、自動的にその場所に fbx フォルダを作って展開されます）
		const command = `"${sdkExe}" "${kn5Path}"`;
		exec(command, (error, stdout, stderr) => {
			// 事実：ツール実行後に「fbx」フォルダの中にファイルが存在するか確認します [cite: 759]
			if (fs.existsSync(outputFbxPath)) {
				console.log("✅ [.kn5] 物理ファイルを確認:", outputFbxPath);
				resolve({
					success: true,
					fbxPath: outputFbxPath
				});
			} else if (error) {
				resolve({
					success: false,
					error: stderr || error.message
				});
			} else {
				resolve({
					success: false,
					error: "展開プロセスは終了しましたが、ファイルが見つかりません。"
				});
			}
		});
	});
});
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
ipcMain.on('set-project-loaded', (event, status) => {
	console.log('★ set-project-loaded が呼ばれました。新しい状態:', status);
	isProjectLoaded = status;
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
ipcMain.handle('get-folder-list', async (event, targetPath) => {
	const fs = require('fs');
	const path = require('path');
	try {
		let searchPath = targetPath;
		// 1. アセットコルサのルート指定(content\cars)が無い場合、選ばれたフォルダ自身を探索先にする
		if (!fs.existsSync(searchPath)) {
			if (searchPath.includes('content\\cars') || searchPath.includes('content/cars')) {
				searchPath = searchPath.replace(/\\content\\cars$/, '').replace(/\/content\/cars$/, '');
			}
		}
		if (!fs.existsSync(searchPath)) return {
			success: false,
			error: 'パスが見つかりません'
		};
		// 2. 指定されたパス内の「フォルダ」をすべて抜き出す
		let folders = fs.readdirSync(searchPath).filter(file => {
			return fs.statSync(path.join(searchPath, file)).isDirectory();
		});
		// 3. そのフォルダ内に「.kn5 ファイル（collider.kn5以外）」が含まれるものを「車両フォルダ」として厳選する！
		const carFolders = folders.filter(folderName => {
			const folderPath = path.join(searchPath, folderName);
			try {
				const innerFiles = fs.readdirSync(folderPath);
				return innerFiles.some(f => f.toLowerCase().endsWith('.kn5') && f.toLowerCase() !== 'collider.kn5');
			} catch (e) {
				return false;
			}
		});
		// 4. .kn5 が入っている車両フォルダが1つでも見つかればそれを優先し、無ければ全フォルダを返す
		if (carFolders.length > 0) {
			folders = carFolders;
		}
		return {
			success: true,
			folders: folders
		};
	} catch (err) {
		return {
			success: false,
			error: err.message
		};
	}
});
// ★★★ ここから追加（指定された車両フォルダのINIデータを一括で読み取る） ★★★
ipcMain.handle('read-car-folder-data', async (event, carPath) => {
	const fs = require('fs');
	const path = require('path');
	const dataPath = path.join(carPath, 'data');
	const ALLOWED_FILES = ['aero.ini', 'cameras.ini', 'car.ini', 'colliders.ini', 'drivetrain.ini', 'engine.ini', 'final.rto', 'power.lut', 'setup.ini', 'suspensions.ini', 'tyres.ini', 'mirrors.ini', 'ui_car.json'];
	const filesRead = [];
	try {
		// 1. 車両の「ルートフォルダ」から .kn5 を拾う（見落とし・ゴミ拾い防止）
		if (fs.existsSync(carPath)) {
			const rootFiles = fs.readdirSync(carPath);
			for (const file of rootFiles) {
				const lowerName = file.toLowerCase();
				// collider.kn5 以外の .kn5 を見つけたら「モデル」として登録
				if (lowerName.endsWith('.kn5') && lowerName !== 'collider.kn5') {
					filesRead.push({
						name: file,
						path: path.join(carPath, file),
						isModel: true // 重要：これを付けることでフロント側で自動展開処理へ誘導します
					});
				}
			}
		}
		// 2. 「data」フォルダ内の設定ファイルを読み取る
		if (fs.existsSync(dataPath)) {
			const files = fs.readdirSync(dataPath);
			for (const file of files) {
				const lowerFile = file.toLowerCase();
				if (ALLOWED_FILES.includes(lowerFile)) {
					const fullPath = path.join(dataPath, file);
					if (fs.statSync(fullPath).isFile()) {
						const content = fs.readFileSync(fullPath, 'utf8');
						filesRead.push({
							name: file,
							content: content,
							path: fullPath
						});
					}
				}
			}
		}
		// 3. 車両の「ui」フォルダから ui_car.json を拾う (★追加)
		const uiPath = path.join(carPath, 'ui');
		const uiJsonPath = path.join(uiPath, 'ui_car.json');
		if (fs.existsSync(uiJsonPath)) {
			const content = fs.readFileSync(uiJsonPath, 'utf8');
			filesRead.push({
				name: 'ui_car.json',
				content: content,
				path: uiJsonPath
			});
			console.log("✅ [裏側] ui_car.json を発見しました。");
		}
		// 4. skins フォルダの探索
		const skinsPath = path.join(carPath, 'skins');
		const skinsFound = [];
		if (fs.existsSync(skinsPath)) {
			const skinDirs = fs.readdirSync(skinsPath);
			for (const skinDir of skinDirs) {
				const fullSkinPath = path.join(skinsPath, skinDir);
				if (fs.statSync(fullSkinPath).isDirectory()) {
					const previewPath = path.join(fullSkinPath, 'preview.jpg');
					if (fs.existsSync(previewPath)) {
						skinsFound.push({
							name: skinDir,
							path: previewPath.replace(/\\/g, '/')
						});
					}
				}
			}
		}
		// 戻り値に skins のリストを足して、表側の res.skins に届けます
		return {
			success: true,
			files: filesRead,
			skins: skinsFound
		};
	} catch (err) {
		console.error("【裏側】車両データ読込エラー:", err);
		return {
			success: false,
			error: err.message
		};
	}
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
		// ★ここに追加：ループが終わった直後、リターンする前
		if (sourcePath && fs.existsSync(sourcePath)) {
			const uiDirPath = path.join(targetDir, 'ui'); // targetDir は上で定義されています
			if (!fs.existsSync(uiDirPath)) {
				fs.mkdirSync(uiDirPath, {
					recursive: true
				});
			}
			const destPath = path.join(uiDirPath, 'badge.png');
			fs.copyFileSync(sourcePath, destPath);
			console.log("✅ バッジ画像をコピーしました:", destPath);
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
		// 2. 既に古いファイルが存在する場合は、安全のために「_old」をつけてバックアップ
		if (fs.existsSync(targetFile)) {
			fs.copyFileSync(targetFile, path.join(targetDir, 'view.ini_old'));
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
		// ★【修正】view.ini の復元処理（マイドキュメントのパスへアクセス）
		const carName = path.basename(path.dirname(folderPath));
		const docViewIni = path.join(app.getPath('documents'), 'Assetto Corsa', 'cfg', 'cars', carName, 'view.ini');
		const viewIniOld = path.join(path.dirname(docViewIni), 'view.ini_old');
		if (shouldRestore && fs.existsSync(viewIniOld)) {
			fs.copyFileSync(viewIniOld, docViewIni);
			fs.unlinkSync(viewIniOld);
			console.log("🧹 [LIVE SYNC] view.ini を復元しました。");
		} else if (fs.existsSync(viewIniOld)) {
			fs.unlinkSync(viewIniOld);
		}
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
			fs.rmSync(backupDir, {
				recursive: true,
				force: true
			});
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
		// ★【修正】view.ini だけ別処理を行い、sync_backup には入れない
		if (files.includes('view.ini')) {
			const carName = path.basename(path.dirname(folderPath));
			const docViewIni = path.join(app.getPath('documents'), 'Assetto Corsa', 'cfg', 'cars', carName, 'view.ini');
			console.log("🔍 [LIVE SYNC] view.ini のバックアップ対象パス:", docViewIni);
			if (fs.existsSync(docViewIni)) {
				fs.copyFileSync(docViewIni, path.join(path.dirname(docViewIni), 'view.ini_old'));
				console.log("✅ [LIVE SYNC] view.ini_old を作成しました。");
			} else {
				console.log("❌ [LIVE SYNC] view.ini が見つかりません:", docViewIni);
			}
		}
		const backupDir = path.join(folderPath, 'sync_backup');
		activeSyncFolderPath = folderPath;
		if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, {
			recursive: true
		});
		files.forEach(fileName => {
			// ★【修正】view.ini がリストにあっても sync_backup にはコピーしない
			if (fileName !== 'view.ini') {
				const src = path.join(folderPath, fileName);
				if (fs.existsSync(src)) fs.copyFileSync(src, path.join(backupDir, fileName));
			}
		});
		return {
			success: true
		};
	} catch (e) {
		return {
			success: false,
			error: e.message
		};
	}
});
ipcMain.handle('sync-restore-end', async (event, folderPath) => {
	return {
		success: cleanupSyncBackup(folderPath, true)
	};
});
// フォルダを丸ごとコピーする処理
ipcMain.handle('clone-car-folder', async (event, sourcePath, targetPath) => {
	const fs = require('fs');
	try {
		if (!fs.existsSync(sourcePath)) return {
			success: false,
			error: '元の車両が見つかりません'
		};
		if (fs.existsSync(targetPath)) return {
			success: false,
			error: '指定した名前の車両は既に存在します'
		};
		// フォルダを再帰的に丸ごとコピー（Node.js 16.7.0以降が必要）
		fs.cpSync(sourcePath, targetPath, {
			recursive: true
		});
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
// フォルダ名変更
ipcMain.handle('rename-car-folder', async (event, oldPath, newName) => {
	const fs = require('fs');
	const path = require('path');
	try {
		const parentDir = path.dirname(oldPath);
		const newPath = path.join(parentDir, newName);
		if (fs.existsSync(newPath)) throw new Error('変更後の名前は既に存在します');
		fs.renameSync(oldPath, newPath);
		return {
			success: true,
			newPath: newPath
		};
	} catch (err) {
		return {
			success: false,
			error: err.message
		};
	}
});