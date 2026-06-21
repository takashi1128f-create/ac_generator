// js/engine.js
window.currentEngineData = null;
window.currentPowerLut = [];
window.currentPowerLutRaw = "";
window.ctrlTurboData = {};
window.engineChartInstance = null;
window.activeTurboIndex = 0;
window.activeEngineTab = 'ENGINE';
window.activeTurboCount = null;
// LUTパース
window.parsePowerLut = function(text) {
	window.currentPowerLutRaw = text;
	const points = text.split(/\r?\n/).map(line => {
		const clean = line.split(';')[0].split('//')[0].trim();
		if (!clean) return null;
		const parts = clean.split('|');
		return parts.length === 2 ? {
			rpm: parseFloat(parts[0]),
			torque: parseFloat(parts[1])
		} : null;
	}).filter(p => p && !isNaN(p.rpm));
	window.currentPowerLut = points.sort((a, b) => a.rpm - b.rpm);
	// すでにテキストエリアがあれば値を更新
	const lutArea = document.getElementById('power-lut-textarea');
	if (lutArea) {
		lutArea.value = text;
	} else {
		// まだエディター自体が作られていなければ生成を試みる
		window.initEngineEditor(window.currentEngineData);
	}
	window.updateEngineGraph();
	if (typeof window.updateSpecsFromPhysics === 'function') {
		window.updateSpecsFromPhysics();
	}
	if (typeof window.updateUiCurveGraph === 'function') {
    window.updateUiCurveGraph();
}
};
// --- ターボ専用UIの生成関数 ---
window.renderTurboUI = function(container, data) {
	if (!container || !data) return;
	container.innerHTML = ''; // コンテナをクリア

	const turboWrapper = document.createElement('article');
	// ターボの基数をカウント
	let turboCount = 0;
	while (data[`TURBO_${turboCount}`]) {
		turboCount++;
	}
	
	// ★修正：グローバルに保存された選択状態があれば優先し、なければデータから取得
	if (window.activeTurboCount === null) {
		window.activeTurboCount = turboCount;
	}
	let currentSelectValue = window.activeTurboCount;

	const turboHeader = document.createElement('div');
	turboHeader.className = 'suspension-item-title_box';
	turboHeader.innerHTML = `
		<p>TURBO</p>
		<select id="turbo-count-select" class="text-input turbo-select">
			${[0,1,2,3,4,5,6,7,8].map(i => `<option value="${i}" ${currentSelectValue === i ? 'selected' : ''}>${i === 0 ? 'None' : i}</option>`).join('')}
		</select>
	`;
	turboWrapper.appendChild(turboHeader);

	const turboTabHeader = document.createElement('div');
	turboTabHeader.className = 'tab-header';
	const turboTabContent = document.createElement('div');
	turboTabContent.className = 'tab-content-container';

	const allTurbos = [];
	const pages = [];
	const tabBtns = [];

	const createTurboItem = (index) => {
		const section = `TURBO_${index}`;
		const tBox = document.createElement('div');
		tBox.className = 'turbo-item_box';
		tBox.id = `turbo-item-${index}`;
		if (index >= currentSelectValue) tBox.classList.add('disabled-turbo');

		tBox.addEventListener('click', () => {
			if (tBox.classList.contains('disabled-turbo')) return;
			window.activeTurboIndex = index;
			window.updateEngineGraph();
		});

		tBox.innerHTML = `<div class="suspension-item-title_box"><p>${section}</p></div>`;
		const innerBox = document.createElement('div');
		innerBox.className = 'suspension-item_box';

		if (!data[section]) data[section] = data['TURBO_0'] ? JSON.parse(JSON.stringify(data['TURBO_0'])) : {};

		Object.keys(data[section]).forEach(key => {
			const val = data[section][key];
			const editorRule = window.getEditorStep(key, val);
			const step = typeof editorRule === 'object' ? editorRule.step : editorRule;

			const item = document.createElement('div');
			item.className = 'suspension-item';
			item.innerHTML = `<div class="input-unit"><label>${key}</label><input type="number" class="text-input" value="${val}" step="${step}"></div>`;
			item.querySelector('input').addEventListener('input', (e) => {
				window.currentEngineData[section][key] = e.target.value;
				window.updateEngineGraph();
				if (typeof window.renderSetupUI === 'function') window.renderSetupUI();
			});
			innerBox.appendChild(item);
		});
		tBox.appendChild(innerBox);
		return tBox;
	};

	for (let i = 0; i < 8; i++) allTurbos.push(createTurboItem(i));

	for (let p = 0; p < 4; p++) {
		// タブがカバーするインデックスの最小値（0, 2, 4, 6）が、選択された基数以上であればタブの生成自体をスキップする
		if (p * 2 >= currentSelectValue) continue;
		const btn = document.createElement('button');
		btn.className = `tab-btn ${p === 0 ? 'active' : ''}`;
		btn.textContent = `${p * 2 + 1}.${p * 2 + 2}`;
		btn.addEventListener('click', () => {
			tabBtns.forEach(b => b.classList.remove('active'));
			btn.classList.add('active');
			pages.forEach(pg => pg.classList.add('tab-hidden'));
			pages[p].classList.remove('tab-hidden');
			window.activeTurboIndex = p * 2;
			window.updateEngineGraph();
		});
		turboTabHeader.appendChild(btn);
		tabBtns.push(btn);

		const pageDiv = document.createElement('div');
		pageDiv.className = `turbo-item-outer_box ${p === 0 ? '' : 'tab-hidden'}`;
		pageDiv.appendChild(allTurbos[p * 2]);
		pageDiv.appendChild(allTurbos[p * 2 + 1]);
		turboTabContent.appendChild(pageDiv);
		pages.push(pageDiv);
	}

	const selectEl = turboHeader.querySelector('#turbo-count-select');
	selectEl.addEventListener('change', (e) => {
		currentSelectValue = parseInt(e.target.value, 10);
		window.activeTurboCount = currentSelectValue; // ★追加: 選択値をグローバルに記憶する

		// 選択された基数に合わせてUI全体のタブボタンの生成をリフレッシュする
		window.initEngineEditor(window.currentEngineData);
		window.updateEngineGraph();
		if (typeof window.updateSpecsFromPhysics === 'function') {
			window.updateSpecsFromPhysics();
		}
	});

	turboWrapper.appendChild(turboTabHeader);
	turboWrapper.appendChild(turboTabContent);
	container.appendChild(turboWrapper);
};
// 2. エディターUIの生成
window.initEngineEditor = function(data) {
	const iniContainer = document.getElementById('engine-data-container');
	if (!iniContainer || !data) return;

	// 1. タブメニューの生成
	iniContainer.innerHTML = `
		<div class="suspension-tab-menu">
			<button class="suspension-tab-btn ${window.activeEngineTab === 'ENGINE' ? 'active' : ''}" id="engine-tab-btn-main">ENGINE</button>
			<button class="suspension-tab-btn ${window.activeEngineTab === 'TURBO' ? 'active' : ''}" id="engine-tab-btn-turbo">TURBO</button>
		</div>
		<div id="engine-tab-content-area"></div>
	`;

	const contentArea = document.getElementById('engine-tab-content-area');

	// タブ切り替え関数
	const switchTab = (tabName) => {
		window.activeEngineTab = tabName;
		window.initEngineEditor(data); // 再描画して切り替え
	};

	iniContainer.querySelector('#engine-tab-btn-main').onclick = () => switchTab('ENGINE');
	iniContainer.querySelector('#engine-tab-btn-turbo').onclick = () => switchTab('TURBO');

	// 2. タブごとの中身を描画
	if (window.activeEngineTab === 'ENGINE') {
		// ENGINEタブ：基本設定 + コントローラーを表示
		const engineGroup = document.createElement('div');
		engineGroup.className = 'turbo-item-outer_box';

		['ENGINE_DATA', 'DAMAGE', 'COAST_REF', 'COAST_DATA', 'COAST_CURVE'].forEach(section => {
			if (!data[section]) return;
			const wrapper = document.createElement('article');
			wrapper.innerHTML = `<div class="suspension-item-title_box"><p>${section}</p></div>`;
			const box = document.createElement('div');
			box.className = 'suspension-item_box';

			Object.keys(data[section]).forEach(key => {
				const val = data[section][key];
				const editorRule = window.getEditorStep(key, val);
				const currentStep = typeof editorRule === 'object' ? editorRule.step : editorRule;
				const currentMin = typeof editorRule === 'object' && editorRule.min !== "" ? ` min="${editorRule.min}"` : "";
				const currentMax = typeof editorRule === 'object' && editorRule.max !== "" ? ` max="${editorRule.max}"` : "";
				const isNum = !isNaN(val) && val !== "";

				const item = document.createElement('div');
				item.className = 'suspension-item';
				item.innerHTML = `<div class="input-unit"><label>${key}</label><div class="input-with-range"><input type="${isNum ? 'number' : 'text'}" class="text-input" value="${val}" step="${currentStep}"${currentMin}${currentMax}></div></div>`;
				
				item.querySelector('input').addEventListener('input', (e) => {
					window.currentEngineData[section][key] = e.target.value;
					window.updateEngineGraph();
					if (typeof window.renderSetupUI === 'function') window.renderSetupUI();
				});
				box.appendChild(item);
			});
			wrapper.appendChild(box);
			engineGroup.appendChild(wrapper);
		});

		// CONTROLLERS（将来用）の空枠もここに追加
		const ctrlWrapper = document.createElement('article');
		ctrlWrapper.innerHTML = `
			<div class="suspension-item-title_box">
				<p>CONTROLLERS (ctrl_turbo_*.ini)</p>
			</div>`;
		const ctrlBox = document.createElement('div');
		ctrlBox.id = 'ctrl-turbo-container';
		ctrlBox.className = 'suspension-item_box';
		ctrlWrapper.appendChild(ctrlBox);
		engineGroup.appendChild(ctrlWrapper);

		contentArea.appendChild(engineGroup);

	} else {
		// TURBOタブ：ターボ設定のみを表示
		window.renderTurboUI(contentArea, data);
	}

	// 補足：もう一つのコンテナ（power.lut 用）の処理
	const lutContainer = document.getElementById('power-lut-data-container');
	if (lutContainer) {
		lutContainer.innerHTML = '';
		const lutWrapper = document.createElement('article');
		lutWrapper.innerHTML = `<div class="suspension-item-title_box"><p>POWER.LUT (RPM|Torque)</p></div>`;
		const lutBox = document.createElement('div');
		lutBox.className = 'suspension-item_box';
		const textarea = document.createElement('textarea');
		textarea.id = 'power-lut-textarea';
		textarea.className = 'text-input';
		textarea.value = window.currentPowerLutRaw;
		textarea.addEventListener('input', (e) => { window.parsePowerLut(e.target.value); });
		lutBox.appendChild(textarea);
		lutWrapper.appendChild(lutBox);
		lutContainer.appendChild(lutWrapper);
	}
};
// グラフ描画
window.updateEngineGraph = function() {
	const canvas = document.getElementById('engineChart');
	if (!canvas) return; // 描画対象がない場合は早期リターン

	// 1. データの状態を確認（デバッグ用）
	const engine = window.currentEngineData || {};
		// ★ここを修正：TURBO_0 固定をやめ、UIで設定されたターボの総数を取得する
		const turboCountSelect = document.getElementById('turbo-count-select');
		const turboCount = turboCountSelect ? parseInt(turboCountSelect.value) : 1;
		const limiter = parseFloat(engine.ENGINE_DATA?.LIMITER) || 8000;

	const BHP_CONSTANT = 7120.8;
	const labels = [], torNa = [], pwrNa = [], torTu = [], pwrTu = [];

	for (let rpm = 0; rpm <= limiter; rpm += 100) {
		labels.push(rpm);
		// 補間計算
		let baseTorque = window.getInterpolatedTorque(rpm, window.currentPowerLut);
		torNa.push(baseTorque);
		pwrNa.push((baseTorque * rpm) / BHP_CONSTANT);
			
			const turboParams = window.calculateEngineParams(rpm, engine, turboCount, baseTorque);
		torTu.push(turboParams.torque);
		pwrTu.push(turboParams.power);
		}

	// 4. チャート再描画処理
	if (window.engineChartInstance) {
		window.engineChartInstance.destroy();
	}
	// ... (以降のチャート生成コード)
	if (window.engineChartInstance) window.engineChartInstance.destroy();
	// グラフの最大値を動的に計算（データ最大値の1.2倍を基準にする）
	const maxVal = Math.max(...torNa, ...pwrNa, ...torTu, ...pwrTu);
	const yMax = Math.ceil(maxVal * 1.2 / 100) * 100;

	if (window.engineChartInstance) window.engineChartInstance.destroy();
	window.engineChartInstance = new Chart(canvas, {
		type: 'line',
		data: {
			labels: labels,
			datasets: [{
				label: 'Torque(NA)',
				data: torNa,
				borderColor: '#3498db',
				borderDash: [5, 5],
				yAxisID: 'y1',
				pointRadius: 0,
				tension: 0.1,
				borderWidth: 2
			}, {
				label: 'Power(NA)',
				data: pwrNa,
				borderColor: '#e74c3c',
				borderDash: [5, 5],
				yAxisID: 'y2',
				pointRadius: 0,
				tension: 0.1,
				borderWidth: 2
			}, {
				label: 'Torque(Turbo)',
				data: torTu,
				borderColor: '#3498db',
				yAxisID: 'y1',
				pointRadius: 0,
				tension: 0.1,
				borderWidth: 2
			}, {
				label: 'Power(Turbo)',
				data: pwrTu,
				borderColor: '#e74c3c',
				yAxisID: 'y2',
				pointRadius: 0,
				tension: 0.1,
				borderWidth: 2
			}]
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			animation: false,
			interaction: {
				mode: 'index',
				intersect: false,
			},
			plugins: {
				tooltip: {
					enabled: true,
					backgroundColor: 'rgb(0, 0, 0)',
					titleColor: '#4dabf7',
					bodyColor: '#ffffff',
					borderColor: 'rgba(255, 255, 255, 0.6)',
					borderWidth: 1,
					padding: 10,
					callbacks: {
						title: function(context) {
							return context[0].label + ' RPM';
						},
						label: function(context) {
							let label = context.dataset.label || '';
							if (label) {
								label += ': ';
							}
							if (context.parsed.y !== null) {
								let val = context.parsed.y.toFixed(1);
								if (label.includes('Torque')) {
									label += val + ' Nm';
								} else if (label.includes('Power')) {
									label += val + ' BHP';
								}
							}
							return label;
						}
					}
				}
			},
			scales: {
				x: {
					title: {
						display: true,
						text: 'RPM',
						color: '#ffffff'
					},
					grid: {
						color: 'rgba(255, 255, 255, 0.3)'
					},
					ticks: {
						color: '#ffffff',
						// ★ Chart.jsの自動調整をオフにして手動で制御する
						autoSkip: false,
						maxRotation: 0,
						minRotation: 0,
						callback: function(value, index, values) {
							// 現在のインデックスから実際のRPM数値を取得
							const rpm = Number(this.getLabelForValue(value));
							// ==========================================
							// ★ ここで縦線の間隔（ステップ）を自由に変更できます
							// （例：1000なら1000RPMごと、500なら500RPMごと）
							const stepSize = 500;
							// ==========================================
							// rpmがstepSizeで割り切れる時だけ表示する
							if (rpm % stepSize === 0) {
								return rpm;
							}
							// それ以外は null を返して線ごと非表示にする
							return null;
						}
					}
				},
				y1: {
					position: 'left',
					beginAtZero: true,
					max: yMax,
					title: {
						display: true,
						text: 'Torque (Nm)',
						color: '#ffffff' // ★Y1軸タイトルの文字色（白）
					},
					grid: {
						color: 'rgba(255, 255, 255, 0.1)'
					},
					ticks: {
						color: '#cccccc', // ★Y1軸の数字の文字色（明るいグレー）
						stepSize: 200
					}
				},
				y2: {
					position: 'right',
					beginAtZero: true,
					max: yMax,
					title: {
						display: true,
						text: 'Power (BHP)',
						color: '#ffffff' // ★Y2軸タイトルの文字色（白）
					},
					grid: {
						drawOnChartArea: false
					},
					ticks: {
						color: '#cccccc', // ★Y2軸の数字の文字色（明るいグレー）
						stepSize: 200
					}
				}
			}
		}
	});
};
// 【追加】指定したRPMにおける補間トルクを算出する関数
window.getInterpolatedTorque = function(targetRpm, lut) {
	if (!lut || lut.length === 0) return 0;
	if (targetRpm <= lut[0].rpm) return lut[0].torque;
	if (targetRpm >= lut[lut.length - 1].rpm) return lut[lut.length - 1].torque;

	for (let i = 0; i < lut.length - 1; i++) {
		if (targetRpm >= lut[i].rpm && targetRpm <= lut[i + 1].rpm) {
			// 前後の点を取得（範囲外は端の値をコピー）
			const p0 = lut[Math.max(0, i - 1)];
			const p1 = lut[i];
			const p2 = lut[i + 1];
			const p3 = lut[Math.min(lut.length - 1, i + 2)];

			const t = (targetRpm - p1.rpm) / (p2.rpm - p1.rpm);
			const t2 = t * t;
			const t3 = t2 * t;

			// 接線（勾配）の計算
			const m0 = (p2.torque - p0.torque) * 0.5;
			const m1 = (p3.torque - p1.torque) * 0.5;

			// 3次エルミート補間式
			return (2 * t3 - 3 * t2 + 1) * p1.torque +
				   (-2 * t3 + 3 * t2) * p2.torque +
				   (t3 - 2 * t2 + t) * m0 +
				   (t3 - t2) * m1;
		}
	}
	return 0;
};
window.calculateEngineParams = function(rpm, engine, turboCount, baseTorque) {
	const BHP_CONSTANT = 7120.8;
	let totalBoost = 0;
	for (let i = 0; i < turboCount; i++) {
    const turboObj = engine[`TURBO_${i}`];
    // 存在チェックとブースト値の確認
    if (!turboObj || !turboObj.MAX_BOOST || parseFloat(turboObj.MAX_BOOST) <= 0) continue;

    let mB = parseFloat(turboObj.MAX_BOOST) || 0;
		if (mB > 0) {
			let refRpm = parseFloat(turboObj.REFERENCE_RPM) || 1;
			let gamma = parseFloat(turboObj.GAMMA) || 1;
			let wastegate = parseFloat(turboObj.WASTEGATE) || mB;
			let userSetting = parseFloat(turboObj.USER_SETTING) || 1.0;

			let b = mB * Math.pow(rpm / refRpm, gamma);
			let limit = wastegate * userSetting;
			if (b > limit) { b = limit; }
			totalBoost += b;
		}
	}

	let torque = baseTorque * (1.0 + totalBoost);
	let power = (torque * rpm) / BHP_CONSTANT;
	return { torque, power };
};
// 物理設定から馬力を算出してUIを更新する関数
window.updateSpecsFromPhysics = function() {
    if (window.isMultiUploading || window.isRestoring) return;
    
    // 1. データの存在チェック
    if (!window.currentEngineData || !window.currentPowerLut || window.currentPowerLut.length === 0) {
        return;
    }
    
    const engine = window.currentEngineData;
    const limiter = parseFloat(engine.ENGINE_DATA?.LIMITER) || 8000;
    
    // ターボ数の判定
    let turboCount = window.activeTurboCount;
    if (turboCount === null || turboCount === undefined) {
        turboCount = Object.keys(engine).filter(key => key.startsWith('TURBO_')).length;
    }
    
    // 2. 馬力・トルクのピーク値を計算
    let maxPowerBhp = 0, maxTorque = 0;
    for (let rpm = 0; rpm <= limiter; rpm += 100) {
        let baseTorque = window.getInterpolatedTorque(rpm, window.currentPowerLut);
        let params = window.calculateEngineParams(rpm, engine, turboCount, baseTorque);
        if (params.power > maxPowerBhp) maxPowerBhp = params.power;
        if (params.torque > maxTorque) maxTorque = params.torque;
    }
    const maxPowerPs = Math.round(maxPowerBhp * 1.01387);

    // 3. パワーウェイトレシオの計算
    let pwRatio = null;
    const currentWeight = parseFloat(window.currentSpecs.weight);
    if (currentWeight > 0 && maxPowerPs > 0) {
        pwRatio = (currentWeight / maxPowerPs).toFixed(2);
    }

    // --- 各種パフォーマンス・スペックの計算 ---
    let topSpeed = null;
    let acceleration = null;

    if (window.gearSetList && window.gearSetList[window.activeGearIdx]) {
        const activeSet = window.gearSetList[window.activeGearIdx].data || {};
        const gears = activeSet.GEARS || {};
        const finalRatio = parseFloat(gears.FINAL) || 0;
        const gearCount = parseInt(gears.COUNT) || 1;
        const topGearRatio = parseFloat(gears["GEAR_" + gearCount]) || 0;
        
        const tyre = window.tyreCompoundList[window.activeTyreIdx]?.data?.REAR || {};
        const tireRadius = parseFloat(tyre.RADIUS) || 0.3;

        // 4. 理論上の最高速計算
        if (limiter > 0 && finalRatio > 0 && topGearRatio > 0) {
            topSpeed = Math.round((limiter * (tireRadius * 2 * Math.PI) * 60) / (topGearRatio * finalRatio * 1000));
        }

        // 5. ★0-100km/h 加速の概算ロジック (追加)
        if (currentWeight > 0 && maxPowerPs > 0) {
            // シフトタイムを取得（ミリ秒から秒へ変換）[cite: 155, 180]
            const shiftTime = (parseFloat(activeSet.GEARBOX?.CHANGE_UP_TIME) || 250) / 1000;
            
            // 物理推算式: (P/W比に基づく基本加速) + (シフトロス) + (発進ロス)
            // 0.72 は一般的な駆動効率とタイヤのグリップを考慮した係数
            const baseAccel = (currentWeight / maxPowerPs) * 0.72;
            
            // 0-100km/h到達までに通常2回のシフト（1→2速、2→3速）が必要と仮定
            const totalShiftLoss = 2 * shiftTime;
            
            // 合計。ローンチ時のラグとして一律 0.4秒 を加算
            let estimatedTime = baseAccel + totalShiftLoss + 0.4;
            
            // トラクションの物理的限界として、どれだけハイパワーでも 2.2秒 以下にはならないように制限
            if (estimatedTime < 2.2) estimatedTime = 2.2;
            
            acceleration = estimatedTime.toFixed(1);
        }
    }

    // 6. 全ての計算結果をUIに一括反映
    if (typeof window.updateSpecsDisplay === 'function') {
        window.updateSpecsDisplay({ 
            whp: maxPowerPs,
            torque: Math.round(maxTorque),
            pwratio: pwRatio,
            topspeed: topSpeed,
            acceleration: acceleration // ここでUIに渡されます
        });
    }
		if (typeof window.updateUiCurveGraph === 'function') {
        window.updateUiCurveGraph();
    }
};
/**
 * ui_car.json プレビュー用の小さなグラフを描画する
 */
window.updateUiCurveGraph = function() {
    const canvas = document.getElementById('ui-torqueCurve');
    // データが揃っていない場合は描画しない
    if (!canvas || !window.currentEngineData || !window.currentPowerLut || window.currentPowerLut.length === 0) return;

    const engine = window.currentEngineData;
    
    // ★修正1：ターボ数の判定を自動計算と同じロジックにする（ターボ反映漏れを防止）
    let turboCount = window.activeTurboCount;
    if (turboCount === null || turboCount === undefined) {
        turboCount = Object.keys(engine).filter(key => key.startsWith('TURBO_')).length;
    }

    const limiter = parseFloat(engine.ENGINE_DATA?.LIMITER) || 8000;
    const labels = [], torqueData = [], powerData = [];

    // 200RPM刻みでプロットデータを生成
    for (let rpm = 0; rpm <= limiter; rpm += 200) {
        labels.push(rpm);
        let baseTorque = window.getInterpolatedTorque(rpm, window.currentPowerLut);
        // ブースト込みの数値を計算
        let params = window.calculateEngineParams(rpm, engine, turboCount, baseTorque);
        
        torqueData.push(params.torque);
        powerData.push(params.power * 1.01387); // BHPをPS(仏馬力)に変換
    }

    if (window.uiCurveChartInstance) window.uiCurveChartInstance.destroy();
    
    window.uiCurveChartInstance = new Chart(canvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { 
                    label: 'Torque', 
                    data: torqueData, 
                    borderColor: '#3498db', 
                    yAxisID: 'yNm', // トルク専用の軸
                    pointRadius: 0, 
                    borderWidth: 2,
                    tension: 0.1
                },
                { 
                    label: 'Power', 
                    data: powerData, 
                    borderColor: '#e74c3c', 
                    yAxisID: 'yPs', // 馬力専用の軸
                    pointRadius: 0, 
                    borderWidth: 2,
                    tension: 0.1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                x: { 
                    display: false // 狭い枠なので横軸（RPM）の数字は隠してスッキリさせる
                },
                // ★修正2：左右の軸設定を分け、独立してスケールするように変更
                yNm: { 
                    position: 'left', 
                    beginAtZero: true, 
                    title: { display: true, text: 'Nm', color: '#0099ff', font: { size: 10 } },
                    ticks: { color: '#333', font: { size: 9 } },
                    grid: { color: '#000000' }
                },
                yPs: { 
                    position: 'right', 
                    beginAtZero: true, 
                    title: { display: true, text: 'ps', color: '#ff0000', font: { size: 10 } },
                    ticks: { color: '#333', font: { size: 9 } },
                    grid: { drawOnChartArea: false } // グリッドの重複を避ける
                }
            },
            plugins: { 
                legend: { display: false },
                tooltip: { enabled: false } // プレビュー用なのでツールチップは無効
            }
        }
    });
};