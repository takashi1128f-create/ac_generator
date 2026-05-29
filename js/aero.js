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
	const sections = Object.keys(data).filter(s => s.startsWith('WING_') || s === 'FIN_0').sort((a, b) => {
		if (a === 'FIN_0') return 1;
		if (b === 'FIN_0') return -1;
		return parseInt(a.split('_')[1]) - parseInt(b.split('_')[1]);
	});
	sections.forEach(section => {
		const wrapper = document.createElement('article');
		wrapper.className = 'aero-section-box';
		// [FIN_0] セクションかつ、拡張物理がOFFならロックする[cite: 27, 28]
		if (section === 'FIN_0' && !window.isExtendedPhysicsEnabled) {
			wrapper.style.opacity = '0.4';
			wrapper.style.pointerEvents = 'none';
			wrapper.classList.add('is-extended-locked');
		}
		const nameStr = data[section].NAME ? ` (${data[section].NAME})` : '';
		wrapper.innerHTML = `<div class="suspension-item-title_box"><p>${section}${nameStr}</p></div>`;
		const box = document.createElement('div');
		box.className = 'suspension-item_box';
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