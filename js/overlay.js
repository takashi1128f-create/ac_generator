// js/overlay.js
/**
 * 1. 指定したIDの要素に数値をテキストとして挿入・更新する
 */
function updateValueText(id, value) {
	const el = document.getElementById(id);
	if (!el) return;
	if (el.childNodes.length > 0 && el.childNodes[0].nodeType === 3) {
		el.childNodes[0].nodeValue = value;
	} else {
		el.prepend(document.createTextNode(value));
	}
}
/**
 * 2. 座標データからキャスター角とKPI角を計算する
 * 引数を (susData, isFront) に統一し、内部でTYPEを判定するように修正
 */
// js/overlay.js
function calculateGeometryAngles(susData, isFront) {
	if (!susData) return {
		caster: "0.00",
		kpi: "0.00",
		camberOffset: 0
	};
	const section = isFront ? susData.FRONT : susData.REAR;
	if (!section) return {
		caster: "0.00",
		kpi: "0.00",
		camberOffset: 0
	};
	const type = section.TYPE || 'DWB';
	const parse = (str) => String(str || "0,0,0").split(',').map(v => parseFloat(v.trim()));
	let casterDeg = 0;
	let kpiDeg = 0;
	let camberOffset = 0;
	if (type === 'STRUT') {
		const car = parse(section.STRUT_CAR);
		const tyre = parse(section.STRUT_TYRE);
		const bot = parse(section.WBTYRE_BOTTOM);
		// ACのストラット計算に近づけるためのベクトル計算
		const dx = car[0] - tyre[0];
		const dy = car[1] - tyre[1];
		const dz = car[2] - tyre[2];
		// キャスター角
		casterDeg = -(Math.atan2(dz, dy) * (180 / Math.PI));
		// KPI角
		kpiDeg = -(Math.atan2(car[0] - bot[0], car[1] - bot[1]) * (180 / Math.PI));
		// --- 追加：キャンバーの補正値 ---
		// ストラットの傾きから生じるキャンバー変化の概算
		camberOffset = Math.atan2(dx, dy) * (180 / Math.PI);
	} else {
		// --- DWB形式 ---
		const top = parse(section.WBTYRE_TOP);
		const bot = parse(section.WBTYRE_BOTTOM);
		const dx = top[0] - bot[0];
		const dy = top[1] - bot[1];
		const dz = top[2] - bot[2];
		casterDeg = -(Math.atan2(dz, dy) * (180 / Math.PI));
		kpiDeg = -(Math.atan2(dx, dy) * (180 / Math.PI));
		camberOffset = 0; // DWBはSTATIC_CAMBERが比較的そのまま出やすい
	}
	return {
		caster: casterDeg.toFixed(2),
		kpi: kpiDeg.toFixed(2),
		camberOffset: camberOffset
	};
}
/**
 * 3. スプリングレートの表示
 */
function updateSpringRateDisplay(data) {
	const g = 9806.65;
	['front', 'rear'].forEach(side => {
		const section = side.toUpperCase();
		if (!data[section]) return;
		const springRate = parseFloat(data[section].SPRING_RATE) || 0;
		const progRate = parseFloat(data[section].PROGRESSIVE_SPRING_RATE) || 0;
		const mainKg = (springRate / g).toFixed(1);
		const mainRateSpan = document.querySelector(`#spring-${side}-val .main-rate`);
		if (mainRateSpan) mainRateSpan.textContent = mainKg;
		const progElem = document.getElementById(`spring-${side}-prog`);
		if (progElem && progRate > 0) {
			progElem.textContent = ` (+${(progRate/g).toFixed(1)}k/m)`;
		} else if (progElem) {
			progElem.textContent = "";
		}
	});
}
/**
 * 4. オーバーレイ更新のメイン関数
 */
window.refreshAlignmentOverlay = function() {
	const sus = window.currentSuspensionData;
	const tyre = window.currentTyreData;
	if (!sus) return;
	// 1. キャンバー (STATIC_CAMBER)
	if (sus.FRONT) {
		const fCamber = parseFloat(sus.FRONT.STATIC_CAMBER || 0).toFixed(2);
		updateValueText('camber-front-fr', fCamber);
		updateValueText('camber-front-fl', fCamber);
	}
	if (sus.REAR) {
		const rCamber = parseFloat(sus.REAR.STATIC_CAMBER || 0).toFixed(2);
		updateValueText('camber-rear-rr', rCamber);
		updateValueText('camber-rear-rl', rCamber);
	}
	// 2. トー (TOE_OUT)
	if (sus.FRONT) updateValueText('toe-front', parseFloat(sus.FRONT.TOE_OUT || 0).toFixed(2));
	if (sus.REAR) updateValueText('toe-rear', parseFloat(sus.REAR.TOE_OUT || 0).toFixed(2));
	// 3. キャスター & KPI (最新の引数形式で呼び出し)
	const fAngles = calculateGeometryAngles(sus, true);
	updateValueText('caster-left', fAngles.caster);
	updateValueText('caster-right', fAngles.caster);
	updateValueText('kpi-left', fAngles.kpi);
	updateValueText('kpi-right', fAngles.kpi);
	// 4. タイヤサイズ
	if (tyre) {
		['FRONT', 'REAR'].forEach(side => {
			const data = tyre[side];
			if (!data) return;
			const widthM = parseFloat(data.WIDTH || 0);
			const radiusM = parseFloat(data.RADIUS || 0);
			const rimRadiusM = parseFloat(data.RIM_RADIUS || 0);
			if (widthM > 0) {
				const realRimRadiusM = rimRadiusM - 0.0127;
				const widthMM = Math.round(widthM * 1000);
				const rimInch = Math.round((realRimRadiusM * 2) / 0.0254);
				const aspect = Math.round(((radiusM - realRimRadiusM) / widthM) * 100);
				const prefix = side.toLowerCase();
				updateValueText(`tire-${prefix}-width`, widthMM);
				updateValueText(`tire-${prefix}-aspect`, aspect);
				updateValueText(`tire-${prefix}-rim`, rimInch);
			}
		});
	}
	updateSpringRateDisplay(sus);
	// 5. ダンパー位置
	const damperVal = document.querySelector('#damper-val .main-rate');
	if (damperVal) {
		const fRod = sus.FRONT ? parseFloat(sus.FRONT.PACKER_RANGE || 0) * 1000 : 0;
		damperVal.textContent = fRod.toFixed(1);
	}
};