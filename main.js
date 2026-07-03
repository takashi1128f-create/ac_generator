//おまとめテスト
window.currentProject = {
	projectName: "名称未設定",
	environment: {
		model_path: "",
		data_folder: ""
	},
	files: {} // ここに各iniファイルの内容が { suspensions: { currentData: {...} }, ... } の形で入る
};
// プロジェクトを開いた時に実行
window.electronAPI.setProjectLoaded(true);
// プロジェクトを閉じた時（または終了時）に実行
// window.electronAPI.setProjectLoaded(false);
// window.currentProjectPath = ""; // 現在開いているプロジェクトのパス
// ==========================================
// ★ アプリ全体の設定管理（フロントエンド）
// ==========================================
window.APP_CONFIG = {
	timing: {
		// authStartDelay: 1500,// スプラッシュ終了後、チェックを開始するまでの「タメ」
		// checkingMinDuration: 2500,// 「確認中...」を見せる
		// successDisplayDelay: 5000,// 緑文字や成功ボタンを見せておく時間（秒数リセット可能）
		// fadeSpeed: 1000// 最後に画面が消える速度
		authStartDelay: 0, // スプラッシュ終了後、チェックを開始するまでの「タメ」
		checkingMinDuration: 1000, // 「確認中...」を見せる
		successDisplayDelay: 1000, // 緑文字や成功ボタンを見せておく時間（秒数リセット可能）
		fadeSpeed: 0 // 最後に画面が消える速度
	},
	messages: {
		checking: '⏳ 権限を確認中...',
		successBtn: '✅ 認証完了！',
		errorBtn: '❌ 認証エラー',
		manualSuccess: "認証に成功しました！\n間もなく起動します...",
		autoSuccess: "自動認証成功！",
		// ★ 追加・修正
		free: (days) => `無料体験版\n残り利用可能日数は ${days} 日です。\nメンバーシップにご参加いただくと制限が解除されます！`,
		trial: (days) => `YouTube メンバーシップ「支援者（心の支え）」\n今月の残り利用可能日数は ${days} 日です。\nいつも応援ありがとうございます！`,
		permanent: "YouTube メンバーシップ「私を支持する者」様\n無制限アクセス権が有効です。ありがとうございます！",
		expired: "今月の利用枠を使い切りました。\n来月1日にリセットされます。\nすぐに使い続けたい場合は、メンバーシップの登録・レベルアップをご検討ください。"
	}
};
// ==========================================\n
// ★ここに追加：入力操作を監視し、スペックをリアルタイムで再計算する
// ==========================================\n
document.addEventListener('input', async (e) => {
	// ★ログ1：そもそも「何か入力された」ことを検知
	console.log(`[DEBUG-INPUT] 入力検知: ID=${e.target.id}, Tag=${e.target.tagName}`);

	const isInsideEditor = e.target.closest('#wrapper');
	if (!isInsideEditor) {
		console.warn("[DEBUG-INPUT] 警告：#wrapper の外側での入力のため無視されました");
		return;
	}

	// 1. 物理スペック（馬力など）の再計算
	if (typeof window.updateSpecsFromPhysics === 'function') {
        window.updateSpecsFromPhysics();
    }

    // ★事実に基づく修正：あなたが指定した「常に更新してほしいメタデータ」のIDリスト
    const alwaysSyncIds = [
        'ui-name', 'ui-author', 'ui-brand', 'ui-tags', 'ui-class', 
        'ui-country', 'ui-version', 'ui-url', 'ui-year', 'ui-description'
    ];
    // 入力された項目のIDがリストに含まれているか確認
    const isUiField = alwaysSyncIds.includes(e.target.id);

    if (typeof window.triggerLiveSync === 'function') {
        window.triggerLiveSync(isUiField);
    }
});
// 以下、既存のコードが続く...
// 起動時のチラつき防止（目印がある場合は最初から透明にしておく）
if (window.location.search.includes('action=newProject')) {
	document.documentElement.style.opacity = '0';
}
// =========================================================
// ★ アプリ起動時のメイン処理（受付係パターン）
// =========================================================
document.addEventListener('DOMContentLoaded', async () => {
	// --- 【準備】共通で使用する要素の取得 ---
	const loginBtn = document.getElementById('discord-login-btn');
	const statusMsg = document.getElementById('auth-status-message');
	const lockScreen = document.getElementById('security-lock-screen');
	const btnNewProject = document.getElementById('hub-new-project');
	const startupHub = document.getElementById('startup-hub');
	const DISCORD_AUTH_URL = "https://discord.com/oauth2/authorize?client_id=1496540447684952144&response_type=code&redirect_uri=http%3A%2F%2Flocalhost%3A34567%2Fauth&scope=identify+guilds.members.read";
	// --- 【分岐点】URLの目印を確認 ---
	const urlParams = new URLSearchParams(window.location.search);
	const isNewProjectMode = urlParams.get('action') === 'newProject';
	if (isNewProjectMode) {
		// -----------------------------------------------------
		// ➡ 【ルートA】新規作成モード（目印がある場合）
		// -----------------------------------------------------
		console.log("【起動】ルートA：新規作成モードで初期化します");
		// 1. 次回リロード時に勝手に発動しないよう、URLの目印を消す
		window.history.replaceState({}, document.title, window.location.pathname);
		// 2. 画面を表示し、認証不要なのでロック画面を即座に消す
		document.documentElement.style.transition = "opacity 0.3s ease";
		document.documentElement.style.opacity = '1';
		if (lockScreen) lockScreen.style.display = "none";
		// 3. タイマー(0.3秒)：画面の表示を待ってから新規作成ボタンを自動で押す
		setTimeout(() => {
			if (btnNewProject) btnNewProject.click();
		}, 300);
		// 4. 【出口】ここで処理を完全終了（これより下の認証処理へは進まない）
		return;
	}
	// -----------------------------------------------------
	// ➡ 【ルートB】通常起動・認証モード（目印がない場合）
	// -----------------------------------------------------
	console.log("【起動】ルートB：通常起動（認証モード）で開始します");
	// 1. 画面の初期状態をセット（ロック画面を確実に表示）
	if (lockScreen) lockScreen.style.display = "flex";
	document.documentElement.style.opacity = '1';
	// 2. 手動ログインボタンの動作を登録
	if (loginBtn) {
		loginBtn.addEventListener('click', () => {
			loginBtn.innerHTML = '⏳ 認証中...';
			if (window.electronAPI) window.electronAPI.openExternalLink(DISCORD_AUTH_URL);
		});
	}
	// 手動ログイン成功時の処理（ブラウザ認証が終わったあと画面を消す）
	if (window.electronAPI && window.electronAPI.onDiscordCallback) {
		window.electronAPI.onDiscordCallback((authResult) => {
			console.log("【表側】手動ログイン成功の通知を受信:", authResult);
			if (authResult && authResult.success) {
				if (statusMsg) {
					statusMsg.style.color = "#51cf66";
					statusMsg.textContent = "認証に成功しました！間もなく起動します...";
				}
				setTimeout(() => {
					const securityOverlay = document.getElementById('security-lock-screen') || lockScreen;
					if (securityOverlay) {
						const fadeSeconds = window.APP_CONFIG.timing.fadeSpeed / 1000;
						securityOverlay.style.transition = `opacity ${fadeSeconds}s ease`;
						securityOverlay.style.opacity = "0";
						setTimeout(() => {
							securityOverlay.style.display = "none";
						}, window.APP_CONFIG.timing.fadeSpeed);
					}
				}, window.APP_CONFIG.timing.successDisplayDelay);
			}
		});
	}
	// 3. 自動ログインのチェック
	// ダウンロード進捗の監視
	if (window.electronAPI && window.electronAPI.onDownloadProgress) {
		window.electronAPI.onDownloadProgress((percent) => {
			const updateArea = document.getElementById('update-area');
			if (updateArea) {
				updateArea.style.display = 'block';
				const progressBar = document.getElementById('update-progress');
				const progressText = document.getElementById('progress-text');
				if (progressBar) progressBar.value = percent;
				if (progressText) progressText.innerText = percent + '%';
			}
		});
	}
	if (window.electronAPI && window.electronAPI.onMainWindowShown) {
		window.electronAPI.onMainWindowShown(() => {
			setTimeout(() => {
				if (loginBtn) loginBtn.innerHTML = window.APP_CONFIG.messages.checking;
				// ★演出用のタイマー：開始時刻を記録
				const startTime = Date.now();
				window.electronAPI.checkAutoLogin().then(authResult => {
					// 通信にかかった時間を計算
					const elapsedTime = Date.now() - startTime;
					// 設定された「最低時間」に足りない分の残り時間を計算
					const waitRemaining = Math.max(0, window.APP_CONFIG.timing.checkingMinDuration - elapsedTime);
					console.log(`【表側】通信完了（${elapsedTime}ms）。演出のため、あと ${waitRemaining}ms 待機します。`);
					// 残りの時間だけ待ってから、画面を更新する
					setTimeout(() => {
						if (authResult && authResult.success) {
							// --- 成功時の表示更新 ---
							if (loginBtn) {
								loginBtn.innerHTML = window.APP_CONFIG.messages.successBtn;
								loginBtn.style.pointerEvents = 'none';
							}
							if (statusMsg) {
								statusMsg.style.color = "#51cf66";
								// プランに応じたメッセージの割り振り
								if (authResult.plan === 'free') { // ★これを追加
									statusMsg.textContent = window.APP_CONFIG.messages.free(authResult.daysLeft);
								} else if (authResult.plan === 'trial') {
									statusMsg.textContent = window.APP_CONFIG.messages.trial(authResult.daysLeft);
								} else if (authResult.plan === 'permanent') {
									statusMsg.textContent = window.APP_CONFIG.messages.permanent;
								} else {
									statusMsg.textContent = window.APP_CONFIG.messages.autoSuccess;
								}
							}
							// 設定された successDisplayDelay (3秒など) の時間だけ表示を維持
							setTimeout(() => {
								const securityOverlay = document.getElementById('security-lock-screen') || lockScreen;
								if (securityOverlay) {
									securityOverlay.style.transition = `opacity ${window.APP_CONFIG.timing.fadeSpeed / 1000}s ease`;
									securityOverlay.style.opacity = "0";
									setTimeout(() => {
										securityOverlay.style.display = "none";
										// ハブ画面を表示
										if (startupHub) {
											startupHub.style.display = "flex";
											startupHub.style.opacity = "0";
											startupHub.style.transition = "opacity 0.5s ease";
											setTimeout(() => {
												startupHub.style.opacity = "1";
											}, 10);
										}
									}, window.APP_CONFIG.timing.fadeSpeed);
								}
							}, window.APP_CONFIG.timing.successDisplayDelay);
						} else {
							// 失敗時の処理（同様に messages から取得）
							if (statusMsg) {
								statusMsg.style.color = "#ff6b6b";
								statusMsg.textContent = (authResult.reason === 'trial_expired') ? window.APP_CONFIG.messages.expired : "認証失敗：権限がありません。";
							}
							if (loginBtn) loginBtn.innerHTML = 'Discordで認証';
						}
					}, waitRemaining); // ⭕️ 修正①：「, waitRemaining」を追加してタイマーの時間を教える
					// ⭕️ 修正②：不足していた「データ受け取り終了」のカッコと、エラー時の処理を追加する
				}).catch(err => {
					console.error("認証チェックでエラー発生:", err);
					if (loginBtn) loginBtn.innerHTML = 'エラー発生';
				});
			}, window.APP_CONFIG.timing.authStartDelay);
		});
	}
	// ★ ここを追加：裏側からバージョン番号を受け取ってHTMLを更新する
	window.appVersion = "0.0.1"; // 予備の初期値
	if (window.electronAPI && window.electronAPI.onAppVersion) {
		window.electronAPI.onAppVersion((version) => {
			window.appVersion = version; // いつでも使えるように保存
			const versionDisplay = document.getElementById('app-version-display');
			if (versionDisplay) {
				versionDisplay.textContent = `Version ${version}`;
			}
		});
	}
	// ★修正：裏側からバージョン番号を受け取ってHTMLを更新し、変更があればお知らせを出す
	if (window.electronAPI && window.electronAPI.onAppVersion) {
		window.electronAPI.onAppVersion((version) => {
			window.appVersion = version;
			const versionDisplay = document.getElementById('app-version-display');
			if (versionDisplay) {
				versionDisplay.textContent = `Version ${version}`;
			}
			// --- ここから追加：バージョン変更検知ロジック ---
			const lastSeenVersion = localStorage.getItem('app_last_seen_version');
			// 初回起動時、またはバージョン番号が前回と違う場合
			if (lastSeenVersion && lastSeenVersion !== version) {
				const infoModal = document.getElementById('info-modal');
				const updateTabBtn = document.getElementById('tab-btn-update');
				if (infoModal && updateTabBtn) {
					// 1. モーダルを表示
					infoModal.classList.remove('hidden');
					// 2. アップデート情報のタブを自動でクリック（表示切替）
					updateTabBtn.click();
				}
			}
			// 現在のバージョンを「確認済み」として記憶
			localStorage.setItem('app_last_seen_version', version);
			// --- ここまで追加 ---
		});
	}
});
// ↓ ここから下は、既存の function updateProjectFileState(...) などが続きます
//テスト終わり
document.addEventListener('DOMContentLoaded', () => {
	const btnNewProject = document.getElementById('hub-new-project');
	const startupHub = document.getElementById('startup-hub');
	// 自作モーダル用の要素
	const nameModal = document.getElementById('name-input-modal');
	const nameInput = document.getElementById('new-project-name');
	const btnCancel = document.getElementById('btn-cancel-create');
	const btnExecute = document.getElementById('btn-execute-create');
	if (btnNewProject && startupHub && nameModal) {
		// 1. 「新規作成」を押したら、自作モーダルを表示
		btnNewProject.addEventListener('click', () => {
			nameModal.classList.remove('hidden');
			nameInput.value = ''; // 入力欄をリセット
			nameInput.focus(); // すぐ入力できるようにカーソルを合わせる
		});
		// 2. 「キャンセル」を押したら隠す
		btnCancel.addEventListener('click', () => {
			nameModal.classList.add('hidden');
		});
		// 3. 「作成」を押したときの処理
		btnExecute.addEventListener('click', async () => {
			const projectName = nameInput.value.trim();
			// ★修正：alert() を廃止し、入力欄を赤くして警告する（フォーカス迷子バグを完全回避）
			if (projectName === "") {
				nameInput.style.border = "2px solid #ff6b6b"; // 枠を赤くする
				nameInput.placeholder = "※プロジェクト名を入力してください！"; // プレースホルダーで警告
				nameInput.value = ""; // 中身を空にする
				// 確実に入力欄にカーソルを戻す
				setTimeout(() => {
					if (nameInput) nameInput.focus();
				}, 50);
				return;
			}
			// 正しく入力されて進む場合は、枠の色などを元に戻す
			nameInput.style.border = "";
			nameInput.placeholder = "例: My_AE86_Grip";
			// モーダルを隠す
			nameModal.classList.add('hidden');
			// ★修正：ダミーデータを作るのではなく、アプリの記憶領域（State）に名前をセットする！
			window.currentProject.projectName = projectName;
			// ★修正：効かなかった document.title を消し、裏側へタイトル変更を依頼する
			if (window.electronAPI && window.electronAPI.setWindowTitle) {
				window.electronAPI.setWindowTitle(projectName);
			}
			window.currentProject.project = {
				name: projectName,
				created: new Date().toISOString(),
				version: "1.0.0"
			};
			try {
				// メインプロセスへ、記憶領域のデータをそのまま保存依頼
				const result = await window.electronAPI.saveProject(window.currentProject);
				if (result.success) {
					console.log("新規プロジェクト作成完了:", result.path);
					window.currentProjectPath = result.path; // 保存先のパスをアプリに覚えさせる
					if (typeof window.updateProjectSidebar === 'function') {
						window.updateProjectSidebar(); // サイドバーの表示を生成する
					}
					// ハブをフワッと消してエディターへ
					startupHub.style.transition = "opacity 0.3s ease";
					startupHub.style.opacity = "0";
					setTimeout(() => {
						startupHub.style.display = 'none';
						const editor = document.getElementById('wrapper');
						if (editor) editor.style.display = 'block';
					}, 300);
				} else {
					alert("作成失敗...\n" + result.error);
				}
			} catch (err) {
				console.error(err);
				alert("エラーが発生しました。");
			}
		});
	}
});
const btnOpenProject = document.getElementById('hub-open-project');
if (btnOpenProject) {
	btnOpenProject.addEventListener('click', async () => {
		console.log("【FRONT: 1】開くボタンが押されました。裏側にデータを要求します...");
		try {
			const result = await window.electronAPI.openProject();
			console.log("【FRONT: 2】裏側から返答が来ました！結果:", result);
			if (result.success) {
				window.currentProject = result.data;
				console.log("【FRONT: 3】Stateへのデータ保存完了。UIの更新に進みます。");
				if (typeof loadProjectToUI === 'function') {
					loadProjectToUI(window.currentProject);
					console.log("【FRONT: 4】loadProjectToUI の実行が完了しました。");
				}
				// ★抜け落ちていた処理：読み込み成功後にスタートアップ画面をフワッと消す
				const startupHub = document.getElementById('startup-hub');
				if (startupHub) {
					startupHub.style.transition = "opacity 0.3s ease";
					startupHub.style.opacity = "0";
					setTimeout(() => {
						startupHub.style.display = 'none';
					}, 300);
				}
			} else {
				// キャンセル時はエラーを出さずに静かに終わる
				console.log("【FRONT】ファイル選択がキャンセルされました。");
			}
		} catch (err) {
			console.error("【FRONT: 致命的エラー】フロント側でクラッシュしました！:", err);
		}
	});
}
window.loadProjectToUI = async function(projectState) {
	console.log("🏁 [復元開始] データの復元を実行します...", projectState);
	if (!projectState) return;
	window.isRestoring = true;
	const env = projectState.environment || {};
	// 1. 車両名の入力欄を復元
	const nameInput = document.getElementById('new-car-project-name');
	if (nameInput && env.output_car_name) {
		nameInput.value = env.output_car_name;
	}
	// 2. ベース車両のプルダウン選択を復元
	if (env.base_car_name) {
		window.currentCarDirectoryName = env.base_car_name;
		const carSelect = document.getElementById('ac-car-select');
		if (carSelect) {
			// 選択肢になければ追加（外部から読み込んだ車両などの対応）
			let exists = false;
			for (let i = 0; i < carSelect.options.length; i++) {
				if (carSelect.options[i].value === env.base_car_name) {
					exists = true;
					break;
				}
			}
			if (!exists) {
				const opt = document.createElement('option');
				opt.value = env.base_car_name;
				opt.textContent = env.base_car_name;
				carSelect.appendChild(opt);
			}
			carSelect.value = env.base_car_name;
		}
	}
	// 3. スキンプレビュー（ギャラリー）を復元
	if (env.all_car_skins && env.all_car_skins.length > 0) {
		// logo-name.js にある既存の初期化関数を使用
		if (typeof window.initSkinGallery === 'function') {
			window.initSkinGallery(env.all_car_skins);
			// 最後に見ていたスキンを表示
			if (env.current_skin_idx !== undefined) {
				window.selectSkin(env.current_skin_idx);
			}
		}
	}
	if (projectState.projectName && window.electronAPI && window.electronAPI.setWindowTitle) {
		window.electronAPI.setWindowTitle(projectState.projectName);
	}
	// =======================================================
	// 1. 3Dモデルの復元（元々あった正しい処理を復活！）
	// =======================================================
	if (projectState.environment && projectState.environment.model_path) {
		if (typeof window.loadModelByPath === 'function') {
			console.log("🏎️ [復元] 保存されたパスから3Dモデルを読み込みます:", projectState.environment.model_path);
			await window.loadModelByPath(projectState.environment.model_path);
		}
	}
	// ★追加：忘れていた「データフォルダのパス」の記憶を復元する
	if (projectState.environment && projectState.environment.data_folder) {
		window.currentDataFolderPath = projectState.environment.data_folder;
	} else {
		window.currentDataFolderPath = null;
	}
	const files = projectState.files || {};
	// =======================================================
	// 2. INIデータ・その他の変数復元（最新の追加分も網羅）
	// =======================================================
	if (files['suspensions']) window.currentSuspensionData = files['suspensions'].currentData;
	if (files['tyres']) window.currentTyreData = files['tyres'].currentData;
	if (files['car']) window.currentCarData = files['car'].currentData;
	if (window.currentCarData?.BASIC?.TOTALMASS) {
		window.updateSpecsDisplay({
			weight: window.currentCarData.BASIC.TOTALMASS
		});
	}
	if (files['aero']) window.currentAeroData = files['aero'].currentData;
	if (files['engine']) window.currentEngineData = files['engine'].currentData;
	if (files['setup']) window.currentSetupData = files['setup'].currentData;
	if (files['drivetrain']) window.currentDrivetrainData = files['drivetrain'].currentData;
	// 追加機能分のデータ
	if (files['power_lut_raw']) window.currentPowerLutRaw = files['power_lut_raw'].currentData;
	if (typeof window.parsePowerLut === 'function') {
		window.parsePowerLut(window.currentPowerLutRaw);
	}
	if (files['final_rto_list']) window.finalRtoList = files['final_rto_list'].currentData;
	if (files['modified_status']) window.modifiedStatus = files['modified_status'].currentData;
	// ★修正：拡張物理スイッチのON/OFF状態を完全に復元する
	// 1. まずは「保存時に記憶したスイッチの状態」を最優先で読み込む
	if (projectState.environment && projectState.environment.isExtendedPhysicsEnabled !== undefined) {
		window.isExtendedPhysicsEnabled = projectState.environment.isExtendedPhysicsEnabled;
	} else {
		// 2. 過去のデータなど、記憶がない場合のみデータから推測する
		let detectedExtended = false;
		if (window.currentCarData?.HEADER?.VERSION === 'extended-2') {
			detectedExtended = true;
		}
		if (window.currentSuspensionData?._EXTENSION || window.currentSuspensionData?._EXTENSION_FLEX) {
			detectedExtended = true;
		}
		window.isExtendedPhysicsEnabled = detectedExtended;
	}
	// 画面のスイッチを復元した状態に合わせて切り替える
	const masterSwitch = document.getElementById('extendedPhysicsSwitch');
	if (masterSwitch) {
		masterSwitch.checked = window.isExtendedPhysicsEnabled;
	}
	// =======================================================
	// 3. 各画面のUI更新 (タブの中身を再描画)
	// =======================================================
	if (typeof window.updateSuspensionEditorUI === 'function') window.updateSuspensionEditorUI(window.currentSuspensionData);
	if (typeof window.updateCarEditorUI === 'function') window.updateCarEditorUI(window.currentCarData);
	if (typeof window.updateTyreEditorUI === 'function') window.updateTyreEditorUI(window.currentTyreData);
	if (typeof window.initEngineEditor === 'function') window.initEngineEditor(window.currentEngineData);
	window.aeroWingBackup = {};
	if (typeof window.initAeroEditor === 'function') window.initAeroEditor(window.currentAeroData);
	if (typeof window.initSetupEditor === 'function') window.initSetupEditor(window.currentSetupData);
	if (typeof window.initColliderEditor === 'function') window.initColliderEditor(window.currentCarData);
	// ★追加：ui_carデータの復元
	if (files['ui_car']) {
		window.uiCarData = files['ui_car'].currentData;
		if (typeof window.updateUiCarData === 'function') {
			window.updateUiCarData(window.uiCarData);
		}
	}
	// =======================================================
	// 4. DRIVETRAINの復元
	// =======================================================
	if (files['drivetrain_sets']) {
		window.gearSetList = files['drivetrain_sets'].currentData;
		window.activeGearIdx = files['drivetrain_sets'].activeIndex || 0;
		if (typeof window.initDrivetrainEditor === 'function') window.initDrivetrainEditor();
		if (typeof window.renderDrivetrainUI === 'function') window.renderDrivetrainUI();
		if (typeof window.updateGearChart === 'function') window.updateGearChart();
	}
	// =======================================================
	// 5. CAMERAの完全復元とUI同期
	// =======================================================
	console.log("📸 [UI更新] カメラ設定の直接同期を開始します");
	if (files['camera_configs']) {
		window.cameraConfigs = files['camera_configs'].currentData;
		window.initialConfigs = JSON.parse(JSON.stringify(window.cameraConfigs));
		for (let i = 0; i < (window.NUM_CAMERAS || 6); i++) {
			const config = window.cameraConfigs[i];
			if (!config) continue;
			// 各プロパティをHTML要素に直接流し込む
			['x', 'y', 'z', 'rx', 'ry', 'rz', 'fov'].forEach(prop => {
				const input = document.querySelector(`.input-range[data-id="${i}"][data-prop="${prop}"]`);
				const display = document.querySelector(`.val-display.val-${prop}[data-id="${i}"]`);
				if (input && config[prop] !== undefined) {
					input.value = config[prop];
					// スライダーイベントを強制発火させて反映を確実にする
					if (typeof triggerEvents === 'function') {
						triggerEvents(input);
					}
					if (display) {
						const suffix = (prop.startsWith('r')) ? '°' : '';
						display.textContent = (prop === 'fov') ? Math.round(config[prop]) : Number(config[prop]).toFixed(3) + suffix;
					}
				}
			});
			// Three.js側のカメラオブジェクトを同期
			if (typeof window.updateUIFromConfig === 'function') {
				window.updateUIFromConfig(i);
			}
		}
	}
	if (files['camera_raw']) window.originalRawData = files['camera_raw'].currentData;
	// =======================================================
	// 6. 変更ステータス（modifiedStatus）の更新
	// =======================================================
	if (window.modifiedStatus) {
		const restoredFiles = Object.keys(files);
		restoredFiles.forEach(key => {
			const statusKey = key.replace('.ini', '');
			if (window.modifiedStatus[statusKey] !== undefined) {
				window.modifiedStatus[statusKey] = true;
			}
			if (key === 'camera_configs') window.modifiedStatus.cameras = true;
		});
	}
	// =======================================================
	// 7. 最終レンダリングとビジュアル更新
	// =======================================================
	if (typeof window.updateSuspensionVisuals === 'function') window.updateSuspensionVisuals(window.currentSuspensionData);
	if (typeof window.requestRender === 'function') window.requestRender();
	if (window.currentProject.files.ui_car && window.restoreUiCarData) {
		window.restoreUiCarData(window.currentProject.files.ui_car.currentData);
	}
	console.log("✅ [同期完了] すべてのデータが復元されました。");
	window.isRestoring = false;
	if (window.currentProject && window.currentProject.environment) {
        const env = window.currentProject.environment;
        const badgeImg = document.getElementById('ui-badge');

        if (badgeImg) {
            if (env.custom_badge_path) {
                // 1. もし「置換」ボタンで個別に選んだパスがあれば、そちらを優先して表示
                badgeImg.src = `file:///${env.custom_badge_path.replace(/\\/g, '/')}`;
                // 次回の「保存」に備えて、作業用変数(pendingBadgePath)も同期しておく
                window.pendingBadgePath = env.custom_badge_path;
                console.log(" [RESTORE] 置換されたカスタム画像を復元しました:", env.custom_badge_path);
            } else if (env.data_folder) {
                // 2. 個別パスが保存されていない場合は、標準の「車両フォルダ/ui/badge.png」を表示
                window.updateBadgeImage(env.data_folder);
            }
        }
    }
	if (typeof window.updateProjectSidebar === 'function') {
		window.updateProjectSidebar();
	}
	// =======================================================
	// 3. 各画面のUI更新 (タブの中身を再描画)
	// =======================================================
	if (typeof window.updateSuspensionEditorUI === 'function') window.updateSuspensionEditorUI(window.currentSuspensionData);
	// ... (既存のコード) ...
	if (typeof window.initColliderEditor === 'function') window.initColliderEditor(window.currentCarData);
	// 物理データに基づくスペック更新
	if (typeof window.updateSpecsFromPhysics === 'function') {
		window.updateSpecsFromPhysics();
	}
};
// 変更をブラウザに通知する（スライダー等を連動させるための魔法の関数）
function triggerEvents(element) {
	element.dispatchEvent(new Event('input', {
		bubbles: true
	}));
	element.dispatchEvent(new Event('change', {
		bubbles: true
	}));
}
// ==========================================
// ★ ファイル読み込み ＆ Stateへの保存
// ==========================================
function processImportedFile(fileName, rawText) {
	let parsedData = {};
	// 1. 拡張子によって解析方法を分ける
	if (fileName.endsWith('.lut')) {
		parsedData = analyzeLUT(rawText);
	} else if (fileName.endsWith('.ini')) {
		parsedData = analyzeINI(rawText);
	} else {
		return; // ini, lut 以外は無視
	}
	// 2. 「suspensions.ini」の「.ini」を消して「suspensions」にする
	const stateKey = fileName.replace('.ini', '').replace('.lut', '');
	// 3. アプリの記憶領域（State）にぶち込む！
	window.currentProject.files[stateKey] = {
		isModified: true,
		currentData: parsedData
	};
	console.log(`[メモリ保存] ${fileName} を解析し、Stateに保存しました。`, parsedData);
	// 4. UI（スライダー）をガチャン！と動かす
	if (typeof loadProjectToUI === 'function') {
		loadProjectToUI(window.currentProject);
	}
}
// INI解析用（あなたのテストコードを少し改良して関数化）
function analyzeINI(text) {
	const lines = text.split(/\r?\n/);
	let currentSection = null;
	const exportData = {};
	lines.forEach((line) => {
		let processingLine = line.trim();
		// コメント行や空行は無視
		if (!processingLine || processingLine.startsWith(';')) return;
		// セクション [FRONT] などの処理
		if (processingLine.startsWith('[') && processingLine.endsWith(']')) {
			currentSection = processingLine.slice(1, -1);
			exportData[currentSection] = {};
			return;
		}
		// キー=値 の処理
		if (currentSection && processingLine.includes('=')) {
			const parts = processingLine.split('=');
			const key = parts[0].trim();
			// コメントやタブを削ぎ落とす
			let cleanValue = parts.slice(1).join('=').split(';')[0].split('//')[0].replace(/\t/g, ' ').trim();
			exportData[currentSection][key] = cleanValue;
		}
	});
	return exportData;
}
// LUT解析用
function analyzeLUT(text) {
	const lines = text.split(/\r?\n/);
	const points = [];
	lines.forEach((line) => {
		const clean = line.split(';')[0].split('//')[0].trim();
		if (!clean) return;
		const parts = clean.split('|');
		if (parts.length === 2) {
			points.push({
				rpm: parseFloat(parts[0]),
				torque: parseFloat(parts[1])
			});
		}
	});
	return points; // [{rpm: 250, torque: 35}, ...] の形
}
// ==========================================
// ★ 「プロジェクトを保存」ボタン（手動保存）の処理
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
	const btnSaveProject = document.getElementById('btn-save-project');
	if (btnSaveProject) {
		btnSaveProject.addEventListener('click', async () => {
			console.log("--- 【SAVE START】 ---");
			// 1. アニメーション開始
			const originalText = btnSaveProject.textContent;
			btnSaveProject.textContent = "⏳ 保存中...";
			btnSaveProject.style.opacity = "0.5";
			btnSaveProject.style.pointerEvents = "none";
			if (!window.currentProject.files) window.currentProject.files = {};
			// --- 追加：環境情報（フォルダパスや置換した画像パス）の更新 ---
			window.currentProject.environment = {
					// 車両データ全体のフォルダパスを保持
					data_folder: window.currentDataFolderPath || "",
					// 3Dモデルのパスを保持（既存の値を優先）
					model_path: window.currentProject.environment?.model_path || "",
					// ★最重要：置換ボタンで選ばれた「新しいロゴ画像の絶対パス」を記録！
					custom_badge_path: window.pendingBadgePath || ""
			};
			// 2. 画面のデータをすべて回収（最新の全ファイルに対応）
			const dataMap = {
				'suspensions': window.currentSuspensionData,
				'tyres': window.currentTyreData,
				'car': window.currentCarData,
				'aero': window.currentAeroData,
				'engine': window.currentEngineData,
				'setup': window.currentSetupData,
				'drivetrain': window.currentDrivetrainData,
				// リスト・テキスト形式の重要データ
				'power_lut_raw': window.currentPowerLutRaw,
				'final_rto_list': window.finalRtoList,
				// 編集状態フラグ（オレンジ色のタグを復元するため）
				'modified_status': window.modifiedStatus,
				// カメラ
				'camera_configs': window.cameraConfigs,
				'camera_raw': window.originalRawData,
				'ui_car': (typeof window.collectUiCarData === 'function') ? window.collectUiCarData() : {},
			};
			console.log('DEBUG [SAVE] dataMapの中身:', dataMap);
			console.log("🔍 [SAVE DEBUG] ui_car の中身:", dataMap.ui_car);
			console.log("🔍 [SAVE DEBUG] キーの数:", Object.keys(dataMap.ui_car).length);
			for (const [key, data] of Object.entries(dataMap)) {
				if (data && (Array.isArray(data) ? data.length > 0 : Object.keys(data).length > 0)) {
					window.currentProject.files[key] = {
						currentData: data
					};
					console.log(`✅ [SAVE] ${key} を回収:`, data);
				} else {
					console.warn(`⚠️ [SAVE] ${key} は空または未定義です。`);
				}
			}
			// 複数ギアセットの回収
			if (window.gearSetList) {
				window.currentProject.files['drivetrain_sets'] = {
					currentData: window.gearSetList,
					activeIndex: window.activeGearIdx || 0
				};
				console.log("✅ [SAVE] drivetrain_sets を回収しました。");
			}
			// ★追加：拡張物理のON/OFF状態もプロジェクトデータに記憶させる
			if (!window.currentProject.environment) window.currentProject.environment = {};
			window.currentProject.environment.isExtendedPhysicsEnabled = (window.isExtendedPhysicsEnabled === true);
			// 1. ベース車両名と、画面に入力されていた車両名を保存
			window.currentProject.environment.base_car_name = window.currentCarDirectoryName || "";
			const nameInputEl = document.getElementById('new-car-project-name');
			window.currentProject.environment.output_car_name = nameInputEl ? nameInputEl.value : "";
			// 2. スキンリストと、現在選んでいるスキンの番号を保存
			window.currentProject.environment.all_car_skins = window.allCarSkins || [];
			window.currentProject.environment.current_skin_idx = window.currentSkinIdx || 0;
			// ★追加：上書き保存用の「データフォルダのパス」も一緒にセーブデータに記憶させる！
			window.currentProject.environment.data_folder = window.currentDataFolderPath || "";
			console.log("✅ [SAVE] 拡張物理の状態を回収しました:", window.currentProject.environment.isExtendedPhysicsEnabled);
			// 3. 最新データを回収した状態でのみ、保存（バックアップ作成）を実行
			try {
				const result = await window.electronAPI.saveProject(window.currentProject);
				if (result.success) {
					console.log("💾 [SAVE] ファイル書き込み成功");
					window.currentProjectPath = result.path; // パスを記憶
					if (window.modifiedStatus) {
						Object.keys(window.modifiedStatus).forEach(k => window.modifiedStatus[k] = false);
					}
					window.updateProjectSidebar(); // サイドバーを再描画して「*」を消す
					btnSaveProject.textContent = "✅ 保存完了";
					// 履歴リストを更新
					refreshRecentList();
				} else {
					alert("保存失敗: " + result.error);
					btnSaveProject.textContent = originalText;
				}
			} catch (err) {
				console.error("❌ [SAVE] エラー:", err);
				btnSaveProject.textContent = originalText;
			} finally {
				// 3秒後にボタンを元に戻す
				setTimeout(() => {
					btnSaveProject.textContent = originalText;
					btnSaveProject.style.opacity = "1";
					btnSaveProject.style.pointerEvents = "auto";
				}, 3000);
			}
		});
		/** 履歴リストを更新して画面に表示する関数 */
		async function refreshRecentList() {
			const listUl = document.getElementById('recent-projects-list');
			if (!listUl) return;
			try {
				const recentProjects = await window.electronAPI.getRecentProjects();
				listUl.innerHTML = '';
				if (!recentProjects || recentProjects.length === 0) {
					listUl.innerHTML = '<li class="empty-msg">最近の項目はありません</li>';
					return;
				}
				recentProjects.forEach(proj => {
					const li = document.createElement('li');
					li.className = 'recent-item';
					li.style.display = 'flex';
					li.style.justifyContent = 'space-between';
					li.style.alignItems = 'center';
					// 左側：プロジェクト情報
					const info = document.createElement('div');
					info.className = 'recent-info';
					info.style.flex = '1';
					info.style.cursor = 'pointer';
					info.innerHTML = `
                <strong style="color:#fff; display:block;">${proj.name}</strong>
                <small style="color:#888; font-size:10px;">${proj.path}</small>
            `;
					// クリックで開く
					info.addEventListener('click', async () => {
						const result = await window.electronAPI.loadProjectByPath(proj.path);
						if (result.success) {
							window.currentProject = result.data;
							window.currentProjectPath = proj.path; // ★ 追加
							window.loadProjectToUI(window.currentProject);
							document.getElementById('startup-hub').style.display = 'none';
							document.getElementById('wrapper').style.display = 'block';
						}
					});
					// 右側：削除ボタン
					const delBtn = document.createElement('button');
					delBtn.innerHTML = '🗑️'; // ゴミ箱アイコン
					delBtn.title = 'プロジェクトを削除';
					delBtn.style.background = 'none';
					delBtn.style.border = 'none';
					delBtn.style.cursor = 'pointer';
					delBtn.style.padding = '5px 10px';
					delBtn.style.fontSize = '16px';
					delBtn.style.opacity = '0.5';
					delBtn.addEventListener('mouseenter', () => delBtn.style.opacity = '1');
					delBtn.addEventListener('mouseleave', () => delBtn.style.opacity = '0.5');
					// 削除実行時の処理
					delBtn.addEventListener('click', async (e) => {
						e.stopPropagation(); // 親要素の「開く」イベントを防ぐ
						const confirmDelete = confirm(`【警告】\nプロジェクト「${proj.name}」をフォルダごと完全に削除しますか？\nこの操作は取り消せません。`);
						if (confirmDelete) {
							const result = await window.electronAPI.deleteProject(proj.path);
							if (result.success) {
								// 画面上のリストを即座に更新
								refreshRecentList();
							} else {
								alert("削除に失敗しました: " + result.error);
							}
						}
					});
					li.appendChild(delBtn);
					li.appendChild(info);
					listUl.appendChild(li);
				});
			} catch (err) {
				console.error("履歴取得エラー:", err);
			}
		}
		// 起動時に呼び出し
		refreshRecentList();
	}
	// ==========================================
	// ★ 復元（バックアップ）ボタンの処理
	// ==========================================
	const btnRestore = document.getElementById('btn-restore-project');
	if (btnRestore) {
		btnRestore.addEventListener('click', async () => {
			console.log("🔘 [RESTORE] 復元ボタンがクリックされました！"); // 通過チェック1
			if (!window.currentProjectPath) {
				console.warn("⚠️ [RESTORE] 保存パスがないため中断しました");
				alert("プロジェクトが一度も保存されていないため、復元できるバックアップがありません。");
				return;
			}
			console.log("📂 [RESTORE] 復元対象パス:", window.currentProjectPath); // 通過チェック2
			const confirmRestore = confirm("【注意】\n最後に保存した時の状態（バックアップ）に戻しますか？\n現在の未保存の編集内容は失われます。");
			if (confirmRestore) {
				try {
					console.log("⏳ [RESTORE] 裏側(Electron)へバックアップデータを要求します...");
					const result = await window.electronAPI.restoreProject(window.currentProjectPath);
					console.log("📥 [RESTORE] 裏側からデータが返ってきました:", result); // 通過チェック3
					if (result.success) {
						window.currentProject = result.data;
						console.log("🔄 [RESTORE] 画面更新(loadProjectToUI)を呼び出します...");
						window.loadProjectToUI(window.currentProject);
						alert("✅ バックアップから復元しました！");
					} else {
						alert("復元失敗: " + result.error);
					}
				} catch (err) {
					console.error("❌ [RESTORE] 致命的エラー発生:", err);
				}
			} else {
				console.log("🛑 [RESTORE] キャンセルされました");
			}
		});
	}
});
window.showCustomPrompt = function(message, defaultValue) {
	return new Promise((resolve) => {
		const overlay = document.createElement('div');
		overlay.classList.add('custom-prompt-overlay');
		const dialogBox = document.createElement('div');
		dialogBox.classList.add('custom-prompt-dialog');
		const msgLabel = document.createElement('label');
		msgLabel.textContent = message;
		msgLabel.classList.add('custom-prompt-message');
		const inputField = document.createElement('input');
		inputField.type = 'text';
		inputField.value = defaultValue;
		inputField.classList.add('custom-prompt-input');
		const btnContainer = document.createElement('div');
		btnContainer.classList.add('custom-prompt-actions');
		const cancelBtn = document.createElement('button');
		cancelBtn.textContent = 'キャンセル';
		const okBtn = document.createElement('button');
		okBtn.textContent = '保存';
		okBtn.classList.add('custom-prompt-btn', 'custom-prompt-ok');
		btnContainer.appendChild(cancelBtn);
		btnContainer.appendChild(okBtn);
		dialogBox.appendChild(msgLabel);
		dialogBox.appendChild(inputField);
		dialogBox.appendChild(btnContainer);
		overlay.appendChild(dialogBox);
		document.body.appendChild(overlay);
		inputField.focus();
		inputField.select();
		const closeDialog = (result) => {
			document.body.removeChild(overlay);
			resolve(result);
		};
		cancelBtn.addEventListener('click', () => closeDialog(null));
		okBtn.addEventListener('click', () => closeDialog(inputField.value));
		inputField.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') closeDialog(inputField.value);
			if (e.key === 'Escape') closeDialog(null);
		});
	});
}
// 各メニューの動作登録
window.electronAPI.onMenuSave(() => {
	const btn = document.getElementById('btn-save-project');
	if (btn) btn.click();
});
// ★追加：「保存して終了」を受け取った時の動作
if (window.electronAPI.onTriggerSaveAndClose) {
	window.electronAPI.onTriggerSaveAndClose(() => {
		const btn = document.getElementById('btn-save-project');
		if (btn) {
			btn.click(); // 1. 既存の保存ボタンをプログラムから押す
			// 2. 保存完了を待ってからアプリを強制終了する
			// データの回収と書き込み時間を考慮し、1.5秒待機します
			setTimeout(() => {
				if (window.electronAPI.forceQuit) {
					window.electronAPI.forceQuit();
				}
			}, 1500);
		} else {
			// エディター画面以外（保存ボタンがない画面）ならそのまま終了
			if (window.electronAPI.forceQuit) window.electronAPI.forceQuit();
		}
	});
}
window.electronAPI.onMenuSaveAs(async () => {
	const currentName = window.currentProject.projectName || "名称未設定";
	const newName = await showCustomPrompt("新しいプロジェクト名を入力してください:", currentName + "_copy");
	if (newName && newName.trim() !== "") {
		window.currentProject.projectName = newName.trim();
		const btn = document.getElementById('btn-save-project');
		if (btn) btn.click();
	}
});
window.electronAPI.onMenuRestore(() => {
	const btn = document.getElementById('btn-restore-project');
	if (btn) btn.click();
});
window.electronAPI.onMenuNew(() => {
	// Electron環境でも絶対に壊れないリロード方法
	window.location.search = "?action=newProject";
});
window.electronAPI.onMenuOpen(() => {
	const btn = document.getElementById('hub-open-project');
	if (btn) btn.click();
});
// =========================================================
// ★追加：メニューバーから「dataフォルダを一括読込」が選ばれた時の処理
// 既存のドラッグ＆ドロップ用ホワイトリスト処理をそのまま100%安全に使い回します
// =========================================================
if (window.electronAPI.onMenuImportFolderData) {
	window.electronAPI.onMenuImportFolderData((filesToSend) => {
		if (filesToSend && filesToSend.length > 0) {
			console.log(`[MENU-IMPORT] 裏側から ${filesToSend.length} 個のファイルデータを受信しました。読み込みを開始します。`);
			window.isMultiUploading = true;
			import('./js/import.js').then(module => {
				if (module.handleMultiFileUpload) {
					// 既存のマルチアップロード処理へそのまま流し込む！
					module.handleMultiFileUpload(filesToSend).then(() => {
						window.isMultiUploading = false;
						console.log("[MENU-IMPORT] メニューからのフォルダ一括読込がすべて完了しました！");
					});
				}
			}).catch(err => {
				console.error("[MENU-IMPORT] 処理中にエラーが発生しました:", err);
				window.isMultiUploading = false;
			});
		}
	});
}
/**
 * window.gearRtoList (または現在のデータ) から ratios.rto 用のテキストを生成する
 */
function generateRtoText() {
	// 全ての車両で共通の固定データを自動生成して書き出す
	const rtoLines = ["V160 1st|3.827", "R154 1st|3.251", "V160 2nd|2.360", "R154 2nd|1.955", "V160 3rd|1.685", "R154 3rd|1.310", "V160 4th|1.312", "R154 4th|1.000", "V160 5th|1.000", "R154 5th|0.753", "V160 6th|0.793", "", // 最後の空行用
		"" // 最後の空行用
	];
	// Assetto Corsa の仕様に合わせて Windows形式 (\r\n) で改行して結合
	return rtoLines.join('\r\n');
}
// ==========================================
// ★ 拡張物理スイッチと各データの自動連動
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
	const masterSwitch = document.getElementById('extendedPhysicsSwitch');
	if (masterSwitch) {
		masterSwitch.addEventListener('change', (e) => {
			const isExtended = e.target.checked;
			window.isExtendedPhysicsEnabled = isExtended;
			// 1. car.ini (コライダー等) の VERSION 書き換え
			if (window.currentCarData && window.currentCarData.HEADER) {
				window.currentCarData.HEADER.VERSION = isExtended ? 'extended-2' : '1';
			}
			// 2. suspensions.ini の VERSION とデフォルト値書き換え
			if (window.currentSuspensionData) {
				if (window.currentSuspensionData.HEADER) {
					window.currentSuspensionData.HEADER.VERSION = isExtended ? 'extended-2' : '2';
				}
				if (isExtended) {
					if (!window.currentSuspensionData._EXTENSION) {
						window.currentSuspensionData._EXTENSION = {
							TORQUE_MODE_EX: '2',
							FIX_PROGRESSIVE_RATE: '1'
						};
					}
					if (!window.currentSuspensionData._EXTENSION_FLEX) {
						window.currentSuspensionData._EXTENSION_FLEX = {
							TORSIONAL_STIFFNESS: '12000',
							TORSIONAL_DAMPING: '150'
						};
					}
				}
			}
			// 3. 画面の再描画（UIエディターをリフレッシュして書き換わったデータを表示する）
			if (typeof window.updateSuspensionEditorUI === 'function') {
				window.updateSuspensionEditorUI(window.currentSuspensionData);
			}
			if (typeof window.initColliderEditor === 'function') {
				window.initColliderEditor(window.currentCarData);
			}
			if (typeof window.initAeroEditor === 'function' && window.currentAeroData) {
				window.initAeroEditor(window.currentAeroData);
			}
			// 4. 変更フラグを立てる（保存時にMODIFIEDマークを出すため）
			if (window.modifiedStatus) {
				window.modifiedStatus.car = true;
				window.modifiedStatus.suspensions = true;
				window.modifiedStatus.aero = true;
			}
		});
	}
});
// ==========================================
// アプリ全体共通：Shiftキー ＋ 上下矢印キーで数値の変化量（位）を10倍に変える処理
// ==========================================
document.addEventListener('keydown', (e) => {
	// フォーカスされているのが数値入力欄（type="number"）の場合のみ発動
	if (e.target.tagName === 'INPUT' && e.target.type === 'number') {
		// Shiftキーが押されていて、かつ上下矢印キーの場合
		if (e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
			e.preventDefault(); // デフォルトの1ステップ増減をキャンセル
			// 現在の入力欄に設定されているstep値を取得（設定されていなければ1）
			const step = parseFloat(e.target.step) || 1;
			// Shiftキーを押している時の倍率（10倍）
			const multiplier = 10;
			const customStep = step * multiplier;
			let currentValue = parseFloat(e.target.value) || 0;
			if (e.key === 'ArrowUp') {
				currentValue += customStep;
			} else if (e.key === 'ArrowDown') {
				currentValue -= customStep;
			}
			// 浮動小数点の計算誤差（0.10000000001みたいな数字）を防ぐ処理
			const stepStr = customStep.toString();
			const decimalPlaces = stepStr.includes('.') ? stepStr.split('.')[1].length : 0;
			// 値を更新
			e.target.value = currentValue.toFixed(decimalPlaces);
			// 値が変更されたことをシステムに通知（タイヤグラフや他のプレビューを自動連動させる）
			e.target.dispatchEvent(new Event('input', {
				bubbles: true
			}));
			e.target.dispatchEvent(new Event('change', {
				bubbles: true
			}));
		}
	}
});
// =========================================================
// ★ 画面全体へのドラッグ＆ドロップ機能（フォルダ展開対応）
// 既存の読み込み機能を一切潰さず、フォルダドロップ機能だけを強化します
// =========================================================
document.addEventListener('dragover', (e) => {
	e.preventDefault();
	e.stopPropagation();
	// ここにドロップ時のエフェクト（画面を暗くするなど）を入れることも可能です
});
document.addEventListener('drop', async (e) => {
	e.preventDefault();
	e.stopPropagation();
	// ファイルまたはフォルダがドロップされたか確認
	if (!e.dataTransfer.items) return;
	let filesToProcess = [];
	// フォルダの中身を再帰的（奥の奥まで）に取得する関数
	const traverseFileTree = (item) => {
		return new Promise((resolve) => {
			if (item.isFile) {
				item.file(file => resolve([file]));
			} else if (item.isDirectory) {
				const dirReader = item.createReader();
				const allEntries = [];
				const readRecursive = () => {
					dirReader.readEntries(async (entries) => {
						if (entries.length > 0) {
							allEntries.push(...entries);
							readRecursive();
						} else {
							// console.log(`[DEBUG] 現在探索中: ${item.name}`);
							if (item.name === 'ui') {
								console.log(`[DEBUG] UIフォルダ内のエントリ数: ${allEntries.length}`);
								allEntries.forEach(entry => {
									// console.log(`[DEBUG] 探索中のファイル名: ${entry.name}`);
									if (entry.name.toLowerCase() === 'badge.png') {
										// console.log(`[DEBUG] badge.png を発見しました！`);
										entry.file(file => {
											const badgeImg = document.getElementById('ui-badge');
											// console.log(`[DEBUG] ui-badge 要素の存在確認: ${!!badgeImg}`);
											if (badgeImg) {
												const formattedPath = file.path.replace(/\\/g, '/');
												// console.log(`[DEBUG] セットするパス: ${formattedPath}`);
												// badgeImg.src = 'file:///' + formattedPath;
												badgeImg.src = URL.createObjectURL(file);
											}
										});
									}
								});
							}
							let entryFiles = [];
							for (let entry of allEntries) {
								const files = await traverseFileTree(entry);
								entryFiles = entryFiles.concat(files);
							}
							resolve(entryFiles);
						}
					});
				};
				readRecursive();
			} else {
				resolve([]);
			}
		});
	};
	window.isMultiUploading = true;
	// ドロップされたアイテム（ファイルやフォルダ）を順番に展開
	for (let i = 0; i < e.dataTransfer.items.length; i++) {
		const item = e.dataTransfer.items[i].webkitGetAsEntry();
		if (item) {
			const extractedFiles = await traverseFileTree(item);
			filesToProcess = filesToProcess.concat(extractedFiles);
		}
	}
	if (filesToProcess.length > 0) {
		console.log(`[D&D] ${filesToProcess.length}個のファイルを検出しました。読み込みを開始します。`);
		try {
			console.log("🚀 [Phase A] 読み込みプロセスに入りました (isMultiUploading=true)");
			window.isMultiUploading = true;

			const module = await import('./js/import.js');
			if (module.handleMultiFileUpload) {
				await module.handleMultiFileUpload(filesToProcess);
				console.log("✅ [Phase B] handleMultiFileUpload が正常終了しました");
			}
		} catch (err) {
			console.error("❌ [ERROR] 読み込み中に致命的なエラーを検知しました:", err);
		} finally {
			window.isMultiUploading = false;
			if (typeof window.updateSpecsFromPhysics === 'function') {
					window.updateSpecsFromPhysics();
			}
			console.log("🏁 [Phase C] 旗(isMultiUploading)を false に戻しました");
		}
	} else {
		window.isMultiUploading = false;
	}
});
// ACフォルダ選択ボタン（ご自身でHTMLに追加したボタンのIDに合わせてください）
// --- 1. 車両リストを更新する共通関数 (新設) ---
window.refreshCarList = async function(acRoot) {
	const carSelect = document.getElementById('ac-car-select');
	const acPathInput = document.getElementById('ac-root-path');
	if (!carSelect || !acRoot) return;
	if (acPathInput) acPathInput.value = acRoot;
	// ★修正：すでに content\cars が含まれているパスならそのまま、そうでなければ付与して探りに行く
	const carsPath = (acRoot.endsWith('content\\cars') || acRoot.endsWith('content/cars')) ? acRoot : acRoot + "\\content\\cars";
	const res = await window.electronAPI.getFolderList(carsPath);
	if (res.success) {
		carSelect.innerHTML = '<option value="">-- 車両を選択してください --</option>';
		res.folders.forEach(carDir => {
			const opt = document.createElement('option');
			opt.value = carDir;
			opt.textContent = carDir;
			carSelect.appendChild(opt);
		});
		console.log("✅ [System] 車両リストを自動更新しました。");
	}
}
// --- 2. ACフォルダ選択ボタン & 選択時の挙動 (更新) ---
const btnSelectAC = document.getElementById('btn-select-ac-path');
const carSelect = document.getElementById('ac-car-select');
if (btnSelectAC) {
	btnSelectAC.addEventListener('click', async () => {
		const path = await window.electronAPI.openDirectoryDialog();
		if (path) {
			// 💾 100%の事実：AppStorage [cite: 616] を使ってPCに記憶させます
			if (typeof AppStorage !== 'undefined') {
				AppStorage.save('ac_root_path', path);
			}
			refreshCarList(path);
		}
	});
}
if (carSelect) {
	carSelect.addEventListener('change', () => {
		const newNameInput = document.getElementById('new-car-project-name');
		if (newNameInput && carSelect.value !== "") {
			newNameInput.value = carSelect.value + "_mod";
		}
	});
}
// ★ 修正版：D&Dと全く同じ仕組みで、データの反映までを「自然に」待つ命令
async function loadCarToEditor(carFullPath, carDirName) {
	// 🌟 読み込み開始！
    if (typeof window.updateLoadingProgress === 'function') {
        window.updateLoadingProgress(10, `「${carDirName}」を読み込み中...`, "初期化しています...");
    }
	// 1. D&Dと同じ「一括処理中フラグ」を立てて、途中のUI更新を一時停止させる
	window.isMultiUploading = true;
	// 2. 裏側(Electron)にフォルダ内のINIやKN5のリストアップを依頼
	const res = await window.electronAPI.readCarFolderData(carFullPath);
	if (res.success) {
		window.currentCarDirectoryName = carDirName;
		const exportNameInput = document.getElementById('exportProjectName');
		if (exportNameInput) exportNameInput.value = carDirName;
		// 3. 全ファイル（.kn5を含む）を import.js の一括処理へ渡す
		// ここで await することで、SDKによるFBXの展開が終わるまで「しっかり待ちます」
		const importModule = await import('./js/import.js');
		await importModule.handleMultiFileUpload(res.files);
		// ★追加：スキンギャラリーの初期化
		if (res.skins && typeof window.initSkinGallery === 'function') {
			window.initSkinGallery(res.skins);
		}
		if (window.currentDataFolderPath && typeof window.updateBadgeImage === 'function') {
			window.updateBadgeImage(window.currentDataFolderPath);
		}
		// --- ★ここからが「D&Dと同じ読み込み」の核心 ---
		// 4. 全ての準備が整ったので、一括処理フラグを解除する
		window.isMultiUploading = false;
		// 5. 貯蔵庫(ini_DATA)にある全データを、一斉に各エディターの画面へ反映させる
		// （D&Dの完了時と全く同じ「自動巡回」ルートです）
		Object.keys(window.ini_DATA).forEach(fileName => {
			importModule.applyIniData(fileName, window.ini_DATA[fileName]);
		});
		// 6. 最後に物理スペック（馬力など）を計算して完成
		if (typeof window.updateSpecsFromPhysics === 'function') window.updateSpecsFromPhysics();
		// --- ★追加：すべての処理（FBX展開・INI解析）が完了したことを確認 ---
		if (window.isMultiUploading === false) {
			// 画面を切り替えてエディターを表示
			const hub = document.getElementById('startup-hub');
			const wrapper = document.getElementById('wrapper');
			if (hub) hub.style.opacity = "0";
			setTimeout(() => {
				if (hub) hub.style.display = 'none';
				if (wrapper) wrapper.style.display = 'block';
				console.log("✅ 全ファイルの正常確認が完了。エディターを表示します。");
			}, 300);
		}
	} else {
		window.isMultiUploading = false;
		alert("読み込みエラー: " + res.error);
	}
}
const btnExecuteCreation = document.getElementById('btn-execute-car-creation');
const btnEditSelected = document.getElementById('btn-edit-selected-car'); // ★追加
// 案：複製して新規作成
if (btnExecuteCreation) {
	btnExecuteCreation.addEventListener('click', async () => {
		const acRoot = document.getElementById('ac-root-path').value;
		const selectedCar = document.getElementById('ac-car-select').value;
		const newCarName = document.getElementById('new-car-project-name').value.trim();
		if (!acRoot || !selectedCar || !newCarName) return alert("必要事項をすべて入力してください。");
		// 【100%の事実に基づく整合性修正】
		// refreshCarListと同じく、content\\cars を含むかどうかを自動判別します
		const isAcStructure = (acRoot.endsWith('content\\cars') || acRoot.endsWith('content/cars'));
		const carsBase = isAcStructure ? acRoot : acRoot + "\\content\\cars";
		// 1次試行：アセットコルサ構造でパスを作成
		let sourcePath = carsBase + "\\" + selectedCar;
		let targetPath = carsBase + "\\" + newCarName;
		// もしアセットコルサ構造でフォルダが存在しない場合は、選択されたパスを「そのまま」使用（デスクトップ用）
		const checkOrigin = await window.electronAPI.checkFolderExists("", sourcePath);
		if (!checkOrigin) {
			sourcePath = acRoot + "\\" + selectedCar;
			targetPath = acRoot + "\\" + newCarName;
		}
		console.log("📂 [Debug] 複製元:", sourcePath);
		const cloneRes = await window.electronAPI.cloneCarFolder(sourcePath, targetPath);
		if (cloneRes.success) {
			await loadCarToEditor(targetPath, newCarName);
		} else {
			alert("複製エラー: " + cloneRes.error);
		}
	});
}
// --- 案：この車両を編集（直接読込・整合性修正版） ---
if (btnEditSelected) {
	btnEditSelected.addEventListener('click', async () => {
		const acRoot = document.getElementById('ac-root-path').value;
		const selectedCar = document.getElementById('ac-car-select').value;
		if (!acRoot || !selectedCar) return alert("車両を選択してください。");
		const newNameInput = document.getElementById('new-car-project-name');
		if (newNameInput) newNameInput.value = selectedCar;
		// 【100%の事実に基づく整合性修正】
		const isAcStructure = (acRoot.endsWith('content\\cars') || acRoot.endsWith('content/cars'));
		const carsBase = isAcStructure ? acRoot : acRoot + "\\content\\cars";
		// まずアセットコルサ構造を試し、無ければそのままのパスを使用（デスクトップ用）
		let carFullPath = carsBase + "\\" + selectedCar;
		const checkOrigin = await window.electronAPI.checkFolderExists("", carFullPath);
		if (!checkOrigin) {
			carFullPath = acRoot + "\\" + selectedCar;
		}
		console.log("📂 [Debug] 直接読込先:", carFullPath);
		await loadCarToEditor(carFullPath, selectedCar);
	});
}
// --- 3. アプリ起動時に記憶していたパスを復元する ---
document.addEventListener('DOMContentLoaded', () => {
	if (typeof AppStorage !== 'undefined') {
		const savedPath = AppStorage.load('ac_root_path');
		if (savedPath) {
			console.log("📂 記憶されていたACパスを復元します:", savedPath);
			refreshCarList(savedPath);
		}
	}
});