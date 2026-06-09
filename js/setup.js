// js/setup.js
window.currentSetupData = null;
window.activeSetupTab = 'BASIC'; // 初期メインタブ
window.activeSetupSubTab = null; // 初期サブタブ
// 1. 初期化処理
window.initSetupEditor = function(data) {
	window.currentSetupData = data || window.currentSetupData;
	if (!window.currentSetupData) return;
	const tabs = getAvailableTabs();
	const firstTab = tabs[1] || tabs[0];
	if (firstTab) window.activeSetupTab = firstTab;
	window.activeSetupSubTab = null;
	window.renderSetupUI();
};

function getAvailableTabs() {
	const data = window.currentSetupData;
	const tabs = new Set(['BASIC', 'GEAR']);
	for (const section in data) {
		// ギア関連の除外判定を、ギアセット数に応じて切り替える
		const isGearSection = section.startsWith('GEAR_') || section === 'FINAL_GEAR_RATIO';
		const shouldHide = (window.gearSetList.length > 1 && isGearSection) || section === 'GEARS' || section === 'DISPLAY_METHOD';
		if (shouldHide) {
			continue;
		}
		if (data[section].TAB) {
			tabs.add(data[section].TAB);
		}
	}
	return Array.from(tabs);
}
// 2. UIの描画
window.renderSetupUI = function() {
	let container = document.getElementById('setup-editor-container') || document.getElementById('setup-editor');
	if (!container) return;
	const data = window.currentSetupData;
	const groups = {
		'BASIC': {}
	};
	for (const section in data) {
		// ギア関連の表示判定
		const isGearSection = section.startsWith('GEAR_') || section === 'FINAL_GEAR_RATIO';
		const shouldHide = (window.gearSetList.length > 1 && isGearSection) || section === 'GEARS' || section === 'DISPLAY_METHOD';
		if (shouldHide) {
			continue;
		}
		const secData = data[section];
		if (!secData.TAB) {
			groups['BASIC'][section] = secData;
		} else {
			const tabName = secData.TAB;
			if (!groups[tabName]) groups[tabName] = {};
			groups[tabName][section] = secData;
		}
	}
	const tabNames = getAvailableTabs();
	let html = '<div class="suspension-tab-menu">';
	tabNames.forEach(tab => {
		const isActive = (tab === window.activeSetupTab) ? 'active' : '';
		html += `<button class="suspension-tab-btn ${isActive}" onclick="window.setSetupTab('${tab}')">${tab}</button>`;
	});
	html += '</div>';
	const activeGroup = groups[window.activeSetupTab] || {};
	const subGroups = {};
	for (const sectionName in activeGroup) {
		let subTab = 'General';
		const nameUpper = sectionName.toUpperCase();
		if (window.activeSetupTab === 'SUSPENSION' || window.activeSetupTab === 'SUSPENSIONS') {
			if (nameUpper.includes('SPRING')) subTab = 'Springs';
			else if (nameUpper.includes('ROD_LENGTH')) subTab = 'Heights';
			else if (nameUpper.includes('ARB')) subTab = 'ARB';
		} else if (window.activeSetupTab === 'DAMPERS') {
			if (nameUpper.endsWith('_LF')) subTab = 'LF';
			else if (nameUpper.endsWith('_RF')) subTab = 'RF';
			else if (nameUpper.endsWith('_LR')) subTab = 'LR';
			else if (nameUpper.endsWith('_RR')) subTab = 'RR';
		} else if (window.activeSetupTab === 'ALIGNMENT') {
			if (nameUpper.includes('CAMBER')) subTab = 'Camber';
			else if (nameUpper.includes('TOE')) subTab = 'Toe';
		} else if (window.activeSetupTab === 'TYRES') {
			if (nameUpper.includes('PRESSURE')) subTab = 'Pressure';
		}
		if (!subGroups[subTab]) subGroups[subTab] = {};
		subGroups[subTab][sectionName] = activeGroup[sectionName];
	}
	const subTabNames = Object.keys(subGroups);
	if (!window.activeSetupSubTab || !subTabNames.includes(window.activeSetupSubTab)) {
		window.activeSetupSubTab = subTabNames[0];
	}
	if (subTabNames.length > 1) {
		html += `<div class="setup-subtab-menu">`;
		subTabNames.forEach(subTab => {
			const activeClass = (subTab === window.activeSetupSubTab) ? ' active' : '';
			html += `<button class="setup-subtab-btn${activeClass}" onclick="window.setSetupSubTab('${subTab}')">${subTab}</button>`;
		});
		html += `</div>`;
	}
	html += '<div class="suspension-tab-content">';
	html += `<div class="suspension-tab-panel setup-panel-${window.activeSetupTab} active">`;
	// ★ ここから追加：GEARタブ専用の右側エディターUI生成
	if (window.activeSetupTab === 'GEAR') {
		const gearsData = data['GEARS'] || {};
		const useGearset = gearsData['USE_GEARSET'] !== undefined ? gearsData['USE_GEARSET'] : '1';
		// 1. [GEARS] USE_GEARSETのセレクトボックス（編集可能）
		html += `<article class="setup-item-GEARS">`;
		html += `	<div class="suspension-item-title_box"><p>[GEARS]</p></div>`;
		html += `	<div class="suspension-item_box">`;
		html += `		<div class="suspension-item">`;
		html += `			<div class="input-unit">`;
		html += `				<label>USE_GEARSET</label>`;
		html += `				<div class="input-with-range">`;
		html += ` 				<select class="text-input GEAR_SET_select" onchange="window.currentSetupData['GEARS']['USE_GEARSET'] = this.value; console.log('Updated USE_GEARSET to:', window.currentSetupData['GEARS']['USE_GEARSET']); window.renderSetupUI();">`;
		html += `						<option value="1" ${useGearset == '1' ? 'selected' : ''}>1 (有効)</option>`;
		html += `						<option value="0" ${useGearset == '0' ? 'selected' : ''}>0 (無効)</option>`;
		html += `					</select>`;
		html += `				</div>`;
		html += `			</div>`;
		html += `		</div>`;
		html += `	</div>`;
		html += `</article>`;
		// 2. [GEAR_SET_X] のデータ表示（drivetrain.jsのリストを直接読み取って同期する）
		if (window.gearSetList && window.gearSetList.length > 0) {
			window.gearSetList.forEach((set, idx) => {
				const section = `GEAR_SET_${idx}`;
				html += `<article class="setup-item-${section}">`;
				html += `	<div class="suspension-item-title_box GEAR_SET_name">
				<p>[${section}]</p>
				<p>name：${set.name}</p>
				</div>`;
				html += `	<div class="suspension-item_box GEAR_SET_data">`; // 編集不可にするためのスタイル
				const gears = set.data.GEARS || {};
				let keys = Object.keys(gears).filter(k => k.startsWith('GEAR_') && k !== 'GEAR_R');
				// ギアの数字順に並び替え
				keys.sort((a, b) => parseInt(a.replace('GEAR_', '')) - parseInt(b.replace('GEAR_', '')));
				keys.forEach(k => {
					if (gears[k] !== undefined && gears[k] !== "") {
						html += `		<div class="suspension-item">`;
						html += `			<div class="input-unit GEAR_SET_gear_data"><label>${k}</label><div class="input-with-range"><span>${gears[k]}</span></div></div>`;
						html += `		</div>`;
					}
				});
				html += `	</div>`;
				html += `</article>`;
			});
		}
		// 3. [FINAL_GEAR_RATIO] のデータ表示（閲覧のみ）
		if (data['FINAL_GEAR_RATIO']) {
			const fin = data['FINAL_GEAR_RATIO'];
			html += `<article class="setup-item-FINAL_GEAR_RATIO">`;
			html += `	<div class="suspension-item-title_box"><p>[FINAL_GEAR_RATIO]</p></div>`;
			html += `	<div class="suspension-item_box GEAR_SET_data">`;
			['NAME', 'RATIOS', 'POS_X', 'POS_Y'].forEach(key => {
				if (fin[key] !== undefined) {
					html += `		<div class="suspension-item">`;
					html += `			<div class="input-unit GEAR_SET_gear_data"><label>${key}</label><div class="input-with-range"><span">${fin[key]}</span></div></div>`;
					html += `		</div>`;
				}
			});
			html += `	</div>`;
			html += `</article>`;
		}
		html += '</div></div>';
		container.innerHTML = html;
		// 左側のプレビューを更新して処理を終了
		if (typeof window.renderSetupPreview === 'function') window.renderSetupPreview();
		return;
	}
	// ELECTRONICSタブの時、engine.iniのTURBO情報を閲覧用として表示
	if (window.activeSetupTab === 'ELECTRONICS') {
		// engine.iniのデータを取得（なければスキップ）
		let engineData = window.currentEngineData;
		if (!engineData && window.ini_DATA && window.ini_DATA['engine.ini']) {
			engineData = window.ini_DATA['engine.ini'];
		}
		if (engineData && engineData.TURBO_0 && engineData.ENGINE_DATA) {
			const isAdjustable = engineData.TURBO_0.COCKPIT_ADJUSTABLE == '1';
			const defaultBoost = parseFloat(engineData.ENGINE_DATA.DEFAULT_TURBO_ADJUSTMENT) || 0;
			// コックピット調整が有効な場合のみ表示する
			if (isAdjustable) {
				html += `<article class="setup-item-TURBO-INFO">`;
				html += `	<div class="suspension-item-title_box" style="display: flex; justify-content: space-between; align-items: center; padding-right: 10px;"><p>[TURBO_INFO] (Read Only)</p></div>`;
				// 編集不可（グレーアウト）にするためのスタイル
				html += `	<div class="suspension-item_box" style="opacity: 0.6; pointer-events: none;">`;
				// ターボ初期値（％表示に変換して表示）
				html += `		<div class="suspension-item">`;
				html += `			<div class="input-unit GEAR_SET_gear_data"><label>TURBO (初期値)</label><div class="input-with-range"><span style="color:#aaa; padding-left:10px;">${Math.round(defaultBoost * 100)} %</span></div></div>`;
				html += `		</div>`;
				// 参考にMAXブースト圧も表示しておく
				if (engineData.TURBO_0.DISPLAY_MAX_BOOST) {
					html += `		<div class="suspension-item">`;
					html += `			<div class="input-unit GEAR_SET_gear_data"><label>MAX_BOOST</label><div class="input-with-range"><span style="color:#aaa; padding-left:10px;">${engineData.TURBO_0.DISPLAY_MAX_BOOST} bar</span></div></div>`;
					html += `		</div>`;
				}
				html += `	</div>`;
				html += `</article>`;
			}
		}
	}
	const activeSubGroup = subGroups[window.activeSetupSubTab] || {};
	for (const sectionName in activeSubGroup) {
		const isActive = activeSubGroup[sectionName].__is_active !== false;
		const opacityStyle = isActive ? '1' : '0.4';
		// --- ★ここだけ追加：大見出しから「DAMP_」と車輪コード（_LF等）を削る ---
		let displaySectionName = sectionName.replace('DAMP_', '').replace('_LF', '').replace('_RF', '').replace('_LR', '').replace('_RR', '');
		html += `
			<article class="setup-item-${sectionName}">
				<div class="suspension-item-title_box setup-item-title_box">
					<p>${displaySectionName}</p>
					<label>
						<input type="checkbox" onchange="window.toggleSectionActive('${sectionName}', this.checked)" ${isActive ? 'checked' : ''}>
					</label>
				</div>
				<div class="suspension-item_box" style="opacity: ${opacityStyle}; transition: opacity 0.2s;">
		`;
		const secData = activeSubGroup[sectionName];
		for (const key in secData) {
			if (['TAB', 'HELP', 'NAME', '__is_active'].includes(key)) continue;
			const val = secData[key];
			let inputHtml = "";
			if (key === 'SHOW_CLICKS') {
				const is0 = (val == 0) ? 'selected' : '';
				const is1 = (val == 1) ? 'selected' : '';
				inputHtml = `
					<select class="text-input" style="cursor: pointer; padding: 2px 4px;" 
							onchange="window.currentSetupData['${sectionName}']['${key}'] = this.value; window.renderSetupPreview();">
						<option value="0" ${is0}>0 (数値表示)</option>
						<option value="1" ${is1}>1 (クリック表示)</option>
					</select>
				`;
			} else {
				const inputType = isNaN(val) ? 'text' : 'number';
				let currentStep = "1";
				let currentMin = "";
				let currentMax = "";
				// ★大掃除：司令塔から「データの塊（step, min, max）」を受け取る
				if (inputType === 'number') {
					const editorRule = typeof window.getEditorStep === 'function' ? window.getEditorStep(key, val) : null;
					if (editorRule) {
						currentStep = typeof editorRule === 'object' ? editorRule.step : editorRule;
						currentMin = typeof editorRule === 'object' && editorRule.min !== "" ? ` min="${editorRule.min}"` : "";
						currentMax = typeof editorRule === 'object' && editorRule.max !== "" ? ` max="${editorRule.max}"` : "";
					} else {
						currentStep = String(val).includes('.') ? '0.01' : '1';
					}
				}
				// ※ setup.ini 特有の安全装置（POS_X, POS_Y はレイアウト用なので範囲を固定）
				if (key === 'POS_X') {
					if (!currentMin) currentMin = ' min="0"';
					if (!currentMax) currentMax = ' max="1"';
				} else if (key === 'POS_Y') {
					if (!currentMin) currentMin = ' min="0"';
					if (!currentMax) currentMax = ' max="8"';
				}
				inputHtml = `
					<input type="${inputType}" class="text-input" value="${val}" step="${currentStep}"${currentMin}${currentMax}
						onchange="window.currentSetupData['${sectionName}']['${key}'] = this.value; window.renderSetupPreview();">
				`;
			}
			html += `
					<div class="suspension-item">
						<div class="input-unit">
							<label>${key}</label>
							<div class="input-with-range">${inputHtml}</div>
						</div>
					</div>
			`;
		}
		html += `</div></article>`;
	}
	html += '</div></div>';
	container.innerHTML = html;
	// ★欠落させていたプレビュー描画処理（これで左側も消えません）
	if (typeof window.renderSetupPreview === 'function') {
		window.renderSetupPreview();
	}
};
window.toggleSectionActive = function(sectionName, isChecked) {
	if (window.currentSetupData && window.currentSetupData[sectionName]) {
		window.currentSetupData[sectionName].__is_active = isChecked;
		window.renderSetupUI();
		window.renderSetupPreview();
	}
};
window.setSetupTab = function(tab) {
	window.activeSetupTab = tab;
	window.activeSetupSubTab = null;
	window.renderSetupUI();
};
window.setSetupSubTab = function(subTab) {
	window.activeSetupSubTab = subTab;
	window.renderSetupUI();
};
// 4. AC風ピット画面プレビューを生成する関数
// window.renderSetupPreview = function() {
// 	let previewArea = document.getElementById('preview-setup') || document.querySelector('#section-setup .preview-area_box');
// 	if (!previewArea) return;
// 	const data = window.currentSetupData;
// 	if (!data) return;
// 	const activeTab = window.activeSetupTab || 'BASIC';
// 	let colLeft = '',
// 		colCenter = '',
// 		colRight = '';
// 	const rowHeight = 45;
// 	for (const section in data) {
// 		const item = data[section];
// 		if (item.__is_active === false) continue;
// 		const itemTab = item.TAB || 'BASIC';
// 		if (itemTab !== activeTab) continue;
// 		const name = item.NAME || section;
// 		const min = parseFloat(item.MIN) || 0;
// 		const max = parseFloat(item.MAX) || 0;
// 		const step = parseFloat(item.STEP) || 1;
// 		const posX = parseFloat(item.POS_X) || 0;
// 		const posY = parseFloat(item.POS_Y) || 0;
// 		let currentValue = min + ((max - min) / 2);
// 		let percentage = ((currentValue - min) / (max - min)) * 100;
// 		if (isNaN(percentage)) percentage = 0;
// 		const topPos = posY * rowHeight;
// 		const sliderHtml = `
// 			<div class="ac-slider-wrapper" style="top: ${topPos}px;" id="preview-wrap-${section}">
// 				<button class="ac-slider-btn" onclick="document.getElementById('preview-input-${section}').stepDown(); document.getElementById('preview-input-${section}').dispatchEvent(new Event('input'))">◀</button>
// 				<div class="ac-slider-track-area">
// 					<div class="ac-slider-fill" id="preview-fill-${section}" style="width: ${percentage}%;"></div>
// 					<div class="ac-slider-text">
// 						<span class="ac-slider-name">${name}</span>
// 						<span class="ac-slider-value" id="preview-val-${section}">${currentValue}</span>
// 					</div>
// 					<input type="range" class="ac-slider-input" id="preview-input-${section}" 
// 						min="${min}" max="${max}" step="${step}" value="${currentValue}"
// 						oninput="
// 							document.getElementById('preview-val-${section}').innerText = this.value;
// 							document.getElementById('preview-fill-${section}').style.width = ((this.value - this.min) / (this.max - this.min) * 100) + '%';
// 						">
// 				</div>
// 				<button class="ac-slider-btn" onclick="document.getElementById('preview-input-${section}').stepUp(); document.getElementById('preview-input-${section}').dispatchEvent(new Event('input'))">▶</button>
// 			</div>
// 		`;
// 		if (posX === 0) colLeft += sliderHtml;
// 		else if (posX === 0.5) colCenter += sliderHtml;
// 		else if (posX === 1) colRight += sliderHtml;
// 	}
// 	previewArea.innerHTML = `
// 		<div class="setup-preview-container">
// 			<div class="setup-col left-col">${colLeft}</div>
// 			<div class="setup-col center-col">${colCenter}</div>
// 			<div class="setup-col right-col">${colRight}</div>
// 		</div>
// 	`;
// };
// 仮想ピットのトランスミッション・プレビューを描画する
// プレビュー操作用のインデックス
window.previewSetupGearIdx = 0;
window.previewSetupFinalIdx = 0;
// ◀ ▶ ボタンでミッションを切り替える関数
window.changePreviewGearSet = function(dir) {
	if (!window.gearSetList || window.gearSetList.length === 0) return;
	window.previewSetupGearIdx += dir;
	if (window.previewSetupGearIdx < 0) window.previewSetupGearIdx = window.gearSetList.length - 1;
	if (window.previewSetupGearIdx >= window.gearSetList.length) window.previewSetupGearIdx = 0;
	if (typeof window.renderTransmissionPreview === 'function') {
		window.renderTransmissionPreview();
	}
};
// ◀ ▶ ボタンでファイナルギアを切り替える関数
window.changePreviewFinal = function(dir) {
	if (!window.finalRtoList || window.finalRtoList.length === 0) return;
	window.previewSetupFinalIdx += dir;
	if (window.previewSetupFinalIdx < 0) window.previewSetupFinalIdx = window.finalRtoList.length - 1;
	if (window.previewSetupFinalIdx >= window.finalRtoList.length) window.previewSetupFinalIdx = 0;
	if (typeof window.renderTransmissionPreview === 'function') {
		window.renderTransmissionPreview();
	}
};
// ★ これが抜けていた「AC風ピット画面」を描画する関数 ★
window.renderTransmissionPreview = function() {
	const previewArea = document.getElementById('preview-setup') || document.querySelector('#section-setup .preview-area_box');
	if (!previewArea) return;
	const gearSets = window.gearSetList || [];
	const finals = window.finalRtoList || [];
	const currentSet = gearSets[window.previewSetupGearIdx] || {
		name: "No Data",
		data: {
			GEARS: {}
		}
	};
	const currentFinalObj = finals[window.previewSetupFinalIdx] || {
		label: "N/A",
		value: 1
	};
	const currentFinal = parseFloat(currentFinalObj.value) || 1;
	// 最高速の計算用データ
	let limiter = 7500;
	if (window.ini_DATA && window.ini_DATA['engine.ini']?.ENGINE_DATA?.LIMITER) {
		limiter = parseFloat(window.ini_DATA['engine.ini'].ENGINE_DATA.LIMITER);
	} else if (window.currentEngineData?.ENGINE_DATA?.LIMITER) {
		limiter = parseFloat(window.currentEngineData.ENGINE_DATA.LIMITER);
	}
	let radius = 0.32;
	if (window.ini_DATA && window.ini_DATA['tyres.ini']?.REAR?.RADIUS) {
		radius = parseFloat(window.ini_DATA['tyres.ini'].REAR.RADIUS);
	} else if (window.currentTyreData?.REAR?.RADIUS) {
		radius = parseFloat(window.currentTyreData.REAR.RADIUS);
	}
	const wheelCirc = 2 * Math.PI * radius;
	const gears = currentSet.data.GEARS || {};
	const count = parseInt(gears.COUNT) || 5;
	// ギアごとの最高速リストを生成
	let tableHtml = `
		<div class="transmission-gear-ratio_box">
			<div class="transmission-gear-ratio-title_box">
				<div class="transmission-gear-ratio-title">Gear</div>
				<div class="transmission-gear-ratio-speed">Top speed (km/h)</div>
			</div>`;
	for (let i = 1; i <= count; i++) {
		const ratio = parseFloat(gears[`GEAR_${i}`]);
		if (ratio) {
			const speed = (limiter * 60 * wheelCirc) / (ratio * currentFinal * 1000);
			tableHtml += `
			<div class="transmission-gear-ratio-data_box">
				<div>${i}</div>
				<div>${Math.round(speed)} km/h</div>
			</div>`;
		}
	}
	tableHtml += `</div>`;
	// アセットコルサのUIをCSSで再現
	const html = `
	<div class="setup-gear-preview_box">
		<div class="setup-gear-preview-title_box">GEAR_SETS</div>
		<div class="transmission-name_box">
			<button onclick="window.changePreviewGearSet(-1)">◀</button>
			<div>${currentSet.name}</div>
			<button onclick="window.changePreviewGearSet(1)"">▶</button>
		</div>

		${tableHtml}

		<div class="final-gear-title_box">Final Gear Ratio</div>
		<div class="final-gear-rate_box">
			<button onclick="window.changePreviewFinal(-1)">◀</button>
			<div>${currentFinalObj.label}</div>
			<button onclick="window.changePreviewFinal(1)">▶</button>
		</div>

		<div class="gear-table_box">
			<canvas id="setupGearChart"></canvas>
		</div>

	</div>
	`;
	previewArea.innerHTML = html;
	if (typeof window.renderSetupGearChart === 'function') {
		window.renderSetupGearChart(currentSet, currentFinal, limiter, wheelCirc, count);
	}
};
// 4. スライダーまたはAC風ピット画面を振り分けて生成する関数
window.renderSetupPreview = function() {
	let previewArea = document.getElementById('preview-setup') || document.querySelector('#section-setup .preview-area_box');
	if (!previewArea) return;
	const activeTab = window.activeSetupTab || 'BASIC';
	// ★変更：GEARタブが開かれている時はスライダーを描画せず、ギアUIを表示する
	if (activeTab === 'GEAR') {
		if (typeof window.renderTransmissionPreview === 'function') {
			window.renderTransmissionPreview();
		}
		return;
	}
	const data = window.currentSetupData;
	if (!data) return;
	// --- 以下は他のタブ（SUSPENSIONやAEROなど）が選ばれた時の、従来のスライダー描画処理 ---
	let colLeft = '',
		colCenter = '',
		colRight = '';
	const rowHeight = 45;
	for (const section in data) {
		const item = data[section];
		if (item.__is_active === false) continue;
		const itemTab = item.TAB || 'BASIC';
		if (itemTab !== activeTab) continue;
		const name = item.NAME || section;
		const min = parseFloat(item.MIN) || 0;
		const max = parseFloat(item.MAX) || 0;
		const step = parseFloat(item.STEP) || 1;
		const posX = parseFloat(item.POS_X) || 0;
		const posY = parseFloat(item.POS_Y) || 0;
		let currentValue = min + ((max - min) / 2);
		let percentage = ((currentValue - min) / (max - min)) * 100;
		if (isNaN(percentage)) percentage = 0;
		const topPos = posY * rowHeight;
		const sliderHtml = `
			<div class="ac-slider-wrapper" style="top: ${topPos}px;" id="preview-wrap-${section}">
				<button class="ac-slider-btn" onclick="document.getElementById('preview-input-${section}').stepDown(); document.getElementById('preview-input-${section}').dispatchEvent(new Event('input'))">◀</button>
				<div class="ac-slider-track-area">
					<div class="ac-slider-fill" id="preview-fill-${section}" style="width: ${percentage}%;"></div>
					<div class="ac-slider-text">
						<span class="ac-slider-name">${name}</span>
						<span class="ac-slider-value" id="preview-val-${section}">${currentValue}</span>
					</div>
					<input type="range" class="ac-slider-input" id="preview-input-${section}" 
						min="${min}" max="${max}" step="${step}" value="${currentValue}"
						oninput="
							document.getElementById('preview-val-${section}').innerText = this.value;
							document.getElementById('preview-fill-${section}').style.width = ((this.value - this.min) / (this.max - this.min) * 100) + '%';
						">
				</div>
				<button class="ac-slider-btn" onclick="document.getElementById('preview-input-${section}').stepUp(); document.getElementById('preview-input-${section}').dispatchEvent(new Event('input'))">▶</button>
			</div>
		`;
		if (posX === 0) colLeft += sliderHtml;
		else if (posX === 0.5) colCenter += sliderHtml;
		else if (posX === 1) colRight += sliderHtml;
	}
	// プレビュー画面へのTURBOスライダー(閲覧用)の割り込み表示
	if (activeTab === 'ELECTRONICS') {
		let engineData = window.currentEngineData;
		if (!engineData && window.ini_DATA && window.ini_DATA['engine.ini']) {
			engineData = window.ini_DATA['engine.ini'];
		}
		if (engineData && engineData.TURBO_0 && engineData.ENGINE_DATA) {
			const isAdjustable = engineData.TURBO_0.COCKPIT_ADJUSTABLE == '1';
			if (isAdjustable) {
				const defaultBoost = parseFloat(engineData.ENGINE_DATA.DEFAULT_TURBO_ADJUSTMENT) || 0;
				const percentage = Math.round(defaultBoost * 100);
				// アセットコルサの実機に合わせて中央カラムの一番上(POS_Y=0)に配置
				const topPos = 0;
				// 閲覧専用のため、opacityを下げてクリック操作を無効化(pointer-events: none)
				const turboSliderHtml = `
					<div class="ac-slider-wrapper" style="top: ${topPos}px; opacity: 0.6; pointer-events: none;" id="preview-wrap-TURBO">
						<button class="ac-slider-btn">◀</button>
						<div class="ac-slider-track-area">
							<div class="ac-slider-fill" style="width: ${percentage}%; background-color: #666;"></div>
							<div class="ac-slider-text">
								<span class="ac-slider-name">TURBO</span>
								<span class="ac-slider-value">${percentage}%</span>
							</div>
							<input type="range" class="ac-slider-input" disabled min="0" max="100" value="${percentage}">
						</div>
						<button class="ac-slider-btn">▶</button>
					</div>
				`;
				colCenter += turboSliderHtml;
			}
		}
	}
	previewArea.innerHTML = `
		<div class="setup-preview-container">
			<div class="setup-col left-col">${colLeft}</div>
			<div class="setup-col center-col">${colCenter}</div>
			<div class="setup-col right-col">${colRight}</div>
		</div>
	`;
};
// グラフ描画関数
window.renderSetupGearChart = function(currentSet, finalRatio, limiter, wheelCirc, count) {
	const canvas = document.getElementById('setupGearChart');
	if (!canvas) return;
	const gears = currentSet.data.GEARS || {};
	const datasets = [];
	let lastMaxSpeed = 0;
	let lastRatio = 0;
	for (let i = 1; i <= count; i++) {
		const ratio = parseFloat(gears[`GEAR_${i}`]);
		if (!ratio || ratio <= 0) continue;
		const currentMaxSpeed = (limiter * 60 * wheelCirc) / (ratio * finalRatio * 1000);
		let startRPM = 0;
		let startSpeed = 0;
		if (lastRatio > 0) {
			startSpeed = lastMaxSpeed;
			startRPM = limiter * (ratio / lastRatio);
		}
		datasets.push({
			label: `G${i}`,
			data: [{
				x: startSpeed,
				y: startRPM
			}, {
				x: currentMaxSpeed,
				y: limiter
			}],
			borderColor: '#e00000',
			borderWidth: 2,
			showLine: true,
			pointRadius: 0,
			tension: 0
		});
		if (lastRatio > 0) {
			datasets.push({
				label: `Drop G${i}`,
				data: [{
					x: startSpeed,
					y: limiter
				}, {
					x: startSpeed,
					y: startRPM
				}],
				borderColor: '#e00000',
				borderWidth: 1,
				borderDash: [5, 5],
				showLine: true,
				pointRadius: 0,
				tension: 0
			});
		}
		lastMaxSpeed = currentMaxSpeed;
		lastRatio = ratio;
	}
	if (window.setupGearChartInstance) {
		window.setupGearChartInstance.destroy();
	}
	window.setupGearChartInstance = new Chart(canvas, {
		type: 'scatter',
		data: {
			datasets: datasets
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			animation: false,
			scales: {
				x: {
					title: {
						display: true,
						text: 'km/h',
						color: '#888',
						align: 'end'
					},
					min: 0,
					grid: {
						color: 'rgba(255, 255, 255, 0.1)'
					},
					ticks: {
						color: '#888'
					}
				},
				y: {
					title: {
						display: true,
						text: 'RPM',
						color: '#888',
						align: 'end'
					},
					min: 0,
					max: limiter,
					grid: {
						color: 'rgba(255, 255, 255, 0.1)'
					},
					ticks: {
						color: '#888'
					}
				}
			},
			plugins: {
				legend: {
					display: false
				},
				tooltip: {
					enabled: false
				}
			}
		}
	});
};