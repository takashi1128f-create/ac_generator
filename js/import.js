import * as THREE from 'three';
import {
	FBXLoader
} from 'three/addons/loaders/FBXLoader.js';
import {
	GLTFLoader
} from 'three/addons/loaders/GLTFLoader.js';
import {
	DDSLoader
} from 'three/addons/loaders/DDSLoader.js';
import {
	default_suspensions_ini,
	default_car_ini,
	default_tyres_ini,
	default_colliders_ini,
	default_aero_ini,
	default_cameras_ini,
	default_engine_ini,
	default_power_lut,
	drivetrain_ini,
	setup_ini,
	default_final_rto,
	default_view_ini,
	default_dash_cam_ini
} from './ini-data.js';
// --- 1. データ保持・状態管理 ---
window.THREE = THREE;
// 各ファイルの編集状態（false:未編集, true:編集済み）を管理するオブジェクト
window.modifiedStatus = {
	suspensions: false,
	car: false,
	tyres: false,
	colliders: false,
	aero: false,
	engine: false,
	lut: false,
	drivetrain: false,
	final: false,
	setup: false,
	cameras: false,
	mirrors: false
};
// ★追加：拡張物理のマスターステート
window.isExtendedPhysicsEnabled = false;

// ★追加：拡張物理として扱うセクションとキーのリスト
window.EXTENDED_PHYSICS_TARGETS = {
	sections: ['_EXTENSION', '_EXTENSION_FLEX', 'FIN_0', 'VIRTUALKM'],
	keys: [] // car.ini の VERSION など
};
// ★追加：メインスイッチを自動でONにする共通関数
window.forceEnableMasterSwitch = function() {
	const masterSwitch = document.getElementById('extendedPhysicsSwitch');
	if (masterSwitch && !masterSwitch.checked) {
		window.isExtendedPhysicsEnabled = true;
		masterSwitch.checked = true;
		
		const extText = document.getElementById('extendedStatusText');
		if (extText) {
			extText.textContent = 'ON';
			extText.classList.remove('off');
			extText.classList.add('on');
		}
		
		masterSwitch.dispatchEvent(new Event('change')); // 他へ通知
	}
};
window.mergeWithDefaultSetup = function(uploadedData) {
	const defaultData = window.parseINI(setup_ini);
	const mergedData = {};
	const skipSections = ['GEARS', 'FINAL_GEAR_RATIO', 'DISPLAY_METHOD'];
	for (const section in defaultData) {
		if (skipSections.includes(section) || section.startsWith('GEAR_SET_')) continue;
		if (uploadedData[section]) {
			mergedData[section] = JSON.parse(JSON.stringify(uploadedData[section]));
			mergedData[section].__is_active = true;
		} else {
			mergedData[section] = JSON.parse(JSON.stringify(defaultData[section]));
			mergedData[section].__is_active = false;
		}
	}
	for (const section in uploadedData) {
		if (!mergedData[section] && !skipSections.includes(section) && !section.startsWith('GEAR_SET_')) {
			mergedData[section] = JSON.parse(JSON.stringify(uploadedData[section]));
			mergedData[section].__is_active = true;
		}
	}
	skipSections.forEach(s => {
		if (uploadedData[s]) mergedData[s] = uploadedData[s];
	});
	for (const section in uploadedData) {
		if (section.startsWith('GEAR_SET_')) mergedData[section] = uploadedData[section];
	}
	return mergedData;
};
// 3Dモデルのノード保持（既存）
export const model_3D = {
	BODY: [],
	WHEEL: {
		LF: null,
		RF: null,
		LR: null,
		RR: null
	},
	SUSP: {
		LF: null,
		RF: null,
		LR: null,
		RR: null
	},
	STEER: null,
	DISC: {
		LF: null,
		RF: null,
		LR: null,
		RR: null
	},
	CALIPER: {
		LF: null,
		RF: null,
		LR: null,
		RR: null
	},
	GLASS: []
};
window.model_3D = model_3D;
// --- 1. データ保持・状態管理 ---
export let susF = {};
export let susR = {};
window.susF = susF;
window.susR = susR;
// --- ini-data.js から読み込んだテキストを解析して格納 ---
export const ini_DATA = {
	'suspensions.ini': parseINI(default_suspensions_ini),
	'car.ini': parseINI(default_car_ini),
	'tyres.ini': parseINI(default_tyres_ini),
	'colliders.ini': parseINI(default_colliders_ini),
	'aero.ini': parseINI(default_aero_ini),
	'engine.ini': parseINI(default_engine_ini),
	'power.lut': default_power_lut,
	'drivetrain.ini': parseINI(drivetrain_ini),
	'setup.ini': parseINI(setup_ini),
	'final.rto': default_final_rto
};
window.ini_DATA = ini_DATA;
//デフォルトのデータを維持するみたいだけど怖い「絶対に上書きされない「純粋なデフォルトデータ」を保存」って書いてあったから
window.DEFAULT_SUSPENSION_DATA = parseINI(default_suspensions_ini);
// ※cameras.ini はそのままテキストとして保持し、後で parseIni に渡すためにエクスポートしておきます
export const raw_cameras_ini = default_cameras_ini;
// --- 起動時の初期セットアップ ---
// 1. サスペンション (suspensions.ini)
if (ini_DATA['suspensions.ini']) {
	window.currentSuspensionData = ini_DATA['suspensions.ini'];
	sortSus(window.currentSuspensionData);
	if (typeof syncSus === 'function') syncSus();
	if (typeof window.initDesmosCalculators === 'function') {
		window.initDesmosCalculators();
		if (typeof window.updateDesmosGraph === 'function') {
			window.updateDesmosGraph('FRONT', window.currentSuspensionData);
			window.updateDesmosGraph('REAR', window.currentSuspensionData);
		}
	}
	if (window.damperVisualizer && typeof window.damperVisualizer.refreshFromIni === 'function') {
		window.damperVisualizer.init();
		window.damperVisualizer.refreshFromIni(window.currentSuspensionData);
	}
}
// 2. 車両データ (car.ini)
if (ini_DATA['car.ini']) {
	window.currentCarData = {
		...window.currentCarData,
		...ini_DATA['car.ini']
	};
	if (typeof window.updateCarEditorUI === 'function') {
		window.updateCarEditorUI(window.currentCarData);
	}
}
// 3. タイヤデータ (tyres.ini)
if (ini_DATA['tyres.ini']) {
	window.currentTyreData = ini_DATA['tyres.ini'];
	if (typeof window.updateTyreEditorUI === 'function') {
		window.updateTyreEditorUI(window.currentTyreData);
	}
}
// 4. コライダーデータ (colliders.ini)
if (ini_DATA['colliders.ini']) {
	window.currentCarData = {
		...window.currentCarData,
		...ini_DATA['colliders.ini']
	};
	if (typeof window.initColliderEditor === 'function') {
		window.initColliderEditor(ini_DATA['colliders.ini']);
	}
	// コライダーの3Dメッシュを更新
	if (typeof window.updateColliderVisuals === 'function') {
		window.updateColliderVisuals();
	}
}
// 4.5 エアロデータ (aero.ini)
if (ini_DATA['aero.ini']) {
	// console.log("[import.js] 初期データから aero.ini をセットアップします");
	window.currentAeroData = ini_DATA['aero.ini'];
	// UIを生成
	if (typeof window.initAeroEditor === 'function') {
		window.initAeroEditor(window.currentAeroData);
	}
	// 3Dを描画
	if (typeof window.updateAeroVisuals === 'function') {
		window.updateAeroVisuals();
	}
}
// 5. カメラデータ (cameras.ini)
// カメラはパースの仕様が異なるため、テキストデータを直接関数に渡します
setTimeout(() => {
	if (typeof window.parseIni === 'function') {
		window.parseIni(default_cameras_ini);
		// console.log("[import.js] カメラエディターへ初期値を適用しました。");
	} else if (typeof window.parseCamerasINI === 'function') {
		window.parseCamerasINI(default_cameras_ini);
	}
	// 6. エンジンデータ (engine.ini)
	if (ini_DATA['engine.ini']) {
		window.currentEngineData = ini_DATA['engine.ini'];
		if (typeof window.initEngineEditor === 'function') {
			window.initEngineEditor(window.currentEngineData);
		}
	}
	// 7. パワー曲線 (power.lut)
	if (ini_DATA['power.lut']) {
		if (typeof window.parsePowerLut === 'function') {
			window.parsePowerLut(ini_DATA['power.lut']);
		}
	}
	// 8. ギア・ドライブトレインデータ (drivetrain.ini)
	if (ini_DATA['drivetrain.ini']) {
		window.currentDrivetrainData = ini_DATA['drivetrain.ini'];
		if (typeof window.initDrivetrainEditor === 'function') {
			window.initDrivetrainEditor(window.currentDrivetrainData);
		}
	}
	// 9. セットアップ (setup.ini)
	if (ini_DATA['setup.ini']) {
		// ★修正：起動時の初期データもデフォルトデータで補完してからセットする
		window.currentSetupData = window.mergeWithDefaultSetup(ini_DATA['setup.ini']);
		// ★追加：データ読み込み時にエディター初期化関数を呼び出す
		if (typeof window.loadSetupIniForGears === 'function') {
			window.loadSetupIniForGears(window.currentSetupData);
		}
		if (typeof window.initSetupEditor === 'function') {
			window.initSetupEditor(window.currentSetupData);
		}
	}
}, 100);
// ★追加：setup.ini から GEAR_SET_x を読み込んで drivetrain.js 用のリストを構築する
window.loadSetupIniForGears = function(setupData) {
	if (!setupData) return;
	let newSets = [];
	let baseDrivetrain = window.currentDrivetrainData || {};
	let baseGears = baseDrivetrain.GEARS || {};
	for (const section in setupData) {
		// [GEAR_SET_X] というセクションを見つけたら
		if (section.startsWith('GEAR_SET_')) {
			const secData = setupData[section];
			const setName = secData.NAME || section;
			let newData = JSON.parse(JSON.stringify(baseDrivetrain));
			if (!newData.GEARS) newData.GEARS = {};
			// drivetrain側の基本情報（FINAL等）を引き継ぐ
			for (const k in baseGears) {
				newData.GEARS[k] = baseGears[k];
			}
			// setup側の情報（1速〜5速）で上書きする
			for (const key in secData) {
				if (key !== 'NAME') {
					newData.GEARS[key] = secData[key];
				}
			}
			newSets.push({
				id: Date.now() + Math.random(),
				name: setName,
				data: newData
			});
		}
	}
	if (newSets.length > 0) {
		// drivetrain.js 側の変数を直接書き換える
		window.gearSetList = newSets;
		window.activeGearIdx = 0;
		window.mainGearIdx = 0; // 最初のものを初期のメインにする
		// セットアッププレビューの初期表示インデックスも同期させる
		window.previewSetupGearIdx = 0;
		const initialFinal = parseFloat(newSets[0].data.GEARS?.FINAL) || 0;
		const foundFinalIdx = window.finalRtoList ? window.finalRtoList.findIndex(f => parseFloat(f.value) === initialFinal) : 0;
		window.previewSetupFinalIdx = foundFinalIdx !== -1 ? foundFinalIdx : 0;
		// 画面更新処理を呼ぶ
		if (window.activeDrivetrainTab === 'GEAR' && typeof window.renderDrivetrainUI === 'function') {
			window.renderDrivetrainUI();
			if (typeof window.updateGearChart === 'function') window.updateGearChart();
		}
	}
};
// --- 3. サスペンション：解析・同期ロジック ---
export function sortSus(iniData) {
	if (!iniData.FRONT || !iniData.REAR) return;
	const convert = (section, axleData) => {
		let result = {};
		// AXLEのデータがあれば先にマージし、その上から FRONT/REAR のデータで上書きする
		let merged = {
			...axleData,
			...section
		};
		for (let key in merged) {
			let val = merged[key];
			if (typeof val === 'string') {
				// カンマが含まれていれば、[0.305, 0.433, -0.065] のような座標配列として処理
				if (val.includes(',')) {
					result[key] = val.split(',').map(v => parseFloat(v.trim()));
				}
				// TYPEなどの文字列項目はそのまま文字列として扱う
				else if (key === 'TYPE' || key === 'NAME') {
					result[key] = val;
				}
				// それ以外は数値に変換（例: "1.6" -> 1.6）
				else {
					let num = parseFloat(val);
					result[key] = isNaN(num) ? val : num;
				}
			} else {
				// すでに配列や数値になっている場合のフォールバック
				result[key] = val;
			}
		}
		return result;
	};
	susF = convert(iniData.FRONT, null);
	susR = convert(iniData.REAR, iniData.AXLE);
	window.susF = susF;
	window.susR = susR;
}
// --- 4. 共通：ファイル処理・読み込み ---
const manager = new THREE.LoadingManager();
manager.addHandler(/\.dds$/i, new DDSLoader());
const fbxLoader = new FBXLoader(manager);
const gltfLoader = new GLTFLoader(manager);
export function readTextFile(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = (e) => resolve(e.target.result);
		reader.onerror = (e) => reject(e);
		reader.readAsText(file);
	});
}
export function parseINI(text) {
	const lines = text.split(/\r?\n/);
	let currentSection = null;
	const result = {};
	lines.forEach((line) => {
		// ★修正：'//' で分割するとURL等も消えてしまうため、標準の ';' のみでコメントを判定します。
		let processingLine = line.split(';')[0].trim();
		// コメントを消した結果、文字が何も残らなければ（空行なら）スキップ
		if (!processingLine) return;
		// セクションの判定（[WING_0] などが確実に判定できるようになります）
		if (processingLine.startsWith('[') && processingLine.endsWith(']')) {
			currentSection = processingLine.slice(1, -1).trim();
			result[currentSection] = {};
			return;
		}
		// 値の判定
		if (currentSection && processingLine.includes('=')) {
			// ★修正：最初の '=' だけを区切り文字として扱う（値の中に '=' がある場合に対応）
			const firstEqIdx = processingLine.indexOf('=');
			const key = processingLine.substring(0, firstEqIdx).trim();
			let cleanValue = processingLine.substring(firstEqIdx + 1).replace(/\t/g, ' ').trim();
			result[currentSection][key] = cleanValue;
		}
	});
	return result;
}
// --- 5. 3Dモデル読み込み（load3DModel） ---
export function isGlass(name) {
	if (!name) return false;
	const n = name.toLowerCase();
	return n.includes('glass') || n.includes('window') || n.includes('vetro') || n.includes('windshield');
}
export function load3DModel(file) {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(file);
		const extension = file.name.split('.').pop().toLowerCase();
		const onObjectLoad = (object) => {
			URL.revokeObjectURL(url);
			const box = new THREE.Box3().setFromObject(object);
			const center = box.getCenter(new THREE.Vector3());
			object.position.sub(center);
			// リセット
			model_3D.BODY = [];
			model_3D.STEER = null;
			model_3D.GLASS = [];
			Object.keys(model_3D.WHEEL).forEach(k => model_3D.WHEEL[k] = null);
			Object.keys(model_3D.SUSP).forEach(k => model_3D.SUSP[k] = null);
			Object.keys(model_3D.DISC).forEach(k => model_3D.DISC[k] = null);
			Object.keys(model_3D.CALIPER).forEach(k => model_3D.CALIPER[k] = null);
			object.traverse((child) => {
				if (!child.isMesh && !child.isGroup && child.type !== 'Object3D') return;
				const name = child.name;
				// --- 調査ログ：ここを追加 ---
				// 物理的な名前を [ ] で囲って出力し、空白や改行が混じっていないか確認します
				if (name && name.toUpperCase().includes('WHEEL')) {
					// console.log(`[import.js] 検出ノード: [${name}] (Type: ${child.type})`);
				}
				if (isGlass(name)) {
					model_3D.GLASS.push(child);
					return;
				}
				switch (name) {
					case 'BODY':
						model_3D.BODY.push(child);
						break;
					case 'WHEEL_LF':
						model_3D.WHEEL.LF = child;
						// console.log("[import.js] WHEEL_LF を正常に捕捉しました");
						break;
					case 'WHEEL_RF':
						model_3D.WHEEL.RF = child;
						break;
					case 'WHEEL_LR':
						model_3D.WHEEL.LR = child;
						break;
					case 'WHEEL_RR':
						model_3D.WHEEL.RR = child;
						break;
					case 'SUSP_LF':
						model_3D.SUSP.LF = child;
						break;
					case 'SUSP_RF':
						model_3D.SUSP.RF = child;
						break;
					case 'SUSP_LR':
						model_3D.SUSP.LR = child;
						break;
					case 'SUSP_RR':
						model_3D.SUSP.RR = child;
						break;
					case 'STEER_HR':
					case 'STEER_LR':
						model_3D.STEER = child;
						break;
					case 'DISC_LF':
						model_3D.DISC.LF = child;
						break;
					case 'DISC_RF':
						model_3D.DISC.RF = child;
						break;
					case 'DISC_LR':
						model_3D.DISC.LR = child;
						break;
					case 'DISC_RR':
						model_3D.DISC.RR = child;
						break;
					case 'CALIPER_LF':
						model_3D.CALIPER.LF = child;
						break;
					case 'CALIPER_RF':
						model_3D.CALIPER.RF = child;
						break;
					case 'CALIPER_LR':
						model_3D.CALIPER.LR = child;
						break;
					case 'CALIPER_RR':
						model_3D.CALIPER.RR = child;
						break;
					default:
						if (child.isMesh) model_3D.BODY.push(child);
						break;
				}
			});
			// 3Dモデルの解析（WHEEL_LF等の捕捉）が完了した直後に、アームの描画を要求する
			if (typeof window.updateSuspensionVisuals === 'function' && window.currentSuspensionData) {
				window.updateSuspensionVisuals(window.currentSuspensionData);
			}
			resolve(object);
		};
		if (extension === 'fbx') fbxLoader.load(url, onObjectLoad, undefined, reject);
		else if (extension === 'glb' || extension === 'gltf') gltfLoader.load(url, (g) => onObjectLoad(g.scene), undefined, reject);
		else reject(new Error("非対応形式: " + extension));
	});
}
// --- 6. メインハンドラ（ファイルのルーティングとデータ同期） ---
// 共通：解析されたデータをシステムに適用し、切り替えを通知する
export function applyIniData(fileName, parsedData) {
	// console.log(`[import.js] applyIniData 開始: ${fileName}`, parsedData);
	// データの正規化：配列をカンマ区切りの文字列に変換する
	const normalizedData = JSON.parse(JSON.stringify(parsedData));
	for (let section in normalizedData) {
		for (let key in normalizedData[section]) {
			let val = normalizedData[section][key];
			if (Array.isArray(val)) {
				normalizedData[section][key] = val.join(', ');
			} else if (typeof val === 'number') {
				normalizedData[section][key] = val.toString();
			}
		}
	}
	let detectedExtended = false;
	
	// car.ini のバージョンチェック
	if (fileName.includes('car.ini') && normalizedData.HEADER?.VERSION === 'extended-2') {
		detectedExtended = true;
	}
	// suspensions.ini の拡張セクションチェック
	if (fileName.includes('suspensions.ini') && (normalizedData._EXTENSION || normalizedData._EXTENSION_FLEX)) {
		detectedExtended = true;
	}
	// ★追加：aero.ini の拡張セクションチェック
	if (fileName.includes('aero.ini')) {
		let hasAeroExt = false;
		if (normalizedData.FIN_0) {
			hasAeroExt = true;
		} else {
			// 全セクションのキーをチェックし、ZONE_ から始まるものがあれば拡張物理と判定
			for (const sec in normalizedData) {
				for (const key in normalizedData[sec]) {
					if (key.startsWith('ZONE_')) {
						hasAeroExt = true;
						break;
					}
				}
				if (hasAeroExt) break;
			}
		}
		if (hasAeroExt) {
			detectedExtended = true;
		}
	}

	if (detectedExtended) {
		window.isExtendedPhysicsEnabled = true;
		const masterSwitch = document.getElementById('extendedPhysicsSwitch'); // ★HTML側で作ったIDと一致させてください
		if (masterSwitch) masterSwitch.checked = true;
	}
	if (!window.ini_DATA) window.ini_DATA = {};
	window.ini_DATA[fileName] = normalizedData;
	if (fileName.includes('suspensions.ini')) {
		// console.log("[import.js] suspensions.ini を適用中...");
		window.currentSuspensionData = normalizedData;
		sortSus(normalizedData);
		if (typeof window.syncSus === 'function') {
			window.syncSus();
		} else {
			console.warn("[import.js] syncSus が見つかりません");
		}
	} else if (fileName.includes('aero.ini')) {
		console.log("[aero.js] 📂 アップロードされたデータ:", normalizedData);

		// 1. 土台として、ini-data.js にある「絶対に FIN_0 が入っている新品」を解析して用意します
		const factoryDefault = window.parseINI(default_aero_ini);
		console.log("[aero.js] 🛠️ 土台となるデフォルト:", factoryDefault);

		// ★追加：合流させる前に、アップロードされた元のデータに本物の FIN_0 が存在していたかチェック
		const hasRealFin0 = normalizedData.hasOwnProperty('FIN_0');

		// 2. その土台の上に、アップロードされたデータを上書き合流させます
		window.currentAeroData = { ...factoryDefault, ...normalizedData };
		console.log("[aero.js] ✅ 合流後の最終データ:", window.currentAeroData);

		// ==========================================
		// ★ここを追加：本物が無ければ初期状態を強制的に _ENABLED = false (OFF) にする
		// ==========================================
		if (window.currentAeroData && window.currentAeroData.FIN_0) {
			if (hasRealFin0) {
				window.currentAeroData.FIN_0._ENABLED = true;  // 実在すれば有効
			} else {
				window.currentAeroData.FIN_0._ENABLED = false; // 実在しなければ無効化（半透明）
			}
		}
		// ==========================================

		if (typeof window.initAeroEditor === 'function') {
			window.initAeroEditor(window.currentAeroData);
		}
		if (typeof window.updateAeroVisuals === 'function') {
			window.updateAeroVisuals();
		}
		if (typeof window.requestRender === 'function') {
			window.requestRender();
		}
	}
	else if (fileName.includes('tyres.ini')) {
		window.currentTyreData = normalizedData;
		if (typeof window.updateTyreEditorUI === 'function') {
			window.updateTyreEditorUI(window.currentTyreData);
		}
	}
	// ★追加：car.ini の処理（上書きせず既存データと合体させる）
	else if (fileName.includes('car.ini')) {
		// ★修正：メモリをクリアにする際、コライダーデータ（[COLLIDER_0]など）だけは保護して引き継ぐ
		const preservedColliders = {};
		if (window.currentCarData) {
			for (const key in window.currentCarData) {
				if (key.startsWith('COLLIDER_')) {
					preservedColliders[key] = window.currentCarData[key];
				}
			}
		}
		window.currentCarData = {
			...preservedColliders,
			...normalizedData
		};
		if (typeof window.updateCarEditorUI === 'function') {
			window.updateCarEditorUI(window.currentCarData);
		}
	}
	// ★追加：colliders.ini の処理（既存データと合体させ、即座に描画する）
	else if (fileName.includes('colliders.ini')) {
		// ★修正：既存の古いコライダーデータを消去してから、新しいコライダーデータを入れる
		if (window.currentCarData) {
			for (const key in window.currentCarData) {
				if (key.startsWith('COLLIDER_')) {
					delete window.currentCarData[key];
				}
			}
		} else {
			window.currentCarData = {};
		}
		window.currentCarData = {
			...window.currentCarData,
			...normalizedData
		};
		if (typeof window.initColliderEditor === 'function') {
			window.initColliderEditor(normalizedData);
		}
		if (typeof window.updateColliderVisuals === 'function') {
			window.updateColliderVisuals();
		}
	}
	// engine.ini の処理
	else if (fileName.includes('engine.ini')) {
		window.currentEngineData = normalizedData;
		if (typeof window.initEngineEditor === 'function') {
			window.initEngineEditor(window.currentEngineData);
		}
		if (typeof window.updateEngineGraph === 'function') {
			window.updateEngineGraph();
		}
	}
	// drivetrain.ini の処理
	else if (fileName.includes('drivetrain.ini')) {
		// ★追加：drivetrainがアップロードされたことを記憶するフラグ
		window.isDrivetrainIniUploaded = true;
		window.currentDrivetrainData = normalizedData;
		if (typeof window.loadSetupIniForGears === 'function') {
			window.loadSetupIniForGears(window.currentSetupData);
		}
		if (typeof window.initDrivetrainEditor === 'function') {
			window.initDrivetrainEditor(window.currentDrivetrainData, fileName); // ファイル名を渡す
		}
		if (typeof window.updateGearChart === 'function') {
			window.updateGearChart();
		}
	}
	// setup.ini の処理
	else if (fileName.includes('setup.ini')) {
		// ★追加：setupがアップロードされたことを記憶するフラグ
		window.isSetupIniUploaded = true;
		// ★修正：アップロードされたデータをデフォルトデータで補完してからセットする
		const completedData = window.mergeWithDefaultSetup(normalizedData);
		window.currentSetupData = completedData;
		// ★追加：ドラッグ＆ドロップでの読み込み時にもエディターを更新
		if (typeof window.initSetupEditor === 'function') {
			window.initSetupEditor(window.currentSetupData);
			
			// --- ここから追加：表示の強制リフレッシュ ---
			// 今開いている「GEAR」などのタブボタンを探して、プログラムからクリックさせます
			const activeTabBtn = document.querySelector('#setup-editor .setup-tab-btn.active');
			if (activeTabBtn) {
				activeTabBtn.click();
			}
			// --- ここまで追加 ---
		}
		if (typeof window.loadSetupIniForGears === 'function') {
			window.loadSetupIniForGears(window.currentSetupData);
		}
	}
	// ★追加：mirrors.ini の処理
	else if (fileName.includes('mirrors.ini')) {
		window.currentMirrorsData = normalizedData;
		console.log("[IMPORT] mirrors.ini を読み込みました", window.currentMirrorsData);
		// 3Dモデルからミラーパーツを探す関数を呼ぶ
		if (typeof window.updateMirrorsVisuals === 'function') {
			window.updateMirrorsVisuals();
		}
	}
}
/**
 * 複数ファイルアップロード時のメインエントリポイント
 */
// （今後UIを追加したら、このリストに名前を足すだけで自動対応します）
const ALLOWED_FILES = [
	'aero.ini',
	'cameras.ini',
	'car.ini',
	'colliders.ini',
	'dash_cam.ini',
	'drivetrain.ini',
	'engine.ini',
	'final.rto',
	'power.lut',
	'setup.ini',
	'suspensions.ini',
	'tyres.ini',
	'mirrors.ini'
];
export async function handleMultiFileUpload(files) {
	// ==========================================
	// ★追加：ドラッグ＆ドロップされたファイルのパスから「車名」を完璧に特定する処理
	// ==========================================
	let detectedCarName = "名称未設定";
	const fileArray = Array.from(files); // 使い回せるように一度配列に変換しておく
	for (let i = 0; i < fileArray.length; i++) {
		const f = fileArray[i];
		// Electron(D&D)からは path、ブラウザ標準なら webkitRelativePath が入る
		const filePath = f.path || f.webkitRelativePath || "";
		if (filePath) {
			const parts = filePath.split(/[\\/]/); // パスをフォルダごとに分割
			if (parts.length >= 2) {
				const parentDir = parts[parts.length - 2];
				// もし親フォルダが "data" なら、さらにその上が車名フォルダ
				if (parentDir.toLowerCase() === 'data' && parts.length >= 3) {
					detectedCarName = parts[parts.length - 3];
				} else {
					detectedCarName = parentDir;
				}
				break; // 車名が見つかったらループ終了
			}
		}
	}
	window.currentCarDirectoryName = detectedCarName;
	console.log("[MULTI-IMPORT] 特定した車名:", window.currentCarDirectoryName);

	// 特定が終わってから、本来のファイル読み込みループを開始する
	for (const file of fileArray) {
		const name = file.name.toLowerCase();
		try {
			// ★追加：3Dモデル以外のファイルは、許可リストにあるかチェックする
			if (!name.endsWith('.fbx') && !name.endsWith('.glb') && !name.endsWith('.gltf')) {
				if (!ALLOWED_FILES.includes(name)) {
					// 許可リストにないファイル（lights.iniなど）はここで華麗にスルー！
					console.log(`[IMPORT] 対象外ファイルをスキップしました: ${name}`);
					continue; 
				}
			}

			if (name.endsWith('.ini') || name.endsWith('.lut') || name.endsWith('.rto')) {
				
				// ★修正：データファイル（ini等）だった場合のみ、その場所を「データ専用の箱」に記憶する
				// ※ただし、ここは初回の一括読み込み時（またはパスが空の時）だけ記憶するように安全装置をかけます
				if (file.path && !window.currentDataFolderPath) {
					const filePath = file.path;
					const lastSlashIdx = Math.max(filePath.lastIndexOf('\\'), filePath.lastIndexOf('/'));
					if (lastSlashIdx !== -1) {
						window.currentDataFolderPath = filePath.substring(0, lastSlashIdx);
						console.log(`[IMPORT] メインの保存先をロックしました: ${window.currentDataFolderPath}`);
					}
				}

				const content = file.content !== undefined ? file.content : await readTextFile(file);
				if (name.endsWith('.lut')) {
					// LUTファイルの場合は専用のパース関数に直接渡す
					if (typeof window.parsePowerLut === 'function') {
						window.parsePowerLut(content);
					}
				} else if (name.endsWith('.rto')) {
					// ★追加：RTOファイルのパース
					if (typeof window.parseFinalRto === 'function') {
						window.parseFinalRto(content);
					}
				} else if (name === 'cameras.ini') {
					// ★修正：cameras.ini は特殊な専用パーサーを通す
					if (typeof window.parseIni === 'function') {
						window.parseIni(content);
					} else if (typeof window.parseCamerasINI === 'function') {
						window.parseCamerasINI(content);
					}
				} else {
					// 通常のINIファイル
					const parsedData = parseINI(content);
					applyIniData(file.name, parsedData);
				}
			} else if (name.endsWith('.fbx') || name.endsWith('.glb') || name.endsWith('.gltf')) {
				// 3Dモデル読み込み
				if (file.path && window.currentProject && window.currentProject.environment) {
					window.currentProject.environment.model_path = file.path;
					console.log("[IMPORT] モデルパスをプロジェクトに登録しました:", file.path);
				}
				
				// =======================================================
				// ★修正：メニューの一括読み込みから届いた「パス情報だけのオブジェクト」の場合
				// プロジェクトロード時にも使われている、実績のある安全な自動復元ルートへ流します
				// =======================================================
				if (file.isModel && typeof window.loadModelByPath === 'function') {
					console.log("[IMPORT] メニュー経由のため、安全なパス復元ルートでモデルを読み込みます:", file.path);
					await window.loadModelByPath(file.path);
				} else {
					// =======================================================
					// ★通常：手動D&D（本物のFileオブジェクト）の場合
					// =======================================================
					if (typeof window.handleModelFile === 'function') {
						window.handleModelFile(file);
					}
					await load3DModel(file);
				}
				// ★修正：すでに編集データ(window.currentSuspensionData等)がある場合は、
				// デフォルト値(ini_DATA)での上書きをスキップする
				const hasExistingData = window.currentSuspensionData && Object.keys(window.currentSuspensionData).length > 0;
				if (hasExistingData) {
					console.log("[IMPORT] 既存データがあるため、3Dモデルの配置更新のみ行います。");
					// サスペンションの更新
					if (typeof window.updateSuspensionVisuals === 'function') {
						window.updateSuspensionVisuals(window.currentSuspensionData);
					}
					// ★追加：コライダーの更新（これでモデル到着後にコライダーが表示されます）
					if (typeof window.updateColliderVisuals === 'function') {
						window.updateColliderVisuals();
					}
					// ★追加：エアロの更新（これでモデル到着後にエアロが表示されます）
				if (typeof window.updateAeroVisuals === 'function') {
					window.updateAeroVisuals();
				}
			} else {
				console.log("[IMPORT] データがないため、デフォルト値を適用します。");
				Object.keys(window.ini_DATA).forEach(key => {
					applyIniData(key, window.ini_DATA[key]);
				});
			}
			// 共通の描画更新
			if (typeof window.requestRender === 'function') window.requestRender();
		}
	} catch (err) {
		// console.error(`[import.js] ファイル処理失敗: ${file.name}`, err);
	}
} // ← ここでファイルの読み込みループ(for)が終了

	// ==========================================
	// ★追加：view.ini と dash_cam.ini のデータ補完（予測を排除した安全なひな形ロード）
	// ==========================================
	// 1. dash_cam.ini の補完 (すでに入っていればそれを使用、なければひな形)
	let dashCamParsed = null;
	const dashCamFile = fileArray.find(f => f.name && f.name.toLowerCase() === 'dash_cam.ini');
	if (dashCamFile) {
		const text = (typeof dashCamFile.text === 'function') ? await dashCamFile.text() : (dashCamFile.content !== undefined ? dashCamFile.content : await readTextFile(dashCamFile));
		dashCamParsed = parseINI(text);
	} else {
		dashCamParsed = parseINI(default_dash_cam_ini);
	}

	// 2. view.ini の補完 (Electron経由でマイドキュメントへ確実な車名で探しに行く)
	let viewIniParsed = null;
	if (window.electronAPI && window.electronAPI.readViewIni) {
		try {
			// 先ほど完璧に特定した車名を使ってアクセスする
			const result = await window.electronAPI.readViewIni(window.currentCarDirectoryName);
			if (result.success) {
				viewIniParsed = parseINI(result.content);
			} else {
				viewIniParsed = parseINI(default_view_ini);
			}
		} catch (e) {
			viewIniParsed = parseINI(default_view_ini);
		}
	} else {
		viewIniParsed = parseINI(default_view_ini);
	}

	// 3. 取得した座標データを car.ini (GRAPHICS) の中に安全に注入する
	if (window.currentCarData) {
		if (!window.currentCarData.GRAPHICS) window.currentCarData.GRAPHICS = {};
		
		// dash_cam.ini の反映
		if (dashCamParsed && dashCamParsed.DASH_CAM && dashCamParsed.DASH_CAM.POS) {
			window.currentCarData.GRAPHICS.DASH_CAM_POS = dashCamParsed.DASH_CAM.POS;
		}
		
		// view.ini の反映
		if (viewIniParsed) {
			if (viewIniParsed.CAMERA) {
				if (viewIniParsed.CAMERA.ON_BOARD_PITCH_ANGLE) {
					window.currentCarData.GRAPHICS.ON_BOARD_PITCH_ANGLE = viewIniParsed.CAMERA.ON_BOARD_PITCH_ANGLE;
				}
				if (viewIniParsed.CAMERA.ON_BOARD_YAW_ANGLE) {
					window.currentCarData.GRAPHICS.ON_BOARD_YAW_ANGLE = viewIniParsed.CAMERA.ON_BOARD_YAW_ANGLE;
				}
			}
			if (viewIniParsed.DRIVER_EYES_POSITION && viewIniParsed.DRIVER_EYES_POSITION.DRIVEREYES) {
				window.currentCarData.GRAPHICS.DRIVEREYES = viewIniParsed.DRIVER_EYES_POSITION.DRIVEREYES;
			}
		}
	}

	// UI側（car.js等）を更新して画面に数値を出す
	if (typeof window.updateCarEditorUI === 'function' && window.currentCarData) {
		window.updateCarEditorUI(window.currentCarData);
	}

} // ← ここで handleMultiFileUpload 関数全体が終了
// サスペンションINI処理
// --- suspensions.ini 用のハンドラ ---
export async function processSuspensionIni(file) {
	try {
		const content = await readTextFile(file);
		const parsedData = parseINI(content);
		// 解析完了後に共通関数へ流す
		applyIniData(file.name, parsedData);
	} catch (err) {
		console.error("[import.js] suspensions.ini 解析失敗", err);
	}
}
// 他のINI（car.ini, tyres.ini等）も同様に applyIniData を通すように統一
//二重読み込みーーーーーーーーーーーーーーーーーーーーーーーーー
// すべてのファイル入力を一括で監視する「統合センター」
document.addEventListener('DOMContentLoaded', () => {
	const fileInputIds = [
		'suspensionFile', 'tyreFile', 'carFile', 'collidersFile',
		'aeroFile', 'engineFile', 'lutFile', 'drivetrainFile', 'setupFile', 'importFile'
	];

	fileInputIds.forEach(id => {
		const el = document.getElementById(id);
		if (el) {
			el.addEventListener('change', async (e) => {
				// まとめてアップロード中は、handleMultiFileUpload 側で処理するため無視する
				if (window.isMultiUploading) return;

				const file = e.target.files[0];
				if (!file) return;

				// ★修正：個別アップロード時も、一括読み込みと全く同じ「メインルート」を通すように統合
				await handleMultiFileUpload([file]);
				
				// ★追加：連続して同じファイルを読み込めるように入力をリセットする
				e.target.value = '';
			});
		}
	});

	// まとめてアップロード（マルチ）用の処理
	const multiFileInput = document.getElementById('multiFileUpload');
	if (multiFileInput) {
		multiFileInput.addEventListener('change', async (e) => {
			window.isMultiUploading = true;
			const files = Array.from(e.target.files);
			
			// ★修正：ここでは一括でパスを記憶せず（3Dモデルのパスを誤認するのを防ぐため）、
			// 上記の handleMultiFileUpload 内でデータファイルごとに記憶するように処理を移動しました。

			// handleMultiFileUpload を直接呼び出し、一括処理を開始する
			await handleMultiFileUpload(files);
			window.isMultiUploading = false;
			e.target.value = ''; // 選択をリセット
		});
	}
});
// =========================================================
// 各エディタ内での変更を監視し、編集フラグを立てる処理
// =========================================================
document.addEventListener('input', (e) => {
	const target = e.target;
	
	// 親要素を探す範囲を広げます（.sub-content, .tab-content, または ID 指定）
	const content = target.closest('.sub-content, .tab-content, .camera-section, #engine-data-container, #power-lut-container, #setup-editor');
	if (!content) return;

	// HTML上の実際のID（事実）と、modifiedStatusのキーを正確に一致させます
	const idMap = {
		'sus-editor': 'suspensions',
		'tyre-editor': 'tyres',
		'car-editor': 'car',
		'colliders-editor': 'colliders',
		'wing-editor': 'aero',
		// エンジン関連
		'engine-content': 'engine',
		'engine-data-container': 'engine',
		'power-lut-container': 'lut',
		// ギア・セットアップ関連
		'gear-editor': 'drivetrain',
		'final-editor': 'final',
		'setup-content': 'setup',
		'setup-editor': 'setup',
		// カメラ
		'camera-content': 'cameras',
		'section-0': 'cameras',
		'section-1': 'cameras',
		'section-2': 'cameras',
		'section-3': 'cameras',
		'section-4': 'cameras',
		'section-5': 'cameras'
	};

	// 1. まず通常の ID マップでフラグを立てる
	const key = idMap[content.id];
	if (key && window.modifiedStatus) {
		window.modifiedStatus[key] = true;
		// もしギアエディタ内で変更があり、かつ現在「FINAL」タブが開かれている場合
		if (key === 'drivetrain' && window.activeDrivetrainTab === 'FINAL') {
			window.modifiedStatus.final = true;
		}
		// console.log(`📝 [LOG] 編集を検知しました: ${key} (ID: ${content.id})`);
	}

	// 2. 特殊なケース（power.lut のテキストエリア）を個別にチェック
	// これを if(key) の外に出すことで、確実に検知させます
	if (target.id === 'power-lut-textarea') {
		if (window.modifiedStatus) {
			window.modifiedStatus.lut = true;
			console.log(`📝 [LOG] 編集を検知しました: lut (Textarea)`);
		}
	}
});

const exportFiles = [
		{ id: 'suspension', name: 'suspensions.ini', func: window.downloadSuspensionIni },
		{ id: 'car', name: 'car.ini', func: window.downloadCarIni },
		// ... 他のファイルも同様
];

// モーダルを開く時の処理
function openExportModal() {
		const container = document.getElementById('exportFileList');
		container.innerHTML = ''; // 一旦クリア

		exportFiles.forEach(file => {
				// 事実確認：そのデータが「初期値と違う」か「読み込まれているか」をチェック
				const isModified = checkIfModified(file.id); 

				const item = document.createElement('div');
				item.className = `export-file-item ${isModified ? 'modified' : ''}`;
				
				item.innerHTML = `
						<input type="checkbox" id="chk-${file.id}" ${isModified ? 'checked' : ''}>
						<label for="chk-${file.id}">${file.name}</label>
						${isModified ? '<span class="modified-tag">MODIFIED</span>' : ''}
				`;
				container.appendChild(item);
		});
		
		document.getElementById('exportModal').style.display = 'flex';
}

// 書き出し対象のファイルリスト定義
window.EXPORT_CONFIG = [
	{ id: 'suspensions', name: 'suspensions.ini', func: 'downloadSuspensionIni' },
	{ id: 'car', name: 'car.ini', func: 'downloadCarIni' },
	{ id: 'tyres', name: 'tyres.ini', func: 'downloadTyreIni' },
	{ id: 'colliders', name: 'colliders.ini', func: 'downloadCollidersIni' },
	{ id: 'aero', name: 'aero.ini', func: 'downloadAeroIni' },
	{ id: 'engine', name: 'engine.ini', func: 'downloadEngineIni' },
	{ id: 'lut', name: 'power.lut', func: 'downloadPowerLut' },
	{ id: 'drivetrain', name: 'drivetrain.ini', func: 'downloadDrivetrainIni' },
	{ id: 'final', name: 'final.rto', func: 'downloadFinalRto' },
	{ id: 'setup', name: 'setup.ini', func: 'downloadSetupIni' },
	{ id: 'cameras', name: 'cameras.ini', func: 'downloadCamerasIni' },
	{ id: 'mirrors', name: 'mirrors.ini', func: 'downloadMirrorsIni' }
];

// モーダルを開く処理
window.openExportModal = function() {
	const listContainer = document.getElementById('exportFileList');
	if (!listContainer) return;
	// ★追加：スイッチ連動処理（モーダルを開くたびに初期化）
	const overwriteSwitch = document.getElementById('overwriteSwitch');
	const overwriteText = document.getElementById('overwriteStatusText');
	const nameInputEl = document.getElementById('exportProjectName');
	if (overwriteSwitch) {
		overwriteSwitch.checked = false; 
		if (overwriteText) { overwriteText.textContent = 'OFF'; overwriteText.className = 'status-text off'; }
		if (nameInputEl) nameInputEl.disabled = false;
		
		overwriteSwitch.onchange = (e) => {
			if (overwriteText) {
				overwriteText.textContent = e.target.checked ? 'ON' : 'OFF';
				overwriteText.className = e.target.checked ? 'status-text on' : 'status-text off';
			}
			if (nameInputEl) nameInputEl.disabled = e.target.checked; // ONならフォルダ名入力を無効化
		};
	}
	// 調査ログは役目を終えたので削除またはコメントアウトします

	// アプリが保持している「プロジェクト名」を最優先で取得して入力欄にセット
	const nameInput = document.getElementById('exportProjectName');
	if (nameInput) {
		let pName = "New-Project";
		
		// 1. ログの事実に基づき、正しいプロパティ名（projectName）で取得する
		if (window.currentProject && window.currentProject.projectName) {
			pName = window.currentProject.projectName;
		} 
		// 2. なければ car.ini の車種名を確認
		else if (window.currentCarData?.INFO?.SCREEN_NAME) {
			pName = window.currentCarData.INFO.SCREEN_NAME;
		}
		
		nameInput.value = pName.trim();
	}

	listContainer.innerHTML = ''; // リストをクリア

	window.EXPORT_CONFIG.forEach(file => {
		const isModified = window.modifiedStatus[file.id] || false;
		
		const div = document.createElement('div');
		div.className = `export-item ${isModified ? 'is-modified' : ''}`;
		
		div.innerHTML = `
			<input type="checkbox" id="check-${file.id}" ${isModified ? 'checked' : ''}>
			<label for="check-${file.id}">${file.name}</label>
			${isModified ? '<span class="modified-badge">MODIFIED</span>' : ''}
		`;
		listContainer.appendChild(div);
	});

	document.getElementById('exportModal').style.display = 'flex';
};

