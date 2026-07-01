// js/export.js
if (window.electronAPI && window.electronAPI.onMenuRequestExport) {
	window.electronAPI.onMenuRequestExport(() => {
		// 個別にリストを作らず、import.js 側の「名前セット機能付き」関数を呼び出す
		if (typeof window.openExportModal === 'function') {
			window.openExportModal();
		}
	});
}
document.addEventListener('DOMContentLoaded', () => {
	const closeBtn = document.getElementById('closeExportBtn');
	const execBtn = document.getElementById('executeExportBtn');
	if (closeBtn) {
		closeBtn.onclick = () => {
			document.getElementById('exportModal').style.display = 'none';
		};
	}
	if (execBtn) {
		execBtn.onclick = window.executeBulkExport;
	}
});
/**
 * まとめて書き出し実行（新・司令塔）
 * Electron側のフォルダ選択・ファイル生成APIと連携します。
 */
window.executeBulkExport = async function() {
	console.log("🚀 [DEBUG] executeBulkExport が開始されました");
	const overwriteSwitch = document.getElementById('overwriteSwitch');
	const isOverwrite = overwriteSwitch ? overwriteSwitch.checked : false;
	// --- 1. プロジェクト名（フォルダ名）を入力欄から取得 ---
	const nameInput = document.getElementById('exportProjectName');
	const projectName = nameInput ? nameInput.value.trim() : "Unknown-Car";
	// フォルダ名に使用できない禁止文字をアンダースコアに置換
	const safeProjectName = projectName.replace(/[\\/:*?"<>|]/g, "_");
	const exportFolderName = safeProjectName; // -data-file を削除
	// --- 2. 保存先のベースとなるフォルダを選択させる（OFFの時のみ） ---
	let baseDir = null;
	// ★追加：スイッチが「OFF」の時だけダイアログを開いて保存先を聞く
	if (!isOverwrite) {
		baseDir = await window.electronAPI.openDirectoryDialog();
		if (!baseDir) {
			console.log("⚠️ [DEBUG] フォルダ選択がキャンセルされました");
			return;
		}
	}
	let viewIniContent = null; // ★追加：マイドキュメント仕分け用の変数
	const filesToExport = [];
	// --- 3. 選択されたファイルのデータを順番に収集 ---
	for (const file of window.EXPORT_CONFIG) {
		const checkbox = document.getElementById(`check-${file.id}`);
		if (checkbox && checkbox.checked) {
			// 🔒 安全ガード：インポートされていない空欄のデータは、チェックが入っていても書き出し対象から除外
			// ★修正：view と dash_cam の安全ガードを追加（carデータがあれば書き出し可能）
			if (file.id === 'view' && !window.currentCarData) continue;
			if (file.id === 'dash_cam' && !window.currentCarData) continue;
			if (file.id === 'tyres' && (!window.tyreCompoundList || window.tyreCompoundList.length === 0)) continue;
			if (file.id === 'suspension' && !window.currentSuspensionData) continue;
			if (file.id === 'car' && !window.currentCarData) continue;
			if (file.id === 'engine' && !window.currentEngineData) continue;
			if (file.id === 'aero' && !window.currentAeroData) continue;
			if (file.id === 'setup' && !window.currentSetupData) continue;
			if (file.id === 'mirrors' && !window.currentMirrorsData) continue;
			const getFunc = window[file.func];
			console.log(`📄 [DEBUG] ファイル収集中: ${file.name} (関数: ${file.func})`);
			if (typeof getFunc === 'function') {
				try {
					// 引数に true を渡して文字列を取得
					const content = getFunc(true);
					if (content) {
						// ==========================================
						// ★ここが3分岐の仕分けコア：view.ini の場合は data フォルダに入れない
						// ==========================================
						if (file.id === 'view' && isOverwrite) {
							viewIniContent = content;
							console.log(`   └ 💺 view.ini は上書きモードのためマイドキュメント保存用へ仕分けました`);
						} else {
							filesToExport.push({
								name: file.name,
								content: content
							});
							console.log(`   └ ✅ データ取得成功 (${content.length} 文字)`);
						}
					} else {
						console.warn(`   └ ⚠️ 関数から空のデータが返されました: ${file.func}`);
					}
				} catch (err) {
					console.error(`   └ ❌ [ERROR] ${file.name} のデータ収集中に失敗しました:`, err);
				}
			} else {
				console.error(`   └ ❌ 関数が見つかりません: ${file.func}`);
			}
		}
	}
	// ★ タイヤのLUTファイルを動的に生成して書き出しリストに追加
	if (window.tyreCompoundList && window.tyreCompoundList.length > 0) {
		// 🕵️ 元のデータから「本物の既存のLUTファイル名」を収集（クノス標準名は意図的に除外し、初期化時の誤判定を防ぐ）
		const originalLutNames = new Set();
		window.tyreCompoundList.forEach(c => {
			if (c.raw_ini) {
				for (let sec in c.raw_ini) {
					if (c.raw_ini[sec]) {
						if (c.raw_ini[sec].WEAR_CURVE) {
							const lut = c.raw_ini[sec].WEAR_CURVE.trim().toLowerCase();
							if (lut !== 'kunos_wear.lut' && lut !== 'kunos_thermal.lut') {
								originalLutNames.add(lut);
							}
						}
						if (c.raw_ini[sec].PERFORMANCE_CURVE) {
							const lut = c.raw_ini[sec].PERFORMANCE_CURVE.trim().toLowerCase();
							if (lut !== 'kunos_wear.lut' && lut !== 'kunos_thermal.lut') {
								originalLutNames.add(lut);
							}
						}
					}
				}
			}
		});
		// 同一ファイル名が複数回リストに追加されるのを防ぐためのガード用Set
		const addedLutFiles = new Set();
		window.tyreCompoundList.forEach(comp => {
			const suffix = comp.index === 0 ? '' : `_${comp.index}`;
			const fSec = `FRONT${suffix}`;
			const rSec = `REAR${suffix}`;
			const tfSec = `THERMAL_FRONT${suffix}`;
			const trSec = `THERMAL_REAR${suffix}`;
			const fData = comp.data.FRONT || {};
			const rData = comp.data.REAR || {};
			const tfData = comp.data.THERMAL_FRONT || {};
			const trData = comp.data.THERMAL_REAR || {};
			const power = comp.wizardPower || 300;
			const pattern = document.getElementById('wiz-lut-pattern') ? document.getElementById('wiz-lut-pattern').value : 'A';
			const nameSuffix = (pattern === 'A') ? `_${comp.name.toLowerCase()}` : '';
			// 1️⃣ FRONTの摩耗LUT
			let fWearName = fData.WEAR_CURVE ? fData.WEAR_CURVE.trim() : "";
			if (!fWearName || !originalLutNames.has(fWearName.toLowerCase())) {
				if (!fWearName) {
					fWearName = `wcurve_front${nameSuffix}.lut`;
					fData.WEAR_CURVE = fWearName;
				}
				const fWearNameLower = fWearName.toLowerCase();
				if (!addedLutFiles.has(fWearNameLower)) {
					const fWearContent = `0|100\n0.005|95\n0.008|98\n0.015|100\n1.5|100\n3|99.5\n6|99\n9|98.5\n12|80\n15|70\n18|65\n21|60\n24|50`;
					filesToExport.push({
						name: fWearName,
						content: fWearContent
					});
					addedLutFiles.add(fWearNameLower);
				}
			}
			// ② REARの摩耗LUT
			let rWearName = rData.WEAR_CURVE ? rData.WEAR_CURVE.trim() : "";
			if (!rWearName || !originalLutNames.has(rWearName.toLowerCase())) {
				if (!rWearName) {
					rWearName = `wcurve_rear${nameSuffix}.lut`;
					rData.WEAR_CURVE = rWearName;
				}
				const rWearNameLower = rWearName.toLowerCase();
				if (!addedLutFiles.has(rWearNameLower)) {
					const peak = (0.015 + (power / 600) * 0.655).toFixed(3);
					const rWearContent = `0|100\n0.005|95\n0.008|98\n${peak}|100\n1.5|100\n3|99.5\n6|99\n9|98.5\n12|80\n15|70\n18|65\n21|60\n24|50`;
					filesToExport.push({
						name: rWearName,
						content: rWearContent
					});
					addedLutFiles.add(rWearNameLower);
				}
			}
			// ③ FRONTの温度熱ダレLUT
			let fPerfName = tfData.PERFORMANCE_CURVE ? tfData.PERFORMANCE_CURVE.trim() : "";
			if (!fPerfName || !originalLutNames.has(fPerfName.toLowerCase())) {
				if (!fPerfName) {
					fPerfName = `tcurve_front${nameSuffix}.lut`;
					tfData.PERFORMANCE_CURVE = fPerfName;
				}
				const fPerfNameLower = fPerfName.toLowerCase();
				if (!addedLutFiles.has(fPerfNameLower)) {
					const tContent = `0|0.800\n30|0.950\n60|1.000\n90|1.000\n120|0.996\n150|0.990\n180|0.984\n210|0.978\n240|0.977\n270|0.976\n300|0.975\n330|0.950\n360|0.925\n390|0.900\n420|0.800`;
					filesToExport.push({
						name: fPerfName,
						content: tContent
					});
					addedLutFiles.add(fPerfNameLower);
				}
			}
			// ④ REARの温度熱ダレLUT
			let rPerfName = trData.PERFORMANCE_CURVE ? trData.PERFORMANCE_CURVE.trim() : "";
			if (!rPerfName || !originalLutNames.has(rPerfName.toLowerCase())) {
				if (!rPerfName) {
					rPerfName = `tcurve_rear${nameSuffix}.lut`;
					trData.PERFORMANCE_CURVE = rPerfName;
				}
				const rPerfNameLower = rPerfName.toLowerCase();
				if (!addedLutFiles.has(rPerfNameLower)) {
					const tContent = `0|0.800\n30|0.950\n60|1.000\n90|1.000\n120|0.996\n150|0.990\n180|0.984\n210|0.978\n240|0.977\n270|0.976\n300|0.975\n330|0.950\n360|0.925\n390|0.900\n420|0.800`;
					filesToExport.push({
						name: rPerfName,
						content: tContent
					});
					addedLutFiles.add(rPerfNameLower);
				}
			}
		});
	}
	if (filesToExport.length === 0) {
		alert("書き出し可能なデータがありませんでした。F12のログを確認してください。");
		return;
	}
	// ★修正：drivetrain.ini が書き出される時 ＆ ギアセットが1つの時だけ ratios.rto を追加
	const isDrivetrainExported = filesToExport.some(f => f.name === 'drivetrain.ini');
	if (isDrivetrainExported && window.gearSetList && window.gearSetList.length === 1) {
		console.log("⚙️ drivetrain.ini出力＆ギア1つのため、ratios.rto を送信リストに追加します。");
		filesToExport.push({
			name: 'ratios.rto',
			content: "V160 1st|3.827\r\nR154 1st|3.251\r\nV160 2nd|2.360\r\nR154 2nd|1.955\r\nV160 3rd|1.685\r\nR154 3rd|1.310\r\nV160 4th|1.312\r\nR154 4th|1.000\r\nV160 5th|1.000\r\nR154 5th|0.753\r\nV160 6th|0.793\r\n\r\n"
		});
	}
	console.log("📤 [DEBUG] Electronへ送信するファイルリスト:", filesToExport);
	console.log("🔍 [事実確認] 現在のデータフォルダの記憶:", window.currentDataFolderPath);
	console.log("🔍 [事実確認] スイッチの状態:", isOverwrite);
	if (!isOverwrite) {
		const folderExists = await window.electronAPI.checkFolderExists(baseDir, exportFolderName);
		if (folderExists) {
			const confirmOverwrite = confirm(`警告：既にフォルダ「${exportFolderName}」が存在します。\n中身を上書きしてもよろしいですか？`);
			if (!confirmOverwrite) {
				console.log("⚠️ [DEBUG] ユーザーにより上書きがキャンセルされました");
				return; // 処理を中断
			}
		}
	}
	// --- 4. Electronのメインプロセスに「フォルダ作成」と「一括保存」を依頼 ---
	let exportSuccess = true;
	let dataResultPath = "";
	if (filesToExport.length > 0) {
		const result = await window.electronAPI.exportFilesToFolder(baseDir, projectName, window.EXPORT_CONFIG, isOverwrite, window.pendingBadgePath || null);
		console.log("🏁 [DEBUG] 書き出し結果:", result);
		if (result && result.success) {
			dataResultPath = result.path;
		} else {
			exportSuccess = false;
			alert("書き出しに失敗しました。\n" + (result ? result.error : "不明なエラー"));
			return;
		}
	}
	// ==========================================
	// 💺 【3分岐の自動仕分け】上書きモードで、収集された viewIniContent があれば、マイドキュメントへダイレクトに保存
	// ==========================================
	if (isOverwrite && viewIniContent) {
		if (window.electronAPI && window.electronAPI.saveViewIni) {
			// インポート時にガチッと特定した本物の「車名（小文字対応）」のフォルダへ送る
			const carName = window.currentCarDirectoryName || exportFolderName;
			const viewResult = await window.electronAPI.saveViewIni(carName, viewIniContent);
			if (viewResult && viewResult.success) {
				console.log(`💺 [発見] マイドキュメントの view.ini 自動仕分け保存に成功しました: ${viewResult.path}`);
			} else {
				exportSuccess = false;
				alert("マイドキュメントへの view.ini 保存に失敗しました。\n" + (viewResult ? viewResult.error : ""));
				return;
			}
		}
	}
	// すべての保存ルートが成功したら、わかりやすい仕分け内訳をポップアップで報告
	if (exportSuccess) {
		let successMsg = `🎉 書き出しが完全に完了しました！\n\n`;
		if (filesToExport.length > 0) {
			successMsg += `📁 dataフォルダ ➔ ${filesToExport.length} 個のファイルを保存しました\n`;
		}
		if (viewIniContent) {
			successMsg += `💺 マイドキュメント ➔ view.ini を適切なフォルダへ自動仕分け保存しました\n`;
		}
		alert(successMsg);
		document.getElementById('exportModal').style.display = 'none';
	}
};
// =========================================================
// ★ 欠落していたボタンのイベント紐付け（超重要）
// =========================================================
document.addEventListener('DOMContentLoaded', () => {
	const openBtn = document.getElementById('openExportModalBtn');
	const closeBtn = document.getElementById('closeExportBtn');
	const execBtn = document.getElementById('executeExportBtn');
	// window.openExportModal は import.js 側で定義されているものを使用します
	if (openBtn) {
		openBtn.onclick = () => {
			if (typeof window.openExportModal === 'function') {
				window.openExportModal();
			} else {
				console.error("openExportModal function not found.");
			}
		};
	}
	if (closeBtn) {
		closeBtn.onclick = () => {
			const modal = document.getElementById('exportModal');
			if (modal) modal.style.display = 'none';
		};
	}
	if (execBtn) {
		execBtn.onclick = window.executeBulkExport;
	}
});
// ★追加：リアルタイム連動（デバウンス）ロジック
let syncTimer = null;
window.triggerLiveSync = function() {
	const syncSwitch = document.getElementById('liveSyncSwitch');
	if (!syncSwitch || !syncSwitch.checked || !window.currentDataFolderPath) return;
	// すでにタイマーが動いていたらリセット（操作が止まるまで待つ）
	if (syncTimer) clearTimeout(syncTimer);
	syncTimer = setTimeout(async () => {
		console.log("🔄 [LIVE SYNC] 自動書き出しを実行中...");
		// executeBulkExportを「上書きモード」かつ「通知なし」で実行する仕組み
		// ここでは簡易的に、現在編集中の全ファイルを data フォルダへ流し込みます
		const filesToExport = [];
		for (const file of window.EXPORT_CONFIG) {
			// 1. 🛡️ 安全ガード：データが読み込まれていない項目はスキップ
			if (file.id === 'view' && !window.currentCarData) continue;
			if (file.id === 'dash_cam' && !window.currentCarData) continue;
			if (file.id === 'tyres' && (!window.tyreCompoundList || window.tyreCompoundList.length === 0)) continue;
			if (file.id === 'suspensions' && !window.currentSuspensionData) continue;
			if (file.id === 'car' && !window.currentCarData) continue;
			if (file.id === 'engine' && !window.currentEngineData) continue;
			if (file.id === 'aero' && !window.currentAeroData) continue;
			if (file.id === 'setup' && !window.currentSetupData) continue;
			if (file.id === 'mirrors' && !window.currentMirrorsData) continue;
			if (file.id === 'drivetrain' && !window.currentDrivetrainData) continue;
			// 2. ⚡ 効率化 ＆ クラッシュ防止：
			// マウス操作で実際に編集された（modifiedStatusがtrue）ファイルのみを処理対象にします。
			// これにより、起動時の「自動復元」による勝手な上書きを完全にブロックします。
			const statusKey = (file.id === 'view' || file.id === 'dash_cam') ? 'car' : file.id;
			if (!window.modifiedStatus || !window.modifiedStatus[statusKey]) continue;
			const getFunc = window[file.func];
			if (typeof getFunc === 'function') {
				const content = getFunc(true);
				if (content) {
					// ★ここを追加：view.ini の場合は data 用リストに入れず、専用変数に保管
					if (file.id === 'view') {
						viewIniContent = content;
					} else {
						filesToExport.push({
							name: file.name,
							content: content
						});
					}
				}
				console.log("🔍 [LIVE SYNC] 送信対象のファイル数:", filesToExport.length);
			}
		}
		// 3. 変更があったファイルがある場合のみ、Electron経由で実ファイルを上書き
		if (filesToExport.length > 0) {
			console.log(`📤 [LIVE SYNC] ${filesToExport.length}個の変更を反映中...`);
			await window.electronAPI.exportFilesToFolder(null, "", filesToExport, true, window.currentDataFolderPath);
			// ★ここを追加：保管された view.ini のデータがあれば、マイドキュメントへ保存
			if (window.uiCarData) {
            const uiJsonContent = JSON.stringify(window.uiCarData, null, 2);
            filesToExport.push({ name: 'ui_car.json', content: uiJsonContent, isUiFile: true });
        }

        if (filesToExport.length > 0) {
            console.log(`📤 [LIVE SYNC] ${filesToExport.length}個の変更を反映中...`);
            // ★重要：ui_car.json だけ保存先が data の隣の ui フォルダなので、Electron側で判定させる
            await window.electronAPI.exportFilesToFolder(null, "", filesToExport, true, window.currentDataFolderPath);
			}
		}
	}, 300); // 0.3秒間操作が止まったら書き出し
};
window.downloadFinalRto = function(isExport = false) {
	let res = "";
	window.finalRtoList.forEach(item => {
		if (item.label && item.value) {
			res += `${item.label}|${item.value}\n`;
		}
	});
	// ★ 修正：個別ダウンロードの処理が走る「前」に、テキスト(res)を返して終わらせる
	if (isExport === true) return res;
	// === 以下は個別保存ボタン用 ===
	const blob = new Blob([res], {
		type: 'text/plain'
	});
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = 'final.rto';
	document.body.appendChild(a);
	a.click();
	setTimeout(() => {
		document.body.removeChild(a);
		window.URL.revokeObjectURL(url);
	}, 0);
};
/**
 * mirrors.ini の書き出し
 */
window.downloadMirrorsIni = function(isExport = false) {
	const data = window.currentMirrorsData;
	if (!data) {
		alert("ミラーデータが存在しません。");
		return;
	}
	let iniContent = "";
	for (const section in data) {
		iniContent += `[${section}]\n`;
		for (const key in data[section]) {
			iniContent += `${key}=${data[section][key]}\n`;
		}
		iniContent += "\n";
	}
	// ★ 重要：一括書き出し時はここでテキストを返して終了
	if (isExport === true) return iniContent;
	// 個別保存用のフォールバック処理
	const blob = new Blob([iniContent], {
		type: 'text/plain'
	});
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = 'mirrors.ini';
	document.body.appendChild(a);
	a.click();
	setTimeout(() => {
		document.body.removeChild(a);
		window.URL.revokeObjectURL(url);
	}, 0);
};
window.downloadDrivetrainIni = function(isExport = false) {
	const activeSet = window.gearSetList[window.mainGearIdx] || window.gearSetList[window.activeGearIdx] || window.gearSetList[0];
	if (!activeSet || !activeSet.data) {
		alert("ドライブトレインデータが存在しません。");
		return;
	}
	let baseExportData = window.currentDrivetrainData ? JSON.parse(JSON.stringify(window.currentDrivetrainData)) : {};
	// =========================================================
	// ★ ユーザー要件に基づく条件分岐ロジック
	// =========================================================
	let isSetupUploaded = window.isSetupIniUploaded === true;
	// 現在のUIのギア状態と、保存しておいた初期状態を比較して「編集されたか」を判定
	let currentGearStr = JSON.stringify(activeSet.data.GEARS);
	let isGearEdited = window.baseGearSnapshot && (window.baseGearSnapshot !== currentGearStr);
	if (!isSetupUploaded && !isGearEdited) {
		// 【要件】setup.iniアップロードなし ＆ 編集なし
		// ➡️ drivetrain.ini のデータを完全にパススルーする（baseExportDataのGEARSはそのまま維持）
		console.log("パススルー出力: drivetrain.iniの元データを維持します");
	} else {
		// 【要件】setup.iniあり、または 編集ありの場合
		if (!baseExportData.GEARS) baseExportData.GEARS = {};
		// ➡ 修正：FINALを含め、UIで編集・選択されたすべてのギア設定を反映させます
		for (let key in activeSet.data.GEARS) {
			baseExportData.GEARS[key] = activeSet.data.GEARS[key];
		}
	}
	// ギア(GEARS)以外の全セクション（GEARBOX、AUTOCLUTCHなど）は、UIの編集結果を全て反映させる
	for (const section in activeSet.data) {
		if (section !== 'GEARS') {
			baseExportData[section] = JSON.parse(JSON.stringify(activeSet.data[section]));
		}
	}
	// =========================================================
	// 以下、テキスト生成とダウンロード処理
	// =========================================================
	let res = "";
	for (const section in baseExportData) {
		res += `[${section}]\n`;
		let keys = Object.keys(baseExportData[section]);
		if (section === 'GEARS') {
			keys.sort((a, b) => {
				const getWeight = (k) => {
					if (k === 'COUNT') return 0;
					if (k === 'GEAR_R') return 1;
					if (k.startsWith('GEAR_')) return 10 + parseInt(k.replace('GEAR_', ''));
					if (k === 'FINAL') return 999;
					return 500;
				};
				return getWeight(a) - getWeight(b);
			});
		}
		const countVal = parseInt(baseExportData.GEARS?.COUNT) || 7;
		keys.forEach(key => {
			if (section === 'GEARS' && key.startsWith('GEAR_') && key !== 'GEAR_R') {
				const gearNum = parseInt(key.replace('GEAR_', ''));
				if (gearNum > countVal) return;
			}
			const val = baseExportData[section][key];
			if (val !== undefined && val !== "") {
				res += `${key}=${val}\n`;
			}
		});
		res += "\n";
	}
	// ★ 修正：個別ダウンロードの処理が走る「前」に、完成したテキスト(res)を返して終わらせる
	if (isExport === true) return res;
	// === 以下は個別保存ボタン用 ===
	const blob = new Blob([res], {
		type: 'text/plain'
	});
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = 'drivetrain.ini';
	document.body.appendChild(a);
	a.click();
	setTimeout(() => {
		document.body.removeChild(a);
		window.URL.revokeObjectURL(url);
	}, 0);
};
/**
 * cameras.ini の書き出し
 */
window.downloadCamerasIni = function(isExport = false) {
	let res = "";
	// originalRawData に格納されている各カメラのデータをループ
	window.originalRawData.forEach((config, idx) => {
		res += `[CAMERA_${idx}]\n`;
		// window.cameraConfigs[idx] に編集後の値（position, target 等）が入っていると想定
		// 編集後のデータがあればそれを使い、なければ元のデータ(config)を使う
		const editData = window.cameraConfigs && window.cameraConfigs[idx] ? window.cameraConfigs[idx] : {};
		// 保存されている全てのキーを書き出す
		for (const key in config) {
			let val = config[key];
			// もし特定のキー（POSITIONなど）が編集データ側にある場合は、そちらを優先して文字列化
			if (key === 'POSITION' && editData.position) {
				val = `${editData.position.x},${editData.position.y},${editData.position.z}`;
			} else if (key === 'FORWARD' && editData.target) {
				// targetから計算が必要な場合はここにロジックを入れる
			}
			res += `${key}=${val}\n`;
		}
		res += "\n";
	});
	// ★ 重要：一括書き出し時はここでテキストを返して終了
	if (isExport === true) return res;
	// 個別保存用（一応残しておきます）
	if (res === "") {
		alert("書き出すカメラデータがありません。");
		return;
	}
	const blob = new Blob([res], {
		type: 'text/plain'
	});
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = 'cameras.ini';
	a.click();
	URL.revokeObjectURL(url);
};
/**
 * aero.ini の書き出し
 */
window.downloadAeroIni = function(isExport = false) {
	const data = window.currentAeroData;
	if (!data) {
		alert("エアロデータが存在しません。");
		return;
	}
	let iniContent = "";
	// 現在保持している全セクション（WING_0, WING_1など）を出力
	if (data.HEADER && data.HEADER.VERSION !== undefined) {
		iniContent += `[HEADER]\nVERSION=${data.HEADER.VERSION}\n\n`;
	}
	for (const section in data) {
		// 【🚨追加必須1】HEADERが二重に書き出されるのを防ぐ
		if (section === 'HEADER') continue;
		// 【🚨追加必須4】不要なDATAセクションを書き出さない
		if (section === 'DATA') continue;
		// 【🚨追加必須2】個別スイッチがOFFの項目は書き出さない
		if (data[section]._ENABLED === false) continue;
		// 拡張物理がOFFの時、[FIN_0] セクションは書き出さない
		if (section === 'FIN_0' && !window.isExtendedPhysicsEnabled) continue;
		iniContent += `[${section}]\n`;
		for (const key in data[section]) {
			// 【🚨追加必須3】システム用の裏側フラグ（_ENABLED）を文字として書き出さない
			if (key === '_ENABLED') continue;
			// 拡張物理がOFFの時、ZONE_ で始まるダメージ項目は書き出さない
			if (key.startsWith('ZONE_') && !window.isExtendedPhysicsEnabled) continue;
			iniContent += `${key}=${data[section][key]}\n`;
		}
		iniContent += "\n";
	}
	// ★ 修正：個別ダウンロードの処理が走る「前」に、テキストだけを返して終わらせる
	if (isExport === true) return iniContent;
	// === 以下は個別保存ボタン用 ===
	const blob = new Blob([iniContent], {
		type: 'text/plain'
	});
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = 'aero.ini';
	a.click();
	URL.revokeObjectURL(url);
};
window.downloadEngineIni = function(isExport = false) {
	const data = window.currentEngineData;
	if (!data) {
		alert("エンジンデータが存在しません。");
		return;
	}
	// ★追加済み：UI（セレクトボックス）で選ばれているターボの総数を取得する
	const turboCountSelect = document.getElementById('turbo-count-select');
	const turboCount = turboCountSelect ? parseInt(turboCountSelect.value) : 1;
	let iniContent = "";
	// 1. 書き出しの理想的な順番を定義する（これで [TURBO_0] の下に [TURBO_1] が並びます）
	const sectionOrder = ['HEADER', 'ENGINE_DATA', 'COAST_REF', 'COAST_DATA', 'COAST_CURVE'];
	// ターボを 0 から順番にリストへ追加する
	for (let i = 0; i < turboCount; i++) {
		sectionOrder.push(`TURBO_${i}`);
	}
	// 最後にダメージ設定などを置く
	sectionOrder.push('DAMAGE');
	const writtenSections = new Set();
	// 2. リストに定義した順番通りに書き出す
	sectionOrder.forEach(secName => {
		if (data[secName]) {
			iniContent += `[${secName}]\n`;
			for (const key in data[secName]) {
				// ★追加：アプリ内部のグラフ計算用設定（USER_SETTING）は INI に含めない
				if (key === 'USER_SETTING') continue;
				iniContent += `${key}=${data[secName][key]}\n`;
			}
			iniContent += "\n";
			writtenSections.add(secName);
		}
	});
	// 3. もしデータ内に上記リストにない未知のセクションがあれば最後に追加（安全策）
	for (const secName in data) {
		if (!writtenSections.has(secName)) {
			// ターボ基数チェック（選ばれた数以上のターボは書かない）
			if (secName.startsWith('TURBO_')) {
				const idx = parseInt(secName.replace('TURBO_', ''));
				if (idx >= turboCount) continue;
			}
			iniContent += `[${secName}]\n`;
			for (const key in data[secName]) {
				if (key === 'USER_SETTING') continue;
				iniContent += `${key}=${data[secName][key]}\n`;
			}
			iniContent += "\n";
		}
	}
	// ★ 修正：個別ダウンロードの処理が走る「前」に、テキストだけを返して終わらせる
	if (isExport === true) return iniContent;
	// === 以下は個別保存ボタン用 ===
	const blob = new Blob([iniContent], {
		type: 'text/plain'
	});
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = 'engine.ini';
	a.click();
	URL.revokeObjectURL(url);
};
/**
 * power.lut の書き出し
 */
window.downloadPowerLut = function(isExport = false) {
	const rawData = window.currentPowerLutRaw;
	if (!rawData) {
		alert("LUTデータが存在しません。");
		return;
	}
	// ★ 重要：個別ダウンロードの処理が走る「前」に、テキストだけを返して終わらせる
	if (isExport === true) return rawData;
	// === 以下は個別保存ボタン用 ===
	const blob = new Blob([rawData], {
		type: 'text/plain'
	});
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = 'power.lut';
	a.click();
	URL.revokeObjectURL(url);
};
// 3. setup.ini のダウンロード機能（ギアの自動合流つき）
// 3. setup.ini のダウンロード機能（ギアの自動合流つき）
window.downloadSetupIni = function(isExport = false) {
	const data = window.currentSetupData;
	if (!data) return alert("セットアップデータが存在しません。");
	let iniContent = "";
	// 🛠️ ヘッダー情報の追加
	iniContent += "[DISPLAY_METHOD]\nSHOW_CLICKS=1\n\n";
	const currentUseGearset = (data['GEARS'] && data['GEARS']['USE_GEARSET'] !== undefined) ? data['GEARS']['USE_GEARSET'] : '1';
	iniContent += `[GEARS]\nUSE_GEARSET=${currentUseGearset}\n\n`;
	// ★ ここからが、あなたが提示された「選択されたギア数による分岐」の最新版です
	if (window.gearSetList && window.gearSetList.length === 1) {
		// 1つの時：協議した通りの「固定ギア(rto)」用ブロックを書き出す
		iniContent += `[GEAR_1]\nRATIOS=ratios.rto\nNAME=First Gear\nPOS_X=0.5\nPOS_Y=0\nHELP=HELP_REAR_GEAR\n\n`;
		iniContent += `[GEAR_2]\nRATIOS=ratios.rto\nNAME=Second Gear\nPOS_X=0.5\nPOS_Y=1.5\nHELP=HELP_REAR_GEAR\n\n`;
		iniContent += `[GEAR_3]\nRATIOS=ratios.rto\nNAME=Third Gear\nPOS_X=0.5\nPOS_Y=3\nHELP=HELP_REAR_GEAR\n\n`;
		iniContent += `[GEAR_4]\nRATIOS=ratios.rto\nNAME=Fourth Gear\nPOS_X=0.5\nPOS_Y=4.5\nHELP=HELP_REAR_GEAR\n\n`;
		iniContent += `[GEAR_5]\nRATIOS=ratios.rto\nNAME=Fifth Gear\nPOS_X=0.5\nPOS_Y=6\nHELP=HELP_REAR_GEAR\n\n`;
		iniContent += `[GEAR_6]\nRATIOS=ratios.rto\nNAME=Sixth Gear\nPOS_X=0.5\nPOS_Y=7.5\nHELP=HELP_REAR_GEAR\n\n`;
	} else if (window.gearSetList && window.gearSetList.length > 1) {
		// 2つ以上の時：✨メインギアを [GEAR_SET_0] に固定して出力（新ロジック）
		const mainIdx = window.mainGearIdx || 0;
		const gearSets = window.gearSetList;
		// 共通の書き出し処理
		const writeGearSet = (set, outIdx) => {
			let block = `[GEAR_SET_${outIdx}]\n`;
			block += `NAME=${set.name}\n`;
			const gears = set.data.GEARS || {};
			let keys = Object.keys(gears).filter(k => k.startsWith('GEAR_') && k !== 'GEAR_R');
			keys.sort((a, b) => parseInt(a.replace('GEAR_', '')) - parseInt(b.replace('GEAR_', '')));
			keys.forEach(k => {
				if (gears[k] !== undefined && gears[k] !== "") {
					block += `${k}=${gears[k]}\n`;
				}
			});
			return block + "\n";
		};
		// ① メインギアを 0番 として最初に出す
		iniContent += writeGearSet(gearSets[mainIdx], 0);
		// ② 残りを 1番以降 として出す
		let currentOutIdx = 1;
		gearSets.forEach((set, idx) => {
			if (idx === mainIdx) return; // メインは既に書いたのでスキップ
			iniContent += writeGearSet(set, currentOutIdx);
			currentOutIdx++;
		});
	}
	iniContent += "[FINAL_GEAR_RATIO]\nRATIOS=final.rto\nNAME=Final Gear Ratio\nPOS_X=1\nPOS_Y=0\nHELP=HELP_REAR_GEAR\n\n";
	// 元々のセットアップデータ（足回り・エアロ等）を書き出す
	for (const section in data) {
		// ギア関連は上で合流させたのでスキップ
		if (section === 'GEARS' || section.startsWith('GEAR_SET_') || section === 'FINAL_GEAR_RATIO' || section === 'DISPLAY_METHOD') {
			continue;
		}
		// ★追加：ギアセットが2つ以上ある時は、rto用の [GEAR_1] ～ [GEAR_6] を二重に書き出さないようスキップさせる
		if (window.gearSetList.length > 1 && section.startsWith('GEAR_')) {
			continue;
		}
		if (data[section].__is_active === false) continue;
		iniContent += `[${section}]\n`;
		let keys = Object.keys(data[section]);
		keys.forEach(key => {
			if (['__is_active'].includes(key)) return;
			if (data[section][key] !== undefined && data[section][key] !== "") {
				iniContent += `${key}=${data[section][key]}\n`;
			}
		});
		iniContent += "\n";
	}
	// ★ 修正：個別ダウンロードの処理が走る「前」に、テキストだけを返して終わらせる
	if (isExport === true) return iniContent;
	const blob = new Blob([iniContent], {
		type: 'text/plain'
	});
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = 'setup.ini';
	document.body.appendChild(a);
	a.click();
	setTimeout(() => {
		document.body.removeChild(a);
		window.URL.revokeObjectURL(url);
	}, 0);
};
window.downloadCollidersIni = function(isExport = false) {
	if (!window.currentCarData) {
		alert("コライダーデータが存在しません。");
		return;
	}
	let iniContent = "";
	let hasCollider = false;
	for (const section in window.currentCarData) {
		// COLLIDER_ から始まる設定のみを抽出する
		if (section.startsWith('COLLIDER_')) {
			hasCollider = true;
			iniContent += `[${section}]\n`;
			for (const key in window.currentCarData[section]) {
				iniContent += `${key}=${window.currentCarData[section][key]}\n`;
			}
			iniContent += "\n";
		}
	}
	if (!hasCollider) {
		alert("書き出すコライダーデータがありません。");
		return;
	}
	// ★ 重要：個別ダウンロードの処理が走る「前」に、テキストだけを返して終わらせる
	if (isExport === true) return iniContent;
	// === 以下は個別保存ボタン用 ===
	const blob = new Blob([iniContent], {
		type: 'text/plain'
	});
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = 'colliders.ini';
	document.body.appendChild(a);
	a.click();
	setTimeout(() => {
		document.body.removeChild(a);
		window.URL.revokeObjectURL(url);
	}, 0);
}; /** suspension.ini の書き出し */
window.downloadSuspensionIni = function(isExport = false) {
	const data = window.currentSuspensionData;
	if (!data) {
		alert("データが存在しません。");
		return;
	}
	let iniContent = "";
	// 出力するセクションの順番
	const sectionOrder = [{
		id: 'HEADER',
		type: 'FIXED'
	}, {
		id: 'BASIC',
		type: 'FIXED'
	}, {
		id: 'ARB',
		type: 'FIXED'
	}, {
		id: 'FRONT',
		type: 'DYNAMIC'
	}, {
		id: 'REAR',
		type: 'DYNAMIC'
	}, {
		id: 'AXLE',
		type: 'AXLE_SPECIAL'
	}, {
		id: '_EXTENSION',
		type: 'FIXED'
	}, {
		id: '_EXTENSION_FLEX',
		type: 'FIXED'
	}, {
		id: 'GRAPHICS_OFFSETS',
		type: 'FIXED'
	}, {
		id: 'DAMAGE',
		type: 'FIXED'
	}];
	sectionOrder.forEach(secDef => {
		const secName = secDef.id;
		// AXLEセクション専用の出力処理
		if (secDef.type === 'AXLE_SPECIAL') {
			if (data.REAR && data.REAR.TYPE === 'AXLE' && data.AXLE) {
				iniContent += `[${secName}]\n`;
				const axleKeys = window.SUSPENSION_EXTRA_SCHEMA['AXLE'].arms;
				axleKeys.forEach(key => {
					if (data.AXLE[key] !== undefined) {
						iniContent += `${key}=${data.AXLE[key]}\n`;
					}
				});
				iniContent += `\n`;
			}
			return;
		}
		if (!data[secName]) return;
		if (data[secName]._ENABLED === false) return;
		// 2. メインの拡張物理スイッチがOFFの時、サス専用の拡張セクションは書き出さない
		if ((secName === '_EXTENSION' || secName === '_EXTENSION_FLEX') && !window.isExtendedPhysicsEnabled) {
			return;
		}
		iniContent += `[${secName}]\n`;
		if (secDef.type === 'FIXED') {
			for (const [key, val] of Object.entries(data[secName])) {
				iniContent += `${key}=${val}\n`;
			}
		} else if (secDef.type === 'DYNAMIC') {
			const currentType = data[secName].TYPE || 'DWB';
			const baseKeys = [...SUSPENSION_BASE_KEYS];
			// すべての形式（DWB, STRUT, AXLE）に対して、スキーマに定義された
			// 'extended' カテゴリのキーを書き出し対象に加える
			if (window.SUSPENSION_EXTRA_SCHEMA[currentType]) {
				const extras = window.SUSPENSION_EXTRA_SCHEMA[currentType];
				// 既存のアーム等のキーを追加
				Object.keys(extras).forEach(cat => {
					if (cat !== 'extended' || window.isExtendedPhysicsEnabled) {
						baseKeys.push(...extras[cat]);
					}
				});
			}
			const finalKeys = [...new Set(baseKeys)];
			finalKeys.forEach(key => {
				if (data[secName][key] !== undefined) {
					iniContent += `${key}=${data[secName][key]}\n`;
				}
			});
		}
		iniContent += `\n`;
	});
	// ★ 修正：個別ダウンロードの処理が走る「前」に、テキストだけを返して終わらせる
	if (isExport === true) return iniContent;
	// === 以下は個別保存ボタン用 ===
	const blob = new Blob([iniContent], {
		type: 'text/plain'
	});
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = 'suspensions.ini';
	document.body.appendChild(a);
	a.click();
	setTimeout(() => {
		document.body.removeChild(a);
		window.URL.revokeObjectURL(url);
	}, 0);
};
// --- ここから追加：各INIの書き出し機能 ---
window.downloadTyreIni = function(isExport = false) {
	if (!window.tyreCompoundList || window.tyreCompoundList.length === 0) {
		alert("タイヤデータが存在しません。");
		return;
	}
	let iniObj = {};
	// 1. 共通のグローバルセクションをベースの生データから安全に引き継ぐ
	const baseRaw = window.tyreCompoundList[0].raw_ini || {};
	if (baseRaw.HEADER) iniObj["HEADER"] = JSON.parse(JSON.stringify(baseRaw.HEADER));
	if (baseRaw.VIRTUALKM) iniObj["VIRTUALKM"] = JSON.parse(JSON.stringify(baseRaw.VIRTUALKM));
	if (baseRaw.COMPOUND_DEFAULT) iniObj["COMPOUND_DEFAULT"] = JSON.parse(JSON.stringify(baseRaw.COMPOUND_DEFAULT));
	// HEADERセクションの存在とVERSION=10の記述を絶対保証
	if (!iniObj["HEADER"]) iniObj["HEADER"] = {};
	if (!iniObj["HEADER"].VERSION) iniObj["HEADER"].VERSION = "10";
	// 2. エディタ画面上の最新状態（window.tyreCompoundList）からインデックス順にセクションを再構成
	window.tyreCompoundList.forEach(comp => {
		const suffix = comp.index === 0 ? '' : `_${comp.index}`;
		const fSec = `FRONT${suffix}`;
		const rSec = `REAR${suffix}`;
		const tfSec = `THERMAL_FRONT${suffix}`;
		const trSec = `THERMAL_REAR${suffix}`;
		if (comp.data.FRONT) iniObj[fSec] = JSON.parse(JSON.stringify(comp.data.FRONT));
		if (comp.data.REAR) iniObj[rSec] = JSON.parse(JSON.stringify(comp.data.REAR));
		if (comp.data.THERMAL_FRONT) iniObj[tfSec] = JSON.parse(JSON.stringify(comp.data.THERMAL_FRONT));
		if (comp.data.THERMAL_REAR) iniObj[trSec] = JSON.parse(JSON.stringify(comp.data.THERMAL_REAR));
		// 🌟クリーンアップ：[HEADER] 以外の各タイヤセクションに紛れ込んだ VERSION キーを完全に除去
		if (iniObj[fSec]) delete iniObj[fSec].VERSION;
		if (iniObj[rSec]) delete iniObj[rSec].VERSION;
		if (iniObj[tfSec]) delete iniObj[tfSec].VERSION;
		if (iniObj[trSec]) delete iniObj[trSec].VERSION;
	});
	// 3. 再構築したオブジェクトから、アセットコルサ標準の INI テキストに変換
	let iniContent = "";
	for (const section in iniObj) {
		iniContent += `[${section}]\n`;
		for (const key in iniObj[section]) {
			iniContent += `${key}=${iniObj[section][key]}\n`;
		}
		iniContent += "\n";
	}
	// 一括保存モードの時はテキストデータのみを返して終了
	if (isExport === true) return iniContent;
	// === 以下は個別保存ボタンが押された場合のフォールバック処理 ===
	const blob = new Blob([iniContent], {
		type: 'text/plain'
	});
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = 'tyres.ini';
	document.body.appendChild(a);
	a.click();
	setTimeout(() => {
		document.body.removeChild(a);
		window.URL.revokeObjectURL(url);
	}, 0);
};
// ★追加：マイドキュメント用の view.ini テキストを生成する関数
window.downloadViewIni = function(isExport = false) {
	const graphics = window.currentCarData?.GRAPHICS || {};
	let res = "[CAMERA]\n";
	res += `ON_BOARD_PITCH_ANGLE=${graphics.ON_BOARD_PITCH_ANGLE !== undefined ? graphics.ON_BOARD_PITCH_ANGLE : '0'}\n`;
	res += `ON_BOARD_YAW_ANGLE=${graphics.ON_BOARD_YAW_ANGLE !== undefined ? graphics.ON_BOARD_YAW_ANGLE : '0'}\n\n`;
	res += "[DRIVER_EYES_POSITION]\n";
	res += `DRIVEREYES=${graphics.DRIVEREYES !== undefined ? graphics.DRIVEREYES : '0, 1.0, 0'}\n`;
	if (isExport === true) return res;
	const blob = new Blob([res], {
		type: 'text/plain'
	});
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = 'view.ini';
	a.click();
	URL.revokeObjectURL(url);
};
// ★追加：dataフォルダ用の dash_cam.ini テキストを生成する関数
window.downloadDashCamIni = function(isExport = false) {
	const graphics = window.currentCarData?.GRAPHICS || {};
	let res = "[DASH_CAM]\n";
	res += `POS=${graphics.DASH_CAM_POS !== undefined ? graphics.DASH_CAM_POS : '0, 1.0, 0'}\n`;
	if (isExport === true) return res;
	const blob = new Blob([res], {
		type: 'text/plain'
	});
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = 'dash_cam.ini';
	a.click();
	URL.revokeObjectURL(url);
};
window.downloadCarIni = function(isExport = false) {
	if (!window.currentCarData) {
		alert("車両データが存在しません。");
		return;
	}
	let iniContent = "";
	// ★追加：マイドキュメントや個別のiniに仕分けされたカメラ座標キーのリスト
	const specialCameraKeys = ['DRIVEREYES', 'ON_BOARD_PITCH_ANGLE', 'ON_BOARD_YAW_ANGLE', 'DASH_CAM_POS'];
	for (const section in window.currentCarData) {
		// COLLIDER_ から始まる設定は colliders.ini 用なので弾く
		if (section.startsWith('COLLIDER_')) continue;
		iniContent += `[${section}]\n`;
		for (const key in window.currentCarData[section]) {
			// ★修正：特殊ファイルへ仕分けされたキーは、car.ini 側に混ざらないよう完全にガードして除外する
			if (section === 'GRAPHICS' && specialCameraKeys.includes(key)) continue;
			iniContent += `${key}=${window.currentCarData[section][key]}\n`;
		}
		iniContent += "\n";
	}
	// ★ 修正：個別ダウンロードの処理が走る「前」に、テキストだけを返して終わらせる
	if (isExport === true) return iniContent;
	const blob = new Blob([iniContent], {
		type: 'text/plain'
	});
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = 'car.ini';
	document.body.appendChild(a);
	a.click();
	setTimeout(() => {
		document.body.removeChild(a);
		window.URL.revokeObjectURL(url);
	}, 0);
};