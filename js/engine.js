// js/engine.js
window.currentEngineData = null;
window.currentPowerLut = [];
window.currentPowerLutRaw = "";
window.engineChartInstance = null;
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
};
// 2. エディターUIの生成
window.initEngineEditor = function(data) {
	const iniContainer = document.getElementById('engine-data-container');
	const lutContainer = document.getElementById('power-lut-data-container');
	// --- A. engine.ini 用のコンテナ処理 ---
	if (iniContainer && data) {
		iniContainer.innerHTML = ''; // 案内テキストを消去
		['ENGINE_DATA', 'TURBO_0'].forEach(section => {
			if (!data[section]) return;
			const wrapper = document.createElement('article');
			wrapper.innerHTML = `<div class="suspension-item-title_box"><p>${section}</p></div>`;
			const box = document.createElement('div');
			box.className = 'suspension-item_box';
			Object.keys(data[section]).forEach(key => {
				const val = data[section][key];
				// ★大掃除：司令塔からステップ値を取得
				const editorRule = window.getEditorStep(key, val);
				const currentStep = typeof editorRule === 'object' ? editorRule.step : editorRule;
				const currentMin = typeof editorRule === 'object' && editorRule.min !== "" ? ` min="${editorRule.min}"` : "";
				const currentMax = typeof editorRule === 'object' && editorRule.max !== "" ? ` max="${editorRule.max}"` : "";
				const item = document.createElement('div');
				item.className = 'suspension-item';
				item.innerHTML = `<div class="input-unit"><label>${key}</label><input type="number" class="text-input" value="${val}" step="${currentStep}"${currentMin}${currentMax}></div>`;
				item.querySelector('input').addEventListener('input', (e) => {
					window.currentEngineData[section][key] = e.target.value;
					window.updateEngineGraph();
					// ★追加：エンジンの数値を変更した際、セットアップ画面(TURBO等)にも即座に反映させる
					if (typeof window.renderSetupUI === 'function') {
						window.renderSetupUI();
					}
				});
				box.appendChild(item);
			});
			wrapper.appendChild(box);
			iniContainer.appendChild(wrapper);
		});
	}
	// --- B. power.lut 用のコンテナ処理 ---
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
		textarea.addEventListener('input', (e) => {
			window.parsePowerLut(e.target.value);
		});
		lutBox.appendChild(textarea);
		lutWrapper.appendChild(lutBox);
		lutContainer.appendChild(lutWrapper);
	}
};
// グラフ描画
window.updateEngineGraph = function() {
	const canvas = document.getElementById('engineChart');
	if (!canvas || !window.currentPowerLut.length) return;
	const engine = window.currentEngineData || {};
	const turbo = engine.TURBO_0 || {};
	const limiter = parseFloat(engine.ENGINE_DATA?.LIMITER) || 8000;
	// アセットコルサの実機(BHP表示)に合わせる定数
	const BHP_CONSTANT = 7120.8;
	const labels = [],
		torNa = [],
		pwrNa = [],
		torTu = [],
		pwrTu = [];
	for (let rpm = 0; rpm <= limiter; rpm += 100) {
		labels.push(rpm);
		let baseTorque = (function(r) {
			const lut = window.currentPowerLut;
			if (r <= lut[0].rpm) return lut[0].torque;
			if (r >= lut[lut.length - 1].rpm) return lut[lut.length - 1].torque;
			for (let i = 0; i < lut.length - 1; i++)
				if (r >= lut[i].rpm && r <= lut[i + 1].rpm) return lut[i].torque + (r - lut[i].rpm) / (lut[i + 1].rpm - lut[i].rpm) * (lut[i + 1].torque - lut[i].torque);
			return 0;
		})(rpm);
		torNa.push(baseTorque);
		pwrNa.push((baseTorque * rpm) / BHP_CONSTANT);
		let maxBoost = parseFloat(turbo.MAX_BOOST) || 0;
		if (maxBoost > 0) {
			let refRpm = parseFloat(turbo.REFERENCE_RPM) || 1;
			let gamma = parseFloat(turbo.GAMMA) || 1;
			// WASTEGATEが未設定の場合はMAX_BOOSTを上限とする
			let wastegate = parseFloat(turbo.WASTEGATE) || maxBoost;
			// MAX_BOOSTを目標にカーブを描き、WASTEGATEの値で頭打ち（カット）する
			let boost = maxBoost * Math.pow(rpm / refRpm, gamma);
			if (boost > wastegate) {
				boost = wastegate;
			}
			// ベーストルク（1.0）にブースト圧を足し合わせる
			let tTor = baseTorque * (1.0 + boost);
			torTu.push(tTor);
			pwrTu.push((tTor * rpm) / BHP_CONSTANT);
		}
	}
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
					max: 1000,
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
					max: 1000,
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
