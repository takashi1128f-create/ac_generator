// js/aero.js
window.aeroGroup = null;
window.aeroWingBackup = {}; // 編集中に消したウイングを一時記憶する箱
// --- 1. ラジオボタンのクリックを監視する（一度だけ実行） ---
function setupAeroEventListeners() {
	const radios = document.querySelectorAll('input[name="aero-wing-count"]');
	radios.forEach(rb => {
		rb.addEventListener('change', () => {
			if (!window.currentAeroData) return;
			const target = parseInt(rb.value);
			const data = window.currentAeroData;
			// 操作する前に、現在のデータをすべてバックアップに記憶させる
			Object.keys(data).forEach(k => {
				if (k.startsWith('WING_')) {
					window.aeroWingBackup[k] = JSON.parse(JSON.stringify(data[k]));
				}
			});
			// 現在の WING_ 項目を取得してソート
			const currentKeys = Object.keys(data).filter(k => k.startsWith('WING_')).sort();
			if (target > currentKeys.length) {
				// 枚数を増やす
				for (let i = currentKeys.length; i < target; i++) {
					const wingKey = `WING_${i}`;
					// バックアップに記憶があればそれを復元、なければ初期値を入れる
					if (window.aeroWingBackup[wingKey]) {
						data[wingKey] = JSON.parse(JSON.stringify(window.aeroWingBackup[wingKey]));
					} else {
						data[wingKey] = {
							NAME: `WING_${i}`,
							CHORD: "1",
							SPAN: "2",
							POSITION: "0,0,0",
							ANGLE: "0"
						};
					}
				}
			} else if (target < currentKeys.length) {
				// 枚数を減らす
				for (let i = currentKeys.length - 1; i >= target; i--) {
					const wingKey = `WING_${i}`;
					// 消す直前にも最新の状態をバックアップ
					window.aeroWingBackup[wingKey] = JSON.parse(JSON.stringify(data[wingKey]));
					delete data[wingKey];
				}
			}
			// 表示を更新
			window.initAeroEditor(data);
			window.updateAeroVisuals();
			if (window.requestRender) window.requestRender();
		});
	});
}
// --- 2. 3D描画ロジック ---
window.updateAeroVisuals = function() {
	const THREE = window.THREE;
	if (!THREE) return;
	const bodyToMove = window.suspensionModel || window.currentModel;
	if (!bodyToMove) {
		if (window.aeroGroup) window.aeroGroup.visible = false;
		return;
	}
	const data = window.currentAeroData;
	const sData = window.currentSuspensionData;
	const carData = window.currentCarData;
	const scene = window.suspensionScene || window.scene;
	if (!data || !sData || !carData || !scene) return;
	if (window.suspensionVisibility && window.suspensionVisibility.wing === false) {
		if (window.aeroGroup) window.aeroGroup.visible = false;
		return;
	}
	if (!window.aeroGroup) {
		window.aeroGroup = new THREE.Group();
		scene.add(window.aeroGroup);
	}
	window.aeroGroup.visible = true;
	while (window.aeroGroup.children.length > 0) {
		window.aeroGroup.remove(window.aeroGroup.children[0]);
	}
	let gOffset = {
		x: 0,
		y: 0,
		z: 0
	};
	if (carData.BASIC?.GRAPHICS_OFFSET) {
		const parts = carData.BASIC.GRAPHICS_OFFSET.split(',').map(v => parseFloat(v.trim()));
		gOffset.x = parts[0] || 0;
		gOffset.y = parts[1] || 0;
		gOffset.z = parts[2] || 0;
	}
	for (const section in data) {
		if (section.startsWith('WING_') || section.startsWith('FIN_')) {
			if (data[section]._ENABLED === false) {
				continue;
			}
			// 2. 追加：もし FIN であり、かつ拡張物理スイッチが OFF なら、描画せずに次のループへ飛ばす
			if (section.startsWith('FIN_') && !window.isExtendedPhysicsEnabled) {
				continue;
			}
			const wing = data[section];
			const wPos = String(wing.POSITION || "0,0,0").split(',').map(v => parseFloat(v.trim()));
			const wSpan = parseFloat(wing.SPAN) || 1;
			const wChord = parseFloat(wing.CHORD) || 1;
			const wAngle = (parseFloat(wing.ANGLE) || 0) * (Math.PI / 180);
			// 数字に変換できなかった場合のエラー防止
			if (!wPos.some(isNaN) && !isNaN(wSpan) && !isNaN(wChord)) {
				// 修正：FINの場合は SPAN を「高さ(Y)」、WINGの場合は「幅(X)」に割り当てます
				const isFin = section.startsWith('FIN_');
				const geoWidth = isFin ? 0.02 : wSpan;
				const geoHeight = isFin ? wSpan : 0.02;

				const geo = new THREE.BoxGeometry(geoWidth, geoHeight, wChord);
				const mesh = window.createEdgeMesh(geo, 0x00ffff);
				const wZ = wPos[2] - gOffset.z;
				if (typeof window.calculateCarAlignmentAtZ === 'function') {
					const align = window.calculateCarAlignmentAtZ(wZ, sData, carData);
					const finalX = wPos[0] + gOffset.x;
					const finalY = align.radiusY + wPos[1] - align.baseY;
					const finalZ = wZ;
					mesh.position.set(finalX, finalY, finalZ);
					mesh.rotation.x = align.pitch - wAngle;
				}
				mesh.renderOrder = 2000;
				window.aeroGroup.add(mesh);
			}
		}
	}
};
// --- 3. エディター(UI)生成ロジック ---
window.initAeroEditor = function(data) {
	const container = document.getElementById('aero-data-container');
	if (!container || !data) return;
	// 現在の枚数に合わせて、HTML側のラジオボタンのチェック状態を同期
	const wingCount = Object.keys(data).filter(k => k.startsWith('WING_')).length;
	const targetRadio = document.querySelector(`input[name="aero-wing-count"][value="${wingCount}"]`);
	if (targetRadio) targetRadio.checked = true;
	container.innerHTML = '';
	const panel = document.createElement('div');
	panel.className = 'suspension-tab-panel active';
	container.appendChild(panel);
	// WING_ で始まるもの、または FIN_0 を表示対象にする[cite: 28]
	//HEADERセクションとVERSIONのセレクトボックスを最上部に生成
	const headerWrapper = document.createElement('article');
	headerWrapper.className = 'aero-section-box';
	headerWrapper.innerHTML = `<div class="suspension-item-title_box"><p>HEADER</p></div>`;
	
	// 現在のVERSIONを取得（データが無ければ '2' とする）
	let currentVersion = (data.HEADER && data.HEADER.VERSION) ? String(data.HEADER.VERSION).trim() : '2';
	
	// データ側にHEADERが無い場合、UIの初期値(2)をデータ側にも確実に保存しておく
	if (!data.HEADER) {
		data.HEADER = { VERSION: currentVersion };
	}
	// 基本の選択肢(1, 2, 3)にない特殊な値なら、リストに自動追加して選択させる
	const standardOptions = ['1', '2', '3'];
	const isCustom = !standardOptions.includes(currentVersion);
	
	const headerBox = document.createElement('div');
	headerBox.className = 'suspension-item_box';
	
	const selectHtml = `
		<div class="suspension-item">
			<div class="input-unit">
				<label>VERSION</label>
				<div class="input-with-range">
					<select id="aero-version-select" class="text-input" style="width: 100%; cursor: pointer;">
						<option value="1" ${currentVersion === '1' ? 'selected' : ''}>1</option>
						<option value="2" ${currentVersion === '2' ? 'selected' : ''}>2</option>
						<option value="3" ${currentVersion === '3' ? 'selected' : ''}>3</option>
						${isCustom ? `<option value="${currentVersion}" selected>${currentVersion}</option>` : ''}
					</select>
				</div>
			</div>
		</div>
	`;
	headerBox.innerHTML = selectHtml;
	headerWrapper.appendChild(headerBox);
	panel.appendChild(headerWrapper);
	// 見た目を整えるための「空のダミー箱」
	const emptySpacer = document.createElement('article');
	emptySpacer.className = 'aero-section-box';
	emptySpacer.style.visibility = 'hidden'; // スペースだけ確保して、箱の枠線や背景は見えなくする
	panel.appendChild(emptySpacer);
	// セレクトボックスの変更をデータに即座に反映させるイベント
	setTimeout(() => {
		const versionSelect = document.getElementById('aero-version-select');
		if (versionSelect) {
			versionSelect.addEventListener('change', (e) => {
				window.currentAeroData.HEADER.VERSION = e.target.value;
				if (window.modifiedStatus) window.modifiedStatus.aero = true;
			});
		}
	}, 0);
	// ★追加ここまで
	const sections = Object.keys(data).filter(s => s.startsWith('WING_') || s === 'FIN_0').sort((a, b) => {
		if (a === 'FIN_0') return 1;
		if (b === 'FIN_0') return -1;
		return parseInt(a.split('_')[1]) - parseInt(b.split('_')[1]);
	});
	sections.forEach(section => {
		const wrapper = document.createElement('article');
		wrapper.className = 'aero-section-box';
		// ★修正：外箱（wrapper）はロックせず、常にスイッチを押せるようにします
		wrapper.style.opacity = '1';
		wrapper.style.pointerEvents = 'auto';
		wrapper.classList.remove('is-extended-locked');
		// ★ここを書き換え：タイトルの横に「個別スイッチ」を追加
		const nameStr = data[section].NAME ? ` (${data[section].NAME})` : '';
		
		// 項目ごとに「有効/無効」の状態を保存するフラグをデータに追加（初期値は true）
		if (data[section]._ENABLED === undefined) {
			data[section]._ENABLED = true; 
		}
		const isItemEnabled = data[section]._ENABLED;

		// スイッチのHTMLをタイトル行の右側に配置する
		wrapper.innerHTML = `
			<div class="suspension-item-title_box" style="display: flex; justify-content: space-between; align-items: center;">
				<p>${section}${nameStr}</p>
				<label class="toggle-switch" style="margin-right: 15px;">
					<input type="checkbox" class="aero-item-toggle" data-section="${section}" ${isItemEnabled ? 'checked' : ''}>
					<span class="toggle-slider round"></span>
				</label>
			</div>
		`;
		
		const box = document.createElement('div');
		box.className = 'suspension-item_box';
		// ★修正：半透明と操作ロックは、入力欄の入った中身（box）だけに適用する
		if ((section === 'FIN_0' && !window.isExtendedPhysicsEnabled) || !isItemEnabled) {
			box.style.opacity = '0.4';
			box.style.pointerEvents = 'none';
		} else {
			box.style.opacity = '1';
			box.style.pointerEvents = 'auto';
		}
		['NAME', 'SPAN', 'CHORD', 'POSITION', 'ANGLE'].forEach(key => {
			if (data[section][key] !== undefined) {
				const val = data[section][key];
				const isCoord = String(val).includes(',');
				const vals = isCoord ? String(val).split(',').map(v => v.trim()) : [val];
				const itemDiv = document.createElement('div');
				itemDiv.className = 'suspension-item' + (isCoord ? ' is-coordinate' : '');
				// ★修正ポイント：司令塔から「データの塊」を受け取り、minとmaxを展開する
				let inputsHtml = vals.map((v, i) => {
					const editorRule = window.getEditorStep(key, v);
					const currentStep = typeof editorRule === 'object' ? editorRule.step : editorRule;
					const currentMin = typeof editorRule === 'object' && editorRule.min !== "" ? ` min="${editorRule.min}"` : "";
					const currentMax = typeof editorRule === 'object' && editorRule.max !== "" ? ` max="${editorRule.max}"` : "";
					return `<input type="${key === 'NAME' ? 'text' : 'number'}" class="text-input" data-idx="${i}" value="${v}" step="${currentStep}"${currentMin}${currentMax}>`;
				}).join('');
				itemDiv.innerHTML = `
						<div class="input-unit">
								<label>${key} ${isCoord ? '<span class="coord-label">(X, Y, Z)</span>' : ''}</label>
								<div class="input-with-range">${inputsHtml}</div>
						</div>
				`;
				const inputs = itemDiv.querySelectorAll('input');
				inputs.forEach(input => {
					input.addEventListener('input', () => {
						if (isCoord) {
							const newVals = Array.from(inputs).map(i => i.value);
							window.currentAeroData[section][key] = newVals.join(',');
						} else {
							window.currentAeroData[section][key] = inputs[0].value;
						}
						window.updateAeroVisuals();
						if (window.requestRender) window.requestRender();
					});
				});
				box.appendChild(itemDiv);
			}
		});
		// ★ここを追加：個別スイッチを切り替えたときの動作
		const toggleInput = wrapper.querySelector('.aero-item-toggle');
		if (toggleInput) {
			toggleInput.addEventListener('change', (e) => {
				const isChecked = e.target.checked;
				data[section]._ENABLED = isChecked; // データに状態を保存
				// ★修正：共通関数を呼び出してメインスイッチをONにする
				if (isChecked && typeof window.forceEnableMasterSwitch === 'function') {
					window.forceEnableMasterSwitch();
				}
				// ★修正：メインスイッチと個別スイッチの両方がONのときだけ中身を解放する
				const isMainEnabled = (section === 'FIN_0' ? window.isExtendedPhysicsEnabled : true);
				if (isChecked && isMainEnabled) {
					box.style.opacity = '1';
					box.style.pointerEvents = 'auto';
				} else {
					box.style.opacity = '0.4';
					box.style.pointerEvents = 'none';
				}

				if (window.modifiedStatus) window.modifiedStatus.aero = true;
				window.updateAeroVisuals();
				if (window.requestRender) window.requestRender();
			});
		}
		wrapper.appendChild(box);
		panel.appendChild(wrapper);
	});
};
// --- 4. 初期化とファイルアップロード処理 ---
document.addEventListener('DOMContentLoaded', () => {
	// UI側のラジオボタンのイベントを有効化
	setupAeroEventListeners();
	// ★追加: 拡張物理スイッチの手動切り替えイベント
	const extSwitch = document.getElementById('extendedPhysicsSwitch');
	const extText = document.getElementById('extendedStatusText');
	
	if (extSwitch) {
		extSwitch.addEventListener('change', (e) => {
			window.isExtendedPhysicsEnabled = e.target.checked;
			
			// CSSの色とテキストを切り替え
			if (extText) {
				if (window.isExtendedPhysicsEnabled) {
					extText.textContent = 'ON';
					extText.classList.remove('off');
					extText.classList.add('on');
				} else {
					extText.textContent = 'OFF';
					extText.classList.remove('on');
					extText.classList.add('off');
				}
			}
			
			// 切り替わったら、エディター(FIN_0のロック等)と3D表示を即座に更新する
			if (window.currentAeroData) {
				window.initAeroEditor(window.currentAeroData);
				window.updateAeroVisuals();
				if (window.requestRender) window.requestRender();
			}
		});
	}
	const aeroFileInput = document.getElementById('aeroFile');
	if (aeroFileInput) {
		aeroFileInput.addEventListener('change', (e) => {
			const file = e.target.files[0];
			if (!file) {
				console.warn("[aero.js] ファイルが選択されていません");
				return;
			}
			console.log("[aero.js] 📂 aero.ini のアップロードを検知！ ファイル名:", file.name);
			const reader = new FileReader();
			reader.onload = (event) => {
				console.log("[aero.js] 📄 ファイルの読み込み完了。");
				
				// 読み込んだテキストデータを変数に格納
				const text = event.target.result;

				// ★追加：拡張物理(ZONE_ または FIN_)の自動判定とスイッチUIの連動
				const extSwitch = document.getElementById('extendedPhysicsSwitch');
				const extText = document.getElementById('extendedStatusText');
				
				if (text.includes('ZONE_') || text.includes('FIN_')) {
					window.isExtendedPhysicsEnabled = true;
					if (extSwitch) extSwitch.checked = true;
					if (extText) {
						extText.textContent = 'ON';
						extText.classList.remove('off');
						extText.classList.add('on');
					}
				} else {
					window.isExtendedPhysicsEnabled = false;
					if (extSwitch) extSwitch.checked = false;
					if (extText) {
						extText.textContent = 'OFF';
						extText.classList.remove('on');
						extText.classList.add('off');
					}
				}

				if (typeof window.parseINI === 'function') {
					// ここでさっき変数に入れた text をパースする
					window.currentAeroData = window.parseINI(text);
					//元のテキストに [FIN_0] が本当に書かれていたか判定する
					if (window.currentAeroData && window.currentAeroData.FIN_0) {
						if (text.toUpperCase().includes('[FIN_0]')) {
							window.currentAeroData.FIN_0._ENABLED = true;  // あればON
						} else {
							window.currentAeroData.FIN_0._ENABLED = false; // 無ければOFF
						}
					}
					console.log("[aero.js] ⚙️ 解析結果データ:", window.currentAeroData);
					// 新しいファイルを読み込んだら完全に記憶をリセット（更新）する
					window.aeroWingBackup = {};
					window.initAeroEditor(window.currentAeroData);
					window.updateAeroVisuals();
					if (window.requestRender) window.requestRender();
					console.log("[aero.js] 🖥️ UIエディターと3Dの更新が完了しました");
				} else {
					console.error("[aero.js] ❌ エラー: window.parseINI が見つかりません");
				}
			};
			reader.readAsText(file);
			// ★超重要: 同じファイルを何度でも再アップロードできるように選択状態をリセット
			e.target.value = '';
		});
	}
});