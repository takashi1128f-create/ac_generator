// js/camera.js
// --- 1. カメラ関連の変数・定数定義（model.js より移設） ---
window.NUM_CAMERAS = 6;
window.cameraConfigs = [];
window.initialConfigs = [];
window.originalRawData = Array.from({
	length: window.NUM_CAMERAS
}, () => ({}));
window.scenes = [];
window.renderers = [];
window.cameras = [];
window.currentModels = [];
window.groundMeshes = [];
// --- 2. ワークベンチ・UI制御（model_app.js より移設・関数化） ---
window.initCameraUI = function() {
	const workbench = document.getElementById('camera-sections-container');
	const previewOuter = document.querySelector('.preview_outer_box');
	// カメラセクションのみを監視対象（サスペンションを除外）
	const cameraSections = Array.from(document.querySelectorAll('.camera-section')).filter(sec => sec.id !== 'section-suspension');
	const section0 = document.getElementById('section-0');
	// 初期状態で section-0 をワークベンチへ
	if (section0 && workbench) {
		workbench.appendChild(section0);
		if (typeof window.resizeAll === 'function') window.resizeAll();
	}
	cameraSections.forEach(section => {
		section.addEventListener('click', function() {
			// すでにワークベンチ内にある場合は何もしない
			if (workbench.contains(this)) return;
			// ワークベンチに何か入っていれば元の場所（previewOuter）へ戻す
			const currentInWorkbench = workbench.firstElementChild;
			if (currentInWorkbench && previewOuter) {
				previewOuter.appendChild(currentInWorkbench);
			}
			// クリックしたセクションをワークベンチへ移動
			workbench.appendChild(this);
			// 移動後に全カメラのサイズを再計算
			if (typeof window.resizeAll === 'function') {
				window.resizeAll();
			}
		});
	});
};
// --- カメラ情報表示の更新（model.js または model_app.js から移設） ---
window.updateCameraInfo = function() {
	if (!window.camera) return;
	const p = window.camera.position;
	const r = window.camera.rotation;
	const posDisp = document.getElementById('cam-pos');
	const rotDisp = document.getElementById('cam-rot');
	if (posDisp) {
		posDisp.textContent = `X:${p.x.toFixed(3)} Y:${p.y.toFixed(3)} Z:${p.z.toFixed(3)}`;
	}
	const toDeg = (rad) => (rad * 180 / Math.PI).toFixed(2);
	if (rotDisp) {
		rotDisp.textContent = `P:${toDeg(r.x)} Y:${toDeg(r.y)} R:${toDeg(r.z)}`;
	}
};
// --- cameras.ini のテキストを解析して反映する関数 ---
window.parseCamerasINI = function(text) {
	const lines = text.split(/\r?\n/);
	let currentCameraIdx = -1;
	lines.forEach(line => {
		line = line.trim();
		if (line.startsWith('[') && line.endsWith(']')) {
			const section = line.substring(1, line.length - 1);
			if (section.startsWith('CAMERA_')) {
				currentCameraIdx = parseInt(section.split('_')[1]);
			}
		} else if (currentCameraIdx >= 0 && currentCameraIdx < window.NUM_CAMERAS) {
			const [key, value] = line.split('=').map(s => s?.trim());
			if (key && value) {
				// 数値変換して保存
				const numValue = parseFloat(value);
				window.originalRawData[currentCameraIdx][key] = isNaN(numValue) ? value : numValue;
				// 既存の cameraConfigs（Three.js用）に反映させるロジックがここに入る
				// 例: if (key === 'POSITION') window.cameraConfigs[currentCameraIdx].position = ...
			}
		}
	});
	// console.log('[camera.js] cameras.ini のパースが完了しました:', window.originalRawData);
};