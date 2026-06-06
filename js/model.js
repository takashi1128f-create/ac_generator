import * as THREE from 'three';
import {
	GLTFLoader
} from 'three/addons/loaders/GLTFLoader.js';
import {
	FBXLoader
} from 'three/addons/loaders/FBXLoader.js';
import {
	DDSLoader
} from 'three/addons/loaders/DDSLoader.js';
import {
	load3DModel
} from './import.js';
window.THREE = THREE;
//画面の再描画が必要かどうかを判定するフラグ。
window.needsUpdate = true;
//デバック用ボタン設定
document.addEventListener('click', (e) => {
	if (e.target.classList.contains('reset-btn')) {
		const id = e.target.dataset.id;
		// ★追加：IDが設定されていないボタン（GENERATE .INIなど）は無視する
		if (id === undefined) return;
		if (window.initialConfigs[id]) {
			cameraConfigs[id] = JSON.parse(JSON.stringify(initialConfigs[id]));
			updateUIFromConfig(id);
			requestRender();
		}
	}
});
//モデルの基本色（暗いグレー）。
let modelBaseColor = 0x4d4d4d;
//特定のサスペンション動作を確認するための専用設定です。
//サスペンション確認用の独立したシーンとカメラ。
let suspensionScene;
let suspensionCamera;
let suspensionRenderer;
let suspensionModel;
let suspensionGround;
//サスペンションの構造線などの描画情報を一時保存（キャッシュ）するためのオブジェクト。
let suspensionLineCache = {};
//衝突判定（コライダー）を視覚的に確認するためのヘルパー。
let colliderHelper = null;

function init() {
	// ★追加：床用テクスチャの読み込みとタイル状（リピート）設定
	const loader = new THREE.TextureLoader();
	const floorTexture = loader.load('image/asphalt.jpg');
	floorTexture.wrapS = THREE.RepeatWrapping;
	floorTexture.wrapT = THREE.RepeatWrapping;
	// 50m四方に対して10回繰り返す設定（1枚あたり5m四方になり自然に見えます）
	floorTexture.repeat.set(10, 10);
	floorTexture.colorSpace = THREE.SRGBColorSpace;
	//6つのカメラ・シーンのループ生成
	for (let i = 0; i < NUM_CAMERAS; i++) {
		//設定の保存: cameraConfigs に初期位置（y=1, fov=60など）を格納し、リセット用に initialConfigs へコピーを保存します。
		cameraConfigs[i] = {
			x: 0,
			y: 1,
			z: 0,
			rx: 0,
			ry: 0,
			rz: 0,
			fov: 60
		};
		initialConfigs[i] = JSON.parse(JSON.stringify(cameraConfigs[i]));
		//各ビューごとの3D空間。
		const scene = new THREE.Scene();
		scenes.push(scene);
		if (i === 0) window.scene = scene;
		const cam = new THREE.PerspectiveCamera(75, 16 / 9, 0.01, 2000);
		cameras.push(cam);
		const canvas = document.getElementById(`canvas-${i}`);
		if (canvas) {
			const renderer = new THREE.WebGLRenderer({
				canvas: canvas,
				antialias: true,
				alpha: true
			});
			renderer.outputColorSpace = THREE.SRGBColorSpace;
			renderer.toneMapping = THREE.ACESFilmicToneMapping;
			renderers.push(renderer);
		}
		const planeSize = 50;
		const planeGeo = new THREE.PlaneGeometry(planeSize, planeSize);
		// ★変更：colorをmap(画像)に変更し、roughnessを1.0にしてマット（つや消し）に設定
		const planeMat = new THREE.MeshStandardMaterial({ 
			map: floorTexture, 
			roughness: 1.0, 
			metalness: 0.0, 
			side: THREE.DoubleSide 
		});
		const ground = new THREE.Mesh(planeGeo, planeMat);
		ground.rotation.x = -Math.PI / 2;
		scene.add(ground);
		groundMeshes.push(ground);
		// 各シーンにライトを追加
		scene.add(new THREE.AmbientLight(0xffffff, 1.2));
		const sun = new THREE.DirectionalLight(0xffffff, 1.5);
		sun.position.set(5, 10, 7.5);
		scene.add(sun);
		updateUIFromConfig(i);
	}
	// --- サスペンション用シーン・カメラの初期化 ---
	window.suspensionScene = new THREE.Scene();
	suspensionScene = window.suspensionScene;
	window.suspensionCamera = new THREE.PerspectiveCamera(60, 1, 0.01, 2000);
	suspensionCamera = window.suspensionCamera;
	window.camera = suspensionCamera; // model_app.jsからの操作を許可
	suspensionCamera.position.set(3, 2, 5);
	suspensionCamera.lookAt(0, 0, 0);
	const suspCanvas = document.getElementById('canvas-suspension');
	if (suspCanvas) {
		suspensionRenderer = new THREE.WebGLRenderer({
			canvas: suspCanvas,
			antialias: true,
			alpha: true
		});
		suspensionRenderer.outputColorSpace = THREE.SRGBColorSpace;
	}
	suspensionScene.add(new THREE.AmbientLight(0xffffff, 1.0));
	const suspSun = new THREE.DirectionalLight(0xffffff, 1.2);
	suspSun.position.set(5, 10, 7.5);
	suspensionScene.add(suspSun);
	const planeGeo = new THREE.PlaneGeometry(50, 50);
	// ★変更：ここもテクスチャを適用し、マットな質感に設定
	const planeMat = new THREE.MeshStandardMaterial({ 
		map: floorTexture, 
		roughness: 1.0, 
		metalness: 0.0, 
		side: THREE.DoubleSide 
	});
	suspensionGround = new THREE.Mesh(planeGeo, planeMat);
	suspensionGround.rotation.x = -Math.PI / 2;
	suspensionScene.add(suspensionGround);
	//スライダーなどを設定している項目
	setupDialControls();
	setupSliderControls();
	setupRightClickReset();
	resizeAll();
	if (typeof window.initModelApp === 'function') {
		window.initModelApp();
	}
	// ★追加：起動時に背景画像を自動読み込みする
	autoLoadDefaultSky();
}
// --- 背景画像の自動読み込み機能 ---
function autoLoadDefaultSky() {
	const localSkyPath = 'image/sky.jpg';
	const loader = new THREE.TextureLoader();

	loader.load(localSkyPath, (texture) => {
		// パノラマ（球状）表示と色味の最適化
		texture.mapping = THREE.EquirectangularReflectionMapping;
		texture.colorSpace = THREE.SRGBColorSpace;

		// 1. サスペンションシーン（メイン3D空間）に適用
		if (typeof suspensionScene !== 'undefined' && suspensionScene) {
			suspensionScene.background = texture;
			suspensionScene.environment = null; 
		}

		// 2. 6つのカメラプレビュー用シーンすべてに適用
		if (window.scenes && window.scenes.length > 0) {
			window.scenes.forEach(scene => {
				scene.background = texture;
				scene.environment = null;
			});
		}

		// 3. 画面を再描画して反映
		if (typeof requestRender === 'function') {
			requestRender();
		}
		console.log("Panoramic background 'sky.jpg' has been auto-loaded to all scenes.");
	});

	// CSS側の背景設定（3D描画前の隙間埋め用）
	document.querySelectorAll('.preview-area').forEach(el => {
		el.style.backgroundImage = `url(${localSkyPath})`;
		el.style.backgroundSize = 'cover';
		el.style.backgroundPosition = 'center';
		el.style.backgroundColor = 'transparent'; // 背景色は不要なので透明に
	});
}
//カメラの部分のエディターをマウスクリックでリセット
function setupRightClickReset() {
	document.addEventListener('contextmenu', (e) => {
		const target = e.target;
		const slider = target.closest('.input-range');
		const dial = target.closest('.dial-container');
		if (slider || dial) {
			e.preventDefault();
			const element = slider || dial;
			const id = element.dataset.id;
			const prop = element.dataset.prop;
			let defaultValue = 0;
			if (prop === 'y') defaultValue = 1;
			else if (prop === 'fov') defaultValue = 60;
			cameraConfigs[id][prop] = defaultValue;
			updateUIFromConfig(id);
			requestRender();
		}
	});
}
//マウス操作でCAMERAのエディター操作
function setupDialControls() {
	let isDragging = false;
	let startX = 0;
	let startValue = 0;
	let targetElement = null;
	document.addEventListener('mousedown', (e) => {
		const container = e.target.closest('.dial-container');
		if (container) {
			isDragging = true;
			startX = e.clientX;
			targetElement = container;
			const id = targetElement.dataset.id;
			const prop = targetElement.dataset.prop;
			startValue = cameraConfigs[id][prop];
			document.body.style.cursor = 'ew-resize';
		}
	});
	document.addEventListener('mousemove', (e) => {
		if (!isDragging || !targetElement) return;
		const id = targetElement.dataset.id;
		const prop = targetElement.dataset.prop;
		const diff = e.clientX - startX;
		let sensitivity = 0.2;
		if (prop === 'ry' || prop === 'rx') {
			cameraConfigs[id][prop] = startValue - (diff * sensitivity);
		} else {
			cameraConfigs[id][prop] = startValue + (diff * sensitivity);
		}
		updateUIFromConfig(id);
		requestRender();
	});
	document.addEventListener('mouseup', () => {
		isDragging = false;
		targetElement = null;
		document.body.style.cursor = 'default';
	});
}
//スライダー（<input type="range">）を動かした際の数値をカメラ設定に反映させる処理を実装しています。
//先ほどのダイヤル操作（setupDialControls）と似ていますが、こちらはブラウザ標準のスライダーの動きに連動しています。
function setupSliderControls() {
	//documentでスライダーをドラッグして動かしている最中、値が変化するたびにリアルタイムで実行されます。
	document.addEventListener('input', (e) => {
		if (e.target.classList.contains('input-range')) {
			const id = e.target.dataset.id;
			const prop = e.target.dataset.prop;
			let val = parseFloat(e.target.value);
			if (prop === 'x' || prop === 'rx') {
				//スライダーの向き調整。
				cameraConfigs[id][prop] = -val;
			} else {
				cameraConfigs[id][prop] = val;
			}
			//updateUIFromConfig(id) を呼び出し、変更された値を数値表示用のラベルなどに反映します。
			updateUIFromConfig(id);
			//requestRender() を呼び出し、3Dシーンを新しいカメラ設定で再描画します。
			requestRender();
		}
	});
}
//サスペンションでのカメラ操作
function updateUIFromConfig(id) {
	const c = cameraConfigs[id];
	if (!c) return;
	const inputs = {
		z: document.querySelector(`.input-z[data-id="${id}"]`),
		y: document.querySelector(`.input-y[data-id="${id}"]`),
		x: document.querySelector(`.input-x[data-id="${id}"]`),
		rx: document.querySelector(`.input-rx[data-id="${id}"]`),
		fov: document.querySelector(`.input-fov[data-id="${id}"]`)
	};
	if (inputs.z) {
		inputs.z.value = c.z;
		const disp = inputs.z.closest('.control-group')?.querySelector('.val-z');
		if (disp) disp.textContent = c.z.toFixed(3);
	}
	if (inputs.y) {
		inputs.y.value = c.y;
		const disp = inputs.y.closest('.control-group')?.querySelector('.val-y');
		if (disp) disp.textContent = c.y.toFixed(3);
	}
	if (inputs.x) {
		inputs.x.value = -c.x;
		const disp = inputs.x.closest('.control-group')?.querySelector('.val-x');
		if (disp) disp.textContent = c.x.toFixed(3);
	}
	if (inputs.rx) {
		inputs.rx.value = -c.rx;
		const disp = inputs.rx.closest('.control-group')?.querySelector('.val-rx');
		if (disp) disp.textContent = c.rx.toFixed(1) + '°';
	}
	if (inputs.fov) {
		inputs.fov.value = c.fov;
		const disp = inputs.fov.closest('.control-group')?.querySelector('.val-fov');
		if (disp) disp.textContent = Math.round(c.fov);
	}
	const dials = document.querySelectorAll(`.dial-container[data-id="${id}"]`);
	dials.forEach(dial => {
		const prop = dial.dataset.prop;
		const val = c[prop];
		const displayVal = val.toFixed(1) + '°';
		const dialValue = dial.querySelector('.dial-value');
		const dialMarks = dial.querySelector('.dial-marks');
		if (dialValue) dialValue.textContent = displayVal;
		if (dialMarks) dialMarks.style.transform = `translateX(${-(val % 360) * 2}px)`;
		const sideDisplay = dial.closest('.control-row')?.querySelector(`.val-${prop}`);
		if (sideDisplay) sideDisplay.textContent = displayVal;
	});
	const cam = cameras[id];
	if (cam) {
		cam.position.set(c.x, c.y, c.z);
		const euler = new THREE.Euler(THREE.MathUtils.degToRad(c.rx), THREE.MathUtils.degToRad(c.ry), THREE.MathUtils.degToRad(c.rz), 'YXZ');
		cam.quaternion.setFromEuler(euler);
		cam.rotateY(Math.PI);
		cam.fov = c.fov;
		cam.updateProjectionMatrix();
	}
}
//requestAnimationFrame を使ったループ）に対して、**「データが変わったから、次のフレームで画面を書き直してね」**と合図を送っています。
function requestRender() {
	needsUpdate = true;
}
window.requestRender = requestRender;
window.handleModelFile = function(file) {
	if (!file) return;
	const fileName = file.name.toLowerCase();
	const url = URL.createObjectURL(file);
	const manager = new THREE.LoadingManager();
	manager.addHandler(/\.dds$/i, new DDSLoader());
	let loader;
	if (fileName.endsWith('.fbx')) {
		loader = new FBXLoader(manager);
	} else {
		loader = new GLTFLoader(manager);
	}
	// 読み込み中のラベルを表示
	for (let i = 0; i < NUM_CAMERAS; i++) {
		const label = document.querySelector(`#preview-${i} .loading-label`);
		if (label) label.style.display = 'block';
	}
	// ★修正：モデルを「1回だけ」読み込んで、それを各シーンにクローンして配る
	loader.load(url, (object) => {
		// 1. まず「大元のモデル（原本）」を取得・調整する
		const originalModel = object.scene ? object.scene : object;
		if (fileName.endsWith('.fbx')) {
			originalModel.scale.setScalar(0.01);
		}
		// 原本に対して1回だけマテリアル（色など）の調整を行う
		applyModelPatches(originalModel);
		// 2. カメラ1〜6（メイン画面）へクローンを配る
		for (let i = 0; i < NUM_CAMERAS; i++) {
			if (currentModels[i]) scenes[i].remove(currentModels[i]);
			// ★ここが魔法のコード：原本の形だけをコピーして軽量化
			const clonedModel = originalModel.clone();
			scenes[i].add(clonedModel);
			currentModels[i] = clonedModel;
			const label = document.querySelector(`#preview-${i} .loading-label`);
			if (label) label.style.display = 'none';
		}
		// 3. サスペンション画面へもクローンを配る
		if (suspensionModel) suspensionScene.remove(suspensionModel);
		const suspClonedModel = originalModel.clone();
		suspensionScene.add(suspClonedModel);
		suspensionModel = suspClonedModel;
		if (typeof window.setupSuspensionReferences === 'function') {
			window.setupSuspensionReferences(suspensionModel);
		}
		// 全て配置が終わったら1回だけ描画を更新
		requestRender();
	});
};
//モデルの色調整
function applyModelPatches(model) {
	model.traverse((child) => {
		if (child.isMesh && child.material) {
			const mats = Array.isArray(child.material) ? child.material : [child.material];
			mats.forEach(mat => {
				const meshName = child.name.toLowerCase();
				if (meshName.includes('glass') || meshName.includes('steklo')) {
					mat.transparent = true;
					mat.opacity = 0.0;
					mat.depthWrite = false;
				} else {
					mat.side = THREE.DoubleSide;
					mat.map = null;
					mat.color.set(modelBaseColor);
					mat.roughness = 0.6;
					mat.metalness = 0.2;
					mat.transparent = false;
					mat.depthWrite = true;
				}
				mat.alphaTest = 0.5;
			});
		}
	});
}

function handleIniFile(file) {
	if (!file) return;
	const reader = new FileReader();
	reader.onload = (e) => window.parseIni(e.target.result);
	reader.readAsText(file);
}
//、外部の設定ファイル（.iniファイル）を読み込み、その内容を解析（パース）してカメラの位置や向きを自動設定する機能
window.parseIni = function(data) {
	const lines = data.split(/\r?\n/);
	let currentCam = -1;
	lines.forEach(line => {
		line = line.trim();
		if (line.startsWith('[CAMERA_')) {
			const match = line.match(/\d+/);
			if (match) currentCam = parseInt(match[0]);
		} else if (currentCam >= 0 && currentCam < NUM_CAMERAS) {
			const [key, val] = line.split('=').map(s => s?.trim());
			if (key && val) {
				if (!originalRawData[currentCam]) originalRawData[currentCam] = {};
				originalRawData[currentCam][key] = val;
			}
		}
	});
	originalRawData.forEach((data, i) => {
		const config = cameraConfigs[i];
		if (!config) return;
		if (data.POSITION) {
			const [x, y, z] = data.POSITION.split(',').map(Number);
			config.x = x;
			config.y = y;
			config.z = z;
		}
		if (data.FORWARD && data.UP) {
			const f = data.FORWARD.split(',').map(Number);
			const u = data.UP.split(',').map(Number);
			const forward = new THREE.Vector3(f[0], f[1], f[2]).normalize();
			const up = new THREE.Vector3(u[0], u[1], u[2]).normalize();
			const right = new THREE.Vector3().crossVectors(up, forward).normalize();
			const correctedUp = new THREE.Vector3().crossVectors(forward, right).normalize();
			const m = new THREE.Matrix4().makeBasis(right, correctedUp, forward);
			const euler = new THREE.Euler().setFromRotationMatrix(m, 'YXZ');
			config.rx = THREE.MathUtils.radToDeg(euler.x);
			config.ry = THREE.MathUtils.radToDeg(euler.y);
			config.rz = THREE.MathUtils.radToDeg(euler.z);
		}
		if (data.FOV) config.fov = parseFloat(data.FOV);
		initialConfigs[i] = JSON.parse(JSON.stringify(config));
		updateUIFromConfig(i);
	});
	requestRender();
};
const mColorPicker = document.getElementById('modelColorPicker');
if (mColorPicker) {
	mColorPicker.addEventListener('input', (e) => {
		modelBaseColor = new THREE.Color(e.target.value).getHex();
		currentModels.forEach(model => {
			if (model) applyModelPatches(model);
		});
		if (suspensionModel) {
			applyModelPatches(suspensionModel);
		}
		requestRender();
	});
}
// const bColorPicker = document.getElementById('bgColorPicker');
// if (bColorPicker) {
// 	bColorPicker.addEventListener('input', (e) => {
// 		const color = e.target.value;
// 		document.querySelectorAll('.preview-area').forEach(el => {
// 			el.style.backgroundImage = 'none';
// 			el.style.backgroundColor = color;
// 		});
// 		if (suspensionScene) {
// 			suspensionScene.background = new THREE.Color(color);
// 		}
// 		requestRender();
// 	});
// }
// const bgImgFile = document.getElementById('bgImageFile');
// if (bgImgFile) {
// 	bgImgFile.addEventListener('change', (e) => {
// 		if (e.target.files[0]) {
// 			const url = URL.createObjectURL(e.target.files[0]);
// 			document.querySelectorAll('.preview-area').forEach(el => {
// 				el.style.backgroundImage = `url(${url})`;
// 				el.style.backgroundSize = 'cover';
// 				el.style.backgroundPosition = 'center';
// 			});
// 			if (suspensionScene) {
// 				new THREE.TextureLoader().load(url, (texture) => {
// 					// ★追加：テクスチャを「球状（パノラマ）マッピング」に変更します
// 					texture.mapping = THREE.EquirectangularReflectionMapping;
// 					// ★追加：画像の色味を正しく表示するための設定です
// 					texture.colorSpace = THREE.SRGBColorSpace;

// 					suspensionScene.background = texture;
// 					suspensionScene.environment = null;
// 					requestRender();
// 				});
// 			}
// 		}
// 	});
// }
const mFile = document.getElementById('modelFile');
if (mFile) {
	mFile.addEventListener('change', (e) => {
		if (e.target.files[0]) handleModelFile(e.target.files[0]);
	});
}
const iFile = document.getElementById('importFile');
if (iFile) iFile.addEventListener('change', (e) => {
	if (e.target.files[0]) handleIniFile(e.target.files[0]);
});
const dlBtn = document.getElementById('downloadBtn');
if (dlBtn) {
	dlBtn.addEventListener('click', () => {
		let res = "";
		cameraConfigs.forEach((c, id) => {
			const cam = cameras[id];
			const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
			const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
			const data = originalRawData[id] || {};
			const name = data.NAME || `F6-${id+1}`;
			const exposure = data.EXPOSURE || 40;
			const sound = data.EXTERNAL_SOUND !== undefined ? data.EXTERNAL_SOUND : 1;
			res += `[CAMERA_${id}]\n`;
			res += `NAME=${name}\n`;
			res += `POSITION=${c.x.toFixed(6)},${c.y.toFixed(6)},${c.z.toFixed(6)}\n`;
			res += `FORWARD=${fwd.x.toFixed(6)},${fwd.y.toFixed(6)},${fwd.z.toFixed(6)}\n`;
			res += `UP=${up.x.toFixed(6)},${up.y.toFixed(6)},${up.z.toFixed(6)}\n`;
			res += `FOV=${Math.round(c.fov)}\n`;
			res += `EXPOSURE=${exposure}\n`;
			res += `EXTERNAL_SOUND=${sound}\n\n`;
		});
		const a = document.createElement('a');
		a.href = URL.createObjectURL(new Blob([res], {
			type: 'text/plain'
		}));
		a.download = 'cameras.ini';
		a.click();
	});
}

function resizeAll() {
	for (let i = 0; i < NUM_CAMERAS; i++) {
		const preview = document.getElementById(`preview-${i}`);
		if (preview && renderers[i]) {
			renderers[i].setSize(preview.clientWidth, preview.clientWidth * (9 / 16), false);
		}
	}
	const suspPreview = document.getElementById('preview-suspension');
	if (suspPreview && suspensionRenderer) {
		const width = suspPreview.clientWidth;
		const height = width * (9 / 16);
		suspensionRenderer.setSize(width, height, false);
		suspensionCamera.aspect = width / height;
		suspensionCamera.updateProjectionMatrix();
	}
	requestRender();
}

function animate() {
	requestAnimationFrame(animate);
	if (needsUpdate) {
		// ★最適化：現在表示されているタブをチェックし、見えているものだけを処理する
		const cameraTab = document.getElementById('camera-content');
		const suspensionTab = document.getElementById('suspension-content');
		// tab-hidden クラスを持っていない（＝表示されている）かを確認
		const isCameraVisible = cameraTab && !cameraTab.classList.contains('tab-hidden');
		const isSuspensionVisible = suspensionTab && !suspensionTab.classList.contains('tab-hidden');
		// 1. サスペンションの重い計算は、サスペンション画面が見えている時だけ実行
		if (isSuspensionVisible) {
			if (typeof window.updateSuspensionVisuals === 'function' && window.currentSuspensionData) {
				try {
					window.updateSuspensionVisuals(window.currentSuspensionData);
				} catch (e) {
					console.error("Suspension Visual Update Error:", e);
				}
			}
		}
		// 2. カメラタブが表示されている時だけ、6つのカメラを描画する
		if (isCameraVisible) {
			for (let i = 0; i < NUM_CAMERAS; i++) {
				if (renderers[i] && scenes[i] && cameras[i]) {
					renderers[i].render(scenes[i], cameras[i]);
				}
			}
		}
		// 3. サスペンションタブが表示されている時だけ、サスペンション画面を描画する
		if (isSuspensionVisible) {
			if (suspensionRenderer && suspensionScene && suspensionCamera) {
				suspensionRenderer.render(suspensionScene, suspensionCamera);
			}
		}
		// 描画が終わったらフラグを戻す
		needsUpdate = false;
	}
}
window.addEventListener('resize', resizeAll);
init();
animate();
window.resizeAll = resizeAll;
// --- model.js の 397行目付近 (let currentModel = null;) から最後までを差し替え ---
let currentModel = null;
// ★修正ポイント：関数を外（グローバル領域）に出し、アップロード時に必ず実行できるようにする
window.setupSuspensionReferences = function(model) {
	if (!model) return;
	if (window.suspensionObjects) {
		Object.values(window.suspensionObjects).forEach(obj => {
			if (obj && window.suspensionScene) {
				window.suspensionScene.remove(obj);
			}
		});
	}
	window.suspensionParts = {
		LF: null,
		RF: null,
		LR: null,
		RR: null
	};
	window.suspensionObjects = {
		LF: null,
		RF: null,
		LR: null,
		RR: null
	};
	window.model3Dwheel = {
		LF: 0,
		RF: 0,
		LR: 0,
		RR: 0
	};
	window.model3DwheelFront = 0;
	window.model3DwheelRear = 0;
	window.suspensionModel = model;
	window.suspensionBodyPos = model.position.clone();
	const wheelObjects = [];
	model.traverse(child => {
		if (child.name.startsWith('WHEEL_')) {
			wheelObjects.push(child);
		}
	});
	wheelObjects.forEach(child => {
		const key = child.name.replace('WHEEL_', '');
		child.updateMatrixWorld(true);
		const worldPos = new THREE.Vector3();
		child.getWorldPosition(worldPos);
		window.suspensionParts[key] = worldPos.clone();
		const box = new THREE.Box3().setFromObject(child);
		const offset = box.min.y - worldPos.y;
		window.model3Dwheel[key] = offset;
		// console.log(`[MODEL CHECK] Node: ${child.name}, LocalY: ${child.position.y.toFixed(4)}`);
		window.suspensionScene.attach(child);
		window.suspensionObjects[key] = child;
	});
	window.model3DwheelFront = -(window.model3Dwheel.LF + window.model3Dwheel.RF) / 2;
	window.model3DwheelRear = -(window.model3Dwheel.LR + window.model3Dwheel.RR) / 2;
	window.model3DwheelFrontLo = -Math.min(window.model3Dwheel.LF, window.model3Dwheel.RF);
	window.model3DwheelRearLo = -Math.min(window.model3Dwheel.LR, window.model3Dwheel.RR);
	window.model3DwheelFrontHi = -Math.max(window.model3Dwheel.LF, window.model3Dwheel.RF);
	window.model3DwheelRearHi = -Math.max(window.model3Dwheel.LR, window.model3Dwheel.RR);
	window.model3DwheelTotal = (window.model3DwheelFront + window.model3DwheelRear) / 2;
	// console.log("[MODEL] 3Dモデルの基準座標がセットされました。ホイール平均:", window.model3DwheelTotal);
};
window.loadModelByPath = async function(path) {
	if (!path) return;
	console.log("[MODEL] プロジェクトからモデルを復元します（安全ルート）:", path);
	try {
		// 1. preload.js 経由で裏側にファイルの読み込みを依頼する（ブラウザの防壁を回避）
		if (!window.electronAPI || typeof window.electronAPI.readModelFile !== 'function') {
			throw new Error("window.electronAPI.readModelFile が定義されていません。preload.jsを確認してください。");
		}
		const arrayBuffer = await window.electronAPI.readModelFile(path);
		// 2. 取得したバイナリデータからBlobを生成
		const blob = new Blob([arrayBuffer]);
		const fileName = path.split('\\').pop().split('/').pop();
		// 3. 元のロジックと同じ「擬似的なアップロードファイル」を再現
		const file = new File([blob], fileName, {
			type: "model/gltf-binary"
		});
		// 4. model.js 本来の「7画面すべてにモデルを配置する処理」を呼び出す
		if (typeof handleModelFile === 'function') {
			handleModelFile(file);
		}
		// 5. import.js 本来の「パーツの仕分け・解析処理」を呼び出す
		if (typeof load3DModel === 'function') {
			await load3DModel(file);
		} else {
			console.warn("[MODEL] load3DModel が見つかりません。");
		}
		console.log("🏎️ [MODEL] 3Dモデルの安全な復元に成功しました！");
		// 描画の安定化のため、少し待ってからサスペンションの見た目を最新状態にガチャン！と合わせる
		setTimeout(() => {
			if (typeof window.updateSuspensionVisuals === 'function' && window.currentSuspensionData) {
				window.updateSuspensionVisuals(window.currentSuspensionData);
			}
			if (typeof window.requestRender === 'function') window.requestRender();
		}, 500);
	} catch (error) {
		console.error("[MODEL] モデルデータの復元処理に失敗しました:", error);
	}
};