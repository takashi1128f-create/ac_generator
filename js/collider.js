// js/collider.js
// --- 1. グローバル変数の定義 ---
window.colliderHelper = null;
// --- 2. 3D表示および地上高計算ロジック ---
window.updateColliderVisuals = function() {
	// ★調査用ログ1：関数が呼ばれたかどうかの確認
	// console.log("[COLLIDER] updateColliderVisuals が呼ばれました");
	const data = window.currentCarData;
	const collider0 = data?.COLLIDER_0;
	const scene = window.suspensionScene || window.scene;
	const suspensionModel = window.suspensionModel || window.currentModel;
	if (!collider0 || (!collider0.CENTRE && !collider0.POSITION) || !collider0.SIZE || !scene || !suspensionModel) {
		if (window.colliderHelper) window.colliderHelper.visible = false;
		return;
	}
	const centerStr = collider0.CENTRE || collider0.POSITION;
	const cVals = String(centerStr).split(',').map(v => parseFloat(v.trim()));
	const sVals = String(collider0.SIZE).split(',').map(v => parseFloat(v.trim()));
	if (cVals.length < 3 || sVals.length < 3 || cVals.some(isNaN) || sVals.some(isNaN)) {
		console.warn("[COLLIDER] 表示中断: 座標数値が不正です");
		return;
	}
	// GRAPHICS_OFFSET の取得
	let gOffset = {
		x: 0,
		y: 0,
		z: 0
	};
	const bOffsetStr = data?.BASIC?.GRAPHICS_OFFSET;
	if (bOffsetStr) {
		const parts = bOffsetStr.split(',').map(v => parseFloat(v.trim()));
		gOffset.x = parts[0] || 0;
		gOffset.y = parts[1] || 0;
		gOffset.z = parts[2] || 0;
	}
	// 3Dメッシュの生成・更新
	if (!window.colliderHelper) {
		const geometry = new THREE.BoxGeometry(1, 1, 1);
		window.colliderHelper = window.createEdgeMesh(geometry, 0xff0000);
		window.colliderHelper.renderOrder = 2000;
		scene.add(window.colliderHelper);
	}
	// ★共通関数を使って高さと角度を取得
	const safeData = window.currentSuspensionData;
	if (safeData && typeof window.calculateCarAlignmentAtZ === 'function') {
		const cZ = cVals[2] - gOffset.z;
		const align = window.calculateCarAlignmentAtZ(cZ, safeData, data);
		const cX = cVals[0] + gOffset.x;
		const cY = align.radiusY + cVals[1] - align.baseY;
		window.colliderHelper.scale.set(sVals[0], sVals[1], sVals[2]);
		window.colliderHelper.position.set(cX, cY, cZ);
		window.colliderHelper.rotation.x = align.pitch;
	}
	if (window.suspensionVisibility && typeof window.suspensionVisibility.collider !== 'undefined') {
		window.colliderHelper.visible = window.suspensionVisibility.collider;
	} else {
		window.colliderHelper.visible = true;
	}
	window.colliderHelper.updateMatrixWorld(true);
	// --- 地上高の詳細計算（四隅の最低点） ---
	const halfWidth = sVals[0] / 2;
	const halfHeight = sVals[1] / 2;
	const halfDepth = sVals[2] / 2;
	const cornerPositions = [
		new THREE.Vector3(-halfWidth, -halfHeight, halfDepth),
		new THREE.Vector3(halfWidth, -halfHeight, halfDepth),
		new THREE.Vector3(-halfWidth, -halfHeight, -halfDepth),
		new THREE.Vector3(halfWidth, -halfHeight, -halfDepth)
	];
	let minBottomY = Infinity;
	cornerPositions.forEach(pos => {
		pos.applyMatrix4(window.colliderHelper.matrixWorld);
		if (pos.y < minBottomY) minBottomY = pos.y;
	});
	const groundClearanceMm = (minBottomY * 1000).toFixed(1);
	// UIへの反映（エディター側とオーバーレイ側の両方を一括処理）
	const clearanceDisplay = document.getElementById('ground-clearance-mm');
	const tijyouVal = document.querySelector('#stroke-tijyou-val .main-rate');
	if (clearanceDisplay) {
		clearanceDisplay.textContent = groundClearanceMm;
		if (minBottomY < 0) clearanceDisplay.classList.add('clearance-warning');
		else clearanceDisplay.classList.remove('clearance-warning');
	}
	if (tijyouVal) {
		tijyouVal.textContent = groundClearanceMm;
		if (minBottomY < 0) tijyouVal.classList.add('is-negative');
		else tijyouVal.classList.remove('is-negative');
	}
	if (typeof window.requestRender === 'function') window.requestRender();
};
// --- 3. UI（エディター）生成ロジック ---
window.initColliderEditor = function(data) {
	const container = document.getElementById('colliders-data-container');
	if (!container || !data) return;
	container.innerHTML = '';
	const tabMenu = document.createElement('div');
	tabMenu.className = 'suspension-tab-menu';
	const contentArea = document.createElement('div');
	contentArea.className = 'suspension-tab-content';
	container.appendChild(tabMenu);
	container.appendChild(contentArea);
	const btn = document.createElement('button');
	btn.textContent = '衝突判定設定';
	btn.className = 'suspension-tab-btn active';
	tabMenu.appendChild(btn);
	const panel = document.createElement('div');
	panel.className = 'suspension-tab-panel active';
	contentArea.appendChild(panel);
	const addColliderInput = (parent, section, key, val) => {
		const isCoord = String(val).includes(',');
		const vals = isCoord ? val.split(',').map(v => v.trim()) : [val];
		const itemDiv = document.createElement('div');
		itemDiv.className = 'suspension-item' + (isCoord ? ' is-coordinate' : '');
		let inputsHtml = vals.map((v, i) => {
			// ★追加：特定のキー（VERSIONなど）はセレクトボックスにする
			if (key === 'VERSION') {
				// Assetto Corsa の拡張物理で使われるバージョンをリストアップ
				const options = ['1', '2', 'extended-2'];
				// 現在の値がリストに無い場合は追加しておく（カスタム対応）
				if (!options.includes(v) && v !== "") options.push(v);
				
				const optionsHtml = options.map(opt => 
					`<option value="${opt}" ${opt === v ? 'selected' : ''}>${opt}</option>`
				).join('');
				
				return `<select class="text-input" data-idx="${i}">${optionsHtml}</select>`;
			}

			const editorRule = window.getEditorStep(key, v);
			const currentStep = typeof editorRule === 'object' ? editorRule.step : editorRule;
			const currentMin = typeof editorRule === 'object' && editorRule.min !== "" ? ` min="${editorRule.min}"` : "";
			const currentMax = typeof editorRule === 'object' && editorRule.max !== "" ? ` max="${editorRule.max}"` : "";
			
			const inputType = isNaN(v) ? "text" : "number";
			
			return `<input type="${inputType}" class="text-input" data-idx="${i}" value="${v}" step="${currentStep}"${currentMin}${currentMax}>`;
		}).join('');
		itemDiv.innerHTML = `
			<div class="input-unit">
				<label>${key} ${isCoord ? '<span class="coord-label">(X, Y, Z)</span>' : ''}</label>
				<div class="input-with-range">${inputsHtml}</div>
			</div>
		`;
		parent.appendChild(itemDiv);
		// ★修正：input だけでなく select の変更も検知できるようにする
		itemDiv.querySelectorAll('input, select').forEach((input, _, all) => {
			input.addEventListener('input', () => {
				const newVals = Array.from(all).map(i => i.value);
				const newVal = isCoord ? newVals.join(',') : newVals[0];
				data[section][key] = newVal;
				if (window.currentCarData) {
					if (!window.currentCarData[section]) window.currentCarData[section] = {};
					window.currentCarData[section][key] = newVal;
				}
				window.updateColliderVisuals();
			});
		});
	};
	const sections = [{
		section: 'HEADER',
		keys: ['VERSION']
	}, {
		section: 'COLLIDER_0',
		keys: ['CENTRE', 'SIZE']
	}];
	sections.forEach(s => {
		if (!data[s.section]) return;
		const wrapper = document.createElement('article');
		wrapper.innerHTML = `<div class="suspension-item-title_box"><p>${s.section}</p></div>`;
		const box = document.createElement('div');
		box.className = 'suspension-item_box';
		s.keys.forEach(k => addColliderInput(box, s.section, k, data[s.section][k] || ""));
		wrapper.appendChild(box);
		panel.appendChild(wrapper);
	});
};
// --- 4. ファイル読み込みイベント ---
document.addEventListener('DOMContentLoaded', () => {
	const fileInput = document.getElementById('collidersFile');
	if (fileInput) {
		fileInput.addEventListener('change', (e) => {
			const file = e.target.files[0];
			if (!file) return;
			const reader = new FileReader();
			reader.onload = (event) => {
				if (typeof window.parseINI === 'function') {
					const parsed = window.parseINI(event.target.result);
					window.currentCarData = {
						...window.currentCarData,
						...parsed
					};
					window.initColliderEditor(parsed);
					window.updateColliderVisuals();
				}
			};
			reader.readAsText(file);
		});
	}
});