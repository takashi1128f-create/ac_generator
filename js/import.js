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
import {
	updateBadgeImage,
	initBadgeHandler,
	updateUiCarData,
	collectUiCarData
} from './logo-name.js';
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
export const glassMaterial = new THREE.MeshPhysicalMaterial({
	color: 0x88ccff,
	transparent: true,
	opacity: 0.1,
	transmission: 0.5,
	roughness: 0.2,
	metalness: 0.4,
	ior: 1.5,
	thickness: 0.5,
	side: THREE.DoubleSide
});
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
	return n.includes('glass') || n.includes('window') || n.includes('vetro') || n.includes('windshield') || n.includes('steklo');
}
export function load3DModel(file) {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(file);
		const extension = file.name.split('.').pop().toLowerCase();
		const onObjectLoad = (object) => {
			URL.revokeObjectURL(url);
			// 🚨 重要：以前あった object.position.sub(center) などの
			// 自動センタリング処理を「余計な設定」として完全に削除しました。
			// これにより、FBX/GLBの持つ本来の原点（Origin）が維持されます。
			// 解析用メモリのリセット [cite: 331, 383]
			model_3D.BODY = [];
			model_3D.STEER = null;
			model_3D.GLASS = [];
			Object.keys(model_3D.WHEEL).forEach(k => model_3D.WHEEL[k] = null);
			Object.keys(model_3D.SUSP).forEach(k => model_3D.SUSP[k] = null);
			Object.keys(model_3D.DISC).forEach(k => model_3D.DISC[k] = null);
			Object.keys(model_3D.CALIPER).forEach(k => model_3D.CALIPER[k] = null);
			// ノードのトラバースとパーツ特定 [cite: 339, 391]
			object.traverse((child) => {
				if (!child.isMesh && !child.isGroup && child.type !== 'Object3D') return;
				const name = child.name;
				if (isGlass(name)) {
					if (child.isMesh) {
						child.material = glassMaterial;
					}
					model_3D.GLASS.push(child);
					return;
				}
				// パーツ名に基づいた分類（D&D状態の再現）
				switch (name) {
					case 'BODY':
						model_3D.BODY.push(child);
						break;
					case 'WHEEL_LF':
						model_3D.WHEEL.LF = child;
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
			// 3Dモデルの解析完了後、視覚情報の更新を要求 [cite: 340, 392]
			if (typeof window.updateSuspensionVisuals === 'function' && window.currentSuspensionData) {
				window.updateSuspensionVisuals(window.currentSuspensionData);
			}
			resolve(object);
		};
		if (extension === 'fbx') {
			fbxLoader.load(url, onObjectLoad, undefined, reject);
		} else if (extension === 'glb' || extension === 'gltf') {
			gltfLoader.load(url, (g) => onObjectLoad(g.scene), undefined, reject);
		} else {
			reject(new Error("非対応形式: " + extension));
		}
	});
}
export function applyIniData(fileName, parsedData) {
	// 1. データの正規化（既存の処理を維持）
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
	// 2. 拡張物理スイッチの自動判定
	let detectedExtended = false;
	if (fileName.includes('car.ini') && normalizedData.HEADER?.VERSION === 'extended-2') detectedExtended = true;
	if (fileName.includes('suspensions.ini') && (normalizedData._EXTENSION || normalizedData._EXTENSION_FLEX)) detectedExtended = true;
	if (detectedExtended) {
		window.isExtendedPhysicsEnabled = true;
		const masterSwitch = document.getElementById('extendedPhysicsSwitch');
		if (masterSwitch) masterSwitch.checked = true;
	}
	// 3. 全体データの保存 [5]
	if (!window.ini_DATA) window.ini_DATA = {};
	window.ini_DATA[fileName] = normalizedData;
	const name = fileName.toLowerCase();
	// 4. 各ファイル名に応じた「適応」処理
	if (name.includes('suspensions.ini')) {
		window.currentSuspensionData = normalizedData;
		sortSus(normalizedData);
		if (typeof window.syncSus === 'function') window.syncSus();
		if (typeof window.updateSuspensionEditorUI === 'function') window.updateSuspensionEditorUI(normalizedData);
	} else if (name.includes('aero.ini')) {
		const factoryDefault = window.parseINI(default_aero_ini);
		window.currentAeroData = {
			...factoryDefault,
			...normalizedData
		};
		if (typeof window.initAeroEditor === 'function') window.initAeroEditor(window.currentAeroData);
	} else if (name.includes('tyres.ini')) {
		window.currentTyreData = normalizedData;
		if (typeof window.updateTyreEditorUI === 'function') window.updateTyreEditorUI(window.currentTyreData);
	} else if (name.includes('car.ini')) {
		const preservedColliders = {};
		if (window.currentCarData) {
			for (const key in window.currentCarData) {
				if (key.startsWith('COLLIDER_')) preservedColliders[key] = window.currentCarData[key];
			}
		}
		window.currentCarData = {
			...preservedColliders,
			...normalizedData
		};
		if (typeof window.updateCarEditorUI === 'function') window.updateCarEditorUI(window.currentCarData);
	} else if (name.includes('engine.ini')) {
		window.currentEngineData = normalizedData;
		if (typeof window.initEngineEditor === 'function') window.initEngineEditor(window.currentEngineData);
	} else if (name.includes('drivetrain.ini')) {
		window.isDrivetrainIniUploaded = true;
		window.currentDrivetrainData = normalizedData;
		// 💡 重要：以前のゴミを消して新しく作り直します
		window.gearSetList = [];
		if (typeof window.initDrivetrainEditor === 'function') {
			window.initDrivetrainEditor(window.currentDrivetrainData, fileName);
		}
		if (typeof window.loadSetupIniForGears === 'function') {
			window.loadSetupIniForGears(window.currentSetupData);
		}
	} else if (name.includes('setup.ini')) {
		window.isSetupIniUploaded = true;
		window.currentSetupData = window.mergeWithDefaultSetup(normalizedData);
		if (typeof window.initSetupEditor === 'function') {
			window.initSetupEditor(window.currentSetupData);
		}
		// 💡 setup.ini からギアの選択肢を読み込みます
		if (typeof window.loadSetupIniForGears === 'function') {
			window.loadSetupIniForGears(window.currentSetupData);
		}
	} else if (name.includes('mirrors.ini')) {
		window.currentMirrorsData = normalizedData;
		if (typeof window.updateMirrorsVisuals === 'function') window.updateMirrorsVisuals();
	}
	const physicsFiles = ['car.ini', 'engine.ini', 'drivetrain.ini', 'tyres.ini', 'power.lut'];
	if (physicsFiles.some(f => name.includes(f))) {
		if (typeof window.updateSpecsFromPhysics === 'function') {
				window.updateSpecsFromPhysics();
		}
	}
}
/**
 * 複数ファイルアップロード時のメインエントリポイント
 */
// （今後UIを追加したら、このリストに名前を足すだけで自動対応します）
const ALLOWED_FILES = ['aero.ini', 'cameras.ini', 'car.ini', 'colliders.ini', 'dash_cam.ini', 'drivetrain.ini', 'engine.ini', 'final.rto', 'power.lut', 'setup.ini', 'suspensions.ini', 'tyres.ini', 'mirrors.ini', 'ui_car.json'];
export async function handleMultiFileUpload(files) {
	const fileArray = Array.from(files);
	console.log("📂 [Phase 1: Sorter] ファイルスキャンを開始します...");
	//データファイル（ini等）が含まれている場合、その親フォルダを「保存先」として記憶する
	for (const f of fileArray) {
		if (f.path && (f.name.toLowerCase().endsWith('.ini') || f.name.toLowerCase() === 'ui_car.json')) {
			const filePath = f.path.replace(/\\/g, '/');
			const lastSlashIdx = filePath.lastIndexOf('/');
			if (lastSlashIdx !== -1) {
				window.currentDataFolderPath = filePath.substring(0, lastSlashIdx);
				console.log(`📌 [IMPORT] 物理ファイルの保存先を特定しました: ${window.currentDataFolderPath}`);
				break; // 1つ見つかればOK
			}
		}
	}
	const tasks = {
		carRoot: null,
		dataDirExists: false,
		kn5ToUnpack: [],
		modelFiles: [],
		iniFiles: [],
		acdFile: null,
		uiJson: null,
		skins: []
	};
	// --- STEP 1: Sorter (仕分け) ---
	for (const file of fileArray) {
		const name = file.name.toLowerCase();
		const fullPath = (file.path || "").replace(/\\/g, '/');
		if (name === 'data.acd') {
			tasks.acdFile = file;
		} else if (name.endsWith('.kn5') && name !== 'collider.kn5') {
			tasks.kn5ToUnpack.push(file);
			const parts = fullPath.split('/');
			tasks.carRoot = parts[parts.length - 2];
			const lastSlashIdx = fullPath.lastIndexOf('/');
			if (lastSlashIdx !== -1) {
				window.currentCarRootPath = fullPath.substring(0, lastSlashIdx);
				console.log(`📌 [IMPORT] 車両のルート(KN5の階層)を特定しました: ${window.currentCarRootPath}`);
			}
		} else if (['.fbx', '.glb', '.gltf'].some(ext => name.endsWith(ext))) {
			tasks.modelFiles.push(file);
		} else if (['.ini', '.lut', '.rto'].some(ext => name.endsWith(ext))) {
			tasks.iniFiles.push(file);
			if (fullPath.includes('/data/')) {
				tasks.dataDirExists = true;
			}
		} else if (name === 'ui_car.json') {
			tasks.uiJson = file;
		} else if (fullPath.toLowerCase().includes('/skins/') && name === 'preview.jpg') {
			// 💡 事実：skins/フォルダ名/preview.jpg という構造からスキン名を取得します
			const parts = fullPath.split('/');
			const skinName = parts[parts.length - 2];
			tasks.skins.push({
				name: skinName,
				path: fullPath
			});
		}
	}
	// --- STEP 2: Dispatcher (順次実行) ---
	console.log("🚀 [Phase 2: Dispatcher] 順次読み込みを開始します...");
	if (tasks.carRoot) window.currentCarDirectoryName = tasks.carRoot;
	console.log("DEBUG: KN5処理開始...");
	// 1. KN5展開
	for (const kn5 of tasks.kn5ToUnpack) {
		console.log(`📦 KN5展開中: ${kn5.name}`);
		const res = await window.electronAPI.unpackKn5(kn5.path);
		if (res.success) {
			// 💡 path.basename(res.fbxPath) の代わりにこれを使います
			const fileName = res.fbxPath.split(/[\\\/]/).pop();
			tasks.modelFiles.push({
				name: fileName,
				path: res.fbxPath,
				isModel: true
			});
			console.log(`✅ [.kn5] 展開成功、FBXをモデルタスクへ追加: ${fileName}`);
		}
	}
	// 2. ACD展開 (物理フォルダがない時のみ)
if (!tasks.dataDirExists && tasks.acdFile) {
    console.log("📦 [ACD] kunossdk.exe で展開します...");
    const res = await window.electronAPI.unpackAcd(tasks.acdFile.path);
    if (res.success) {
        tasks.dataDirExists = true;

        // 🌟 修正ポイント：展開されたファイルのパスから「dataフォルダ」の場所を記憶する
        if (res.files && res.files.length > 0) {
            const firstFile = res.files;
            if (firstFile.path) {
                // ファイルのフルパスから末尾のファイル名を削って、dataフォルダのパスを取得
                const filePath = firstFile.path.replace(/\\/g, '/');
                window.currentDataFolderPath = filePath.substring(0, filePath.lastIndexOf('/'));
                console.log("📍 [ACD] 展開後の保存先を特定しました:", window.currentDataFolderPath);
            }
            tasks.iniFiles.push(...res.files);
        }
    }
}
	console.log("DEBUG: モデル読み込み開始...");
	// 3. 3Dモデル描写
	for (const model of tasks.modelFiles) {
		if (model.path && typeof window.loadModelByPath === 'function') {
			await window.loadModelByPath(model.path);
		} else {
			await load3DModel(model);
		}
	}
	// data フォルダ、または展開された acd 内に ui フォルダがあればロゴを表示
	if (window.currentDataFolderPath) {
		const dataPath = window.currentDataFolderPath.replace(/\\/g, '/');
		// 親フォルダのパスを渡して badge.png を探しに行かせる [cite: 300]
		const parentPath = dataPath.substring(0, dataPath.lastIndexOf('/'));
		if (typeof window.updateBadgeImage === 'function') {
			window.updateBadgeImage(parentPath);
		}
	}
	// ui_car.json が見つかっていれば適用 [cite: 301]
	if (tasks.uiJson) {
		const uiContent = (tasks.uiJson.content !== undefined) 
			? tasks.uiJson.content 
			: await readTextFile(tasks.uiJson);

		if (typeof window.updateUiCarData === 'function') {
			window.updateUiCarData(uiContent);
		}
	}
	// --- 5.5 スキンギャラリー ---
	if (tasks.skins.length > 0 && typeof window.initSkinGallery === 'function') {
		window.initSkinGallery(tasks.skins);
		console.log(`🖼️ [D&D] ${tasks.skins.length} 個のスキンを検出しました。`);
	}
	// --- 6. ドキュメント内の view.ini (シート位置) を自動取得 ---
	if (window.currentCarDirectoryName && window.electronAPI.readViewIni) {
		console.log("💺 マイドキュメントから視点設定を読み込みます...");
		const viewRes = await window.electronAPI.readViewIni(window.currentCarDirectoryName);
		if (viewRes.success) {
			const parsedView = parseINI(viewRes.content);
			applyIniData('view.ini', parsedView); // 既存の applyIniData で処理
			console.log("✅ 視点設定を適用しました。");
		}
	}
	console.log("DEBUG: INI/LUT解析開始...");
	// --- 7. 設定ファイルの解析 (INI/LUT) ---
	for (const ini of tasks.iniFiles) {
		// ファイルサイズが0の場合や、FBX展開時に生成される不要ファイル(.fbx.ini)は読み飛ばす
		if (ini.size === 0 || (ini.name && ini.name.toLowerCase().includes('.fbx.ini'))) {
			// console.warn(`⚠️ [SKIP] 読み取り不可または不要なファイルをスキップします: ${ini.name}`);
			continue;
		}
		// 空ファイル対策を施した安定版 [cite: 874, 929]
		const content = (ini.content !== undefined) ? ini.content : await readTextFile(ini);
		if (ini.name.toLowerCase().endsWith('.lut')) {
			if (ini.name.toLowerCase() === 'power.lut' && typeof window.parsePowerLut === 'function') {
				window.parsePowerLut(content);
			}
			continue;
		}
		const parsedData = parseINI(content);
		applyIniData(ini.name, parsedData);
	}
	console.log("DEBUG: 全工程終了、関数を抜けます");
	// すべて終わったらスペック表を最終更新 [cite: 143]
	if (typeof window.updateSpecsFromPhysics === 'function') {
		window.updateSpecsFromPhysics();
	}
	console.log("✅ 全ての工程が正常に完了しました。");
}
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
// ★LIVE SYNC スイッチの初期化（グローバルで管理）
document.addEventListener('DOMContentLoaded', () => {
	initBadgeHandler();
	const liveSyncSwitch = document.getElementById('liveSyncSwitch');
	if (liveSyncSwitch) {
		liveSyncSwitch.addEventListener('change', (e) => {
			if (e.target.checked) {
				// ONにした時：
				// 1. バックアップをとる
				window.syncBackupData = JSON.parse(JSON.stringify(window.currentSetupData));
				// 2. ★即座に書き出しを実行
				if (typeof window.triggerLiveSync === 'function') {
					window.triggerLiveSync();
				}
			} else if (window.syncBackupData) {
				// OFFにした時：バックアップから復元
				window.currentSetupData = JSON.parse(JSON.stringify(window.syncBackupData));
				if (typeof window.initSetupEditor === 'function') {
					window.initSetupEditor(window.currentSetupData);
				}
			}
			if (typeof window.updateSpecsFromPhysics === 'function') {
					window.updateSpecsFromPhysics();
			}
		});
	}
});
// 他のINI（car.ini, tyres.ini等）も同様に applyIniData を通すように統一
//二重読み込みーーーーーーーーーーーーーーーーーーーーーーーーー
// すべてのファイル入力を一括で監視する「統合センター」
document.addEventListener('DOMContentLoaded', () => {
	const fileInputIds = ['suspensionFile', 'tyreFile', 'carFile', 'collidersFile', 'aeroFile', 'engineFile', 'lutFile', 'drivetrainFile', 'setupFile', 'importFile'];
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
	// =========================================================
	// ★追加: 画面全体（window）でのドラッグ＆ドロップ監視
	// =========================================================
	window.addEventListener('dragover', (e) => {
		e.preventDefault(); // これがないとドロップが許可されない
	});
	window.addEventListener('drop', async (e) => {
		e.preventDefault();
		const files = e.dataTransfer.files;
		if (files && files.length > 0) {
			try {
				window.isMultiUploading = true;
				await handleMultiFileUpload(Array.from(files));
			} catch (err) {
				console.error("Drop import failed:", err);
			} finally {
				// 成功しても失敗しても、必ず false に戻す
				window.isMultiUploading = false;
			}
		}
	});
	// まとめてアップロード（マルチ）用の処理
	const multiFileInput = document.getElementById('multiFileUpload');
	if (multiFileInput) {
		// multiFileInput.addEventListener('change', async (e) => {
		// 	window.isMultiUploading = true;
		// // ★追加：LIVE SYNC の ON/OFF 切り替え時のデータ復元処理
		// 	const liveSyncSwitch = document.getElementById('liveSyncSwitch');
		// 	if (liveSyncSwitch) {
		// 		liveSyncSwitch.addEventListener('change', (e) => {
		// 			if (e.target.checked) {
		// 				// ONにした時：現在のデータをバックアップとして保存
		// 				window.syncBackupData = JSON.parse(JSON.stringify(window.currentSetupData));
		// 			} else if (window.syncBackupData) {
		// 				// OFFにした時：保存しておいたデータを復元
		// 				window.currentSetupData = JSON.parse(JSON.stringify(window.syncBackupData));
		// 				// エディタのUIを再読み込み
		// 				if (typeof window.initSetupEditor === 'function') {
		// 					window.initSetupEditor(window.currentSetupData);
		// 				}
		// 			}
		// 		});
		// 	}
		// const files = Array.from(e.target.files);
		// ★修正：ここでは一括でパスを記憶せず（3Dモデルのパスを誤認するのを防ぐため）、
		// 上記の handleMultiFileUpload 内でデータファイルごとに記憶するように処理を移動しました。
		// handleMultiFileUpload を直接呼び出し、一括処理を開始する
		// 	await handleMultiFileUpload(files);
		// 	window.isMultiUploading = false;
		// 	e.target.value = ''; // 選択をリセット
		// });
		multiFileInput.addEventListener('change', async (e) => {
			const files = Array.from(e.target.files);
			try {
				window.isMultiUploading = true;
				await handleMultiFileUpload(files);
			} catch (err) {
				console.error("Multi upload failed:", err);
			} finally {
				window.isMultiUploading = false;
				e.target.value = ''; // 選択をリセット
			}
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
		if (key === 'drivetrain' && window.activeDrivetrainTab === 'FINAL') {
			window.modifiedStatus.final = true;
		}
		// ★ここを追加：変更を検知した瞬間にサイドバーの表示（*マーク）を更新する
		if (typeof window.updateProjectSidebar === 'function') {
			window.updateProjectSidebar();
		}
	}
	// 2. 特殊なケース（power.lut のテキストエリア）を個別にチェック
	// これを if(key) の外に出すことで、確実に検知させます
	if (target.id === 'power-lut-textarea') {
		if (window.modifiedStatus) {
			window.modifiedStatus.lut = true;
			console.log(`📝 [LOG] 編集を検知しました: lut (Textarea)`);
		}
	}
	// ★提案：編集があったので、LIVE SYNC が有効なら書き出しを実行する
	if (typeof window.triggerLiveSync === 'function') {
		window.triggerLiveSync();
	}
});
const exportFiles = [{
		id: 'suspension',
		name: 'suspensions.ini',
		func: window.downloadSuspensionIni
	}, {
		id: 'car',
		name: 'car.ini',
		func: window.downloadCarIni
	},
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
window.EXPORT_CONFIG = [{
	id: 'suspensions',
	name: 'suspensions.ini',
	func: 'downloadSuspensionIni'
}, {
	id: 'car',
	name: 'car.ini',
	func: 'downloadCarIni'
}, {
	id: 'view',
	name: 'view.ini',
	func: 'downloadViewIni'
}, {
	id: 'dash_cam',
	name: 'dash_cam.ini',
	func: 'downloadDashCamIni'
}, {
	id: 'tyres',
	name: 'tyres.ini',
	func: 'downloadTyreIni'
}, {
	id: 'colliders',
	name: 'colliders.ini',
	func: 'downloadCollidersIni'
}, {
	id: 'aero',
	name: 'aero.ini',
	func: 'downloadAeroIni'
}, {
	id: 'engine',
	name: 'engine.ini',
	func: 'downloadEngineIni'
}, {
	id: 'lut',
	name: 'power.lut',
	func: 'downloadPowerLut'
}, {
	id: 'drivetrain',
	name: 'drivetrain.ini',
	func: 'downloadDrivetrainIni'
}, {
	id: 'final',
	name: 'final.rto',
	func: 'downloadFinalRto'
}, {
	id: 'setup',
	name: 'setup.ini',
	func: 'downloadSetupIni'
},{
	id: 'ui_car',
	name: 'ui_car.json',
	func: 'downloadUiCarData'
},{
	id: 'cameras',
	name: 'cameras.ini',
	func: 'downloadCamerasIni'
}, {
	id: 'mirrors',
	name: 'mirrors.ini',
	func: 'downloadMirrorsIni'
}];
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
		if (overwriteText) {
			overwriteText.textContent = 'OFF';
			overwriteText.className = 'status-text off';
		}
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
			<span class="switch-label">${file.name}</span>
			<div class="export-select_box">
				${isModified ? '<span class="modified-badge">MODIFIED</span>' : ''}
				<label class="toggle-switch">
					<input type="checkbox" id="check-${file.id}" ${isModified ? 'checked' : ''}>
					<span class="toggle-slider round"></span>
				</label>
			</div>
		`;
		listContainer.appendChild(div);
	});
	document.getElementById('exportModal').style.display = 'flex';
};