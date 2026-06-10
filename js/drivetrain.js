// js/drivetrain.js
window.gearSetList = [];
window.finalRtoList = [{
	label: "3.7:1",
	value: "3.7"
}, {
	label: "3.9:1",
	value: "3.9"
}, {
	label: "4.1:1",
	value: "4.1"
}, {
	label: "4.3:1",
	value: "4.3"
}];
window.gearSetList = [];
window.activeGearIdx = 0;
window.mainGearIdx = 0; // ★追加：drivetrain.ini に書き出すメインのインデックス
window.gearChartInstance = null;
window.diffChartInstance = null;
window.__lastDrivetrainData = null;
window.activeDrivetrainTab = 'GEAR'; // 開いた時の初期タブを「ギア」に設定
window.initDrivetrainEditor = function(initialData = null) {
	// ★修正：データ構築を先に行うため、ログを先頭に移動
	console.log("⚙️ [DEBUG-DT] initDrivetrainEditor開始: 現在のギアセット数 =", window.gearSetList.length);
	// ==========================================
	// ★ 古いギアセットの居座り（ゴミデータ）を掃除する（要素チェックの前に実行！）
	// ==========================================
	if (window.currentSetupData) {
		const hasGearSets = Object.keys(window.currentSetupData).some(k => k.startsWith('GEAR_SET_'));
		if (!hasGearSets && window.gearSetList.length > 0) {
			console.log("🧹 [DEBUG-DT] setup.ini は単一ギア設定です。古いギアセット(JZX100等)を消去します！");
			window.gearSetList = [];
			if (window.currentProject && window.currentProject.files['drivetrain_sets']) {
				delete window.currentProject.files['drivetrain_sets'];
			}
		}
	}
	// ==========================================
	// ★ ギアセットが空の場合、Base Drivetrainを自動生成する（要素チェックの前に実行！）
	// ==========================================
	if (window.gearSetList.length === 0) {
		console.log("⚙️ [DEBUG-DT] ギアセットが0件です。drivetrain.ini から Base Drivetrain を生成します...");
		let baseData = initialData;
		if (!baseData && window.currentProject && window.currentProject.files['drivetrain']) {
			baseData = window.currentProject.files['drivetrain'].currentData;
		}
		if (baseData && Object.keys(baseData).length > 0) {
			window.gearSetList.push({
				id: Date.now(),
				name: "Base Drivetrain",
				data: JSON.parse(JSON.stringify(baseData))
			});
			window.activeGearIdx = 0;
			window.mainGearIdx = 0;
			console.log("⚙️ [DEBUG-DT] ✅ Base Drivetrain の生成に成功しました！", window.gearSetList);
		} else {
			console.warn("⚙️ [DEBUG-DT] ❌ drivetrain.ini のデータも見つからなかったため、生成できませんでした。");
		}
	}
	// 🛠️ ギア数の自動同期：
	// データ内に GEAR_6 や GEAR_7 があれば、COUNT（速数）を自動的にその最大値に合わせます。
	// これにより、読み込み直後に手動で COUNT を書き換える手間がなくなります。
	window.gearSetList.forEach(set => {
		if (set.data && set.data.GEARS) {
			const gears = set.data.GEARS;
			let maxGearFound = parseInt(gears.COUNT) || 0;

			Object.keys(gears).forEach(key => {
				if (key.startsWith('GEAR_') && key !== 'GEAR_R') {
					const num = parseInt(key.replace('GEAR_', ''));
					if (!isNaN(num) && num > maxGearFound) {
						maxGearFound = num;
					}
				}
			});
			gears.COUNT = maxGearFound.toString();
		}
	});
	// 🚨【ガード節】データ構築が完了した後に、HTML要素の存在チェックを行う！
	// タブを開いていない時は、ここで安全に処理を抜けます（データはすでに裏で作られています）
	const container = document.getElementById('gear-editor');
	if (!container) return;
	// ここから下はタブが開かれている（HTML要素がある）時だけ実行される描画処理
	window.renderDrivetrainUI();
	if (window.activeDrivetrainTab === 'GEAR' || window.activeDrivetrainTab === 'FINAL') {
		window.updateGearChart();
	}
	if (window.gearSetList && window.gearSetList.length > 0 && window.gearSetList[window.activeGearIdx].data) {
		window.baseGearSnapshot = JSON.stringify(window.gearSetList[window.activeGearIdx].data.GEARS);
	}
};
window.renderDrivetrainUI = function() {
	const container = document.getElementById('gear-editor');
	if (!container) return;
	const activeSet = window.gearSetList[window.activeGearIdx];
	if (!activeSet || !activeSet.data) return;
	// サブタブメニューと、コンテンツを入れる枠を作成
	container.innerHTML = `
		<div class="suspension-tab-menu" id="dt-subtab-menu">
			<button class="suspension-tab-btn ${window.activeDrivetrainTab==='GEAR'?'active':''}" onclick="window.setDtTab('GEAR')">GEAR</button>
			<button class="suspension-tab-btn ${window.activeDrivetrainTab==='FINAL'?'active':''}" onclick="window.setDtTab('FINAL')">FINAL</button>
			<button class="suspension-tab-btn ${window.activeDrivetrainTab==='DIFF'?'active':''}" onclick="window.setDtTab('DIFF')">LSD</button>
			<button class="suspension-tab-btn ${window.activeDrivetrainTab==='GEARBOX'?'active':''}" onclick="window.setDtTab('GEARBOX')">GEARBOX</button>
			<button class="suspension-tab-btn ${window.activeDrivetrainTab==='ASSIST'?'active':''}" onclick="window.setDtTab('ASSIST')">ASSIST</button>
		</div>
		<div class="suspension-tab-content" id="dt-tab-content"></div>
	`;
	const content = document.getElementById('dt-tab-content');
	// --- 選択されたサブタブに応じて中身を描画 ---
	if (window.activeDrivetrainTab === 'GEAR') {
		// ユーザー様が作成したCSS構造を完全に維持した「ギアエディター」
		content.innerHTML = `
			<div class="drivetrain-editor-layout">
				<article>
					<aside class="gear-sidebar">
						<div class="suspension-item-title_box"><p>GEAR SETS</p></div>
						<div id="gear-set-list" class="gear-set-list"></div>
						<button class="add-set-btn" onclick="window.duplicateGearSet()">+ セットを複製</button>
					</aside>
				</article>
				<article>
					<div class="gear-main-editor" style="width: 100%;">
						<div class="suspension-item-title_box"><p>GEAR RATIOS (1-7 & FINAL)</p></div>
						<div id="gear-ratio-inputs" class="suspension-item_box"></div>
					</div>
				</article>
			</div>
		`;
		// 1. サイドバー（GEAR SETS）
		const list = document.getElementById('gear-set-list');
		list.innerHTML = window.gearSetList.map((set, idx) => {
			const isActive = idx === window.activeGearIdx;
			const isMain = idx === window.mainGearIdx; // ★追加：ラジオボタン用
			return `
			<div class="gear-set-item ${isActive ? 'active' : ''}">
				<input type="radio" name="main_gear_radio" ${isMain ? 'checked' : ''} 
					onchange="window.setMainGear(${idx})" title="drivetrain.ini に書き出すメインギアに設定">
				
				<input type="text" class="set-name-input" value="${set.name}" 
					onchange="window.updateGearSetName(${idx}, this.value)">
				
				<button class="select-set-btn ${isActive ? 'is-selected' : ''}" onclick="window.selectGearSet(${idx})">
					${isActive ? '編集' : '選択'}
				</button>
				
				<button class="delete-set-btn" onclick="window.deleteGearSet(${idx})" title="削除">×</button>
			</div>
			`;
		}).join('');
		// 2. GEARS入力 (7速固定でCOUNT連動)
		const ratioBox = document.getElementById('gear-ratio-inputs');
		const gearsData = activeSet.data.GEARS || {};
		const gearOrder = ["COUNT", "GEAR_R", "GEAR_1", "GEAR_2", "GEAR_3", "GEAR_4", "GEAR_5", "GEAR_6", "GEAR_7", "FINAL"];
		const countVal = parseInt(gearsData.COUNT) || 7;
		const currentGearKeys = Object.keys(gearsData);
		const keysToDisplay = [...gearOrder];
		currentGearKeys.forEach(k => {
			if (!keysToDisplay.includes(k)) keysToDisplay.push(k);
		});
		keysToDisplay.forEach(key => {
			const val = gearsData[key] !== undefined ? gearsData[key] : "";
			const isText = isNaN(val) && val !== "";
			// ★大掃除：GEARSタブも司令塔（step.js）からカスタム設定を受け取れるようにする
			let currentStep = isText ? "" : (key === "COUNT" ? "1" : "0.001");
			let currentMin = key === "COUNT" ? ' min="1" max="7"' : ""; // COUNT用の安全装置
			let currentMax = "";
			if (!isText && typeof window.getEditorStep === 'function') {
				const editorRule = window.getEditorStep(key, val);
				if (editorRule) {
					// ユーザーのカスタム設定があれば上書き（なければデフォルトの0.001等を維持）
					if (editorRule.step) currentStep = editorRule.step;
					if (editorRule.min !== "") currentMin = ` min="${editorRule.min}"`;
					if (editorRule.max !== "") currentMax = ` max="${editorRule.max}"`;
				}
			}
			let isDisabled = false;
			let opacity = "1.0";
			if (key.startsWith("GEAR_") && key !== "GEAR_R") {
				const gearNum = parseInt(key.replace("GEAR_", ""));
				if (gearNum > countVal) {
					isDisabled = true;
					opacity = "0.3";
				}
			}
			const div = document.createElement('div');
			div.className = 'suspension-item';
			div.style.opacity = opacity;
			div.innerHTML = `<div class="input-unit"><label>${key}</label><input type="${isText ? 'text' : 'number'}" step="${currentStep}"${currentMin}${currentMax} value="${val}" class="text-input" ${isDisabled ? 'disabled' : ''}></div>`;
			div.querySelector('input').addEventListener('input', (e) => {
				activeSet.data.GEARS[key] = e.target.value;
				if (key === 'COUNT') {
					window.renderDrivetrainUI();
				}
				if (key.startsWith('GEAR_') || key === 'FINAL' || key === 'COUNT') {
					window.updateGearChart();
				}
			});
			ratioBox.appendChild(div);
		});
	} else if (window.activeDrivetrainTab === 'FINAL') {
		// --- ★ 新設：ファイナルギア (.rto) タブ ---
		const activeSet = window.gearSetList[window.activeGearIdx];
		const currentFinal = parseFloat(activeSet.data.GEARS?.FINAL) || 0;
		let rtoHtml = `
			<div class="drivetrain-editor-layout">
				<article class="drivetrain-editor-ui_box">
					<div class="suspension-item-title_box final-editor-ui-title">
						<p>FINAL GEAR RATIOS (final.rto)</p>
						<button onclick="window.addFinalRto()">+ 追加</button>
					</div>
					<div class="suspension-item_box final-editor-ui-edit_box">
						<div>
						「●」を選択するとプレビューグラフに反映され、保存時に drivetrain.ini のメインとして書き出されます。<br>
							ファイナルギアのリストは上の「final」で final.rto 保存できます。
						</div>
		`;
		window.finalRtoList.forEach((item, idx) => {
			const isChecked = (parseFloat(item.value) === currentFinal) ? 'checked' : '';
			rtoHtml += `
						<div class="suspension-item">
							<input type="radio" name="main_final" ${isChecked} onchange="window.setMainFinal(${idx})">
							<div class="input-unit">
								<label>ピット表示名 (Label)</label>
								<!--<input type="text" class="text-input" value="${item.label}" onchange="window.updateFinalRto(${idx}, 'label', this.value)">-->
								<input type="text" class="text-input" value="${item.label}" readonly tabindex="-1" style="pointer-events: none;">
							</div>
							<div class="input-unit">
								<label>ギア比 (Ratio)</label>
								<input type="number" class="text-input" value="${item.value}" step="0.01" onchange="window.updateFinalRto(${idx}, 'value', this.value)">
							</div>
							<button onclick="window.removeFinalRto(${idx})">削除</button>
						</div>
			`;
		});
		rtoHtml += `
					</div>
					<div style="padding: 15px; text-align: right;">
					</div>
				</article>
			</div>
		`;
		content.innerHTML = rtoHtml;
	} else {
		// --- ギア以外のタブ（DIFF, GEARBOX, ASSIST） ---
		const tabMap = {
			'DIFF': ['DIFFERENTIAL'],
			'GEARBOX': ['GEARBOX'],
			'ASSIST': ['AUTOCLUTCH', 'AUTOBLIP', 'DOWNSHIFT_PROFILE', 'AUTO_SHIFTER', 'CLUTCH']
		};
		const sections = tabMap[window.activeDrivetrainTab];
		if (!sections) return;
		let hasContent = false;
		// ★ご要望の通り、パネルのラッパーを作成
		let html = `<div class="suspension-tab-panel active">`;
		sections.forEach(section => {
			if (!activeSet.data[section]) return;
			hasContent = true;
			html += `
				<article>
					<div class="suspension-item-title_box"><p>${section}</p></div>
					<div class="suspension-item_box" id="sec-${section}"></div>
				</article>
			`;
		});
		html += `</div>`;
		// データが空っぽの場合はダミーを表示
		if (!hasContent) {
			content.innerHTML = `
				<div style="padding: 30px; text-align: center; color: #88a; background: #222; border-radius: 4px; height: 100%;">
					<p>このタブに関する設定項目がありません。</p>
				</div>
			`;
			return;
		}
		content.innerHTML = html;
		// 生成した枠の中に、ご指定のHTML構造で入力欄を入れていく
		sections.forEach(section => {
			if (!activeSet.data[section]) return;
			const itemBox = document.getElementById(`sec-${section}`);
			if (!itemBox) return;
			Object.keys(activeSet.data[section]).forEach(key => {
				const val = activeSet.data[section][key];
				// カンマ区切りの座標データかどうかを判定
				const isCoord = String(val).includes(',');
				const vals = isCoord ? String(val).split(',').map(v => v.trim()) : [val];
				// stepの取得
				let currentStep = "0.01";
				let currentMin = "";
				let currentMax = "";
				if (typeof window.getEditorStep === 'function') {
					const editorRule = window.getEditorStep(key, val);
					currentStep = typeof editorRule === 'object' ? editorRule.step : editorRule;
					currentMin = typeof editorRule === 'object' && editorRule.min !== "" ? ` min="${editorRule.min}"` : "";
					currentMax = typeof editorRule === 'object' && editorRule.max !== "" ? ` max="${editorRule.max}"` : "";
				} else {
					currentStep = (isNaN(val) || String(val).includes('.')) ? "0.01" : "1";
				}
				const div = document.createElement('div');
				div.className = 'suspension-item' + (isCoord ? ' is-coordinate' : '');
				// ★追加：SUPPORTS_SHIFTER の場合はセレクトボックスにする
				let inputsHtml = "";
				if (key === 'SUPPORTS_SHIFTER') {
					inputsHtml = `
						<select class="text-input" style="width: 100%; cursor: pointer;">
							<option value="1" ${String(val) === '1' ? 'selected' : ''}>1 (Hパターンシフター有効)</option>
							<option value="0" ${String(val) === '0' ? 'selected' : ''}>0 (パドルシフト専用)</option>
						</select>
					`;
				} else {
					// それ以外は通常のinputタグ（司令塔のデータをすべて流し込む）
					inputsHtml = vals.map((v, i) => `<input type="${isNaN(v) ? 'text' : 'number'}" class="text-input" data-idx="${i}" value="${v}" step="${currentStep}"${currentMin}${currentMax}>`).join('');
				}
				div.innerHTML = `
					<div class="input-unit">
						<label>${key} ${isCoord ? '<span class="coord-label">(X, Y, Z)</span>' : ''}</label>
						<div class="input-with-range">${inputsHtml}</div>
					</div>
				`;
				// ★変更：inputタグだけでなく、selectタグも取得するように変更
				const inputs = div.querySelectorAll('input, select');
				inputs.forEach(input => {
					input.addEventListener('input', () => {
						if (isCoord) {
							const newVals = Array.from(inputs).map(i => i.value);
							activeSet.data[section][key] = newVals.join(',');
						} else {
							activeSet.data[section][key] = inputs[0].value;
						}
						//デフの設定が変わったらグラフをリアルタイム更新
						if (section === 'DIFFERENTIAL' && typeof window.updateDiffChart === 'function') {
							window.updateDiffChart();
						}
						//ギアボックスの設定が変わったらテキスト枠を更新（静的テキストですが念のため）
						if (section === 'GEARBOX' && typeof window.updateGearboxInfo === 'function') {
							window.updateGearboxInfo();
						}
					});
				});
				itemBox.appendChild(div);
			});
		});
	}
};
// サブタブをクリックした時の処理（プレビューの切り替えもここでやります）
window.setDtTab = function(tab) {
	window.activeDrivetrainTab = tab;
	window.renderDrivetrainUI();
	const previewArea = document.getElementById('preview-gear');
	const gearChart = document.getElementById('gearChart');
	let diffChart = document.getElementById('diffChart');
	let gearboxInfo = document.getElementById('gearboxInfo'); // ★グラフの代わりにテキスト枠を使用
	if (previewArea) {
		previewArea.style.position = 'relative';
		// デフグラフのCanvas生成（これはそのまま残す）
		if (!diffChart) {
			diffChart = document.createElement('canvas');
			diffChart.id = 'diffChart';
			previewArea.appendChild(diffChart);
		}
		// ★追加：GEARBOX用のテキスト解説枠の生成
		if (!gearboxInfo) {
			gearboxInfo = document.createElement('div');
			gearboxInfo.id = 'gearboxInfo';
			gearboxInfo.className = 'preview-text-info';
			previewArea.appendChild(gearboxInfo);
		}
	}
	// タブの内容に応じてプレビューを出し分ける
	if (tab === 'GEAR') {
		if (gearChart) {
			gearChart.style.opacity = '1';
			gearChart.style.pointerEvents = 'auto';
		}
		if (diffChart) {
			diffChart.style.opacity = '0';
			diffChart.style.pointerEvents = 'none';
		}
		if (gearboxInfo) {
			gearboxInfo.style.opacity = '0';
			gearboxInfo.style.pointerEvents = 'none';
		}
		window.updateGearChart();
	} else if (tab === 'FINAL') {
		// ★ 新設：FINALタブもギアグラフを表示して連動させる
		if (gearChart) {
			gearChart.style.opacity = '1';
			gearChart.style.pointerEvents = 'auto';
		}
		if (diffChart) {
			diffChart.style.opacity = '0';
			diffChart.style.pointerEvents = 'none';
		}
		if (gearboxInfo) {
			gearboxInfo.style.opacity = '0';
			gearboxInfo.style.pointerEvents = 'none';
		}
		window.updateGearChart();
	} else if (tab === 'DIFF') {
		if (gearChart) {
			gearChart.style.opacity = '0';
			gearChart.style.pointerEvents = 'none';
		}
		if (diffChart) {
			diffChart.style.opacity = '1';
			diffChart.style.pointerEvents = 'auto';
		}
		if (gearboxInfo) {
			gearboxInfo.style.opacity = '0';
			gearboxInfo.style.pointerEvents = 'none';
		}
		window.updateDiffChart(); // デフグラフの描画
	} else if (tab === 'GEARBOX') {
		// GEARBOXタブの時は、解説テキストを表示する
		if (gearChart) {
			gearChart.style.opacity = '0';
			gearChart.style.pointerEvents = 'none';
		}
		if (diffChart) {
			diffChart.style.opacity = '0';
			diffChart.style.pointerEvents = 'none';
		}
		if (gearboxInfo) {
			gearboxInfo.style.opacity = '1';
			gearboxInfo.style.pointerEvents = 'auto';
		}
		window.updateGearboxInfo(); // ★テキスト内容を書き込む関数を呼ぶ
	} else if (tab === 'ASSIST') {
		// ★追加：ASSISTタブの時は、ASSIST用の解説テキストを表示する
		if (gearChart) {
			gearChart.style.opacity = '0';
			gearChart.style.pointerEvents = 'none';
		}
		if (diffChart) {
			diffChart.style.opacity = '0';
			diffChart.style.pointerEvents = 'none';
		}
		if (gearboxInfo) {
			gearboxInfo.style.opacity = '1';
			gearboxInfo.style.pointerEvents = 'auto';
		}
		window.updateAssistInfo(); // ★ASSISTのテキストを書き込む関数を呼ぶ
	} else {
		// ギア、デフ、ギアボックス以外の時は全部隠す（ASSISTタブなど）
		if (gearChart) {
			gearChart.style.opacity = '0';
			gearChart.style.pointerEvents = 'none';
		}
		if (diffChart) {
			diffChart.style.opacity = '0';
			diffChart.style.pointerEvents = 'none';
		}
		if (gearboxInfo) {
			gearboxInfo.style.opacity = '0';
			gearboxInfo.style.pointerEvents = 'none';
		}
	}
};
// ★追加：デフ（LSD）のグラフを描画する関数
// ★デフ（LSD）のグラフを描画する関数（1way非表示・物理演算・Y軸固定版）
window.updateDiffChart = function() {
	const canvas = document.getElementById('diffChart');
	if (!canvas || window.activeDrivetrainTab !== 'DIFF') return;
	const activeSet = window.gearSetList[window.activeGearIdx];
	if (!activeSet || !activeSet.data || !activeSet.data.DIFFERENTIAL) return;
	const diff = activeSet.data.DIFFERENTIAL;
	const powerCoef = parseFloat(diff.POWER) || 0;
	const coastCoef = parseFloat(diff.COAST) || 0;
	const preload = parseFloat(diff.PRELOAD) || 0;
	// 一般的なハイパワー車の最大トルクを想定（1000Nm）
	const MAX_INPUT_TORQUE = 1000;
	const powerData = [];
	const coastData = [];
	for (let x = 0; x <= 100; x += 5) {
		let t = x / 100;
		let inputTorque = t * MAX_INPUT_TORQUE;
		// 【加速側 (POWER) の計算】
		let yPower = preload + (inputTorque * powerCoef);
		powerData.push({
			x: x,
			y: yPower
		});
		// 【減速側 (COAST) の計算】
		// COAST が 0 より大きい時だけデータを計算して追加する（1way表現）
		if (coastCoef > 0) {
			let yCoast = preload + (inputTorque * coastCoef);
			coastData.push({
				x: x,
				y: yCoast
			});
		}
	}
	if (window.diffChartInstance) window.diffChartInstance.destroy();
	// ★ 修正点：Y軸の最大値を「一般的なトルク＋α」で固定する（グラフの上下動を防ぐ）
	const FIXED_MAX_Y = 1000;
	window.diffChartInstance = new Chart(canvas, {
		type: 'line',
		data: {
			datasets: [{
				label: '加速時ロック (POWER)',
				data: powerData,
				borderColor: '#e74c3c',
				backgroundColor: 'rgba(231, 76, 60, 0.1)',
				fill: true,
				borderWidth: 3,
				pointRadius: 0,
				tension: 0
			}, {
				label: '減速時ロック (COAST)',
				data: coastData,
				borderColor: '#3498db',
				backgroundColor: 'rgba(52, 152, 219, 0.1)',
				fill: true,
				borderWidth: 3,
				pointRadius: 0,
				tension: 0
			}]
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			animation: false,
			scales: {
				x: {
					type: 'linear',
					min: 0,
					max: 100,
					title: {
						display: true,
						text: 'アクセル / ブレーキ負荷 (%)',
						color: '#ccc'
					},
					grid: {
						color: '#333'
					},
					ticks: {
						color: '#aaa'
					}
				},
				y: {
					min: 0,
					max: FIXED_MAX_Y, // ★ 計算ではなく固定値を指定
					title: {
						display: true,
						text: 'デフロック力 (Nm)',
						color: '#ccc'
					},
					grid: {
						color: '#333'
					},
					ticks: {
						color: '#aaa'
					}
				}
			},
			plugins: {
				legend: {
					display: true,
					labels: {
						color: '#eee'
					}
				},
				tooltip: {
					callbacks: {
						label: (ctx) => `${ctx.dataset.label}: ${Math.round(ctx.parsed.y)} Nm`
					}
				}
			}
		}
	});
};
window.selectGearSet = (idx, fromInput = false) => {
	// すでに選択されているものをクリックした場合は何もしない（入力中のリセットを防ぐ）
	if (window.activeGearIdx === idx) return;
	window.activeGearIdx = idx;
	window.renderDrivetrainUI();
	window.updateGearChart();
	// 入力欄から呼ばれた場合は、再描画後にその入力欄にフォーカスを戻す
	if (fromInput) {
		const inputs = document.querySelectorAll('.set-name-input');
		if (inputs[idx]) {
			inputs[idx].focus();
			// カーソルを一番最後に持っていく
			const val = inputs[idx].value;
			inputs[idx].value = '';
			inputs[idx].value = val;
		}
	}
};
window.duplicateGearSet = function() {
	// 1. 現在アクティブなセットがあるか確認
	if (!window.gearSetList || window.activeGearIdx === undefined) {
		console.warn("[DRIVETRAIN] 複製元のデータが見つかりません。");
		return;
	}
	const currentSet = window.gearSetList[window.activeGearIdx];
	if (!currentSet) return;
	// 2. 新しい名前を決定
	const newName = (currentSet.name || "Set") + "_copy";
	// 3. 複製処理（ディープコピー）
	const newSet = JSON.parse(JSON.stringify(currentSet));
	newSet.id = Date.now();
	newSet.name = newName;
	// 4. リストに追加し、アクティブなインデックスを「最後（新しく追加した方）」に設定
	window.gearSetList.push(newSet);
	window.activeGearIdx = window.gearSetList.length - 1;
	console.log("[DRIVETRAIN] 複製成功:", newName, "現在数:", window.gearSetList.length);
	// 5. UIの再描画
	// renderDrivetrainUIの中で、window.activeGearIdx を元に
	// <select> の selected を決める処理が走る必要があります
	if (typeof window.renderDrivetrainUI === 'function') {
		window.renderDrivetrainUI();
	}
	if (typeof window.updateGearChart === 'function') {
		window.updateGearChart();
	}
	if (typeof window.renderSetupUI === 'function') {
		window.renderSetupUI();
	}
};
window.deleteGearSet = (idx) => {
	// ★修正：リストが1つ以下の時は削除させない（必ず1つは残すため）
	if (window.gearSetList.length < 2) return;
	if (confirm(`「${window.gearSetList[idx].name}」を削除しますか？`)) {
		window.gearSetList.splice(idx, 1);
		window.activeGearIdx = 0;
		window.renderDrivetrainUI();
		window.updateGearChart();
		if (typeof window.renderSetupUI === 'function') window.renderSetupUI();
	}
};
// 名前を変更したときにセットアップ画面にも反映させるための関数（HTMLから呼ばれます）
window.updateGearSetName = (idx, newName) => {
	if (window.gearSetList[idx]) {
		window.gearSetList[idx].name = newName;
		if (typeof window.renderSetupUI === 'function') window.renderSetupUI();
	}
};
// ラジオボタンが押された時の処理
window.setMainGear = (idx) => {
	window.mainGearIdx = idx;
	window.previewSetupGearIdx = idx; // ★追加：プレビュー用のインデックスも同時に切り替える
	window.renderDrivetrainUI();
	window.updateGearChart();
	// セットアッププレビュー画面も裏で更新しておく
	if (typeof window.renderTransmissionPreview === 'function') {
		window.renderTransmissionPreview();
	}
};
window.updateGearChart = function() {
	const canvas = document.getElementById('gearChart');
	if (!canvas || (window.activeDrivetrainTab !== 'GEAR' && window.activeDrivetrainTab !== 'FINAL')) return;
	const limiter = parseFloat(window.currentEngineData?.ENGINE_DATA?.LIMITER) || 8000;
	const radius = parseFloat(window.currentTyreData?.REAR?.RADIUS) || 0.305;
	const wheelCirc = 2 * Math.PI * radius;
	const datasets = [];
	window.gearSetList.forEach((set, setIdx) => {
		// if (!set.isExport && setIdx !== window.activeGearIdx) return;
		const gears = set.data.GEARS || {};
		const final = parseFloat(gears.FINAL) || 1.0;
		const countVal = parseInt(gears.COUNT) || 7;
		const isCurrent = (setIdx === window.activeGearIdx);
		let lastMaxSpeed = 0;
		let lastRatio = 0;
		["GEAR_1", "GEAR_2", "GEAR_3", "GEAR_4", "GEAR_5", "GEAR_6", "GEAR_7"].forEach((key, i) => {
			if (i + 1 > countVal) return;
			const ratio = parseFloat(gears[key]);
			if (!ratio || ratio <= 0) return;
			const currentMaxSpeed = (limiter * 60 * wheelCirc) / (ratio * final * 1000);
			let startRPM = 0;
			let startSpeed = 0;
			if (lastRatio > 0) {
				startSpeed = lastMaxSpeed;
				startRPM = limiter * (ratio / lastRatio);
			}
			datasets.push({
				label: `${set.name} G${i+1}`,
				data: [{
					x: startSpeed,
					y: startRPM
				}, {
					x: currentMaxSpeed,
					y: limiter
				}],
				borderColor: isCurrent ? `hsl(${i * 45}, 70%, 50%)` : `rgba(150, 150, 150, 0.7)`,
				borderWidth: isCurrent ? 2 : 1,
				borderDash: isCurrent ? [] : [5, 5],
				showLine: true,
				pointRadius: isCurrent ? 3 : 0,
				pointBackgroundColor: isCurrent ? `hsl(${i * 45}, 70%, 50%)` : 'transparent',
				tension: 0
			});
			lastMaxSpeed = currentMaxSpeed;
			lastRatio = ratio;
		});
	});
	if (window.gearChartInstance) window.gearChartInstance.destroy();
	window.gearChartInstance = new Chart(canvas, {
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
						text: 'Speed (km/h)',
						color: '#fff'
					},
					min: 0,
					grid: {
						color: '#333'
					}
				},
				y: {
					title: {
						display: true,
						text: 'RPM',
						color: '#fff'
					},
					min: 0,
					max: limiter + 500,
					grid: {
						color: '#333'
					}
				}
			},
			plugins: {
				legend: {
					display: false
				},
				tooltip: {
					callbacks: {
						label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.x.toFixed(1)} km/h @ ${Math.round(ctx.parsed.y)} RPM`
					}
				}
			}
		}
	});
};
// ★追加：GEARBOXの解説テキストをプレビュー画面に表示する関数
window.updateGearboxInfo = function() {
	const infoDiv = document.getElementById('gearboxInfo');
	if (!infoDiv || window.activeDrivetrainTab !== 'GEARBOX') return;
	// HTMLで綺麗に構造化して流し込む
	infoDiv.innerHTML = `
		<div class="info-gear">
			<h2>GEARBOX（トランスミッション設定）の解説</h2>
			<div>
				<h3>CHANGE_UP_TIME / CHANGE_DN_TIME</h3>
				<p>
					シフトアップ・ダウンにかかる時間（無動力になる時間）をミリ秒で指定します。<br>
					・レーシングカー（シーケンシャル）: <strong>50ms前後</strong><br>
					・一般的な市販車（Hパターン）: <strong>250ms前後</strong>
				</p>
			</div>
			<div>
				<h3>AUTO_CUTOFF_TIME</h3>
				<p>
					シフトアップ時に、自動でエンジンの点火をカットする時間（ミリ秒）。<br>
					<span>※警告:</span> この数値を <code>CHANGE_UP_TIME</code> より短くすると、ギアが繋がる前にエンジンが吹け上がり、大きなシフトショックが発生します。通常は同じか少し長めに設定します。
				</p>
			</div>
			<div>
				<h3>SUPPORTS_SHIFTER</h3>
				<p>
					Hパターンシフターでの操作を許可するかどうか。<br>
					<code>1</code> にするとHパターン有効。<code>0</code> にするとパドルシフト専用車になります。
				</p>
			</div>
			<div>
				<h3>VALID_SHIFT_RPM_WINDOW</h3>
				<p>
					シフトダウン時の「オーバーレブ保護」の猶予範囲（rpm）。<br>
					この範囲を超えてエンジンが回ってしまうようなシフトダウン操作は、ゲーム側で無視（拒否）されます。
				</p>
			</div>

			<div>
				<h3>CONTROLS_WINDOW_GAIN</h3>
				<p>
					シフト操作判定の「甘さ」。数値が高いほど、クラッチとシフターの操作タイミングが少しズレてもミスシフトになりにくくなります。
				</p>
			</div>

			<div>
				<h3>INERTIA</h3>
				<p>
					ギアボックス内部の回転慣性（重さ）。<br>
					シフトチェンジ時やニュートラル時の、エンジンの「回転の落ちやすさ」に影響します。
				</p>
			</div>
		</div>
	`;
};
// ★追加：ASSIST（クラッチ・シフト制御）の解説テキストを表示する関数
window.updateAssistInfo = function() {
	const infoDiv = document.getElementById('gearboxInfo');
	if (!infoDiv || window.activeDrivetrainTab !== 'ASSIST') return;
	infoDiv.innerHTML = `
		<div class="info-gear">
			<h2>ASSIST（クラッチ・シフト制御）の解説</h2>
			<div>
				<h3>[CLUTCH] MAX_TORQUE</h3>
				<p>
					クラッチが滑らずに伝達できる「最大トルク（Nm）」。<br>
					エンジンの最大トルク（power.lutのピーク値）より少し高めに設定しないと、フル加速時にクラッチが滑って加速しなくなります。
				</p>
			</div>
			<div>
				<h3>[AUTOCLUTCH] MIN_RPM / MAX_RPM</h3>
				<p>
					発進時や停車時にエンストを防ぐための「半クラッチ」アシスト設定。<br>
					<code>MIN_RPM</code> でクラッチが繋がり始め、<code>MAX_RPM</code> に達すると完全に繋がります。アイドリング回転数より少し上に設定するのが一般的です。
				</p>
			</div>
			<div>
				<h3>[AUTOBLIP] ELECTRONIC / LEVEL</h3>
				<p>
					シフトダウン時に自動でアクセルを煽って回転数を合わせる「オートブリッピング」機能。<br>
					<code>ELECTRONIC=1</code> にすると電子制御の正確なブリッピングになります。<code>LEVEL</code> は煽る量（スロットル開度）の基本値です。
				</p>
			</div>
			<div>
				<h3>UPSHIFT_PROFILE / DOWNSHIFT_PROFILE</h3>
				<p>
					シフト操作時の「クラッチペダルを離す速さ」のプロファイル。<br>
					<code>POINT_0</code>, <code>POINT_1</code>, <code>POINT_2</code> のパラメータで、人間がペダルを操作する際の「ジワッ」と繋がる感覚をシミュレートします。
				</p>
			</div>
			<div>
				<h3>[AUTO_SHIFTER] UP / DOWN</h3>
				<p>
					オートマチック（AT）車としての挙動設定。<br>
					<code>UP</code> で指定した回転数（rpm）に達すると自動でシフトアップし、<code>DOWN</code> を下回るとシフトダウンします。シーケンシャル車やパドルシフト車でも、プレイヤーがATアシストをONにした際はこの設定が使われます。
				</p>
			</div>
		</div>
	`;
};
// =====================================
// ファイナルギア (.rto) 用の制御関数
// =====================================
window.setMainFinal = function(idx) {
	const item = window.finalRtoList[idx];
	if (item) {
		window.previewSetupFinalIdx = idx;
		window.gearSetList.forEach(set => {
			if (!set.data.GEARS) set.data.GEARS = {};
			set.data.GEARS.FINAL = item.value;
		});
		window.updateGearChart();
		if (typeof window.renderTransmissionPreview === 'function') {
			window.renderTransmissionPreview();
		}
	}
};
window.updateFinalRto = function(idx, field, value) {
	window.finalRtoList[idx][field] = value;
	// ★追加：ギア比(value)が変更されたら、ピット表示名(label)も自動で「値:1」に連動させる
	if (field === 'value') {
		const newLabel = value + ":1";
		window.finalRtoList[idx]['label'] = newLabel;
		// UIを強制的に再描画して、書き換わった文字を画面に反映させる
		window.renderDrivetrainUI();
	}
	const radios = document.querySelectorAll('input[name="main_final"]');
	// ラジオボタンが選択されている値を書き換えたら、グラフも自動更新する
	if (radios[idx] && radios[idx].checked && field === 'value') {
		window.setMainFinal(idx);
	}
};
window.addFinalRto = function() {
	window.finalRtoList.push({
		label: "4.5:1",
		value: "4.5"
	});
	window.renderDrivetrainUI();
};
window.removeFinalRto = function(idx) {
	window.finalRtoList.splice(idx, 1);
	window.renderDrivetrainUI();
};
window.parseFinalRto = function(text) {
	const lines = text.split(/\r?\n/);
	window.finalRtoList = [];
	lines.forEach(line => {
		line = line.trim();
		if (line && !line.startsWith('[')) {
			const parts = line.split('|');
			if (parts.length === 2) {
				window.finalRtoList.push({
					label: parts[0].trim(),
					value: parts[1].trim()
				});
			}
		}
	});
	if (window.activeDrivetrainTab === 'FINAL') {
		window.renderDrivetrainUI();
	}
};