// 1. THREEの認識
if (typeof THREE !== 'undefined') {
	window.THREE = THREE;
}
//ラインの斜めの線を普通の四角にする関数
window.createEdgeMesh = function(geometry, colorHex) {
	const edges = new THREE.EdgesGeometry(geometry);
	const material = new THREE.LineBasicMaterial({
		color: colorHex,
		depthTest: false
	});
	return new THREE.LineSegments(edges, material);
};
const extractNum = (val) => {
	if (val === undefined || val === null || val === "") return NaN;
	const match = String(val).match(/-?\d*\.?\d+/);
	return match ? parseFloat(match[0]) : NaN;
};
let colliderMesh = null;
let colliderHelper = null;
// 2. ワークベンチ・UI制御
document.addEventListener('DOMContentLoaded', () => {
	if (typeof window.initCameraUI === 'function') {
		window.initCameraUI();
	}
});
// 4. サスペンション描画 (CG_LOCATION, RIM_OFFSET, 表示切替, STRUT/KINGPINを反映)デバック用で設置
// window.suspensionVisibility = {
// 	arms: true,
// 	steer: true,
// 	wheels: true,
// 	rimOffset: true,
// 	collider: true,
// 	tank: true,
// 	wing: true
// };
// すべて true（表示）から false（非表示）に変更します基本はこちらを予定
window.suspensionVisibility = {
	arms: false,
	steer: false,
	wheels: false,
	rimOffset: false,
	collider: false,
	tank: false,
	wing: false
};
// --- ここから追加：位置とピッチの共通計算関数 ---
window.calculateCarAlignmentAtZ = function(worldZ, safeData, carData) {
	const wb = extractNum(safeData?.BASIC?.WHEELBASE) || 2.73;
	const cg = extractNum(safeData?.BASIC?.CG_LOCATION) || 0.5;
	const bYF = extractNum(safeData?.FRONT?.BASEY) || 0;
	const bYR = extractNum(safeData?.REAR?.BASEY) || 0;
	const zFront = (wb * (1 - cg));
	const zRear = (-wb * cg);
	// Z位置の割合とBASEYの補間
	let ratio = 0;
	if (zFront !== zRear) {
		ratio = (zFront - worldZ) / (zFront - zRear);
	}
	const interpolatedBaseY = bYF + (bYR - bYF) * ratio;
	// ピッチ角の計算
	const currentPitch = Math.atan2(bYF - bYR, wb);
	const initialPitchDeg = extractNum(carData?.BASIC?.GRAPHICS_PITCH_ROTATION) || 0;
	const totalPitchAngle = currentPitch + (initialPitchDeg * Math.PI / 180);
	// 基準のホイール高さ
	const baseRadiusY = typeof window.model3DwheelFrontHi !== 'undefined' ? window.model3DwheelFrontHi : 0.3;
	return {
		baseY: interpolatedBaseY,
		pitch: totalPitchAngle,
		radiusY: baseRadiusY
	};
};
window.updateSuspensionVisuals = function(data) {
	const scene = window.suspensionScene || window.scene || (window.app && window.app.scene) || (window.mainApp && window.mainApp.scene);
	const sData = data || window.currentSuspensionData || window.lastParsedData;
	// console.log("[DEBUG] model_3D status:", window.model_3D);
	if (window.model_3D && window.model_3D.WHEEL && window.model_3D.WHEEL.LF) {
		const pos = window.model_3D.WHEEL.LF.position;
		const worldPos = new THREE.Vector3();
		window.model_3D.WHEEL.LF.getWorldPosition(worldPos);
		// console.log(`[DEBUG] WHEEL_LF LocalPos: x:${pos.x}, y:${pos.y}, z:${pos.z}`);
		// console.log(`[DEBUG] WHEEL_LF WorldPos: x:${worldPos.x}, y:${worldPos.y}, z:${worldPos.z}`);
	}
	if (!scene || !sData) return;
	// シーン内の全オブジェクト名を一度だけ出力して名前を特定する
	if (!window._nameCheckDone) {
		scene.traverse(node => {
			if (node.isMesh || node.isGroup) {}
		});
		window._nameCheckDone = true;
	}
	// ここが重要！下の古いコードたちが「data」という名前で動けるようにします
	data = sData;
	const old = scene.getObjectByName("suspensionGuides");
	if (old) scene.remove(old);
	const guideGroup = new THREE.Group();
	guideGroup.name = "suspensionGuides";
	const wb = extractNum(data.BASIC?.WHEELBASE);
	const cg = extractNum(data.BASIC?.CG_LOCATION);
	// 1. まず window.model_3D から WHEEL_LF を取得し、変数 wheelLF に入れる
	const wheelLF = window.model_3D?.WHEEL?.LF;
	// 2. wheelLF が存在しない（まだ読み込まれていない）場合は処理を中断する（ガード）
	if (!wheelLF) return;
	if (isNaN(wb) || isNaN(cg)) return;
	// --- 変更点1：ここで GRAPHICS_OFFSET を先に取得する ---
	let gOffset = {
		x: 0,
		y: 0,
		z: 0
	};
	const offsetStr = window.currentCarData?.BASIC?.GRAPHICS_OFFSET;
	if (offsetStr) {
		const parts = offsetStr.split(',').map(v => extractNum(v.trim()));
		gOffset.x = parts[0] || 0;
		gOffset.y = parts[1] || 0;
		gOffset.z = parts[2] || 0;
	}
	// タイヤ側を動かすため、Z座標の基準に offset.z を足す（正で前へ）
	const zFront = (wb * (1 - cg)) - gOffset.z;
	const zRear = (-wb * cg) - gOffset.z;
	const drawLine = (p1, p2, color, isDashed = false) => {
		if (!p1 || !p2) return;
		let mat;
		if (isDashed) {
			mat = new THREE.LineDashedMaterial({
				color: color,
				dashSize: 0.05,
				gapSize: 0.02,
				depthTest: false
			});
		} else {
			mat = new THREE.LineBasicMaterial({
				color: color,
				depthTest: false
			});
		}
		const geo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
		const line = new THREE.Line(geo, mat);
		if (isDashed) line.computeLineDistances();
		line.renderOrder = 2000;
		guideGroup.add(line);
		// console.log(`[CHECK 3] drawLine from:`, p1, `to:`, p2);
	};
	const createMarker = (pos, name, originalKey, sectionName) => {
		if (!pos) return;
		const geo = new THREE.SphereGeometry(0.015, 16, 16);
		const mat = new THREE.MeshBasicMaterial({
			color: 0x00ffff,
			depthTest: false
		});
		const mesh = new THREE.Mesh(geo, mat);
		mesh.position.copy(pos);
		mesh.name = name;
		mesh.renderOrder = 3000;
		// ★記憶している「キー」と「セクション(FRONT/REAR等)」の両方が一致した時だけ光らせる
		if (window.hoveredSuspensionKey === originalKey && window.hoveredSuspensionSection === sectionName) {
			mesh.visible = true;
			mesh.scale.set(1.5, 1.5, 1.5);
		} else {
			mesh.visible = false;
		}
		guideGroup.add(mesh);
	};
	// --- 修正版：WIDTHを反映しつつ、角度を固定する drawWheel ---
	const drawWheel = (centerX, centerY, centerZ, side, isFront, rimOffsetValue, camberRad, toeRad, steerRad = 0, kingpinAxis = null, pivotPoint = null) => {
		if (!window.currentTyreData) return;
		const isRimVisible = document.getElementById('check-rim-offset')?.checked;
		const section = isFront ? 'FRONT' : 'REAR';
		const tyre = window.currentTyreData[section];
		if (!tyre) return;
		const scaleValue = (val) => {
			const num = parseFloat(val);
			return (num > 1) ? num / 1000 : num;
		};
		// タイヤの半径と「WIDTH（幅）」を取得
		const radius = scaleValue(tyre.RADIUS);
		const rimRadius = scaleValue(tyre.RIM_RADIUS);
		const width = scaleValue(tyre.WIDTH); // ← これが反映されます
		const tyreGroup = new THREE.Group();
		// グループ自体の位置をハブ（中心）に置く
		tyreGroup.position.set(centerX, centerY, centerZ);
		// リングを作る関数（ここでは回転を一切つけず、位置だけ決める）
		const createRing = (r, offset) => {
			const curve = new THREE.EllipseCurve(0, 0, r, r, 0, 2 * Math.PI, false, 0);
			const points = curve.getPoints(50);
			const geometry = new THREE.BufferGeometry().setFromPoints(points);
			const material = new THREE.LineBasicMaterial({
				color: 0xffffff,
				transparent: true,
				opacity: 0.5
			});
			material.depthTest = false;
			const ring = new THREE.LineLoop(geometry, material);
			ring.renderOrder = 2000;
			// リング単体は常に「真横」を向かせる
			ring.rotation.y = Math.PI / 2;
			// グループの中心から左右に width/2 ずつオフセットする
			ring.position.x = offset * side;
			tyreGroup.add(ring);
		};
		// リングを4つ（外径2本、リム2本）グループに追加
		createRing(radius, width / 2);
		createRing(radius, -width / 2);
		createRing(rimRadius, width / 2);
		createRing(rimRadius, -width / 2);
		// ★ポイント2：グループ全体に対して一括で角度を適用する
		// ACの座標系に合わせて符号を調整（ハの字 = ネガティブキャンバーになるように）
		tyreGroup.rotation.order = 'YXZ';
		tyreGroup.rotation.z = -camberRad * side; // キャンバー角
		tyreGroup.rotation.y = -toeRad * side; // トー角
		// フロントの場合はステアリング切れ角を反映
		// if (isFront && kingpinAxis) {
		//     tyreGroup.rotateOnWorldAxis(kingpinAxis, steerRad);
		// }
		// 最後にシーン（ガイドグループ）に追加
		guideGroup.add(tyreGroup);
		// リムオフセットのライン（これはグループの外、またはハブ基準で描画）
		if (isRimVisible && rimOffsetValue !== undefined && !isNaN(rimOffsetValue)) {
			const offsetAmount = scaleValue(rimOffsetValue);
			const offsetCenterX = centerX + (offsetAmount * side);
			const geo = new THREE.BufferGeometry().setFromPoints([
				new THREE.Vector3(centerX, centerY, centerZ),
				new THREE.Vector3(offsetCenterX, centerY, centerZ)
			]);
			const mat = new THREE.LineBasicMaterial({
				color: 0x00ffff,
				depthTest: false
			});
			const line = new THREE.Line(geo, mat);
			line.renderOrder = 2000;
			guideGroup.add(line);
		}
	};
	const parsePos = (str, isLeft, axleZ, trackWidth, baseY) => {
		if (!str) return null;
		const parts = String(str).split(',').map(p => extractNum(p));
		if (parts.length < 3 || parts.some(isNaN)) return null;
		// 修正：サスペンションの支点も「左がプラス、右がマイナス」の座標系に合わせる
		const wheelX = (isLeft ? (trackWidth / 2) : -(trackWidth / 2)) + gOffset.x;
		const finalX = isLeft ? (wheelX - parts[0]) : (wheelX + parts[0]);
		// wheelRadius固定ではなく、引き渡された3DモデルのY座標(baseY)を使用する
		const finalY = parts[1] + baseY;
		const finalZ = axleZ + parts[2];
		return new THREE.Vector3(finalX, finalY, finalZ);
	};
	const getSuspPoint = (key, isLeft, axleKey, axleZ, trackWidth) => {
		const rawPos = parsePos(data[axleKey][key], isLeft, axleZ, trackWidth);
		const bodyToMove = window.suspensionModel || window.currentModel;
		if (!rawPos || !bodyToMove) return rawPos;
		const sideChar = isLeft ? 'L' : 'R';
		const axleChar = axleKey === 'FRONT' ? 'F' : 'R';
		const suspNodeName = `SUSP_${sideChar}${axleChar}`;
		const suspNode = bodyToMove.getObjectByName(suspNodeName);
		if (suspNode) {
			const worldPos = new THREE.Vector3();
			suspNode.getWorldPosition(worldPos);
			return worldPos;
		} else {
			return rawPos.applyMatrix4(bodyToMove.matrixWorld);
		}
	};
	// ★【修正1】ラインを描画する「前」に車体（エンプティの親）を動かして位置を確定させる
	// ★【修正1】ボディーの原点を「エンプティの高さ」に結びつけ、BASEYとOffsetで制御する
	const bodyToMove = window.suspensionModel || window.currentModel;
	if (bodyToMove) {
		const safeData = sData || window.currentSuspensionData;
		// 1. 車体全体の基準高さを「物理的な中心(Z=0)」で取得
		// XとZのオフセットは固定として扱うため、高さの基準計算にはオフセットを含めません
		const align = window.calculateCarAlignmentAtZ(0, safeData, window.currentCarData);
		// 2. 最終座標の決定
		// X, Z は GRAPHICS_OFFSET をそのまま適用（固定）
		const bX = 0
		const bZ = 0
		// Y は 【ホイール半径】 － 【中心点でのBASEY】 ＋ 【手動オフセット(gOffset.y)】
		// これにより、BASEYの値に応じて車高が上下し、ピッチ角で傾きます
		const bY = align.radiusY - align.baseY + gOffset.y;
		bodyToMove.position.set(bX, bY, bZ);
		bodyToMove.rotation.x = align.pitch;
		bodyToMove.updateMatrixWorld(true);
	}
	[false, true].forEach(isLeft => {
		const axels = [{
			key: 'FRONT',
			z: zFront,
			colorUpper: 0xffffff,
			colorLower: 0x00ff00,
			visible: window.suspensionVisibility.arms
		}, {
			key: 'REAR',
			z: zRear,
			colorUpper: 0xff4444,
			colorLower: 0x44ff44,
			visible: window.suspensionVisibility.arms
		}];
		axels.forEach(axel => {
			const s = data[axel.key];
			if (s) {
				// 変数を let に変更（後で上書きするため）
				let t = extractNum(s.TRACK);
				if (isNaN(t)) return;
				const sideChar = isLeft ? 'L' : 'R';
				const axelChar = axel.key.includes('FRONT') ? 'F' : 'R';
				const wheelKey = sideChar + axelChar;
				let modelY = 0.3;
				const suspensionModel = window.suspensionModel || window.currentModel;
				const parentNodeName = "WHEEL_" + sideChar + axelChar;
				const meshName = "WHEEL" + sideChar.toLowerCase() + axelChar.toLowerCase();
				let wheelNode = null;
				if (suspensionModel) {
					const parentNode = suspensionModel.getObjectByName(parentNodeName);
					if (parentNode) {
						wheelNode = parentNode.getObjectByName(meshName);
					}
				}
				// ★【修正2】エンプティが見つかったら、X・Y・Z すべてを吸い出して強制的に基準にする
				if (wheelNode) {
					const worldPos = new THREE.Vector3();
					wheelNode.getWorldPosition(worldPos);
					modelY = worldPos.y; // Y座標（高さ）を完全一致させる
					// X座標（幅）とZ座標（前後）もエンプティの位置から逆算して上書きする
					t = Math.abs(worldPos.x - gOffset.x) * 2;
					axel.z = worldPos.z;
				} else {
					if (wheelKey === 'LF' || wheelKey === 'RF') {
						if (typeof window.model3DwheelFrontHi !== 'undefined') modelY = window.model3DwheelFrontHi;
					} else if (wheelKey === 'LR' || wheelKey === 'RR') {
						if (typeof window.model3DwheelRearHi !== 'undefined') modelY = window.model3DwheelRearHi;
					}
				}
				// --- 1. ステアリング物理計算セクション ---
				const steerData = (window.currentCarData && window.currentCarData.CONTROLS) ? window.currentCarData.CONTROLS : {};
				const steerRatio = Math.abs(extractNum(steerData.STEER_RATIO)) || 10.0;
				const rodRatio = extractNum(steerData.LINEAR_STEER_ROD_RATIO) || 0.0; // デフォルトは0（動かない）
				const steerLockVal = extractNum(steerData.STEER_LOCK) || 0;
				const steerWheelDeg = window.currentSteerAngle || 0;
				// A. AC物理に基づいたラック移動量 (m)
				// 検証データより：移動量は Ratio で割られ、rodRatio で倍増する
				const rackMoveX = (steerWheelDeg / steerRatio) * rodRatio;
				// B. タイヤ切れ角の初期値
				// フロントかつ幾何学データがある場合は 0 にリセットし、逆算結果のみを採用する
				let tyreSteerRad = 0;
				if (!axel.key.includes('FRONT')) {
					// リアなどのフォールバック用
					tyreSteerRad = -(steerWheelDeg / steerRatio) * (Math.PI / 180);
				}
				// C. 最大切れ角の制限（ラジアン）
				const maxLockRad = (steerLockVal / steerRatio) * (Math.PI / 180);
				// D. キングピン軸と座標の算出
				// 1. 形式の取得
				const type = s.TYPE || 'DWB';
				// 2. STRUT形式かどうかに応じて参照するキーを動的に変更
				const kpTopKey = (type === 'STRUT') ? 'STRUT_CAR' : 'WBTYRE_TOP';
				// ★修正点1: ステアリング回転軸の下側はどちらも WBTYRE_BOTTOM を使用する
				const kpBotKey = 'WBTYRE_BOTTOM';
				// ★重要: 後半の描画処理（アームの線引きなど）でエラーにならないよう、元の変数は消さずに残す
				const topPos = parsePos(s['WBTYRE_TOP'], isLeft, axel.z, t, modelY);
				const botPos = parsePos(s['WBTYRE_BOTTOM'], isLeft, axel.z, t, modelY);
				// キングピン軸自体の算出（ステアリング回転用）
				const kpTopPos = parsePos(s[kpTopKey], isLeft, axel.z, t, modelY);
				const kpBotPos = parsePos(s[kpBotKey], isLeft, axel.z, t, modelY);
				let kpAxis = new THREE.Vector3(0, 1, 0);
				if (kpTopPos && kpBotPos) {
					kpAxis.subVectors(kpTopPos, kpBotPos).normalize();
				}
				// --- 1.5. AC物理完全コピーロジック ---
				let carSteerPos = parsePos(s.WBCAR_STEER, isLeft, axel.z, t, modelY);
				let tyreSteerPos = parsePos(s.WBTYRE_STEER, isLeft, axel.z, t, modelY);
				// ★修正点2: STRUTでは topPos が null になるため、計算開始の判定を kpTopPos と kpBotPos に変更
				if (axel.key.includes('FRONT') && kpTopPos && kpBotPos && carSteerPos && tyreSteerPos) {
					const tieRodLengthSq = carSteerPos.distanceToSquared(tyreSteerPos);
					// 回転中心点 (pivot) を算出
					// ★修正点3: botPos ではなく kpBotPos を基準に回転軌道を計算する
					const vecToTyreSteer = new THREE.Vector3().subVectors(tyreSteerPos, kpBotPos);
					const projectionLength = vecToTyreSteer.dot(kpAxis);
					const pivotPos = new THREE.Vector3().copy(kpAxis).multiplyScalar(projectionLength).add(kpBotPos);
					const r0 = new THREE.Vector3().subVectors(tyreSteerPos, pivotPos);
					const Rsq = r0.lengthSq();
					const crossR0 = new THREE.Vector3().crossVectors(kpAxis, r0);
					// ラック移動の適用
					const movedCarSteerPos = carSteerPos.clone();
					movedCarSteerPos.x += rackMoveX;
					// 幾何学逆算
					const v = new THREE.Vector3().subVectors(pivotPos, movedCarSteerPos);
					const vSq = v.lengthSq();
					const A = 2 * v.dot(r0);
					const B = 2 * v.dot(crossR0);
					const C_val = tieRodLengthSq - vSq - Rsq;
					const hypot = Math.sqrt(A * A + B * B);
					if (hypot > 0 && Math.abs(C_val) <= hypot) {
						const phi = Math.atan2(A, B);
						let alpha1 = Math.asin(C_val / hypot) - phi;
						let alpha2 = Math.PI - Math.asin(C_val / hypot) - phi;
						const normalizeAngle = (a) => {
							while (a > Math.PI) a -= 2 * Math.PI;
							while (a < -Math.PI) a += 2 * Math.PI;
							return a;
						};
						let geomRad = (Math.abs(normalizeAngle(alpha1)) < Math.abs(normalizeAngle(alpha2))) ? normalizeAngle(alpha1) : normalizeAngle(alpha2);
						// タイヤの回転制限STEER_LOCK制限
						// tyreSteerRad = Math.max(-maxLockRad, Math.min(maxLockRad, geomRad));
						// タイヤの回転制限解除
						tyreSteerRad = geomRad;
					}
					// --- 数値表示の更新 (追加) ---
					if (axel.key.includes('FRONT')) {
						const suffix = isLeft ? '_left' : '_right';
						const overlayT = document.getElementById('overlay-steer-t' + suffix);
						const overlayStr = document.getElementById('overlay-steer-str' + suffix);
						if (overlayT && overlayStr) {
							// 1. タイヤの表示角(t)の計算
							// AC仕様：右輪(isLeft=false)の場合は符号を反転させる
							const displayDegT = (isLeft ? tyreSteerRad : -tyreSteerRad) * 180 / Math.PI;
							overlayT.textContent = displayDegT.toFixed(2);
							// 2. 実効ステアリングレシオ(str)の計算
							// AC仕様を再現：ハンドルの絶対値をタイヤの表示角で割る
							let displayStr = 0;
							if (Math.abs(displayDegT) > 0.01) {
								// window.currentSteerAngleの「絶対値」を使うことで
								// タイヤの向き(displayDegT)に合わせてstrの符号が勝手に反転（スワップ）します
								displayStr = Math.abs(window.currentSteerAngle) / displayDegT;
							} else {
								// 直進付近で計算が不安定な場合は、INI設定のレシオをフォールバックとして表示
								const sData = (window.currentCarData && window.currentCarData.STEER) ? window.currentCarData.STEER : {};
								displayStr = parseFloat(sData.STEER_RATIO) || 0;
							}
							overlayStr.textContent = displayStr.toFixed(1);
						}
					}
					// 更新後の座標をセットアップ
					carSteerPos.copy(movedCarSteerPos);
					tyreSteerPos.sub(pivotPos);
					tyreSteerPos.applyAxisAngle(kpAxis, tyreSteerRad);
					tyreSteerPos.add(pivotPos);
				}
				const targetKeys = ['STRUT_CAR', 'STRUT_TYRE', 'WBCAR_BOTTOM_FRONT', 'WBCAR_BOTTOM_REAR', 'WBTYRE_TOP', 'WBTYRE_BOTTOM', 'WBCAR_TOP_FRONT', 'WBCAR_TOP_REAR', 'WBCAR_STEER', 'WBTYRE_STEER', 'J0_CAR', 'J0_AXLE', 'J1_CAR', 'J1_AXLE', 'J2_CAR', 'J2_AXLE', 'J3_CAR', 'J3_AXLE', 'J4_CAR', 'J4_AXLE', 'TORQUE_REACTION'];
				targetKeys.forEach(k => {
					let rawPosData = s[k];
					// AXLEデータは [AXLE] セクションから探す
					if (!rawPosData && (k.startsWith('J') || k === 'TORQUE_REACTION')) {
						if (data['AXLE'] && data['AXLE'][k]) {
							rawPosData = data['AXLE'][k];
						}
					}
					if (rawPosData) {
						const isAxleKey = k.startsWith('J') || k === 'TORQUE_REACTION';
						let pos = null;
						if (isAxleKey) {
							// ★ AXLE専用の座標計算（車体中心からの絶対座標）
							// 既存のリンク描画(drawAxleLinks)と全く同じ計算式を使います
							const parts = String(rawPosData).split(',').map(p => extractNum(p));
							if (parts.length >= 3 && !parts.some(isNaN)) {
								pos = new THREE.Vector3(parts[0] + gOffset.x, parts[1] + modelY, parts[2] + axel.z);
							}
						} else {
							// ★ 従来の DWB / STRUT 用の座標計算（ホイールからの相対座標）
							pos = parsePos(rawPosData, isLeft, axel.z, t, modelY);
						}
						if (pos) {
							const actualSection = isAxleKey ? 'AXLE' : axel.key;
							// AXLEのデータは左右共通（1つだけ）ですが、UI側でLとR両方を検索して
							// 光らせる仕様になっているため、ここでL用とR用を同じ場所に2つ重ねて作っておきます。
							const name = `marker_${actualSection}_${k}_${sideChar}`;
							createMarker(pos, name, k, actualSection);
						}
					}
				});
				// --- 2. サスペンション構造線の描画 ---
				if (axel.visible) {
					// 修正：AXLEではない時だけキングピン軸を描画する
					if (s.TYPE !== 'AXLE' && topPos && botPos) {
						drawLine(topPos, botPos, 0xff00ff, true);
					}
					if (s.TYPE === 'STRUT') {
						// 1. ストラット形式
						drawLine(parsePos(s.STRUT_CAR, isLeft, axel.z, t, modelY), parsePos(s.STRUT_TYRE, isLeft, axel.z, t, modelY), 0x55aaff);
						// 2. ロアアーム（DWBと同じ処理）を追加
						drawLine(parsePos(s.WBCAR_BOTTOM_FRONT, isLeft, axel.z, t, modelY), parsePos(s.WBTYRE_BOTTOM, isLeft, axel.z, t, modelY), axel.colorLower);
						drawLine(parsePos(s.WBCAR_BOTTOM_REAR, isLeft, axel.z, t, modelY), parsePos(s.WBTYRE_BOTTOM, isLeft, axel.z, t, modelY), axel.colorLower);
					} else if (s.TYPE === 'AXLE') {
						// 2. AXLE用の描画：重複を防ぐため、1回だけ一括で描画する
						if (!isLeft) {
							drawAxleLinks(s, axel, t, modelY, drawLine, gOffset.x);
						}
					} else {
						// 3. DWB形式：上下アームを描画
						drawLine(parsePos(s.WBCAR_TOP_FRONT, isLeft, axel.z, t, modelY), parsePos(s.WBTYRE_TOP, isLeft, axel.z, t, modelY), axel.colorUpper);
						drawLine(parsePos(s.WBCAR_TOP_REAR, isLeft, axel.z, t, modelY), parsePos(s.WBTYRE_TOP, isLeft, axel.z, t, modelY), axel.colorUpper);
						drawLine(parsePos(s.WBCAR_BOTTOM_FRONT, isLeft, axel.z, t, modelY), parsePos(s.WBTYRE_BOTTOM, isLeft, axel.z, t, modelY), axel.colorLower);
						drawLine(parsePos(s.WBCAR_BOTTOM_REAR, isLeft, axel.z, t, modelY), parsePos(s.WBTYRE_BOTTOM, isLeft, axel.z, t, modelY), axel.colorLower);
					}
				}
				// --- 3. ステアリングラックとタイロッドの連動 ---
				if (s.TYPE !== 'AXLE' && window.suspensionVisibility.steer && carSteerPos && tyreSteerPos) {
					drawLine(carSteerPos, tyreSteerPos, 0xffff00); // タイロッド（黄色）
				}
				// A. INI設定に基づくX/Z軸の計算
				let wx = (isLeft ? t / 2 : -t / 2) + gOffset.x;
				let wz = axel.z
				// ※高さ(wy)の計算は上で統合したため不要
				const rimOffsetVal = extractNum(s.RIM_OFFSET) || 0;
				const camberRad = (parseFloat(s.STATIC_CAMBER) || 0) * (Math.PI / 180);
				const toeRad = (parseFloat(s.TOE_OUT) || 0) * (Math.PI / 180);
				// --- 追加：GRAPHICS_OFFSETSの取得と適用 ---
				const graphicsOffsets = data.GRAPHICS_OFFSETS || {};
				const wheelOffsetInput = extractNum(graphicsOffsets[`WHEEL_${wheelKey}`]) || 0;
				const suspOffsetInput = extractNum(graphicsOffsets[`SUSP_${wheelKey}`]) || 0;
				// 左側はプラス方向(外側)、右側はマイナス方向(外側)へオフセットを適用
				const visualOffsetX = +wheelOffsetInput;
				const suspVisualOffsetX = +suspOffsetInput;
				if (window.suspensionObjects && window.suspensionObjects[wheelKey]) {
					const obj = window.suspensionObjects[wheelKey];
					// --- 3Dモデルのホイール回転を同期 ---
					if (wheelNode) {
						const quat = new THREE.Quaternion();
						wheelNode.getWorldQuaternion(quat);
						obj.quaternion.copy(quat);
					} else {
						const sideSign = isLeft ? -1 : 1;
						obj.rotation.set(0, (isLeft ? toeRad : -toeRad), camberRad * sideSign, 'YXZ');
					}
					// 物理的なホイール中心 (計算用)
					const wheelCenter = new THREE.Vector3(wx, modelY, wz);
					// 表示上のホイール中心 (オフセットを加味)
					const visualWheelCenter = new THREE.Vector3(wx + visualOffsetX, modelY, wz);
					// if (wheelKey === 'LF') {
					// 	console.log("========== ホイール強制接地 現場検証 (LF) ==========");
					// 	console.log("1. ターゲットの高さ (modelY):", modelY);
					// 	console.log("2. 適用前のホイールY座標 (obj.position.y):", obj.position.y);
					// }
					// ▲▲▲ ログを追加ここまで ▲▲▲
					if (axel.key.includes('FRONT') && botPos && kpAxis) {
						// ★変更: オフセット加味後の位置(visualWheelCenter)から回転軸(botPos)へのベクトルを作成する
						// これにより、離れた位置にあってもキングピン軸を中心に弧を描くように動きます。
						const offset = new THREE.Vector3().subVectors(visualWheelCenter, botPos);
						offset.applyAxisAngle(kpAxis, tyreSteerRad);
						const newPos = new THREE.Vector3().addVectors(botPos, offset);
						obj.position.copy(newPos);
						obj.rotateOnWorldAxis(kpAxis, tyreSteerRad);
					} else {
						// ★変更: ステアリングがない場合はそのまま表示位置へ
						obj.position.copy(visualWheelCenter);
					}
					obj.updateMatrixWorld(true);
					// if (wheelKey === 'LF') {
					// 	console.log("3. 適用後のホイールY座標 (obj.position.y):", obj.position.y);
					// 	console.log("==================================================");
					// }
				}
				// --- ★追加: SUSP_**（サスペンションパーツ）のオフセット ---
				const suspModelToMove = window.suspensionModel || window.currentModel;
				if (suspModelToMove) {
					const suspNodeName = `SUSP_${wheelKey}`;
					const suspObj = suspModelToMove.getObjectByName(suspNodeName);
					if (suspObj) {
						// 無限にズレるのを防ぐため初期のX座標を userData に記憶
						if (suspObj.userData.originalX === undefined) {
							suspObj.userData.originalX = suspObj.position.x;
						}
						suspObj.position.x = suspObj.userData.originalX + suspVisualOffsetX;
						suspObj.updateMatrixWorld(true);
					}
				}
				//ガイドライン(白いリング)の描画だけをチェックボックスで制御する
				if (window.suspensionVisibility.wheels) {
					drawWheel(wx, modelY, wz, (isLeft ? 1 : -1), axel.key.includes('FRONT'), rimOffsetVal, camberRad, toeRad, tyreSteerRad, kpAxis, botPos); // wy を modelY に変更
				}
			}
		});
		// --- ここから追加：燃料タンク(TANK)の3D描画（共通関数版） ---
		if (window.suspensionVisibility.tank && window.currentCarData && window.currentCarData.FUELTANK && window.currentCarData.FUELTANK.POSITION) {
			const tParts = String(window.currentCarData.FUELTANK.POSITION).split(',').map(v => extractNum(v.trim()));
			const maxFuel = extractNum(window.currentCarData.FUEL?.MAX_FUEL) || 60;
			const safeData = sData || window.currentSuspensionData;
			if (tParts.length === 3 && !tParts.some(isNaN) && maxFuel > 0 && safeData) {
				// 1. サイズ計算
				const volume = maxFuel * 0.001;
				const k = Math.pow(volume / 8, 1 / 3);
				const tankGeo = new THREE.BoxGeometry(4 * k, 1 * k, 2 * k);
				const tankMesh = window.createEdgeMesh(tankGeo, 0xffa500);
				// 2. Z位置と共通関数による高さ・角度の取得
				const tZ = tParts[2] - gOffset.z;
				const align = window.calculateCarAlignmentAtZ(tZ, safeData, window.currentCarData);
				// 3. XとYの決定、メッシュの配置
				const tX = tParts[0] + gOffset.x;
				const tY = align.radiusY + tParts[1] - align.baseY;
				tankMesh.position.set(tX, tY, tZ);
				tankMesh.rotation.x = align.pitch;
				tankMesh.renderOrder = 2000;
				guideGroup.add(tankMesh);
			}
		}
		// (※車体位置の更新ブロックは上部に移動済みのためここから削除)
		// --- 救済処置：計算エラーが起きてもラインだけは必ず描画する ---
		if (guideGroup && scene) {
			scene.add(guideGroup);
		}
		needsUpdate = true; // 必要に応じて再描画フラグを立てる
	})
};
// --- AXLE専用描画関数 ---
function drawAxleLinks(s, axel, t, wheelRadius, drawLine, offsetX = 0) {
	// データの参照先を決定（sの中にデータがなければ、AXLEセクションを直接見に行く）
	const axleData = (s && s.J0_CAR) ? s : (window.currentSuspensionData ? window.currentSuspensionData.AXLE : null);
	if (!axleData) {
		console.error("=== AXLE Error: [AXLE] section not found in INI ===");
		return;
	}
	// 1. 車軸の高さ（タイヤ半径）とZ位置
	const centerY = wheelRadius;
	const centerZ = axel.z; // すでにオフセット適用済み
	// 2. 左右のタイヤ中心座標を計算し、結ぶ線（車軸本体）を白で描画
	const pLeft = new THREE.Vector3((-t / 2) + offsetX, centerY, centerZ);
	const pRight = new THREE.Vector3((t / 2) + offsetX, centerY, centerZ);
	drawLine(pLeft, pRight, 0xffffff);
	// console.log("=== AXLE Rendering Start ===");
	// console.log(`Using Data From: ${ (s && s.J0_CAR) ? "REAR section" : "AXLE section" }`);
	// 3. リンクの描画（最大5本）
	for (let i = 0; i < 5; i++) {
		const carKey = `J${i}_CAR`;
		const axleKey = `J${i}_AXLE`;
		const rawCar = axleData[carKey];
		const rawAxle = axleData[axleKey];
		if (rawCar && rawAxle) {
			const getPoint = (str, keyName) => {
				const parts = String(str).split(',').map(p => extractNum(p));
				if (parts.length < 3 || parts.some(isNaN)) return null;
				// 変更点8：中点を基準に配置しつつ、X軸のオフセット(offsetX)を足す
				return new THREE.Vector3(parts[0] + offsetX, parts[1] + centerY, parts[2] + centerZ);
			};
			const pCar = getPoint(rawCar, carKey)
			const pAxle = getPoint(rawAxle, axleKey);
			if (pCar && pAxle) {
				// J4（ラテラルロッド）は黄色、それ以外は緑
				const lineColor = (i === 4) ? 0xffff00 : 0x00ff00;
				drawLine(pCar, pAxle, lineColor)
				// console.log(`  Drawn Link ${i}: ${carKey} to ${axleKey}`);
			}
		}
	}
	// console.log("=== AXLE Rendering End ===");
}
/**suspensions.ini のテキストを解析してオブジェクトに変換する*/
window.parseINI = function(text) {
	const lines = text.split(/\r?\n/);
	let currentSection = null;
	const data = {};
	lines.forEach(line => {
		// 1. 前後の空白を除去
		let processingLine = line.trim();
		// 空行またはコメント行（;開始）はスキップ
		if (!processingLine || processingLine.startsWith(';')) return;
		// 2. セクション名の抽出 [SECTION]
		if (processingLine.startsWith('[') && processingLine.endsWith(']')) {
			currentSection = processingLine.slice(1, -1);
			data[currentSection] = {};
			return;
		}
		// 3. キー=値 の解析
		if (currentSection && processingLine.includes('=')) {
			const parts = processingLine.split('=');
			const key = parts[0].trim();
			// 値の「3段階洗浄」
			// ① セミコロンで分割してコメントを除去
			// ② TAB文字を半角スペースに置換
			// ③ 前後の余計な空白をトリム
			let rawValue = parts.slice(1).join('=');
			let cleanValue = rawValue.split(';')[0].replace(/\t/g, ' ').trim();
			data[currentSection][key] = cleanValue;
		}
	});
	return data;
};
async function initDefaultAssets() {
	try {
		// --- 1. GLBモデルのロードを「待たずに」即座に開始する ---
		// if (typeof window.loadModelByPath === 'function') {
		// 	// awaitを付けないことで、ロード開始だけして次の処理へ進む
		// 	window.loadModelByPath('model/Toyota_JZX100mk2_zawa.glb');
		// }
		// --- 2. 設定ファイルの取得を並列で実行 ---
		const [sRes, cRes] = await Promise.all([
			fetch('model/suspensions.ini'),
			fetch('model/cameras.ini')
		]);
		// --- 3. サスペンションデータの処理 ---
		if (sRes.ok) {
			const text = await sRes.text();
			window.currentSuspensionData = parseINI(text);
			// 3DプレビューとエディターUIに反映
			if (typeof window.updateSuspensionVisuals === 'function') {
				window.updateSuspensionVisuals(window.currentSuspensionData);
			}
			updateSuspensionEditorUI(window.currentSuspensionData);
			// Desmosの初期化
			if (typeof window.initDesmosCalculators === 'function') {
				window.initDesmosCalculators();
				if (typeof window.updateDesmosGraph === 'function') {
					window.updateDesmosGraph('FRONT', window.currentSuspensionData);
					window.updateDesmosGraph('REAR', window.currentSuspensionData);
				}
			}
		}
		// --- 4. カメラデータの処理 ---
		if (cRes.ok) {
			const cameraText = await cRes.text();
			if (typeof window.parseIni === 'function') {
				window.parseIni(cameraText);
			}
		}
	} catch (e) {
		console.error("Auto-load failed:", e);
	}
}
// UI（入力欄）にデータを流し込む関数
window.updateSuspensionEditorUI = function(data) {
	const container = document.getElementById('suspension-data-container');
	const previewArea = document.getElementById('preview-suspension');
	if (!container || !data) return;
	// ★ここから追加：初期起動時でも枠組みを表示させるための初期化
	if (!data._EXTENSION) {
		data._EXTENSION = { TORQUE_MODE_EX: '2', FIX_PROGRESSIVE_RATE: '1', _ENABLED: false };
	}
	if (!data._EXTENSION_FLEX) {
		data._EXTENSION_FLEX = { TORSIONAL_STIFFNESS: '12000', TORSIONAL_DAMPING: '150', _ENABLED: false };
	}
	// --- 1. TYPEごとのスキーマ定義は window.SUSPENSION_EXTRA_SCHEMA を参照 ---
	// アクティブタブの記憶
	const activeBtn = container.querySelector('.suspension-tab-btn.active');
	const currentActiveLabel = activeBtn ? activeBtn.textContent : 'BASIC';
	container.innerHTML = '';
	// --- 2. タブ設計図 ---
	const tabDefinitions = [{
		id: 'basic',
		label: 'BASIC',
		items: [{
			section: 'HEADER',
			keys: ['VERSION']
		}, {
			section: 'BASIC',
			keys: ['CG_LOCATION', 'WHEELBASE']
		}, {
			section: 'SIDE_BOTH',
			keys: ['TYPE', 'TRACK', 'BASEY', 'HUB_MASS', 'RIM_OFFSET']
		}]
	}, {
		id: 'arms',
		label: 'ARMS',
		items: [{
			section: 'SIDE_BOTH',
			keys: []
		}]
	}, {
		id: 'alignment',
		label: 'ALIGNMENT',
		items: [{
			section: 'SIDE_BOTH',
			keys: ['TOE_OUT', 'STATIC_CAMBER']
		}]
	}, {
		id: 'springs',
		label: 'SPRINGS',
		items: [{
			section: 'SIDE_BOTH',
			keys: ['SPRING_RATE', 'PROGRESSIVE_SPRING_RATE']
		}, {
			section: 'ARB',
			keys: ['FRONT', 'REAR'],
			labelOverride: 'ARB'
		}]
	}, {
		id: 'damper',
		label: 'DAMPER',
		items: [{
			section: 'SIDE_BOTH',
			keys: ['BUMPSTOP_UP', 'BUMPSTOP_DN', 'PACKER_RANGE', 'ROD_LENGTH', 'BUMP_STOP_RATE', 'DAMP_FAST_BUMP', 'DAMP_FAST_REBOUND', 'DAMP_BUMP', 'DAMP_REBOUND', 'DAMP_FAST_BUMPTHRESHOLD', 'DAMP_FAST_REBOUNDTHRESHOLD']
		}]
	}, {
		id: 'others',
		label: 'OTHERS',
		items: [{
			section: 'GRAPHICS_OFFSETS',
			keys: ['WHEEL_LF', 'SUSP_LF', 'WHEEL_RF', 'SUSP_RF', 'WHEEL_LR', 'SUSP_LR', 'WHEEL_RR', 'SUSP_RR']
		}, {
			section: 'DAMAGE',
			keys: ['MIN_VELOCITY', 'GAIN', 'MAX_DAMAGE', 'DEBUG_LOG']
		}]
	}, {
		id: 'extended', // ★新設
		label: 'EXTENDED',
		items: [{
			section: '_EXTENSION',
			keys: ['TORQUE_MODE_EX', 'FIX_PROGRESSIVE_RATE']
		}, {
			section: '_EXTENSION_FLEX',
			keys: ['TORSIONAL_STIFFNESS', 'TORSIONAL_DAMPING']
		}]
	}];
	const tabMenu = document.createElement('div');
	tabMenu.className = 'suspension-tab-menu';
	container.appendChild(tabMenu);
	const contentArea = document.createElement('div');
	contentArea.className = 'suspension-tab-content';
	container.appendChild(contentArea);
	// 入力生成関数 (addInput)
	const addInput = (parent, section, key, val, displayLabel) => {
		const config = getParamConfig(key, val);
		// ★ここを修正：司令塔から「データの塊（step, min, max）」を受け取る
		const editorRule = window.getEditorStep(key, val);
		// 古い仕様（文字）が来ても、新しい仕様（オブジェクト）が来ても動く安全な処理
		const currentStep = typeof editorRule === 'object' ? editorRule.step : editorRule;
		const currentMin = typeof editorRule === 'object' && editorRule.min !== "" ? ` min="${editorRule.min}"` : "";
		const currentMax = typeof editorRule === 'object' && editorRule.max !== "" ? ` max="${editorRule.max}"` : "";
		const itemDiv = document.createElement('div');
		itemDiv.className = 'suspension-item' + (config.isCoord ? ' is-coordinate' : '');
		itemDiv.dataset.key = key;
		// ★判定ロジック：セクション名で拡張物理かどうかを判定する（VERSIONキーは除外）
		const isExtendedSection = window.EXTENDED_PHYSICS_TARGETS.sections.includes(section);

		// 1. 拡張セクション（_EXTENSION等）はスイッチがOFFの時だけロックする
		if (isExtendedSection) {
			if (!window.isExtendedPhysicsEnabled) {
				itemDiv.style.opacity = '0.4';
				itemDiv.style.pointerEvents = 'none';
				itemDiv.classList.add('is-extended-locked');
			} else {
				itemDiv.style.opacity = '1';
				itemDiv.style.pointerEvents = 'auto';
				itemDiv.classList.remove('is-extended-locked');
			}
		}

		// 2. VERSION 項目は、スイッチの状態に関わらず常に操作可能（ロックしない）
		if (key === 'VERSION') {
			itemDiv.style.opacity = '1';
			itemDiv.style.pointerEvents = 'auto';
			itemDiv.classList.remove('is-extended-locked');
		}
		let innerHtml = '';
		if (key === 'TYPE') {
			innerHtml = `<div class="input-unit"><label>${displayLabel || key}</label><div class="input-with-range"><select class="type-select text-input">
				${Object.keys(window.SUSPENSION_EXTRA_SCHEMA).map(t => `<option value="${t}" ${t === val ? 'selected' : ''}>${t}</option>`).join('')}
			</select></div></div>`;
		} else if (config.isCoord) {
			innerHtml = `<div class="input-unit"><label>${displayLabel || key} <span class="coord-label">X・Y・Z</span></label><div class="input-with-range">
				${config.values.map((v, idx) => `<input type="number" class="text-input" data-idx="${idx}" value="${v}" step="${currentStep}"${currentMin}${currentMax}>`).join('')}
			</div></div>`;
		} else {
			const v = config.values[0];
			const rangeKeys = ['ROD_LENGTH', 'PACKER_RANGE', 'BUMPSTOP_UP', 'BUMPSTOP_DN'];
			const isRange = rangeKeys.includes(key);
			let minVal = (key === 'ROD_LENGTH') ? "-0.2" : "0";
			let maxVal = (key === 'ROD_LENGTH') ? "0.2" : "0.3";

			// ★修正：VERSIONの場合は自動拡張機能付きのセレクトボックスにする
			if (key === 'VERSION') {
				const options = ['1', '2', 'extended-2'];
				// 未知のバージョンが来たら、その場だけ選択肢に追加する
				if (!options.includes(v) && v !== "") options.push(v);
				
				const optionsHtml = options.map(opt => 
					`<option value="${opt}" ${opt === v ? 'selected' : ''}>${opt}</option>`
				).join('');
				
				innerHtml = `<div class="input-unit"><label>${displayLabel || key}</label><div class="input-with-range">
					<select class="text-input">${optionsHtml}</select>
				</div></div>`;
			} else {
				// ★修正ポイント：数値でない（文字を含む）場合は type="text" に切り替える
				const inputType = isNaN(v) ? 'text' : 'number';
				innerHtml = `<div class="input-unit"><label>${displayLabel || key}</label><div class="input-with-range">
					<input type="${inputType}" class="text-input" data-idx="0" value="${v}" step="${currentStep}"${currentMin}${currentMax}>
					${isRange ? `<input type="range" class="range-slider" min="${minVal}" max="${maxVal}" step="${currentStep}" value="${v}">` : ''}
				</div></div>`;
			}
		}
		itemDiv.innerHTML = innerHtml;
		parent.appendChild(itemDiv);
		const textInputs = itemDiv.querySelectorAll('.text-input, .type-select');
		const rangeIn = itemDiv.querySelector('.range-slider');
		const syncValue = () => {
			let finalVal = config.isCoord ? Array.from(textInputs).map(i => i.value).join(', ') : textInputs[0].value;
			if (!window.currentSuspensionData[section]) window.currentSuspensionData[section] = {};
			window.currentSuspensionData[section][key] = finalVal;
			if (key === 'TYPE') {
				console.log(`[DEBUG-TYPE] TYPEが変更されました。新しいTYPE: ${finalVal}, 変更したセクション: ${section}`);
				// ★ここを修正：上書きされる ini_DATA ではなく、純粋なデフォルトデータを参照する
				const defaultData = window.DEFAULT_SUSPENSION_DATA;
				if (!defaultData) {
					console.log(`[DEBUG-ERROR] ❌ window.DEFAULT_SUSPENSION_DATA が見つかりません！ import.js の修正が反映されていないか、読み込み順の問題です。`);
				} else {
					console.log(`[DEBUG-TYPE] ⭕ 予備データ (DEFAULT_SUSPENSION_DATA) を発見しました。`);
					// 選択された形式（finalVal）に対応するデフォルトデータのセクションを決める
					let sourceSection = '';
					if (finalVal === 'DWB') sourceSection = 'REAR';
					else if (finalVal === 'STRUT') sourceSection = 'FRONT';
					else if (finalVal === 'AXLE') sourceSection = 'AXLE';
					console.log(`[DEBUG-TYPE] 参照元テンプレート: ${sourceSection} ➔ 適用先: ${section}`);
					if (sourceSection && defaultData[sourceSection]) {
						const template = defaultData[sourceSection];
						let copyCount = 0;
						if (finalVal === 'AXLE') {
							// AXLE形式の場合は [AXLE] セクションに値をセットする
							if (!window.currentSuspensionData.AXLE) window.currentSuspensionData.AXLE = {};
							Object.keys(template).forEach(k => {
								if (window.currentSuspensionData.AXLE[k] === undefined || window.currentSuspensionData.AXLE[k] === "") {
									window.currentSuspensionData.AXLE[k] = template[k];
									copyCount++;
									console.log(`[DEBUG-COPY] AXLE に補充: ${k} = ${template[k]}`);
								}
							});
						} else {
							// DWB または STRUT の場合は現在のセクション（FRONTまたはREAR）に値をセットする
							Object.keys(template).forEach(k => {
								if (window.currentSuspensionData[section][k] === undefined || window.currentSuspensionData[section][k] === "") {
									window.currentSuspensionData[section][k] = template[k];
									copyCount++;
									console.log(`[DEBUG-COPY] ${section} に補充: ${k} = ${template[k]}`);
								}
							});
						}
						console.log(`[DEBUG-TYPE] 補充完了。合計 ${copyCount} 個のデータを流し込みました。`);
					} else {
						console.log(`[DEBUG-ERROR] ❌ 参照元のセクション [${sourceSection}] がテンプレート内に見つかりません。`);
					}
				}
				console.log(`[DEBUG-TYPE] UIを再描画します...`);
				window.updateSuspensionEditorUI(window.currentSuspensionData);
				if (typeof window.requestRender === 'function') {
					window.requestRender();
				}
			}
			if (key === 'BUMPSTOP_UP' || key === 'PACKER_RANGE') {
				if (typeof window.syncSuspensionUIConstraints === 'function') {
					window.syncSuspensionUIConstraints(section);
				}
			}
			if (typeof window.updateSuspensionVisuals === 'function') window.updateSuspensionVisuals(window.currentSuspensionData);
			if (typeof window.requestRender === 'function') {
				console.log("[DEBUG]  requestRender() が呼び出されました。2か所目");
				window.requestRender();
			}
			if (window.damperVisualizer) window.damperVisualizer.refreshFromIni(window.currentSuspensionData);
			if (typeof window.updateDesmosGraph === 'function' && (section === 'FRONT' || section === 'REAR')) {
				window.updateDesmosGraph(section, window.currentSuspensionData);
			}
		};
		textInputs.forEach(input => {
			input.addEventListener(input.tagName === 'SELECT' ? 'change' : 'input', syncValue);
		});
		if (rangeIn) {
			rangeIn.addEventListener('input', (e) => {
				textInputs[0].value = e.target.value;
				syncValue();
			});
		}
		// X・Y・Zの座標入力欄だけを対象にする
		if (config.isCoord) {
			const targetEl = itemDiv.querySelector('.input-unit') || itemDiv;
			targetEl.addEventListener('mouseenter', () => {
				// ★キーとセクションの両方を記憶させる
				window.hoveredSuspensionKey = key;
				window.hoveredSuspensionSection = section;
				if (typeof window.updateSuspensionVisuals === 'function') {
					window.updateSuspensionVisuals(window.currentSuspensionData);
				}
				if (typeof window.requestRender === 'function') window.requestRender();
			});
			targetEl.addEventListener('mouseleave', () => {
				// ★キーとセクションの両方が一致している場合のみ記憶を消去する
				if (window.hoveredSuspensionKey === key && window.hoveredSuspensionSection === section) {
					window.hoveredSuspensionKey = null;
					window.hoveredSuspensionSection = null;
					if (typeof window.updateSuspensionVisuals === 'function') {
						window.updateSuspensionVisuals(window.currentSuspensionData);
					}
					if (typeof window.requestRender === 'function') window.requestRender();
				}
			});
		}
	};
	tabDefinitions.forEach((tab) => {
		const btn = document.createElement('button');
		btn.textContent = tab.label;
		const isActive = (tab.label === currentActiveLabel);
		btn.className = 'suspension-tab-btn' + (isActive ? ' active' : '');
		tabMenu.appendChild(btn);
		const panel = document.createElement('div');
		panel.className = 'suspension-tab-panel' + (isActive ? ' active' : '');
		panel.id = `panel-${tab.id}`;
		contentArea.appendChild(panel);
		const updatePreview = () => {
			if (!previewArea) return;
			const alignmentGroup = previewArea.querySelector('.alignment-preview-group');
			const damperUI = document.getElementById('damper-special-ui');
			const visibilityControls = document.querySelector('.visibility-controls');
			const isDamper = tab.id === 'damper';
			if (alignmentGroup) alignmentGroup.style.display = isDamper ? 'none' : 'block';
			if (damperUI) damperUI.style.display = isDamper ? 'block' : 'none';
			if (visibilityControls) visibilityControls.style.display = isDamper ? 'none' : '';
		};
		if (isActive) updatePreview();
		btn.addEventListener('click', () => {
			tabMenu.querySelectorAll('.suspension-tab-btn').forEach(b => b.classList.remove('active'));
			contentArea.querySelectorAll('.suspension-tab-panel').forEach(p => p.classList.remove('active'));
			btn.classList.add('active');
			panel.classList.add('active');
			updatePreview();
		});
		tab.items.forEach(itemDef => {
			if (itemDef.section === 'SIDE_BOTH') {
				['FRONT', 'REAR'].forEach(side => {
					if (!data[side]) return;
					const currentType = data[side].TYPE || 'DWB';
					const sectionWrapper = document.createElement('article');
					// タイトルとボタンを包むボックス（以前の構造を完全に再現）
					const titleBox = document.createElement('div');
					titleBox.className = 'suspension-item-title_box damper-btn-outer_box';
					const titleP = document.createElement('p');
					titleP.textContent = side;
					titleBox.appendChild(titleP);
					// ボタンの追加（以前の構造を完全に再現）
					const btnBox = document.createElement('div');
					btnBox.className = 'damper-btn_box';
					const playBtn = document.createElement('button');
					playBtn.id = `damper-btn-${side}`;
					playBtn.className = 'damper-control-btn';
					playBtn.textContent = '▶';
					// 初期状態として停止中(false)をセット
					playBtn.setAttribute('data-playing', 'false');
					// クリックイベントの登録
					playBtn.addEventListener('click', () => {
						if (typeof window.toggleDesmosAnimation === 'function') {
							// 引数に「playBtn」を追加して、クリックされたボタン自身を渡す
							window.toggleDesmosAnimation(side, playBtn);
						}
					});
					btnBox.appendChild(playBtn);
					titleBox.appendChild(btnBox);
					sectionWrapper.appendChild(titleBox);
					const itemBox = document.createElement('div');
					itemBox.className = 'suspension-item_box';
					// タブ固有の追加項目（SCHEMA）を取得
					const extraKeys = (window.SUSPENSION_EXTRA_SCHEMA && window.SUSPENSION_EXTRA_SCHEMA[currentType] && window.SUSPENSION_EXTRA_SCHEMA[currentType][tab.id]) ? window.SUSPENSION_EXTRA_SCHEMA[currentType][tab.id] : [];
					const allKeys = [...itemDef.keys, ...extraKeys];
					allKeys.forEach(key => {
						const isCoord = key.includes('_FRONT') || key.includes('_REAR') || key.includes('_TOP') || key.includes('_BOTTOM') || key.includes('_STEER') || key.includes('_CAR') || key.includes('_TYRE') || key.includes('_AXLE') || /^J\d_/.test(key);
						let targetSection = side;
						if (currentType === 'AXLE' && window.SUSPENSION_EXTRA_SCHEMA['AXLE'] && window.SUSPENSION_EXTRA_SCHEMA['AXLE']['arms'].includes(key)) {
							targetSection = 'AXLE';
						}
						const val = (data[targetSection] && data[targetSection][key] !== undefined) ? data[targetSection][key] : (isCoord ? "0,0,0" : "0");
						addInput(itemBox, targetSection, key, val);
					});
					sectionWrapper.appendChild(itemBox);
					panel.appendChild(sectionWrapper);
				});
			} else if (data[itemDef.section]) {
				const sectionWrapper = document.createElement('article');
				const titleBox = document.createElement('div');
				titleBox.className = 'suspension-item-title_box';
				const titleP = document.createElement('p');
				titleP.textContent = itemDef.section;
				titleBox.appendChild(titleP);
				sectionWrapper.appendChild(titleBox);
				const itemBox = document.createElement('div');
				itemBox.className = 'suspension-item_box';
				itemDef.keys.forEach(key => {
					if (data[itemDef.section][key] !== undefined) {
						const labelText = itemDef.labelOverride ? `${itemDef.labelOverride} (${key})` : key;
						addInput(itemBox, itemDef.section, key, data[itemDef.section][key], labelText);
					}
				});
				sectionWrapper.appendChild(itemBox);
				panel.appendChild(sectionWrapper);
			}
		});
	});
	if (typeof syncSuspensionUIConstraints === 'function') {
		syncSuspensionUIConstraints('FRONT');
		syncSuspensionUIConstraints('REAR');
	}
};
// 6. マウス操作の登録
function setupSuspensionControls() {
	const container = document.getElementById('canvas-suspension');
	if (!container || window._cameraInited) return;
	let isDragging = false;
	let prevM = new THREE.Vector2();
	// 視点の状態を管理（極座標）
	let spherical = new THREE.Spherical();
	let target = new THREE.Vector3(0, 0, 0); // 回転の中心点
	const updateCameraFromSpherical = () => {
		if (!window.camera) return;
		window.camera.position.setFromSpherical(spherical).add(target);
		window.camera.lookAt(target);
		if (window.updateCameraInfo) window.updateCameraInfo();
		if (window.requestRender) window.requestRender();
	};
	// 初期位置からSphericalを設定
	if (window.camera) {
		const relPos = window.camera.position.clone().sub(target);
		spherical.setFromVector3(relPos);
	}
	container.addEventListener('mousedown', (e) => {
		isDragging = true;
		prevM.set(e.clientX, e.clientY);
	});
	window.addEventListener('mouseup', () => {
		isDragging = false;
	});
	window.addEventListener('mousemove', (e) => {
		if (!isDragging || !window.camera) return;
		const deltaX = e.clientX - prevM.x;
		const deltaY = e.clientY - prevM.y;
		prevM.set(e.clientX, e.clientY);
		// 1. 左クリック：回転（上下は頂点で止まるように制限）
		if (e.buttons === 1) {
			const orbitSpeed = 0.005;
			spherical.theta -= deltaX * orbitSpeed; // 左右回転
			spherical.phi -= deltaY * orbitSpeed; // 上下回転
			// 頂点と底で止まるように制限 (0.1〜PI-0.1)
			const minPhi = 0.1;
			const maxPhi = Math.PI / 2;
			spherical.phi = Math.max(minPhi, Math.min(maxPhi, spherical.phi));
		}
		// 2. マウスホイール押し込み（中央ボタン）：並進移動
		else if (e.buttons === 4) {
			const panSpeed = 0.0078;
			const right = new THREE.Vector3().setFromMatrixColumn(window.camera.matrix, 0);
			const up = new THREE.Vector3().setFromMatrixColumn(window.camera.matrix, 1);
			target.addScaledVector(right, -deltaX * panSpeed);
			target.addScaledVector(up, deltaY * panSpeed);
		}
		// 3. 右クリック：垂直ドラッグでズーム / 左右は無効
		else if (e.buttons === 2) {
			const zoomSpeed = 0.0075;
			// 上ドラッグ(deltaY負)でズームアップ、下ドラッグ(deltaY正)でズームアウト
			spherical.radius += deltaY * zoomSpeed;
			// 最小ズーム距離を制限
			spherical.radius = Math.max(0.1, spherical.radius);
		}
		updateCameraFromSpherical();
	});
	// マウスホイール：ズーム（既存機能の維持）
	container.addEventListener('wheel', (e) => {
		if (!window.camera) return;
		e.preventDefault();
		const zoomSpeed = 0.001;
		spherical.radius += e.deltaY * zoomSpeed;
		spherical.radius = Math.max(0.1, spherical.radius);
		updateCameraFromSpherical();
	}, {
		passive: false
	});
	container.addEventListener('contextmenu', e => e.preventDefault());
	window._cameraInited = true;
}
// 念のため、1秒おきのチェックも残すが、基本は init() から呼ばれるようにする
const initTimer = setInterval(() => {
	if (window.suspensionScene && !window._modelAppInited) {
		window.initModelApp();
		clearInterval(initTimer);
	}
}, 500);

function setupVisibilityListeners() {
	// HTMLのIDと、管理オブジェクトのキーを完全に一致させる
	const mapping = {
		'check-arms': 'arms',
		'check-steer': 'steer',
		'check-wheels': 'wheels',
		'check-rim-offset': 'rimOffset',
		'check-collider': 'collider',
		'check-tank': 'tank',
		'check-wing': 'wing'
	};
	Object.entries(mapping).forEach(([id, key]) => {
		const el = document.getElementById(id);
		if (el) {
			el.addEventListener('change', (e) => {
				const isChecked = e.target.checked;
				window.suspensionVisibility[key] = isChecked;
				// COLLIDERの場合、メッシュの表示を直接切り替える
				if (key === 'collider' && window.colliderHelper) {
					window.colliderHelper.visible = isChecked;
				}
				// 全体の再描画（他のパーツ用）
				if (window.currentSuspensionData) {
					window.updateSuspensionVisuals(window.currentSuspensionData);
				}
			});
		}
	});
}
// 7. 初期化関数
window.initModelApp = function() {
	if (window._modelAppInited) return;
	const target = window.suspensionScene || window.scene;
	if (window.THREE && target) {
		window.suspensionScene = target;
		setupSuspensionControls();
		setupVisibilityListeners(); // これを追加してUIを有効化
		// initDefaultAssets(); 
		window._modelAppInited = true;
	}
};
// 8. ダンパーのセクションの作成
class DamperVisualizer {
	constructor() {
		this.charts = {
			front: null,
			rear: null
		};
		if (document.readyState === 'loading') {
			document.addEventListener('DOMContentLoaded', () => this.setupTabListener());
		} else {
			this.setupTabListener();
		}
	}
	setupTabListener() {
		const tabBtns = document.querySelectorAll('.tab-btn');
		tabBtns.forEach(btn => {
			btn.addEventListener('click', () => {
				if (btn.getAttribute('data-tab') === 'suspension') this.init();
			});
		});
		const activeTab = document.querySelector('.tab-btn.active');
		if (activeTab && activeTab.getAttribute('data-tab') === 'suspension') this.init();
	}
	init() {
		const frontContainer = document.querySelector('.damper-graph-front_box');
		const rearContainer = document.querySelector('.damper-graph-rear_box');
		if (this.charts.front && this.charts.rear) return;
		if (frontContainer) this.charts.front = this.createChart(frontContainer, 'FRONT DAMPER');
		if (rearContainer) this.charts.rear = this.createChart(rearContainer, 'REAR DAMPER');
		// データがあれば描画
		if (window.currentSuspensionData) {
			this.refreshFromIni(window.currentSuspensionData);
		}
	}
	/* --- 685行目付近 createChart メソッドを差し替え --- */
	createChart(container, label) {
		container.innerHTML = '';
		const canvas = document.createElement('canvas');
		canvas.className = 'damper-chart-canvas';
		container.appendChild(canvas);
		return new Chart(canvas, {
			type: 'line',
			data: {
				datasets: [{
					label: '伸び側 (Rebound)',
					data: [],
					borderColor: '#3498db',
					backgroundColor: 'rgba(52, 152, 219, 0.1)',
					fill: 'origin',
					tension: 0.1,
					pointRadius: 0,
					borderWidth: 2
				}, {
					label: '縮み側 (Bump)',
					data: [],
					borderColor: '#e74c3c',
					backgroundColor: 'rgba(231, 76, 60, 0.1)',
					fill: 'origin',
					tension: 0.1,
					pointRadius: 0,
					borderWidth: 2
				}]
			},
			/* --- 685行目付近 createChart メソッド内の options 部分を修正 --- */
			options: {
				responsive: true,
				maintainAspectRatio: false,
				scales: {
					x: {
						type: 'linear',
						min: 0,
						max: 0.6,
						title: {
							display: true,
							text: 'ピストン速度 (m/s)'
						}
					},
					y: {
						// 修正ポイント：最小・最大値をある程度固定するか、
						// 数値が大きく変わった時にスケールをリセットするようにします
						beginAtZero: true,
						title: {
							display: true,
							text: '減衰力 (N)'
						},
						grid: {
							color: (ctx) => (ctx.tick.value === 0 ? '#000' : '#ddd'),
							lineWidth: (ctx) => (ctx.tick.value === 0 ? 2 : 1)
						}
					}
				},
				// アニメーションを無効化すると数値変更が即座に反映されます
				animation: false
			}
		});
	}
	/* --- 724行目付近 refreshFromIni メソッドを差し替え --- */
	refreshFromIni(data) {
		['FRONT', 'REAR'].forEach(side => {
			const s = data[side];
			const chart = this.charts[side.toLowerCase()];
			if (!s || !chart) return;
			// 数値の抽出（NaN対策）
			const b = parseFloat(s.DAMP_BUMP) || 0;
			const fb = parseFloat(s.DAMP_FAST_BUMP) || b;
			const r = parseFloat(s.DAMP_REBOUND) || 0;
			const fr = parseFloat(s.DAMP_FAST_REBOUND) || r;
			const b_thick = parseFloat(s.DAMP_FAST_BUMPTHRESHOLD) || 0.1;
			const r_thick = parseFloat(s.DAMP_FAST_REBOUNDTHRESHOLD) || 0.1;
			const reboundPoints = [];
			const bumpPoints = [];
			// X軸のサンプリングポイント（0.01刻みで滑らかにするか、主要点のみにするか）
			let steps = [0, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6];
			if (b_thick > 0 && b_thick < 0.6) steps.push(b_thick);
			if (r_thick > 0 && r_thick < 0.6) steps.push(r_thick);
			steps = [...new Set(steps)].sort((a, b) => a - b);
			steps.forEach(v => {
				// 縮み側計算 (Bump)
				const bumpVal = v > b_thick ? (b_thick * b + (v - b_thick) * fb) : v * b;
				bumpPoints.push({
					x: v,
					y: Math.round(bumpVal)
				});
				// 伸び側計算 (Rebound) - グラフで見やすくするため正の値にする場合は -rebVal を止める
				const rebVal = v > r_thick ? (r_thick * r + (v - r_thick) * fr) : v * r;
				reboundPoints.push({
					x: v,
					y: Math.round(rebVal)
				});
			});
			// データの更新
			chart.data.datasets[0].data = reboundPoints;
			chart.data.datasets[1].data = bumpPoints;
			// Y軸の表示範囲をデータに合わせて自動調整
			chart.options.scales.y.min = 0; // 下限を0に固定（伸びをマイナス表示しない場合）
			chart.options.scales.y.max = null; // 上限は自動
			chart.update('none');
			this.drawSimulation(side, data);
		});
	}
	/* --- model_app.js 800行目付近：refreshFromIni の直後に追加 --- */
	// 2Dシミュレーション描画メソッド
	drawSimulation(side, data) {
		const canvas = document.getElementById(`canvas-${side.toLowerCase()}-sim`);
		if (!canvas || !data[side]) return;
		const ctx = canvas.getContext('2d');
		// 1. 描画基準点の定義 (1G位置)
		// 動的計算ではなく、シミュレーションが綺麗に収まる固定座標を基準にする
		const baseCenterY = 150;
		// 2. 解像度と表示サイズの同期
		// 描画が消えないよう、最低限必要な高さ（1G位置 + ストローク分）を担保する
		const minRequiredHeight = 250;
		const currentWidth = canvas.clientWidth;
		const currentHeight = Math.max(canvas.clientHeight, minRequiredHeight);
		if (currentWidth === 0) return; // 親要素が非表示の場合はスキップ
		if (canvas.width !== currentWidth || canvas.height !== currentHeight) {
			canvas.width = currentWidth;
			canvas.height = currentHeight;
		}
		const s = data[side];
		// 値の取得
		const rodLen = parseFloat(s.ROD_LENGTH) || 0.06;
		const packer = parseFloat(s.PACKER_RANGE) || 0.055;
		const bUp = parseFloat(s.BUMPSTOP_UP) || 0.075;
		const bDn = parseFloat(s.BUMPSTOP_DN) || 0.05;
		// Desmosのスライダー s (SusTravel) の値を取得（未定義なら0）
		const calc = (side === 'FRONT') ? window.frontCalculator : window.rearCalculator;
		const susTravel = (calc) ? calc.HelperExpression({
			latex: 's'
		}).numericValue : 0;
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		// スケール設定 (1m = 1000px)
		const scale = 1000;
		const centerX = canvas.width / 2;
		const centerY = baseCenterY;
		console.log(`[CHECK] Wheel: ${wheelKey}, centerX: ${centerX.toFixed(1)}px`);
		// 1G位置から SusTravel 分だけオフセットされた現在のハブ位置
		const currentHubY = centerY - (susTravel * scale);
		// --- 描画開始 ---
		// 1. 基準線 (1Gライン)
		ctx.setLineDash([5, 5]);
		ctx.strokeStyle = '#999';
		ctx.beginPath();
		ctx.moveTo(0, centerY);
		ctx.lineTo(canvas.width, centerY);
		ctx.stroke();
		ctx.setLineDash([]);
		// 2. シリンダー (上部に固定：1G位置から rodLen 分だけ上の位置を底面とする)
		// 修正：cylinderBottomY は rodLen のみに依存させ、他からの干渉を完全に排除
		const cylinderBottomY = centerY - (rodLen * scale);
		ctx.fillStyle = '#444';
		ctx.fillRect(centerX - 25, cylinderBottomY - 100, 50, 100);
		// 3. ロッド (現在のハブ位置 currentHubY から シリンダー底面までを描画)
		ctx.fillStyle = '#aaa';
		const rodVisualHeight = currentHubY - cylinderBottomY;
		ctx.fillRect(centerX - 5, cylinderBottomY, 10, rodVisualHeight);
		// --- ROD_LENGTH 基準線（点線） ---
		ctx.setLineDash([2, 2]);
		ctx.strokeStyle = '#555'; // 色を濃く修正
		ctx.beginPath();
		ctx.moveTo(centerX - 60, cylinderBottomY);
		ctx.lineTo(centerX + 60, cylinderBottomY);
		ctx.stroke();
		ctx.setLineDash([]);
		ctx.fillStyle = '#555';
		ctx.font = '10px Arial';
		ctx.fillText(`ROD_LENGTH: ${rodLen.toFixed(3)}`, centerX - 130, cylinderBottomY + 3);
		// 5. 縮み側ストッパー (BUMPSTOP_UP) 基部
		const upY = centerY - (bUp * scale);
		ctx.strokeStyle = '#3498db';
		ctx.save();
		ctx.translate(screenX, screenY);
		// 左右に合わせて回転方向を調整
		ctx.rotate(side === 1 ? camberRad : -camberRad);
		ctx.setLineDash([2, 2]);
		ctx.beginPath();
		ctx.moveTo(centerX - 40, upY);
		ctx.lineTo(centerX + 40, upY);
		ctx.stroke();
		ctx.setLineDash([]);
		// 6. パッカー (PACKER_RANGE) の描画
		const packerY = upY + (packer * scale);
		ctx.fillStyle = 'rgba(241, 196, 15, 0.4)'; // パッカー領域
		ctx.fillRect(centerX - 30, upY, 60, (packer * scale));
		// パッカーの端面（実際にバンプが当たるライン）
		ctx.strokeStyle = '#f39c12';
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(centerX - 40, packerY);
		ctx.lineTo(centerX + 40, packerY);
		ctx.stroke();
		ctx.lineWidth = 1;
		ctx.fillStyle = '#3498db';
		ctx.fillText(`BUMPSTOP_UP: ${bUp.toFixed(3)}`, centerX + 45, upY + 3);
		ctx.fillStyle = '#f39c12';
		ctx.fillText(`PACKER_RANGE: ${packer.toFixed(3)}`, centerX + 45, packerY + 3);
		// 実際の衝突点（実効バンプストローク）
		ctx.strokeStyle = '#f1c40f';
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(centerX - 40, packerY);
		ctx.lineTo(centerX + 40, packerY);
		ctx.stroke();
		ctx.lineWidth = 1;
		ctx.fillStyle = '#3498db';
		ctx.font = '10px Arial';
		ctx.fillText(`BUMPSTOP_UP: ${bUp.toFixed(3)}`, centerX + 45, upY + 3);
		ctx.fillStyle = '#f39c12';
		ctx.fillText(`EFFECTIVE: ${(bUp - packer).toFixed(3)}`, centerX + 45, packerY + 3);
		// 7. 伸び側ストッパー (BUMPSTOP_DN)
		const dnY = centerY + (bDn * scale);
		ctx.strokeStyle = '#e74c3c';
		ctx.beginPath();
		ctx.moveTo(centerX - 40, dnY);
		ctx.lineTo(centerX + 40, dnY);
		ctx.stroke();
		ctx.fillStyle = '#e74c3c';
		ctx.fillText(`BUMPSTOP_DN: ${bDn.toFixed(3)}`, centerX + 45, dnY + 3);
		if (typeof window.requestRender === 'function') {
			console.log("[DEBUG] DamperVisualizer から requestRender() を呼び出しました");
			window.requestRender();
		}
	}
}
window.damperVisualizer = new DamperVisualizer();
let isUpdating = false; // ループ防止用フラグ
window.updateDamperChart = function() {
	if (isUpdating) return; // 更新中なら何もしない
	isUpdating = true;
	// 処理が終わったら少し間を置いてロックを解除
	setTimeout(() => {
		isUpdating = false;
	}, 50);
};
window.updateSuspensionEditorUI = (typeof updateSuspensionEditorUI !== 'undefined') ? updateSuspensionEditorUI : null;
// --- アライメント表示とビジュアル更新の同期設定 --
// 1. スライダーなどの数値が変わった時に表示を更新する
const originalUpdateSuspensionVisuals = window.updateSuspensionVisuals;
window.updateSuspensionVisuals = function(data) {
	// 1. 既存の描画更新処理を実行
	if (typeof originalUpdateSuspensionVisuals === 'function') {
		originalUpdateSuspensionVisuals(data);
	}
	if (typeof suspensionModel !== 'undefined' && suspensionModel) {
		suspensionModel.visible = window.suspensionVisibility.body;
	}
	// 3. アライメント表示などの追加更新を実行
	if (typeof window.updateColliderVisuals === 'function') {
		window.updateColliderVisuals();
	}
	// エアロも一緒に動かす
	if (typeof window.updateAeroVisuals === 'function') {
		window.updateAeroVisuals();
	}
	// アライメントやタイヤサイズの数値オーバーレイを同期させる
	if (typeof window.refreshAlignmentOverlay === 'function') {
		window.refreshAlignmentOverlay();
	}
};
// ==========================================
// ★追加：拡張物理マスタースイッチの動作
// ==========================================
document.addEventListener('change', (e) => {
	if (e.target.id === 'extendedPhysicsSwitch') {
		window.isExtendedPhysicsEnabled = e.target.checked;

		// --- ★追加：ON/OFFテキストの切り替え ---
		const statusText = document.getElementById('extendedStatusText');
		if (statusText) {
			if (window.isExtendedPhysicsEnabled) {
				statusText.textContent = 'ON';
				statusText.className = 'status-text on';
			} else {
				statusText.textContent = 'OFF';
				statusText.className = 'status-text off';
			}
		}
		// ------------------------------------
		
		// 1. car.ini の VERSION 書き換え
		if (window.currentCarData && window.currentCarData.HEADER) {
			window.currentCarData.HEADER.VERSION = window.isExtendedPhysicsEnabled ? 'extended-2' : '1';
		}

		// ★追加：suspensions.ini の VERSION も同時に書き換える命令
		if (window.currentSuspensionData && window.currentSuspensionData.HEADER) {
			window.currentSuspensionData.HEADER.VERSION = window.isExtendedPhysicsEnabled ? 'extended-2' : '2';
		}

		// 2. ONになった時、データに項目がなければデフォルト値を補完
		if (window.isExtendedPhysicsEnabled && window.currentSuspensionData) {
			if (!window.currentSuspensionData._EXTENSION) {
				window.currentSuspensionData._EXTENSION = {
					TORQUE_MODE_EX: '2',
					FIX_PROGRESSIVE_RATE: '1'
				};
			}
			if (!window.currentSuspensionData._EXTENSION_FLEX) {
				window.currentSuspensionData._EXTENSION_FLEX = {
					TORSIONAL_STIFFNESS: '12000',
					TORSIONAL_DAMPING: '150'
				};
			}
		}
		// 3. UIの表示を即座に更新（画面をリフレッシュして VERSION 変更を表示させる）
		if (typeof window.updateSuspensionEditorUI === 'function') {
			window.updateSuspensionEditorUI(window.currentSuspensionData);
		}
		if (typeof window.updateCarEditorUI === 'function') {
			window.updateCarEditorUI(window.currentCarData);
		}
		if (typeof window.updateTyreEditorUI === 'function') {
			window.updateTyreEditorUI(window.currentTyreData);
		}
		if (typeof window.initAeroEditor === 'function' && window.currentAeroData) {
			window.initAeroEditor(window.currentAeroData);
		}
		if (typeof window.updateSuspensionVisuals === 'function') {
			window.updateSuspensionVisuals(window.currentSuspensionData);
		}
		// 3Dプレビューなどの描画更新
		if (window.requestRender) window.requestRender();
	}
});