// js/tires.js
window.tiresChartInstance = null;
window.tyreCompoundList = [];
window.activeTyreIdx = 0;
// ★追加：現在開いているカテゴリタブの記憶
window.activeTyreSubTab = 'BASIC';
window.activeTyreSide = 'FRONT';
window.isTyreFirstLoad = true;
/**
 * 簡易ジェネレーター（Tire Wizard）の表示/非表示を切り替える
 */
window.toggleTyreWizardMode = function() {
	window.isTyreWizardMode = !window.isTyreWizardMode;
	window.renderTyreUI(); // UIを再描画してパネルを切り替え
};

/**
 * スライダーが動いた瞬間に物理数値を計算し、グラフと詳細データを更新する心臓部
 */
window.applyTyreWizard = function() {
	const currentCompound = window.tyreCompoundList[window.activeTyreIdx];
	if (!currentCompound) return;

	// 1. UIの入力値を取得
	const mass = parseFloat(document.getElementById('wiz-mass').value) || 1000;
	
	const fW = parseFloat(document.getElementById('wiz-f-w').value) || 235;
	const fA = parseFloat(document.getElementById('wiz-f-a').value) || 40;
	const fR = parseFloat(document.getElementById('wiz-f-r').value) || 18;

	const rW = parseFloat(document.getElementById('wiz-r-w').value) || 255;
	const rA = parseFloat(document.getElementById('wiz-r-a').value) || 35;
	const rR = parseFloat(document.getElementById('wiz-r-r').value) || 18;

	const gripLevel = parseFloat(document.getElementById('wiz-grip').value) || 1.18;
	const gripBal = parseFloat(document.getElementById('wiz-gbal').value) || 0.0;
	const loadSens = parseFloat(document.getElementById('wiz-load').value) || 0.60;
	const loadBal = parseFloat(document.getElementById('wiz-lbal').value) || 0.0;
	const slide = parseFloat(document.getElementById('wiz-slide').value) || 0.785;

	// 2. 物理値の自動計算アルゴリズム
	// ① 基準荷重(FZ0) = 車重を4輪で割った近似値（N）
	const fz0 = Math.round((mass * 9.80665) / 4.0);

	// ② グリップ＆荷重感度バランス
	const dyRef = gripLevel;
	const dxRef = gripLevel - gripBal; // 横を基準に、縦のバランスを足し引き
	const lsExpy = loadSens;
	const lsExpx = loadSens - loadBal;
	
	const falloffLevel = slide;

	// ③ 外径・リム径の自動計算ヘルパー（アセットコルサ本家の仕様）
	const calcTyreSize = (w, a, r) => {
		const widthM = w / 1000.0; // mm -> m
		const sidewallM = widthM * (a / 100.0); // 扁平率からサイドウォール高さを計算
		const rimRadiusM = (r * 0.0254) / 2.0; // インチ -> m
		const radiusM = rimRadiusM + sidewallM;
		// ★重要: ACの RIM_RADIUS は実寸より1インチ大きく設定する公式ルール
		const acRimRadius = ((r + 1) * 0.0254) / 2.0;
		return { width: widthM, radius: radiusM, rimRadius: acRimRadius };
	};

	const fSize = calcTyreSize(fW, fA, fR);
	const rSize = calcTyreSize(rW, rA, rR);

	// 3. タイヤデータ本体に上書き（FRONTとREAR）
	if (!currentCompound.data.FRONT) currentCompound.data.FRONT = {};
	if (!currentCompound.data.REAR) currentCompound.data.REAR = {};

	const updateData = (side, sizeObj) => {
		const d = currentCompound.data[side];
		d.WIDTH = sizeObj.width.toFixed(3);
		d.RADIUS = sizeObj.radius.toFixed(4);
		d.RIM_RADIUS = sizeObj.rimRadius.toFixed(4);
		d.FZ0 = fz0;
		d.DY_REF = dyRef.toFixed(3);
		d.DX_REF = dxRef.toFixed(3);
		d.LS_EXPY = lsExpy.toFixed(3);
		d.LS_EXPX = lsExpx.toFixed(3);
		d.FALLOFF_LEVEL = falloffLevel.toFixed(3);
	};

	updateData('FRONT', fSize);
	updateData('REAR', rSize);

	// 4. スライダー横の「緑色の数値テキスト」をリアルタイム更新
	document.getElementById('wiz-val-grip').innerText = gripLevel.toFixed(3);
	document.getElementById('wiz-val-gbal').innerText = gripBal.toFixed(3);
	document.getElementById('wiz-val-load').innerText = loadSens.toFixed(3);
	document.getElementById('wiz-val-lbal').innerText = loadBal.toFixed(3);
	document.getElementById('wiz-val-slide').innerText = slide.toFixed(3);

	// 5. 詳細モード（Advanced）の入力欄（input）にも数値を同期して流し込む
	const syncInputs = (side) => {
		const d = currentCompound.data[side];
		for (let key in d) {
			const input = document.getElementById(`input-${side}-${key}`);
			if (input) input.value = d[key];
		}
	};
	syncInputs('FRONT');
	syncInputs('REAR');

	// 6. 最後に、グラフを描画し直してウネウネ動かす！
	if (typeof window.updateTiresChart === 'function') {
		window.updateTiresChart();
	}
};

/**
 * 【ステップ1】 INIデータをコンパウンドごとのリストに変換する
 */
window.parseTyreDataToCompounds = function(data) {
	if (!data) return [];
	let list = [];
	let indices = new Set([0]);

	for (let sec in data) {
		let match = sec.match(/FRONT_(\d+)/) || sec.match(/REAR_(\d+)/);
		if (match) {
			indices.add(parseInt(match[1]));
		}
	}

	Array.from(indices).sort((a, b) => a - b).forEach(idx => {
		let fKey = idx === 0 ? 'FRONT' : `FRONT_${idx}`;
		let rKey = idx === 0 ? 'REAR' : `REAR_${idx}`;
		let tfKey = idx === 0 ? 'THERMAL_FRONT' : `THERMAL_FRONT_${idx}`;
		let trKey = idx === 0 ? 'THERMAL_REAR' : `THERMAL_REAR_${idx}`;

		if (data[fKey] || data[rKey]) {
			let name = data[fKey]?.NAME || data[rKey]?.NAME || `Compound ${idx}`;
			
			// 🔓 HEADERセクションのVERSIONを各タイヤデータへ引き継いでエディタ側で表示・編集可能にする
			let versionVal = data.HEADER?.VERSION !== undefined ? data.HEADER.VERSION : "10";
			if (data[fKey] && data[fKey].VERSION === undefined) data[fKey].VERSION = versionVal;
			if (data[rKey] && data[rKey].VERSION === undefined) data[rKey].VERSION = versionVal;

			list.push({
				index: idx,
				name: name,
				// ★修正：FRONTやREARだけでなく、INI全体のデータ（raw_ini）も一緒に同梱して引き渡す
				raw_ini: data,
				data: {
					FRONT: data[fKey] || {},
					REAR: data[rKey] || {},
					THERMAL_FRONT: data[tfKey] || {},
					THERMAL_REAR: data[trKey] || {}
				}
			});
		}
	});

	return list;
};


/**
 * 【ステップ2】 タイヤエディター全体のUI生成
 */
window.updateTyreEditorUI = function(data) {
	window.tyreCompoundList = window.parseTyreDataToCompounds(data);
	window.activeTyreIdx = 0;
	window.isTyreWizardMode = false;
	window.activeTyreSubTab = 'INFO';

	// ⚠️ tyres.iniが新しくインポートされ、かつ初回起動時ではない（2回目以降の読込）場合のみポップアップ警告を出す
	if (data && data.HEADER && data.HEADER.VERSION == '10') {
		// ⚠️ 起動から「2秒（2000ミリ秒）」以上経過している場合のみ許可（起動直後の連続ロードを完全ブロック）
		if (Date.now() - window.tyreAppStartTime > 2000) {
			setTimeout(() => {
				alert("⚠️ 注意: 新しく読み込まれたデータはVERSION=10が適用されています。「DY0、DY1、DX0、DX1、XMU」は走行物理計算から除外され、完全なダミーデータとして扱われます。");
			}, 100);
		}
	}
	// 初回読み込みが完了したためフラグを解除（これ以降のファイルインポートでポップアップが動くようになります）
	window.isTyreFirstLoad = false;

	window.renderTyreUI();
	if (typeof window.updateSpecsFromPhysics === 'function') {
		window.updateSpecsFromPhysics();
	}
};

/**
 * 【ステップ3】 画面の描画処理（左右分割のエディター生成）
 */
window.renderTyreUI = function() {
	const container = document.getElementById('tyre-data-container');
	if (!container) return;

	// タブと項目の設計図（セッティングの目的別に再構築）
	const tyreTabs = [
		{ id: 'GLOBAL', label: 'GLOBAL', keys: ['VERSION','INDEX', 'USE_LOAD', 'MAX_KM', 'CAMBER_WEAR'] },
		{ id: 'BASIC', label: 'BASIC', keys: ['NAME', 'SHORT_NAME', 'DESCRIPTION', 'WIDTH', 'RADIUS', 'RIM_RADIUS', 'ANGULAR_INERTIA', 'DAMP', 'RATE', 'FLEX', 'XMU', 'FZ0'] },
		{ id: 'LON_GRIP', label: 'LON', keys: ['DX_REF', 'DX0', 'DX1', 'LS_EXPX', 'CX_MULT', 'RADIUS_ANGULAR_K', 'BRAKE_DX_MOD'] },
		{ id: 'LAT_GRIP', label: 'LAT', keys: ['DY_REF', 'DY0', 'DY1', 'LS_EXPY', 'CAMBER_GAIN', 'DCAMBER_0', 'DCAMBER_1', 'FRICTION_LIMIT_ANGLE', 'COMBINED_FACTOR'] },
		{ id: 'SLIDE', label: 'SLIDE', keys: ['FLEX_GAIN', 'FLEX_GAIN_LOAD', 'FALLOFF_LEVEL', 'FALLOFF_SPEED', 'SPEED_SENSITIVITY', 'RELAXATION_LENGTH', 'ROLLING_RESISTANCE_0', 'ROLLING_RESISTANCE_1', 'ROLLING_RESISTANCE_SLIP'] },
		{ id: 'PRESSURE', label: 'PRESS', keys: ['PRESSURE_STATIC', 'PRESSURE_SPRING_GAIN', 'PRESSURE_FLEX_GAIN', 'PRESSURE_RR_GAIN', 'PRESSURE_D_GAIN', 'PRESSURE_IDEAL'] },
		{ id: 'THERMAL', label: 'TEMP', keys: ['PERFORMANCE_CURVE', 'SURFACE_TRANSFER', 'PATCH_TRANSFER', 'CORE_TRANSFER', 'INTERNAL_CORE_TRANSFER', 'FRICTION_K', 'ROLLING_K', 'SURFACE_ROLLING_K', 'COOL_FACTOR'] },
		{ id: 'WEAR', label: 'WEAR', keys: ['WEAR_CURVE', 'GRAIN_GAMMA', 'GRAIN_GAIN', 'BLISTER_GAMMA', 'BLISTER_GAIN', 'TYRE_RND', 'RIM_RND'] }
	];

	// タブ用の解説文
	const tabHelpMap = {
		'BASIC': 'タイヤの寸法や剛性、慣性など。縦・横グリップのベースとなる「XMU（基本摩擦）」と「FZ0（基準荷重）」もここで設定します。',
		'LON_GRIP': '縦グリップ（Lon FX）。加速（トラクション）やブレーキング時のグリップ力、荷重による縦グリップの変化を設定します。',
		'LAT_GRIP': '横グリップ（Lat FY）。コーナリング時の限界グリップ力、キャンバー角による影響、最大グリップを発揮する角度を設定します。',
		'SLIDE': '限界超過後の挙動。スライド時のグリップの抜け方（唐突かマイルドか）、ステア応答のラグ、転がり抵抗（ドリフトの失速感）を設定します。',
		'PRESSURE': '空気圧特性。空気圧の変化がタイヤの剛性やたわみ、転がり抵抗に与える影響を設定します。',
		'THERMAL': '熱特性。路面との摩擦・転がりによる発熱や冷却、温度によるグリップ変化（LUTファイル）を設定します。',
		'WEAR': '摩耗・ダメージ。摩耗（走行距離）によるグリップ低下（LUTファイル）や、グレーニング・ブリスターの発生しやすさを設定します。'
	};

	let subTabHtml = `<div class="suspension-tab-menu" id="tyre-subtab-menu" style="margin-top: 10px;">`;
	tyreTabs.forEach(tab => {
		const isActive = (window.activeTyreSubTab === tab.id) ? 'active' : '';
		subTabHtml += `<button class="suspension-tab-btn ${isActive}" onclick="window.setTyreSubTab('${tab.id}')">${tab.label}</button>`;
	});
	subTabHtml += `</div>`;

	// ★ 現在開いているタブの解説を取得
	const activeTabHelpText = tabHelpMap[window.activeTyreSubTab] || '';
	// ★ 修正：ここで先に currentCompound を取得しておく
	const currentCompound = window.tyreCompoundList[window.activeTyreIdx];
	if (!currentCompound) return;
	// ★ ウィザード用の初期値（現在のFRONTの数値から逆算してスライダーの位置を合わせる）
	const fData = currentCompound.data.FRONT || {};
	const currDyRef = parseFloat(fData.DY_REF) || 1.18;
	const currDxRef = parseFloat(fData.DX_REF) || 1.18;
	const currLsExpy = parseFloat(fData.LS_EXPY) || 0.60;
	const currLsExpx = parseFloat(fData.LS_EXPX) || 0.60;
	const currFalloff = parseFloat(fData.FALLOFF_LEVEL) || 0.785;

	const wGripLevel = currDyRef;
	const wGripBal = currDyRef - currDxRef;
	const wLoadSens = currLsExpy;
	const wLoadBal = currLsExpy - currLsExpx;
	const wSlide = currFalloff;

	// 大枠のHTML（追加された構造を反映）
	let html = `
		<div class="drivetrain-editor-layout">
			<article class="tyres_select-outer_box">
				<div id="tyres-explain_box" class="tyres_select-explain_box">
					<strong style="color: #4ade80;">[ ${window.activeTyreSubTab} タブ ]</strong><br>
					${activeTabHelpText}
					<hr style="border: 0; border-top: 1px dashed #555; margin: 8px 0;">
					<span style="font-size: 0.9em; color: #aaa;">
						※左のグラフは当アプリ独自の簡易シミュレーターです。<br>
						📊：グラフ波形が変化する項目<br>
						💪 🏎️ 🛞 💨：下のインジケーターが変化する項目<br>
					</span>
				</div>
				<aside class="gear-sidebar">
					<div class="suspension-item-title_box"><p>COMPOUNDS</p></div>
					<div id="tyre-compound-list" class="gear-set-list"></div>
					<div>
						<button class="add-set-btn" onclick="window.addTyreCompound()">+ 複製</button>
					</div>
				</aside>
			</article>
			<article style="width: 100%;">
				<div id="tyre-main-editor" class="gear-main-editor">
					<div class="suspension-item-title_box" style="display:flex; justify-content:space-between; align-items:center;">
						<p>TYRE DATA</p>
						<div class="extended-physics-switch-container" style="margin:0;">
							<span class="switch-label">🛠️ 簡易設定</span>
							<label class="toggle-switch">
								<input type="checkbox" id="tyre-wizard-toggle" ${window.isTyreWizardMode ? 'checked' : ''} onchange="window.toggleTyreWizardMode()">
								<span class="toggle-slider round"></span>
							</label>
						</div>
					</div>

					<div id="tyre-wizard-panel" style="display: ${window.isTyreWizardMode ? 'block' : 'none'};">
						<div class="tyre-wizard-specs">
							<div class="wiz-spec-row">
								<div class="wiz-spec-col">
									<label class="wiz-spec-label">Car Mass (kg)</label>
									<input type="number" id="wiz-mass" class="wiz-spec-input" value="1000" oninput="window.applyTyreWizard()">
								</div>
								<div class="wiz-spec-col">
									<label class="wiz-spec-label">Power (whp)</label>
									<input type="number" id="wiz-power" class="wiz-spec-input" value="300" oninput="window.applyTyreWizard()">
								</div>
							</div>
							
							<div class="wiz-spec-label">FRONT TIRE (Width / Aspect / Rim)</div>
							<div class="wiz-spec-row">
								<select id="wiz-f-w" class="wiz-spec-select" onchange="window.applyTyreWizard()">
									${Array.from({length: 27}, (_, i) => 175 + i*5).map(v => `<option value="${v}" ${v===235?'selected':''}>${v}</option>`).join('')}
								</select>
								<select id="wiz-f-a" class="wiz-spec-select" onchange="window.applyTyreWizard()">
									${Array.from({length: 9}, (_, i) => 25 + i*5).map(v => `<option value="${v}" ${v===40?'selected':''}>${v}</option>`).join('')}
								</select>
								<select id="wiz-f-r" class="wiz-spec-select" onchange="window.applyTyreWizard()">
									${Array.from({length: 6}, (_, i) => 15 + i).map(v => `<option value="${v}" ${v===18?'selected':''}>R${v}</option>`).join('')}
								</select>
							</div>

							<div class="wiz-spec-label">REAR TIRE (Width / Aspect / Rim)</div>
							<div class="wiz-spec-row">
								<select id="wiz-r-w" class="wiz-spec-select" onchange="window.applyTyreWizard()">
									${Array.from({length: 27}, (_, i) => 175 + i*5).map(v => `<option value="${v}" ${v===255?'selected':''}>${v}</option>`).join('')}
								</select>
								<select id="wiz-r-a" class="wiz-spec-select" onchange="window.applyTyreWizard()">
									${Array.from({length: 9}, (_, i) => 25 + i*5).map(v => `<option value="${v}" ${v===35?'selected':''}>${v}</option>`).join('')}
								</select>
								<select id="wiz-r-r" class="wiz-spec-select" onchange="window.applyTyreWizard()">
									${Array.from({length: 6}, (_, i) => 15 + i).map(v => `<option value="${v}" ${v===18?'selected':''}>R${v}</option>`).join('')}
								</select>
							</div>

							<div class="wiz-spec-footer" style="margin-top: 15px;">
								<label class="wiz-spec-label">LUT Pattern:</label>
								<select id="wiz-lut-pattern" class="wiz-spec-select" style="width: auto;" onchange="window.applyTyreWizard()">
									<option value="A">独立型 (Independent)</option>
									<option value="B">共有型 (Shared)</option>
								</select>
							</div>
						</div>
						<p class="wiz-spec-label-p">スライダーでグリップとスライド特性を微調整します。</p>
						
						<div class="suspension-item">
							<label>
							<span>🏁 全体グリップ (Grip Level)</span>
							<span id="wiz-val-grip">${wGripLevel.toFixed(3)}</span>
							</label>
							<input type="range" id="wiz-grip" min="0.5" max="2.0" step="0.005" value="${wGripLevel}" oninput="window.applyTyreWizard()">
						</div>
						<div class="suspension-item">
							<label>
							<span>⚖️ 縦横バランス (Grip Balance)</span>
							<span id="wiz-val-gbal">${wGripBal.toFixed(3)}</span>
							</label>
							<input type="range" cursor:ew-resize;" id="wiz-gbal" min="-0.5" max="0.5" step="0.005" value="${wGripBal}" oninput="window.applyTyreWizard()">
							<div>
							<span>← 横重視</span>
							<span>縦重視 →</span>
							</div>
						</div>
						<div class="suspension-item">
							<label>
							<span>🏋️ 荷重感度 (Load Sensitivity)</span>
							<span id="wiz-val-load">${wLoadSens.toFixed(3)}</span>
							</label>
							<input type="range" id="wiz-load" min="0.5" max="1.5" step="0.005" value="${wLoadSens}" oninput="window.applyTyreWizard()">
						</div>
						<div class="suspension-item">
							<label>
							<span>⚖️ 荷重感度バランス (Load Sens Bal)</span>
							<span id="wiz-val-lbal">${wLoadBal.toFixed(3)}</span>
							</label>
							<input type="range" id="wiz-lbal" min="-0.5" max="0.5" step="0.005" value="${wLoadBal}" oninput="window.applyTyreWizard()">
							<div>
								<span>← 横重視</span>
								<span>縦重視 →</span>
							</div>
						</div>
						<div class="suspension-item">
							<label>
							<span>💨 スライド特性 (Sliding Control)</span>
							<span id="wiz-val-slide">${wSlide.toFixed(3)}</span>
							</label>
							<input type="range" id="wiz-slide" min="0.5" max="1.0" step="0.005" value="${wSlide}" oninput="window.applyTyreWizard()">
							<div>
								<span>← ピーキー(滑る)</span>
								<span>マイルド(粘る) →</span>
							</div>
						</div>
					</div>

					<div id="tyre-advance-panel" style="display: ${window.isTyreWizardMode ? 'none' : 'block'};">
						${subTabHtml}
						
						<div class="suspension-tab-menu" style="margin-top: 5px; border-bottom: 1px solid #444; padding-bottom: 0px;">
							<button class="suspension-tab-btn ${window.activeTyreSide === 'FRONT' ? 'active' : ''}" onclick="window.setTyreSideTab('FRONT')">FRONT</button>
							<button class="suspension-tab-btn ${window.activeTyreSide === 'REAR' ? 'active' : ''}" onclick="window.setTyreSideTab('REAR')">REAR</button>
						</div>

						<div class="suspension-tab-content tyre-editor_box" id="tyre-tab-content">
							<div class="tyre-editor_box">
								<div class="suspension-item-title_box">
									<p style="color: ${window.activeTyreSide === 'FRONT' ? '#60a5fa' : '#f87171'}; font-weight: bold;">
										${window.activeTyreSide} DATA
									</p>
								</div>
								<div class="suspension-item_box" id="tyre-side-inputs"></div>
							</div>
						</div>
					</div>

				</div>
			</article>
		</div>
	`;
	
	container.innerHTML = html;

	const listEl = document.getElementById('tyre-compound-list');
	if (listEl) {
		listEl.innerHTML = window.tyreCompoundList.map((comp, idx) => {
			const isActive = idx === window.activeTyreIdx;
			return `
				<div class="gear-set-item ${isActive ? 'active' : ''}">
					<input type="text" class="set-name-input" value="${comp.name}" 
						onchange="window.updateTyreCompoundName(${idx}, this.value)">
					<button class="select-set-btn ${isActive ? 'is-selected' : ''}" onclick="window.selectTyreCompound(${idx})">
						${isActive ? '編集' : '選択'}
					</button>
					<button class="delete-set-btn" onclick="window.deleteTyreCompound(${idx})" title="削除">×</button>
				</div>
			`;
		}).join('');
	}

	// const currentCompound = window.tyreCompoundList[window.activeTyreIdx];
	// if (!currentCompound) return;

	const activeTabDef = tyreTabs.find(t => t.id === window.activeTyreSubTab) || tyreTabs[0];
	const isThermal = (window.activeTyreSubTab === 'THERMAL' || window.activeTyreSubTab === 'DAMAGE');
	
	// 🌟 重複を完全に排除し、GLOBALとコンパウンド別項目を正しく仕分ける唯一のループ
	const globalSectionMap = {
		'VERSION': 'HEADER',
		'INDEX': 'COMPOUND_DEFAULT',
		'USE_LOAD': 'VIRTUALKM',
		'MAX_KM': 'VIRTUALKM',
		'CAMBER_WEAR': 'VIRTUALKM'
	};

	const thermalKeys = [
		'SURFACE_TRANSFER', 'PATCH_TRANSFER', 'CORE_TRANSFER', 'INTERNAL_CORE_TRANSFER',
		'FRICTION_K', 'ROLLING_K', 'SURFACE_ROLLING_K', 'COOL_FACTOR', 'PERFORMANCE_CURVE',
		'GRAIN_GAMMA', 'GRAIN_GAIN', 'BLISTER_GAMMA', 'BLISTER_GAIN', 'TYRE_RND', 'RIM_RND'
	];

	// 入力欄の生成コンテナをリセット（ダブり防止）
	const inputContainer = document.getElementById('tyre-side-inputs');
	if (inputContainer) inputContainer.innerHTML = '';

	activeTabDef.keys.forEach(key => {
		let secName = '';
		let secData = {};

		// ① 全体設定（GLOBAL）項目の場合
		if (globalSectionMap[key] !== undefined) {
			secName = globalSectionMap[key];
			// インポート時に同梱された raw_ini から直接全体セクションのデータを引き出す
			secData = currentCompound.raw_ini ? (currentCompound.raw_ini[secName] || {}) : {};
		} 
		// ② 通常のコンパウンド（FRONT/REAR/THERMAL）項目の場合
		else {
			const isThermalKey = thermalKeys.includes(key);
			// FRONT_1 や REAR_1 のようなインデックス番号サフィックスを処理
			const suffix = currentCompound.index === 0 ? '' : `_${currentCompound.index}`;
			
			if (isThermalKey) {
				secName = `THERMAL_${window.activeTyreSide}${suffix}`;
				if (currentCompound.raw_ini && !currentCompound.raw_ini[secName]) {
					currentCompound.raw_ini[secName] = {};
				}
				secData = currentCompound.raw_ini ? (currentCompound.raw_ini[secName] || {}) : {};
			} else {
				secName = `${window.activeTyreSide}${suffix}`;
				secData = currentCompound.raw_ini ? (currentCompound.raw_ini[secName] || {}) : {};
			}
		}

		// ファイル内に値があれば取得、なければ空欄
		const val = secData[key] !== undefined ? secData[key] : "";
		
		// 画面に正しい入力欄を生成して配置
		window.addTyreInputField(inputContainer, currentCompound, secName, key, val);
	});

	// UI描画後にスイッチの状態を見て解説ボックスの表示/非表示を同期
	if (typeof window.toggleTyreTooltips === 'function') {
		window.toggleTyreTooltips();
	}

	setTimeout(() => {
		if (typeof window.updateTiresChart === 'function') {
			window.updateTiresChart();
		}
		if (window.isTyreWizardMode) {
			window.updateWizTireSizes('f');
			window.updateWizTireSizes('r');
		}
	}, 50);
};

// --- サブタブ切り替え ---
window.setTyreSubTab = function(tabId) {
	window.activeTyreSubTab = tabId;
	window.renderTyreUI();
};
// 🌟 追加：フロント/リアの切り替え
window.setTyreSideTab = function(side) {
	window.activeTyreSide = side;
	window.renderTyreUI();
};

// --- 入力欄のDOM生成関数 ---
window.addTyreInputField = function(parent, compoundObj, sectionName, key, val) {
	const itemDiv = document.createElement('div');
	itemDiv.className = 'suspension-item';
	let isNum = !isNaN(val) && val !== "";
	
	const editorRule = window.getEditorStep(key, val);
	const currentStep = typeof editorRule === 'object' ? editorRule.step : editorRule;
	const currentMin = typeof editorRule === 'object' && editorRule.min !== "" ? ` min="${editorRule.min}"` : "";
	const currentMax = typeof editorRule === 'object' && editorRule.max !== "" ? ` max="${editorRule.max}"` : "";
	
	const isFY = ['DY0', 'DY1', 'DY_REF', 'LS_EXPY'].includes(key);
	const isFX = ['DX0', 'DX1', 'DX_REF', 'LS_EXPX'].includes(key);
	let colorClass = '';
	if (isFY) colorClass = ' tyre-input-fy';
	if (isFX) colorClass = ' tyre-input-fx';

	// =========================================================
	// 🌟 修正：インラインスタイルを排除し、CSSクラスを付与する
	// =========================================================
	let indicatorIcon = '';
	let groupClass = ''; // ボックスシャドウ（色分け）用のクラス

	// グラフが変化する項目（限界値）＝ オレンジのライン
	const graphKeys = ['DY0', 'DY1', 'DX0', 'DX1', 'DX_REF', 'DY_REF', 'LS_EXPY', 'LS_EXPX', 'FLEX_GAIN', 'FALLOFF_LEVEL', 'FALLOFF_SPEED', 'FRICTION_LIMIT_ANGLE', 'CAMBER_GAIN', 'DCAMBER_0', 'DCAMBER_1'];
	// グラフは変わらないがフィーリングが変化する項目（過渡特性）＝ ブルーのライン
	const feelKeys = ['RELAXATION_LENGTH', 'ROLLING_RESISTANCE_SLIP', 'ANGULAR_INERTIA', 'RATE', 'FLEX', 'PRESSURE_STATIC', 'XMU'];

	if (graphKeys.includes(key)) {
		groupClass = ' tyre-graph-item'; // CSSでオレンジのシャドウを設定
		indicatorIcon += '<span title="プレビューグラフの波形が変化します">📊</span>';
	} else if (feelKeys.includes(key)) {
		groupClass = ' tyre-feel-item'; // CSSでブルーのシャドウを設定
	}

	// 1. FFBの重さに影響する項目
	if (['DY_REF', 'XMU', 'PRESSURE_STATIC', 'CAMBER_GAIN', 'RATE'].includes(key)) {
		indicatorIcon += '<span title="FFBの重さ (MZ) に影響">💪</span>';
	}
	// 2. 応答性（シャープさ）に影響する項目
	if (['FLEX', 'RELAXATION_LENGTH'].includes(key)) {
		indicatorIcon += '<span title="応答性 (シャープさ) に影響">🏎️</span>';
	}
	// 3. 回転慣性に影響する項目
	if (['ANGULAR_INERTIA', 'RADIUS', 'WIDTH'].includes(key)) {
		indicatorIcon += '<span title="回転慣性 (重さ) に影響">🛞</span>';
	}
	// 4. スライド抵抗感に影響する項目
	if (['ROLLING_RESISTANCE_SLIP'].includes(key)) {
		indicatorIcon += '<span title="スライド抵抗感 に影響">💨</span>';
	}

	const helpMap = {
		'WIDTH': 'タイヤ幅（単位：m）',
		'RADIUS': 'タイヤ半径（外径の半分）',
		'RIM_RADIUS': 'ホイールリム半径（単位：m）',
		'ANGULAR_INERTIA': '慣性モーメント タイヤの慣性',
		'WEAR_CURVE': '摩耗ルックアップテーブル',
		'DAMP': 'タイヤの減衰係数 タイヤの接地している際の振動・エネルギーの減衰速度',
		'RATE': 'タイヤのスプリング剛性 たわみの剛性',
		'FLEX': 'タイヤたわみ量',
		'XMU': '横方向の摩擦係数',
		'DX_REF': '縦方向の摩擦係数の基準値：XMUの倍数',
		'DY_REF': '横方向の摩擦係数の基準値：XMUの倍数',
		'DY0': '横方向のグリップ係数の最大値：コーナリング時におけるグリップ最大値（倍数ではない）',
		'DY1': '横方向のグリップの減衰率 荷重に応じて、どのように変化するか示す数値',
		'DX0': '縦方向のグリップ係数の最大値：加速やブレーキ時におけるグリップ最大値（倍数ではない）',
		'DX1': '縦方向のグリップの減衰率 荷重に応じて、どのように変化するか示す数値',
		'FZ0': 'タイヤの縦荷重（加速・ブレーキ時）の基準値：どれだけの重さを支えるか・タイヤの安定性や曲がりやすさに影響',
		'LS_EXPY': '横Gに対するグリップ・スリップ特性（タイヤの地面に対する押し付ける力）：スリップを抑える効果',
		'LS_EXPX': '縦Gに対するグリップの変化を示す（縦Gに対して、グリップのエネルギーがどのように変化するか）',
		'FLEX_GAIN': 'たわみ係数 タイヤの柔軟性・変形に影響、車両の乗り心地・グリップ特性（路面の凹凸に対する応答性や、コーナリング時の安定性を調整）',
		'FALLOFF_LEVEL': 'タイヤの限界を超えた際の変化（グリップが失われた際の挙動が急激か穏やかかを設定）',
		'FALLOFF_SPEED': 'タイヤのグリップが限界を超えた後のグリップ低下速度を示す（スリップが発生した際にグリップ低下速度の調整）',
		'CX_MULT': '空気抵抗係数に対する乗算係数',
		'RADIUS_ANGULAR_K': 'タイヤの回転半径に基づく角速度の係数（タイヤが回転する際の半径に基づいてどのように回転するか）',
		'BRAKE_DX_MOD': 'ブレーキング時のスリップ調整係数の設定（ブレーキング時にどれだけスリップが発生するかを調整）',
		'SPEED_SENSITIVITY': '車両の速度に対するタイヤの感度を調整',
		'RELAXATION_LENGTH': 'タイヤが荷重に応答するまでの遅れ（ラグ）（単位：メートル）',
		'ROLLING_RESISTANCE_0': '転がり抵抗係数の初期値（タイヤが地面と接触して転がる際に生じる抵抗）（低速時）',
		'ROLLING_RESISTANCE_1': '速度に応じた転がり抵抗の係数を設定（速度に比例して増加するタイヤの転がり抵抗を設定）（高速時）',
		'ROLLING_RESISTANCE_SLIP': 'タイヤのスリップ時の転がり抵抗を定義 （スリップ状態となった際に、転がり抵抗がどのように変化するか調整）',
		'PRESSURE_STATIC': '空気圧（psi単位）停車時の空気圧',
		'PRESSURE_SPRING_GAIN': '内圧がタイヤのスプリング剛性に与える影響を設定',
		'PRESSURE_FLEX_GAIN': '内圧がタイヤのたわみや柔軟性に与える影響を設定（タイヤのたわみは、設置面積やグリップに影響を与える）',
		'PRESSURE_RR_GAIN': '内圧が転がり抵抗に与える影響を設定（グリップ力・耐久力・加速・最高速に影響）',
		'PRESSURE_D_GAIN': '内圧がタイヤの減衰特性に与える影響',
		'PRESSURE_IDEAL': 'タイヤの性能を発揮する空気圧',
		'CAMBER_GAIN': 'キャンバー角によるグリップ影響（キャンバー角が変化した際、タイヤのグリップへ与える影響を示す）',
		'DCAMBER_0': '静止・静止に近い状態での静的なキャンバー角を設定する値',
		'DCAMBER_1': 'タイヤに負荷がかかった時の制御するための値（車の荷重や挙動に応じて、タイヤによりキャンバー角がどのように変化するかを制御）',
		'FRICTION_LIMIT_ANGLE': 'タイヤが最大の摩擦力を発揮する角度（スリップアングル）'
	};
	
	const helpText = helpMap[key] || '';

let inputHtml = '';

	if (key === 'WEAR_CURVE' || key === 'PERFORMANCE_CURVE') {
		let foundLuts = new Set();
		if (window.tyreCompoundList) {
			window.tyreCompoundList.forEach(c => {
				if (c.raw_ini) {
					for (let sec in c.raw_ini) {
						if (c.raw_ini[sec] && c.raw_ini[sec][key]) {
							foundLuts.add(c.raw_ini[sec][key].trim());
						}
					}
				}
			});
		}

		const kunosDefault = key === 'WEAR_CURVE' ? 'kunos_wear.lut' : 'kunos_thermal.lut';
		let options = [];
		
		foundLuts.forEach(lut => {
			options.push({ value: lut, label: `${lut}` });
		});

		if (!foundLuts.has(kunosDefault)) {
			options.push({ value: kunosDefault, label: `${kunosDefault} (標準)` });
		}

		if (val && !foundLuts.has(val) && val !== kunosDefault) {
			options.push({ value: val, label: `${val}` });
		}

		let optionsHtml = options.map(opt => {
			const isSelected = (opt.value.toLowerCase() === val.toLowerCase()) ? 'selected' : '';
			return `<option value="${opt.value}" ${isSelected}>${opt.label}</option>`;
		}).join('');

		inputHtml = `<select class="text-input tyre-text-input tyre-lut-select" style="cursor: pointer;">${optionsHtml}</select>`;
	} else {
		inputHtml = `<input type="${isNum ? 'number' : 'text'}" class="text-input tyre-text-input" value="${val}" step="${currentStep}"${currentMin}${currentMax}>`;
	}

	itemDiv.innerHTML = `
		<div class="input-unit${colorClass}${groupClass}">
			<label>${key}</label>
			<div class="input-with-range tyre-input-wrapper">
				${inputHtml}
				<div class="tyre-indicator-icons">
					${indicatorIcon}
				</div>
			</div>
		</div>
	`;
	parent.appendChild(itemDiv);
	
	const input = itemDiv.querySelector('.tyre-text-input');

	if (key === 'WEAR_CURVE' || key === 'PERFORMANCE_CURVE') {
		input.addEventListener('change', (e) => {
			const selectedValue = e.target.value;
			console.log(`\n[LUT-UI-EVENT] 🔄 ドロップダウン変更: "${selectedValue}" (項目: ${key})`);

			// 1. 画面の再描画元である raw_ini を確実に上書き
			if (compoundObj.raw_ini && compoundObj.raw_ini[sectionName]) {
				compoundObj.raw_ini[sectionName][key] = selectedValue;
			}

			// 2. 従来のサフィックス付きdataに保存
			if (!compoundObj.data[sectionName]) compoundObj.data[sectionName] = {};
			compoundObj.data[sectionName][key] = selectedValue;

			// 3. export.jsが見に行く固定キー（FRONT / REAR 等）に確実に保存
			let baseSide = '';
			if (sectionName.startsWith('FRONT')) baseSide = 'FRONT';
			else if (sectionName.startsWith('REAR')) baseSide = 'REAR';
			else if (sectionName.startsWith('THERMAL_FRONT')) baseSide = 'THERMAL_FRONT';
			else if (sectionName.startsWith('THERMAL_REAR')) baseSide = 'THERMAL_REAR';

			if (baseSide && compoundObj.data[baseSide]) {
				compoundObj.data[baseSide][key] = selectedValue;
			}

			if (typeof window.updateTiresChart === 'function') window.updateTiresChart();
			if (typeof window.requestRender === 'function') window.requestRender();
		});
	}

	// ★ 入力欄をクリック（フォーカス）した時に解説ボックスの中身を書き換える
	input.addEventListener('focus', () => {
		const explainBox = document.getElementById('tyres-explain_box');
		if (explainBox && helpText) {
			explainBox.innerHTML = `<strong style="color: #4ade80;">[ ${key} ]</strong><br>${helpText}`;
		}
	});

	// ② 普通の数値・文字入力（インプットボックス）の変更イベント監視
	input.addEventListener('input', (e) => {
		if (e.target.tagName === 'SELECT') {
			return;
		}

		// 1. 画面の再描画元である raw_ini を確実に上書き
		if (compoundObj.raw_ini && compoundObj.raw_ini[sectionName]) {
			compoundObj.raw_ini[sectionName][key] = e.target.value;
		}

		// 2. 従来のサフィックス付きdataに保存
		if (!compoundObj.data[sectionName]) compoundObj.data[sectionName] = {};
		compoundObj.data[sectionName][key] = e.target.value;

		// 3. export.jsが見に行く固定キー（FRONT / REAR 等）に確実に保存
		let baseSide = '';
		if (sectionName.startsWith('FRONT')) baseSide = 'FRONT';
		else if (sectionName.startsWith('REAR')) baseSide = 'REAR';
		else if (sectionName.startsWith('THERMAL_FRONT')) baseSide = 'THERMAL_FRONT';
		else if (sectionName.startsWith('THERMAL_REAR')) baseSide = 'THERMAL_REAR';

		if (baseSide && compoundObj.data[baseSide]) {
			compoundObj.data[baseSide][key] = e.target.value;
		}

		// ⚠️ 手動でVERSIONが10に変更された場合のアラート通知
		if (key === 'VERSION' && e.target.value === '10') {
			e.target.blur();
			setTimeout(() => {
				alert("⚠️ 注意: VERSION=10が設定されました。「DY0、DY1、DX0、DX1、XMU」は完全なダミーデータ（走行物理に無影響）として扱われます。");
			}, 50);
		}
		if (key === 'NAME' && (sectionName === 'FRONT' || sectionName === 'REAR')) {
			compoundObj.name = e.target.value;
			const listInputs = document.querySelectorAll('#tyre-compound-list .set-name-input');
			if (listInputs[window.activeTyreIdx]) {
				listInputs[window.activeTyreIdx].value = e.target.value;
			}
		}

		if (typeof window.updateTiresChart === 'function') {
			window.updateTiresChart();
		}

		// --- ★追加: 寸法が変更されたら3Dプレビューとテキストオーバーレイを即座に更新 ---
		if (key === 'WIDTH' || key === 'RADIUS' || key === 'RIM_RADIUS') {
			if (typeof window.refreshAlignmentOverlay === 'function') {
				window.refreshAlignmentOverlay();
			}
			if (typeof window.updateSuspensionVisuals === 'function') {
				window.updateSuspensionVisuals(window.currentSuspensionData);
			}
		}
		// ------------------------------------------------------------------

		if (typeof window.requestRender === 'function') {
			window.requestRender();
		}
	});
};

// --- リスト操作用の関数 ---

// 選択切り替え
window.selectTyreCompound = function(idx) {
	if (window.activeTyreIdx === idx) return;
	window.activeTyreIdx = idx;
	window.renderTyreUI();
};

// 名前の変更（左リストからの操作）
window.updateTyreCompoundName = function(idx, newName) {
	if (window.tyreCompoundList[idx]) {
		window.tyreCompoundList[idx].name = newName;
		if (window.tyreCompoundList[idx].data.FRONT) window.tyreCompoundList[idx].data.FRONT.NAME = newName;
		if (window.tyreCompoundList[idx].data.REAR) window.tyreCompoundList[idx].data.REAR.NAME = newName;
		
		// アクティブなタイヤの名前が変更されたら、右側のエディター(NAME欄)も同期させる
		if (idx === window.activeTyreIdx) window.renderTyreUI();
	}
};

// 削除
window.deleteTyreCompound = function(idx) {
	if (window.tyreCompoundList.length <= 1) {
		alert("最低1つのコンパウンドは必要です。");
		return;
	}
	if (confirm(`「${window.tyreCompoundList[idx].name}」を削除しますか？`)) {
		window.tyreCompoundList.splice(idx, 1);
		window.activeTyreIdx = 0;
		// ★追加：ここでフラグを立てて保存システムを動かす
		if (window.modifiedStatus) window.modifiedStatus.tyres = true;
		if (typeof window.triggerLiveSync === 'function') window.triggerLiveSync();
		window.renderTyreUI();
	}
};

// 追加（現在のものを複製）
window.addTyreCompound = function() {
	const currentSet = window.tyreCompoundList[window.activeTyreIdx];
	if (!currentSet) return;
	
	const newSet = JSON.parse(JSON.stringify(currentSet));
	newSet.name = currentSet.name + "_copy";
	
	if (newSet.data.FRONT) newSet.data.FRONT.NAME = newSet.name;
	if (newSet.data.REAR) newSet.data.REAR.NAME = newSet.name;
	
	// 複製した新しいインデックス番号を決定
	newSet.index = Math.max(...window.tyreCompoundList.map(c => c.index)) + 1;
	
	// サフィックス管理されている実体データ（raw_ini）の引っ越し（器の複製）
	if (newSet.raw_ini) {
		const oldSuffix = currentSet.index === 0 ? '' : `_${currentSet.index}`;
		const newSuffix = `_${newSet.index}`;
		
		const oldFrontSec = `FRONT${oldSuffix}`;
		const oldRearSec = `REAR${oldSuffix}`;
		const oldThermFrontSec = `THERMAL_FRONT${oldSuffix}`;
		const oldThermRearSec = `THERMAL_REAR${oldSuffix}`;
		
		const newFrontSec = `FRONT${newSuffix}`;
		const newRearSec = `REAR${newSuffix}`;
		const newThermFrontSec = `THERMAL_FRONT${newSuffix}`;
		const newThermRearSec = `THERMAL_REAR${newSuffix}`;
		
		if (newSet.raw_ini[oldFrontSec]) newSet.raw_ini[newFrontSec] = JSON.parse(JSON.stringify(newSet.raw_ini[oldFrontSec]));
		if (newSet.raw_ini[oldRearSec]) newSet.raw_ini[newRearSec] = JSON.parse(JSON.stringify(newSet.raw_ini[oldRearSec]));
		if (newSet.raw_ini[oldThermFrontSec]) newSet.raw_ini[newThermFrontSec] = JSON.parse(JSON.stringify(newSet.raw_ini[oldThermFrontSec]));
		if (newSet.raw_ini[oldThermRearSec]) newSet.raw_ini[newThermRearSec] = JSON.parse(JSON.stringify(newSet.raw_ini[oldThermRearSec]));
		
		if (newSet.raw_ini[newFrontSec]) newSet.raw_ini[newFrontSec].NAME = newSet.name;
		if (newSet.raw_ini[newRearSec]) newSet.raw_ini[newRearSec].NAME = newSet.name;
	}
	
	window.tyreCompoundList.push(newSet);
	window.activeTyreIdx = window.tyreCompoundList.length - 1;
	if (window.modifiedStatus) window.modifiedStatus.tyres = true;
	if (typeof window.triggerLiveSync === 'function') window.triggerLiveSync();
	window.renderTyreUI();
};

window.tiresChartFrontInstance = null;
window.tiresChartRearInstance = null;

/**
 * 【ステップ1・2】 グラフ描画（器の固定と、シアンの絶対基準のみを描画）
 */
window.updateTiresChart = function() {
	const currentCompound = window.tyreCompoundList[window.activeTyreIdx];
	if (!currentCompound) return;

	// 🔐 不足パラメータの「デフォルト値」自動補完マップ (SPEED=15.0を含む)
	function getVal(key, sideData) {
		if (sideData[key] === undefined || sideData[key] === "") {
			if (key === 'SPEED') return 15.0; // 本家テスター固定仕様の動的車速 (15m/s)
			if (key === 'FZ0') return 3200;
			if (key === 'DY_REF') return 2.0;
			if (key === 'DX_REF') return 1.42;
			if (key === 'LS_EXPY') return 0.6;
			if (key === 'LS_EXPX') return 0.65;
			if (key === 'RELAXATION_LENGTH') return 0.075;
			if (key === 'FALLOFF_LEVEL') return 0.92;
			if (key === 'FALLOFF_SPEED') return 1.2;
			return 0.0;
		}
		return parseFloat(sideData[key]) || 0.0;
	}

	// 📊 黄色い線専用：本家テスター仕様のフォールバック構造（表示バグの完全再現）
	function getFactDY(Fz, blister, sideData) {
		if (Fz <= 0.0) return 0.0;
		const lsExpy = getVal('LS_EXPY', sideData);

		// LS_EXPY が 0.0 のときだけ、古い直線式が黄色いグラフにのみ適用される
		if (lsExpy === 0.0) {
			const dy0 = getVal('DY0', sideData);
			const dy1 = getVal('DY1', sideData);
			let dy = Fz * 0.0005 * dy1 + dy0;
			return dy / ((blister * 0.01) * 0.2 + 1.0);
		}

		const fz0 = getVal('FZ0', sideData);
		const dyRef = getVal('DY_REF', sideData);
		const lsMultY = dyRef / Math.pow(fz0, lsExpy - 1.0);
		let dy = (Math.pow(Fz, lsExpy) * lsMultY) / Fz;
		return dy / ((blister * 0.01) * 0.2 + 1.0);
	}

	function getCamberedDyFact(camberRAD, sideData) {
		const dcamber0 = getVal('DCAMBER_0', sideData) || 1.6;
		const dcamber1 = getVal('DCAMBER_1', sideData) || -13.5;
		let fVar2 = camberRAD * dcamber0 - (camberRAD * camberRAD) * dcamber1;
		if (fVar2 <= -1.0) fVar2 = -0.9;
		return 1.0 / (fVar2 + 1.0);
	}

	// 🏎️ 緩和長遅延をシミュレートする動的なフィルター計算（stepDynamicTyre 方式）
	// ⚠️ ここでの計算（実際の白・マゼンタ線）からは DY0 や XMU などのダミーデータは完全に排除され、V10指数式を維持します
	function stepDynamicTyre(state, target_SA_rad, target_SR, Fz, camber_deg, sideData) {
		let v_hub = getVal('SPEED', sideData);
		if (v_hub < 0.1) v_hub = 0.1;

		let dyn_RL = getVal('RELAXATION_LENGTH', sideData);
		if (dyn_RL <= 0.0001) dyn_RL = 0.0001;

		const dt = 0.003; // シミュレーション時間刻み
		let k = (v_hub * dt) / dyn_RL;
		if (k > 1.0) k = 1.0; if (k < 0.04) k = 0.04;

		// 緩和長によるスリップの蓄積・遅延（タメ）
		state.SR = k * (target_SR - state.SR) + state.SR;
		state.SA = k * (target_SA_rad - state.SA) + state.SA;

		const fz0 = getVal('FZ0', sideData);
		const dyRef = getVal('DY_REF', sideData);
		const lsExpy = getVal('LS_EXPY', sideData);
		const lsMultY = dyRef / Math.pow(fz0, lsExpy - 1.0);
		let muY = (Math.pow(Fz, lsExpy) * lsMultY) / Fz;

		const dxRef = getVal('DX_REF', sideData);
		const lsExpandedX = getVal('LS_EXPX', sideData);
		const lsMultX = dxRef / Math.pow(fz0, lsExpandedX - 1.0);
		let muX = (Math.pow(Fz, lsExpandedX) * lsMultX) / Fz;

		const blister = getVal('BLISTER', sideData);
		muY = muY / ((blister * 0.01) * 0.2 + 1.0);
		muX = muX / ((blister * 0.01) * 0.2 + 1.0);

		if (state.SR < 0.0) {
			const brakeDxMod = getVal('BRAKE_DX_MOD', sideData) || 0.06;
			muX = muX * (1.0 + brakeDxMod);
		}

		const camberRAD = camber_deg * Math.PI / 180.0;
		let camber_curve_val = getCamberedDyFact(camberRAD, sideData);
		muY = muY * camber_curve_val;

		const camberGain = getVal('CAMBER_GAIN', sideData);
		const SA_eff = (camberRAD * camberGain) + state.SA;
		
		let sr_clamp = Math.max(state.SR, -0.99999);
		let Sx = state.SR / (sr_clamp + 1.0);
		let Sy = Math.tan(SA_eff) / (sr_clamp + 1.0);
		
		let rho = Math.sqrt(Sx*Sx + Sy*Sy);

		const frictionLimitAngle = getVal('FRICTION_LIMIT_ANGLE', sideData);
		const flexGain = getVal('FLEX_GAIN', sideData);
		const maxSlip0 = Math.tan(frictionLimitAngle * Math.PI / 180.0);
		const maxSlip1 = Math.tan((flexGain + 1.0) * frictionLimitAngle * Math.PI / 180.0);
		let base_slip = (((Fz - fz0) / fz0) * (maxSlip1 - maxSlip0) + maxSlip0);
		if (base_slip <= 0.001) base_slip = 0.001;

		const pStatic = getVal('PRESSURE_STATIC', sideData);
		const pIdeal = getVal('PRESSURE_IDEAL', sideData);
		const prRatio = pIdeal > 0 ? (pStatic / pIdeal) : 1.0;
		const prOffset = prRatio - 1.0;
		const pFlexGain = getVal('PRESSURE_FLEX_GAIN', sideData);
		const grain = getVal('GRAIN', sideData);
		let limit_slip = base_slip * (grain * 0.01 + 1.0) / (pFlexGain * prOffset + 1.0);
		if (limit_slip <= 0.001) limit_slip = 0.001;

		const speedSensitivity = getVal('SPEED_SENSITIVITY', sideData);
		let V_slide = Math.sqrt(Math.pow(v_hub * Math.sin(state.SA), 2) + Math.pow(v_hub * Math.cos(state.SA) * state.SR, 2));
		let v_factor = V_slide * speedSensitivity + 1.0;
		muY = muY / v_factor; muX = muX / v_factor;

		const falloffLevel = getVal('FALLOFF_LEVEL', sideData);
		const falloffSpeed = getVal('FALLOFF_SPEED', sideData);
		const cxMult = getVal('CX_MULT', sideData);

		function getPureForce(slip_input, p_max) {
			if (slip_input <= p_max) {
				const Sn = slip_input / p_max;
				return Math.pow(1.0 - Sn, 2) * (3.0 / p_max) * slip_input + (3.0 - 2.0 * Sn) * Sn * Sn;
			} else {
				return (1.0 - falloffLevel) / ((slip_input - p_max) * falloffSpeed + 1.0) + falloffLevel;
			}
		}

		const pureFY_mag = getPureForce(rho, limit_slip);
		const pureFX_mag = getPureForce(rho, limit_slip / cxMult);

		const Fy_ratio = (rho > 0.000001) ? (Sy / rho) : 0.0;
		const Fx_ratio = (rho > 0.000001) ? (Sx / rho) : 0.0;
		const pDGain = getVal('PRESSURE_D_GAIN', sideData);
		const prCfGain = pDGain * prOffset + 1.0;
		
		let Fy = pureFY_mag * Fy_ratio * muY * Fz * prCfGain;
		let Fx = pureFX_mag * Fx_ratio * muX * Fz * prCfGain;

		const ndSlip = rho / limit_slip;
		let t_mod = 1.0 - ndSlip * 0.8;
		if (t_mod < 0) t_mod = 0; else if (t_mod > 1) t_mod = 1;
		
		let depth = Fz / (getVal('RATE', sideData) || 300000);
		let liveRadius = (getVal('RADIUS', sideData) || 0.3) - depth;
		let cpLength = 0.0;
		let fVar1 = liveRadius - depth;
		if ((0.0 < fVar1) && (fVar1 < liveRadius)) {
			cpLength = Math.sqrt(liveRadius * liveRadius - fVar1 * fVar1) * 2.0;
		}
		let trail = ((3.0 - 2.0 * t_mod) * t_mod * t_mod * 1.1 - 0.1) * cpLength * 0.12;
		const Mz = -(trail * Fy);

		return { Fx, Fy, Mz, camber_curve_val };
	}

	['FRONT', 'REAR'].forEach(side => {
		const canvasId = side === 'FRONT' ? 'tiresChartFront' : 'tiresChartRear';
		const canvas = document.getElementById(canvasId);
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const sideData = currentCompound.data[side];
		if (!sideData) return;

		const rect = canvas.parentElement.getBoundingClientRect();
		if (rect.width > 0 && rect.height > 0) {
			canvas.width = rect.width;
			canvas.height = rect.height;
		}

		ctx.clearRect(0, 0, canvas.width, canvas.height);

		const gX = 20; 
		const gY = 20; 
		const gW = canvas.width - 40; 
		const gH = canvas.height - 40;
		const cX = gX + gW / 2; 
		const cY = gY + gH / 2;

		ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
		ctx.strokeRect(gX, gY, gW, gH);
		ctx.strokeStyle = '#1a1a1a';
		for(let i = 50; i < gW; i += 50) {
			ctx.beginPath(); ctx.moveTo(gX + i, gY); ctx.lineTo(gX + i, gY + gH); ctx.stroke();
			ctx.beginPath(); ctx.moveTo(gX, gY + i); ctx.lineTo(gX + gW, gY + i); ctx.stroke();
		}
		ctx.strokeStyle = '#555';
		ctx.beginPath(); ctx.moveTo(gX, cY); ctx.lineTo(gX + gW, cY); ctx.stroke();
		ctx.beginPath(); ctx.moveTo(cX, gY); ctx.lineTo(cX, gY + gH); ctx.stroke();

		const scaleY = gH / 5.0; 
		
		// 🏋️ 重心配分から垂直荷重 (Fz) を自動計算して当てるアプローチ
		let totalMass = 1320.0;
		let cgLocation = 0.51;
		if (window.currentCarData && window.currentCarData.BASIC && window.currentCarData.BASIC.TOTALMASS) {
			totalMass = parseFloat(window.currentCarData.BASIC.TOTALMASS);
		}
		if (window.currentSuspensionData && window.currentSuspensionData.BASIC && window.currentSuspensionData.BASIC.CG_LOCATION !== undefined) {
			cgLocation = parseFloat(window.currentSuspensionData.BASIC.CG_LOCATION);
		}
		const totalWeightN = totalMass * 9.80665;
		const Fz = (side === 'FRONT') ? (totalWeightN * (1.0 - cgLocation)) / 2.0 : (totalWeightN * cgLocation) / 2.0;

		// 🛞 suspensions.ini に設定されている実際の初期キャンバー角を自動取得して当てる
		let testCamberDeg = 0.0;
		if (window.currentSuspensionData && window.currentSuspensionData[side] && window.currentSuspensionData[side].STATIC_CAMBER !== undefined) {
			testCamberDeg = parseFloat(window.currentSuspensionData[side].STATIC_CAMBER) || 0.0;
		}

		// ■ White (Serie 0): Fy/Load vs SA (-20° to +20°)
		// ■ White (Serie 0): Fy/Load vs SA (-20° to +20°)
		let state_SA = { SR: 0, SA: -20.0 * Math.PI / 180.0 };
		ctx.beginPath(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
		
		// 🎯 ピーク値（最大グリップ、角度、ハンドルの重さ）を記憶するための変数を準備
		let maxFy = 0;
		let peakAngle = 0;
		let maxMz = 0; // 🌟 追加：MZ(ハンドルの重さ)用
		
		for (let i = 0; i <= 200; i++) {
			let sa_deg = -20.0 + (i * 40.0) / 200.0;
			let res = stepDynamicTyre(state_SA, sa_deg * Math.PI / 180.0, 0, Fz, testCamberDeg, sideData);
			
			// 📈 これまでの中で最大の横グリップが出たらメモする
			if (res.Fy > maxFy) {
				maxFy = res.Fy;
				peakAngle = sa_deg;
			}
			// 📈 ハンドルの手応え（Mz）の最大値もメモする（マイナス方向もあるので絶対値で比較）
			if (Math.abs(res.Mz) > maxMz) {
				maxMz = Math.abs(res.Mz);
			}

			let x = gX + (i * gW) / 200;
			let y = cY - (res.Fy / Fz) * scaleY;
			if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
		}
		ctx.stroke();

		// ■ Magenta (Serie 1): Fx/Load vs SR (-1.0 to +1.0)
		// ⚠️ 本家通りの不格好な交点ズレ仕様（マゼンタ中央完全固定）を再現
		let state_SR = { SR: -1.0, SA: 0 };
		ctx.beginPath(); ctx.strokeStyle = '#ff00ff'; ctx.lineWidth = 1.5;

		// 🎯 縦グリップとスリップ率を記憶するための変数を準備
		let maxFx = 0;         // 🌟 追加：FX(縦グリップ)用
		let peakSlipRatio = 0; // 🌟 追加：その時のスリップ率用

		for (let i = 0; i <= 200; i++) {
			let sr = -1.0 + (i * 2.0) / 200.0;
			let res = stepDynamicTyre(state_SR, 0, sr, Fz, testCamberDeg, sideData);
			
			// 📈 縦のグリップ（Fx）の最大値が出たらメモする
			if (Math.abs(res.Fx) > maxFx) {
				maxFx = Math.abs(res.Fx);
				peakSlipRatio = sr;
			}

			let x = gX + (i * gW) / 200;
			let y = cY - (res.Fx / Fz) * scaleY;
			if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
		}
		ctx.stroke();

		// 🖥️ メモしたすべての最大値をUI（HTML）へ流し込む
		// side が 'FRONT' なら 'f'、'REAR' なら 'r' にしてHTMLのIDと一致させる
		const sidePrefix = side === 'FRONT' ? 'f' : 'r';
		
		// 1. 横グリップ(FY)と角度
		const peakFyElement = document.getElementById(`peak-${sidePrefix}-fy`);
		const peakSaElement = document.getElementById(`peak-${sidePrefix}-sa`);
		if (peakFyElement) peakFyElement.innerText = (maxFy / Fz).toFixed(2);
		if (peakSaElement) peakSaElement.innerText = Math.abs(peakAngle).toFixed(1);

		// 2. ハンドルの重さ(MZ)
		const peakMzElement = document.getElementById(`peak-${sidePrefix}-mz`);
		if (peakMzElement) peakMzElement.innerText = maxMz.toFixed(1);

		// 3. 縦グリップ(FX)とスリップ率(%)
		const peakFxElement = document.getElementById(`peak-${sidePrefix}-fx`);
		const peakSrElement = document.getElementById(`peak-${sidePrefix}-sr`);
		if (peakFxElement) peakFxElement.innerText = (maxFx / Fz).toFixed(2);
		if (peakSrElement) peakSrElement.innerText = (Math.abs(peakSlipRatio) * 100).toFixed(1);

		// =========================================================
		// 🌟 差し替えではなく、ここから下を「追加」します！
		// =========================================================
		const sideName = sidePrefix === 'f' ? 'front' : 'rear';

		// 1. FFBの重さ (ニューマチックトレール = Mz / Fy)
		const valMz = document.getElementById(`val-mz-${sideName}`);
		const barMz = document.getElementById(`bar-mz-${sideName}`);
		if (valMz && barMz && maxFy > 0) {
			let trail = maxMz / maxFy; // 接地抵抗の腕の長さ（m）
			// 解析事実: ストリート/ドリフトタイヤのRATE/RADIUSによる物理的限界は約20mm
			// 0mm 〜 25mm (0.025m) を0〜100%スケールとする
			let trailPct = Math.max(0, Math.min(100, (trail / 0.025) * 100));
			valMz.innerText = (trail * 1000).toFixed(0) + " mm"; 
			barMz.style.width = trailPct + "%";
		}

		// 2. 応答性 (シャープさ) -> RELAXATION_LENGTH
		const valResp = document.getElementById(`val-resp-${sideName}`);
		const barResp = document.getElementById(`bar-resp-${sideName}`);
		if (valResp && barResp) {
			let relax = parseFloat(sideData.RELAXATION_LENGTH) || 0.075;
			// 解析事実: 最小0.022 (DWG Comp) 〜 最大0.082 (MLFD3S)
			// 0.090(鈍い) 〜 0.020(機敏) の範囲を0〜100%とする
			let respPct = Math.max(0, Math.min(100, ((0.09 - relax) / 0.07) * 100));
			valResp.innerText = relax.toFixed(3);
			barResp.style.width = respPct + "%";
		}

		// 3. 回転慣性 (重さ) -> ANGULAR_INERTIA
		const valInertia = document.getElementById(`val-inertia-${sideName}`);
		const barInertia = document.getElementById(`bar-inertia-${sideName}`);
		if (valInertia && barInertia) {
			let inertia = parseFloat(sideData.ANGULAR_INERTIA) || 1.5;
			// 解析事実: 最小0.8 (ML86) 〜 最大1.97 (Tando C4_265)
			// 0.5(軽い) 〜 2.5(重い) の範囲を0〜100%とする
			let inertiaPct = Math.max(0, Math.min(100, ((inertia - 0.5) / 2.0) * 100));
			valInertia.innerText = inertia.toFixed(2) + " kgm²";
			barInertia.style.width = inertiaPct + "%";
		}

		// 4. スライド抵抗感 -> ROLLING_RESISTANCE_SLIP
		const valSlip = document.getElementById(`val-slip-${sideName}`);
		const barSlip = document.getElementById(`bar-slip-${sideName}`);
		if (valSlip && barSlip) {
			let rrSlip = parseFloat(sideData.ROLLING_RESISTANCE_SLIP) || 5000;
			// 解析事実: 最小480 (MLFD3S) 〜 最大6500 (generator2)
			// 0(滑る) 〜 7000(止まる) の範囲を0〜100%とする
			let slipPct = Math.max(0, Math.min(100, (rrSlip / 7000.0) * 100));
			valSlip.innerText = rrSlip.toFixed(0);
			barSlip.style.width = slipPct + "%";
		}
		// =========================================================
		// 🌟 追加ブロックはここまで
		// =========================================================

		// ■ Green (Serie 2): Mz Curve vs SA (-20° to +20°)
		let state_MZ = { SR: 0, SA: -20.0 * Math.PI / 180.0 };
		ctx.beginPath(); ctx.strokeStyle = '#00ff00'; ctx.lineWidth = 1.5;
		for (let i = 0; i <= 200; i++) {
			let sa_deg = -20.0 + (i * 40.0) / 200.0;
			let res = stepDynamicTyre(state_MZ, sa_deg * Math.PI / 180.0, 0, Fz, testCamberDeg, sideData);
			let mz_scaled = (res.Mz / (Fz * 0.0002)) * 0.01;
			let x = gX + (i * gW) / 200;
			let y = cY - mz_scaled * scaleY;
			if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
		}
		ctx.stroke();

		// ■ Yellow (Serie 3): Dy Curve vs Load (0 to 2000kg)
		ctx.beginPath(); ctx.strokeStyle = '#ffff00'; ctx.lineWidth = 1.5;
		for (let i = 0; i < 200; i++) {
			let load_kg = i * 10.0;
			let dy_val = getFactDY(load_kg * 9.806, getVal('BLISTER', sideData), sideData);
			let x = gX + (i * gW) / 200;
			let y = cY - dy_val * scaleY;
			if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
		}
		ctx.stroke();

		// ■ Cyan (Serie 4): Fy/Load vs SR (SA = 9.0° Fixed)
		let state_GL_SA = { SR: -1.0, SA: 9.0 * Math.PI / 180.0 };
		ctx.beginPath(); ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 1.5;
		for (let i = 0; i < 200; i++) {
			let sr = -1.0 + (i * 2.0) / 200.0;
			let res = stepDynamicTyre(state_GL_SA, 9.0 * Math.PI / 180.0, sr, Fz, testCamberDeg, sideData);
			let x = gX + (i * gW) / 200;
			let y = cY - (res.Fy / Fz) * scaleY;
			if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
		}
		ctx.stroke();

		// ■ Orange (Serie 5): dCamber (-20° to +20°)
		ctx.beginPath(); ctx.strokeStyle = '#ff7f7f'; ctx.lineWidth = 1.5;
		for (let i = 0; i <= 200; i++) {
			let camb = -20.0 + (i * 40.0) / 200.0;
			let camberRAD = camb * Math.PI / 180.0;
			let c_dy = getCamberedDyFact(camberRAD, sideData);
			let camber_y = (c_dy - 1.0) * 5.0;
			let x = gX + (i * gW) / 200;
			let y = cY - camber_y * scaleY;
			if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
		}
		ctx.stroke();

		// ■ Cyan Ellipse (GL): Fx vs Fy (SA = 9.0° Fixed)
		let state_GL = { SR: -1.0, SA: 9.0 * Math.PI / 180.0 };
		ctx.beginPath(); ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 2.0;
		const glScale = gW * 0.25; 
		for (let i = 0; i < 200; i++) {
			let sr = -1.0 + (i * 2.0) / 200.0;
			let res = stepDynamicTyre(state_GL, 9.0 * Math.PI / 180.0, sr, Fz, testCamberDeg, sideData);
			let gl_x = cX + (res.Fx / Fz) * glScale;
			let gl_y = cY + (res.Fy / Fz) * glScale;
			if (i === 0) ctx.moveTo(gl_x, gl_y); else ctx.lineTo(gl_x, gl_y);
		}
		ctx.stroke();
	});
};