// js/suspension.js
// --- 1. 定数・グローバル変数の定義 ---
window.currentSuspensionData = null;
window.currentTyreData = null;
window.currentCarData = null;
let frontCalculator = null;
let rearCalculator = null;
window.SUSPENSION_EXTRA_SCHEMA = {
	'DWB': {
		'arms': ['WBCAR_TOP_FRONT', 'WBCAR_TOP_REAR', 'WBTYRE_TOP', 'WBCAR_BOTTOM_FRONT', 'WBCAR_BOTTOM_REAR', 'WBTYRE_BOTTOM', 'WBCAR_STEER', 'WBTYRE_STEER'],
		'damper': [],
		'extended': ['TORSIONAL_STIFFNESS', 'TORSIONAL_DAMPING', 'TORQUE_MODE_EX', 'FIX_PROGRESSIVE_RATE'] // ★追加
	},
	'STRUT': {
		'arms': ['STRUT_CAR', 'STRUT_TYRE', 'WBTYRE_TOP', 'WBCAR_BOTTOM_FRONT', 'WBCAR_BOTTOM_REAR', 'WBTYRE_BOTTOM', 'WBCAR_STEER', 'WBTYRE_STEER'],
		'damper': [],
		'extended': ['TORSIONAL_STIFFNESS', 'TORSIONAL_DAMPING', 'TORQUE_MODE_EX', 'FIX_PROGRESSIVE_RATE'] // ★追加
	},
	'AXLE': {
		'arms': ['LINK_COUNT', 'J0_CAR', 'J0_AXLE', 'J1_CAR', 'J1_AXLE', 'J2_CAR', 'J2_AXLE', 'J3_CAR', 'J3_AXLE', 'J4_CAR', 'J4_AXLE', 'TORQUE_REACTION'],
		'damper': [],
		'extended': ['TORSIONAL_STIFFNESS', 'TORSIONAL_DAMPING', 'TORQUE_MODE_EX', 'FIX_PROGRESSIVE_RATE'] // ★追加
	}
	// ,
	// 'D_STRUT': {
	// 	'arms': [],
	// 	'damper': []
	// },
	// 'ML': {
	// 	'arms': [],
	// 	'damper': []
	// }
};
const SUSPENSION_BASE_KEYS = ['TYPE', 'TRACK', 'BASEY', 'HUB_MASS', 'RIM_OFFSET', 'TOE_OUT', 'STATIC_CAMBER', 'SPRING_RATE', 'PROGRESSIVE_SPRING_RATE', 'BUMP_STOP_RATE', 'DAMP_FAST_BUMP', 'DAMP_FAST_REBOUND', 'DAMP_BUMP', 'DAMP_REBOUND', 'DAMP_FAST_REBOUNDTHRESHOLD', 'BUMPSTOP_UP', 'BUMPSTOP_DN', 'PACKER_RANGE', 'ROD_LENGTH', 'DAMP_FAST_BUMPTHRESHOLD', 'WBCAR_STEER', 'WBTYRE_STEER'];
// --- 2. イベントリスナー ---
document.addEventListener('DOMContentLoaded', () => {
	const suspensionFileInput = document.getElementById('suspensionFile');
	if (suspensionFileInput) {
		suspensionFileInput.addEventListener('change', (e) => {
			const file = e.target.files[0];
			if (!file) return;
			const reader = new FileReader();
			reader.onload = (event) => {
				const content = event.target.result;
				window.currentSuspensionData = window.parseINI(content);
				if (window.currentSuspensionData) {
					['_EXTENSION', '_EXTENSION_FLEX'].forEach(sec => {
						if (window.currentSuspensionData[sec]) {
							const hasRealSection = content.toUpperCase().includes(`[${sec.toUpperCase()}]`);
							window.currentSuspensionData[sec]._ENABLED = hasRealSection;
						}
					});
				}
				if (typeof window.updateSuspensionEditorUI === 'function') {
					window.updateSuspensionEditorUI(window.currentSuspensionData);
					initDesmosCalculators();
					updateDesmosGraph('FRONT', window.currentSuspensionData);
					updateDesmosGraph('REAR', window.currentSuspensionData);
				}
				if (window.damperVisualizer && typeof window.damperVisualizer.refreshFromIni === 'function') {
					window.damperVisualizer.refreshFromIni(window.currentSuspensionData);
				}
				if (typeof window.updateSuspensionVisuals === 'function') {
					window.updateSuspensionVisuals(window.currentSuspensionData);
				}
			};
			reader.readAsText(file);
		});
	}
	// const tyreFileInput = document.getElementById('tyreFile');
	// if (tyreFileInput) {
	// 	tyreFileInput.addEventListener('change', function(e) {
	// 		const file = e.target.files[0];
	// 		if (!file) return;
	// 		const reader = new FileReader();
	// 		reader.onload = function(e) {
	// 			const content = e.target.result;
	// 			window.currentTyreData = window.parseINI(content);
	// 			// console.log("[INI_PARSE] tyres.ini loaded:", window.currentTyreData);
	// 			// 追加：タイヤエディターのUIを生成・表示する
	// 			if (typeof window.updateTyreEditorUI === 'function') {
	// 				window.updateTyreEditorUI(window.currentTyreData);
	// 			}
	// 			if (window.currentSuspensionData && typeof window.updateSuspensionVisuals === 'function') {
	// 				window.updateSuspensionVisuals(window.currentSuspensionData);
	// 			}
	// 		};
	// 		reader.readAsText(file);
	// 	});
	// }
});
//car.iniの読み込み
// const carFileInput = document.getElementById('carFile');
// if (carFileInput) {
// 	carFileInput.addEventListener('change', (e) => {
// 		const file = e.target.files[0];
// 		if (!file) return;
// 		const reader = new FileReader();
// 		reader.onload = (event) => {
// 			if (typeof window.parseINI === 'function') {
// 				window.currentCarData = window.parseINI(event.target.result);
// 				// console.log("--- car.ini 解析完了 ---", window.currentCarData);
// 				// 追加：車両設定エディターのUIを生成・表示する（関数作成後に動作します）
// 				if (typeof window.updateCarEditorUI === 'function') {
// 					window.updateCarEditorUI(window.currentCarData);
// 				}
// 				if (typeof window.updateSuspensionVisuals === 'function') {
// 					window.updateSuspensionVisuals(window.currentSuspensionData);
// 				}
// 			}
// 		};
// 		reader.readAsText(file);
// 	});
// }
// --- 3. ユーティリティ ---
function getParamConfig(key, val) {
	const isCoord = val && val.toString().includes(',');
	const editorRule = window.getEditorStep(key, val);
	const step = typeof editorRule === 'object' ? editorRule.step : editorRule;
	return {
		isCoord: isCoord,
		step: step,
		values: isCoord ? val.split(',').map(v => v.trim()) : [val]
	};
}
// --- 4. Desmos計算機関連 ---
function initDesmosCalculators() {
	if (frontCalculator || rearCalculator) return;
	const frontElt = document.getElementById('desmos-front-sim');
	const rearElt = document.getElementById('desmos-rear-sim');
	if (frontElt) {
		try {
			frontCalculator = Desmos.GraphingCalculator(frontElt, {
				expressions: false,
				settingsMenu: false,
				lockViewport: true,
				expressionsTopbar: false
			});
			setupDesmosDefault(frontCalculator);
		} catch (e) {
			console.error(e);
		}
	}
	if (rearElt) {
		try {
			rearCalculator = Desmos.GraphingCalculator(rearElt, {
				expressions: false,
				settingsMenu: false,
				lockViewport: true,
				expressionsTopbar: false
			});
			setupDesmosDefault(rearCalculator);
		} catch (e) {
			console.error(e);
		}
	}
}
//ダンパーの表のスケール変更
function setupDesmosDefault(calc) {
	calc.setMathBounds({
		left: -0.3,
		right: 0.3,
		bottom: -0.6,
		top: 0.6
	});
	calc.setExpression({
		id: 'axis',
		latex: 'x=0',
		color: '#eeeeee',
		lineStyle: Desmos.Styles.DASHED
	});
}

function updateDesmosGraph(side, data) {
	const calc = (side === 'FRONT') ? frontCalculator : rearCalculator;
	if (!calc || !data[side]) return;
	let L = parseFloat(data[side].ROD_LENGTH) || 0;
	let P = parseFloat(data[side].PACKER_RANGE) || 0;
	let bUp = parseFloat(data[side].BUMPSTOP_UP) || 0;
	let bDn = parseFloat(data[side].BUMPSTOP_DN) || 0;
	if (P > bUp) {
		P = bUp;
		data[side].PACKER_RANGE = P.toString();
	}
	calc.setExpressions([{
			id: 'L_val',
			latex: 'L=' + L
		}, {
			id: 'U_val',
			latex: 'U=' + bUp
		}, {
			id: 'D_val',
			latex: 'D=' + bDn
		}, {
			id: 'P_val',
			latex: 'P=' + P,
			sliderBounds: {
				min: 0,
				max: bUp
			}
		}, {
			id: 'T_var',
			latex: 'T_{v} = ' + (L - bDn),
			sliderBounds: {
				min: (L - bDn).toString(),
				max: (L + P).toString()
			},
			playing: false,
			loopMode: 'LOOP_FORWARD_REVERSE',
			playingSettings: {
				playbackSpeed: 2
			}
		},
		// 補助計算：シリンダー描画用のオフセット
		// シリンダー上端（天井より少し下）
		{
			id: 'C_top',
			latex: 'T = L + U - 0.02'
		},
		// シリンダー底面（底より少し突き抜け）
		{
			id: 'C_bot',
			latex: 'B = L - D - 0.01'
		},
		// アウターチューブ（U字の壁：左右）
		{
			id: 'outer_wall',
			latex: 'x = [-0.1, 0.1] \\{ -0.5 < y < 0.1 \\}',
			color: '#444444',
			lineWidth: 5
		},
		// アウターチューブ（U字の底）
		{
			id: 'outer_bottom',
			latex: 'y = - 0.5 \\{ -0.1 < x < 0.1 \\}',
			color: '#444444',
			lineWidth: 5
		}, {
			id: 'inner_shell',
			latex: 'x = [-0.07, 0.07] \\{ B < y < T \\}',
			color: '#7f8c8d',
			lineWidth: 2
		},
		// --- 3. 視覚要素（物理ライン：既存） ---
		{
			id: 'visual_rod_base_label',
			latex: '(0.155, L)',
			label: '1G地点',
			color: '#ea00ff',
			showLabel: true,
			hidden: true,
			labelOrientation: 'right',
		}, {
			id: 'visual_rod_base',
			latex: 'y = L \\{-0.15 < x < 0.15\\}',
			color: '#ea00ff',
			label: 'ROD_LENGTH',
			showLabel: true
		}, {
			id: 'visual_packer_line',
			latex: 'y = L + P \\{-0.075 < x < 0.075\\}',
			color: '#f1c40f',
			lineWidth: 4,
			label: 'PACKER_END',
			showLabel: true
		}, {
			id: 'visual_rubber_area',
			latex: 'L + P <= y <= L + U \\{-0.075 < x < 0.075\\}',
			color: '#f1c40f',
			fillOpacity: 0.2
		}, {
			id: 'visual_up',
			latex: 'y = L + U \\{-0.1 < x < 0.1\\}',
			color: '#3498db'
		}, {
			id: 'visual_dn',
			latex: 'y = L - D \\{-0.08 < x < 0.08\\}',
			color: '#e74c3c',
			label: 'BUMP_DN',
			showLabel: true
		}, {
			id: 'visual_rod_shaft',
			latex: 'x = 0 \\{ T_{v} < y \\}',
			color: '#bdc3c7',
			lineWidth: 10
		}, {
			id: 'visual_piston_head',
			latex: 'y = T_{v} \\{-0.06 < x < 0.06\\}',
			color: '#7f8c8d',
			lineWidth: 6
		}
	]);
}
/** HTML側のUI制約制御：BUMPSTOP_UPとPACKER_RANGEの連動 */
window.syncSuspensionUIConstraints = function(side) {
	const panel = document.getElementById('panel-damper');
	if (!panel) return;
	// FRONT または REAR の article を特定
	const articles = panel.querySelectorAll('article');
	let targetArticle = null;
	articles.forEach(art => {
		const title = art.querySelector('.suspension-item-title_box p')?.textContent;
		if (title === side) targetArticle = art;
	});
	if (!targetArticle) return;
	// 各入力要素の取得
	const items = targetArticle.querySelectorAll('.suspension-item');
	let uInput, pInput, pSlider;
	items.forEach(item => {
		const label = item.querySelector('label')?.textContent;
		if (label === 'BUMPSTOP_UP') {
			uInput = item.querySelector('.text-input');
		} else if (label === 'PACKER_RANGE') {
			pInput = item.querySelector('.text-input');
			pSlider = item.querySelector('.range-slider');
		}
	});
	if (uInput && pSlider && pInput) {
		const uVal = parseFloat(uInput.value) || 0;
		const pVal = parseFloat(pInput.value) || 0;
		// 1. PACKER_RANGEのスライダーの最大値をBUMPSTOP_UPの値に制限する
		pSlider.max = uVal;
		// 2. 物理制約：PがUを超えた場合、Pを強制的にUに合わせる
		if (pVal > uVal) {
			pInput.value = uVal.toFixed(3);
			pSlider.value = uVal;
			// グローバルデータの更新
			if (window.currentSuspensionData && window.currentSuspensionData[side]) {
				window.currentSuspensionData[side].PACKER_RANGE = uVal.toString();
			}
			// 外部描画の更新
			if (typeof updateDesmosGraph === 'function') {
				updateDesmosGraph(side, window.currentSuspensionData);
			}
			if (typeof window.updateSuspensionVisuals === 'function') {
				window.updateSuspensionVisuals(window.currentSuspensionData);
			}
			if (window.damperVisualizer) {
				window.damperVisualizer.refreshFromIni(window.currentSuspensionData);
			}
		}
	}
};
/** アニメーション再生切り替え */
window.toggleDesmosAnimation = function(side, btn) {
	const calc = (side === 'FRONT') ? frontCalculator : rearCalculator;
	if (!calc) return;
	const currentText = btn.textContent.trim();
	const nextState = (currentText === '▶');
	calc.setExpression({
		id: 'T_var',
		playing: nextState
	});
	btn.textContent = nextState ? '■' : '▶';
};
window.initDesmosCalculators = initDesmosCalculators;
// --- データ同期ハブ ---
window.syncSus = function() {
	const data = window.currentSuspensionData;
	if (!data) return;
	// サスペンションエディタのUI構築関数を正しく呼び出す
	if (typeof window.updateSuspensionEditorUI === 'function') {
		window.updateSuspensionEditorUI(data);
	}
	// 3Dプレビュー（構造線など）の再描画
	if (typeof window.updateSuspensionVisuals === 'function') {
		window.updateSuspensionVisuals(data);
	}
};
// ==========================================================================
// ★ここをファイルの最下部（最後の } の後ろなど）に丸ごと追加
// 既存のUI表示関数を安全に拡張し、_EXTENSION セクションの横にトグルスイッチをインジェクトする
// ==========================================================================
setTimeout(() => {
	const originalUpdateSuspensionEditorUI = window.updateSuspensionEditorUI;
	
	window.updateSuspensionEditorUI = function(data) {
		// 1. まず本来のUI生成処理を通常通り走らせる
		if (typeof originalUpdateSuspensionEditorUI === 'function') {
			originalUpdateSuspensionEditorUI(data);
		}
		
		if (!data) return;

		// 2. 生成された HTML の中から _EXTENSION と _EXTENSION_FLEX を探してスイッチを仕込む
		['_EXTENSION', '_EXTENSION_FLEX'].forEach(section => {
			if (!data[section]) return;

			// 画面上の該当セクションの article 要素をタイトルテキストから特定する
			const articles = document.querySelectorAll('#suspension-data-container article, .suspension-tab-panel article, #sus-editor article');
			let targetArticle = null;
			
			articles.forEach(art => {
				const titleText = art.querySelector('.suspension-item-title_box p')?.textContent;
				// ★修正1：startsWith から「完全一致 (===)」に変更して、名前の競合を完全に防ぐ
				if (titleText && titleText.trim() === section) {
					targetArticle = art;
				}
			});

			if (!targetArticle) return;
			if (data[section]._ENABLED === undefined) {
				data[section]._ENABLED = false; // 初期状態はOFF（半透明）
			}
			const isItemEnabled = data[section]._ENABLED;

			// ★修正：外箱（targetArticle）は常に操作可能にしてスイッチを押せるようにする
			targetArticle.style.opacity = '1';
			targetArticle.style.pointerEvents = 'auto';

			const titleBox = targetArticle.querySelector('.suspension-item-title_box');
			const contentBox = targetArticle.querySelector('.suspension-item_box');

			// ★修正：半透明と操作ロックは、入力欄の入った中身（contentBox）だけに適用する
			if (contentBox) {
				if (!window.isExtendedPhysicsEnabled || !isItemEnabled) {
					contentBox.style.opacity = '0.4';
					contentBox.style.pointerEvents = 'none';
				} else {
					contentBox.style.opacity = '1';
					contentBox.style.pointerEvents = 'auto';
				}
			}

			// 重複生成を防ぎつつ、右側にトグルスイッチを埋め込む
			if (titleBox && contentBox && !titleBox.querySelector('.suspension-item-toggle')) {
				titleBox.style.display = 'flex';
				titleBox.style.justifyContent = 'space-between';
				titleBox.style.alignItems = 'center';

				const toggleLabel = document.createElement('label');
				toggleLabel.className = 'toggle-switch';
				toggleLabel.style.marginRight = '15px';
				toggleLabel.style.flexShrink = '0';
				toggleLabel.innerHTML = `
					<input type="checkbox" class="suspension-item-toggle" ${isItemEnabled ? 'checked' : ''}>
					<span class="toggle-slider round"></span>
				`;
				titleBox.appendChild(toggleLabel);

				// 初期状態の見た目（半透明ロック）を反映
				if (!isItemEnabled) {
					contentBox.style.opacity = '0.4';
					contentBox.style.pointerEvents = 'none';
				}

				// スイッチ切り替え時のイベントリスナーをバインド
				toggleLabel.querySelector('input').addEventListener('change', (e) => {
					const isChecked = e.target.checked;
					data[section]._ENABLED = isChecked; // 状態を保存
					// ★修正：共通関数を呼び出してメインスイッチをONにする
					if (isChecked && typeof window.forceEnableMasterSwitch === 'function') {
						window.forceEnableMasterSwitch();
					}
					// ★修正：メインスイッチと個別スイッチの両方がONのときだけ中身を解放する
					if (isChecked && window.isExtendedPhysicsEnabled) {
						contentBox.style.opacity = '1';
						contentBox.style.pointerEvents = 'auto';
					} else {
						contentBox.style.opacity = '0.4';
						contentBox.style.pointerEvents = 'none';
					}

					if (window.modifiedStatus) window.modifiedStatus.suspensions = true;
					if (typeof window.updateSuspensionVisuals === 'function') {
						window.updateSuspensionVisuals(window.currentSuspensionData);
					}
				});
			}
		});
	};
}, 200);