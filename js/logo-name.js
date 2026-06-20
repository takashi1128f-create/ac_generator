// logo-name.js

/**
 * プロジェクトのデータフォルダからbadge.pngを表示する
 */
export const updateBadgeImage = (dataFolder) => {
	const badgeImg = document.getElementById('ui-badge');
	if (!badgeImg || !dataFolder) return;

	// /data/ が含まれている場合は削除して、直接 /ui/badge.png を繋ぐ
	const cleanFolder = dataFolder.replace(/\/data$/, '').replace(/\\data$/, '');
	const badgePath = `${cleanFolder}/ui/badge.png`.replace(/\\/g, '/');
	
	console.log("🛠 [Badge] 設定パス:", `file:///${badgePath}`);
	badgeImg.src = `file:///${badgePath}`;
};

// main.jsから呼び出せるように公開
window.updateBadgeImage = updateBadgeImage;

/**
 * バッジ画像の置換機能を初期化する
 */
export const initBadgeHandler = () => {
	const badgeInput = document.getElementById('badge-file-input');
	const badgeBtn = document.getElementById('btn-change-badge');

	if (!badgeBtn || !badgeInput) {
		console.error("❌ [Error] ボタンまたはinputが見つかりません。");
		return;
	}

	badgeBtn.addEventListener('click', () => {
		badgeInput.click();
	});

	badgeInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && file.path) {
            // パスを URL 形式に整形（Windowsの \ を / に置換）
            const formattedPath = file.path.replace(/\\/g, '/');
            
            // 1. パスを保持
            window.pendingBadgePath = formattedPath;
            
            // 2. 画面に反映
            const badgeImg = document.getElementById('ui-badge');
            if (badgeImg) {
                badgeImg.src = `file:///${formattedPath}`;
            }
        }
    });
};
/**
 * ui_car.json をパースして適用する
 */
export const updateUiCarData = (data) => {
	// console.log("[Logo-Name] 受信したデータ:", data);
	try {
		// 文字列ならJSONパースし、オブジェクトならそのまま使用する
		window.uiCarData = (typeof data === 'string') ? JSON.parse(data) : data;
		console.log("[Logo-Name] ui_car.json を正常に適用しました:", window.uiCarData);

		// --- HTMLへ反映 ---
		const parsedData = window.uiCarData;
		if (parsedData) {
			const setVal = (id, val) => {
				const el = document.getElementById(id);
				if (el) {
					if (el.tagName === 'INPUT') el.value = val || '';
					else el.textContent = val || '';
				}
			};

			setVal('ui-name', parsedData.name);
			setVal('ui-author', parsedData.author);
			setVal('ui-brand', parsedData.brand);
			setVal('ui-tags', parsedData.tags);
			setVal('ui-class', parsedData.class);

			if (parsedData.specs) {
				setVal('ui-specs-bhp', parsedData.specs.bhp);
				setVal('ui-specs-torque', parsedData.specs.torque);
				setVal('ui-specs-weight', parsedData.specs.weight);
				setVal('ui-specs-topspeed', parsedData.specs.topspeed);
				setVal('ui-specs-acceleration', parsedData.specs.acceleration);
				setVal('ui-specs-pwratio', parsedData.specs.pwratio);
			}
		}
	} catch (e) {
		console.error("[Logo-Name] ui_car.json 適用エラー:", e);
	}
};
window.updateUiCarData = updateUiCarData;
/**
 * 画面上の入力値をオブジェクトとして収集する
 */
export const collectUiCarData = () => {
	const getVal = (id) => document.getElementById(id)?.value || '';

	const data = {
		name: getVal('ui-name'),
		author: getVal('ui-author'),
		brand: getVal('ui-brand'),
		tags: getVal('ui-tags'),
		class: getVal('ui-class'),
		specs: {
			bhp: getVal('ui-specs-bhp'),
			torque: getVal('ui-specs-torque'),
			weight: getVal('ui-specs-weight'),
			topspeed: getVal('ui-specs-topspeed'),
			acceleration: getVal('ui-specs-acceleration'),
			pwratio: getVal('ui-specs-pwratio')
		}
	};
	return data;
};
window.collectUiCarData = collectUiCarData;
/**
 * UIデータを JSON としてダウンロードする
 */
export const downloadUiCarJson = () => {
	const data = window.collectUiCarData();
	const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = 'ui_car.json';
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
};
window.downloadUiCarJson = downloadUiCarJson;
/**
 * 物理データからスペックを計算・反映する
 */
export const updateSpecsFromPhysics = () => {
	// updateSpecsFromPhysics の冒頭に追加してください
console.log("【デバッグ開始】各データの中身を確認します");
console.log("[DEBUG-DATA] EngineData:", window.currentEngineData);
console.log("[DEBUG-DATA] GearSetList:", window.gearSetList);
console.log("[DEBUG-DATA] FinalRtoList:", window.finalRtoList);
console.log("[DEBUG-DATA] TyreCompoundList:", window.tyreCompoundList);
console.log("[DEBUG-DATA] CurrentSetupData:", window.currentSetupData);
	const car = window.currentCarData;
	const engine = window.currentEngineData;
	const lut = window.currentPowerLut; // engine.jsでパースされた {rpm, torque} の配列

	console.log("[DEBUG] 物理データからスペック計算を開始します...");

	const setVal = (id, val) => {
		const el = document.getElementById(id);
		if (el) el.textContent = val;
	};

	// 1. Weight (car.ini -> [BASIC] TOTALMASS)
	let weight = 0;
	if (car && car.BASIC && car.BASIC.TOTALMASS) {
		weight = parseFloat(car.BASIC.TOTALMASS);
		setVal('ui-specs-weight', `${weight} kg`);
		console.log(`[DEBUG] 重量算出: ${weight} kg`);
	} else {
		console.warn("[DEBUG] car.ini の TOTALMASS が見つかりません");
	}

	// 2. Power & Torque (power.lut と engine.ini から計算)
	if (engine && lut && lut.length > 0) {
		const limiter = parseFloat(engine.ENGINE_DATA?.LIMITER) || 8000;
		const BHP_CONSTANT = 7120.8;
		let maxTorque = 0;
		let maxPower = 0;

		// ターボ基数の取得 (engine.jsと同じロジック)
		let turboCount = 0;
		while (engine[`TURBO_${turboCount}`]) {
			turboCount++;
		}
		const activeCount = window.activeTurboCount !== null ? window.activeTurboCount : turboCount;

		// 0〜LIMITERまで回して最大値を探索する
		for (let rpm = 0; rpm <= limiter; rpm += 100) {
			let baseTorque = typeof window.getInterpolatedTorque === 'function' 
				? window.getInterpolatedTorque(rpm, lut) 
				: 0;

			let totalBoost = 0;
			for (let i = 0; i < activeCount; i++) {
				const turboObj = engine[`TURBO_${i}`];
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

			// NAトルクにターボ係数を乗算
			let tTor = baseTorque * (1.0 + totalBoost);
			let pwr = (tTor * rpm) / BHP_CONSTANT;

			if (tTor > maxTorque) maxTorque = tTor;
			if (pwr > maxPower) maxPower = pwr;
		}

		const finalBhp = Math.round(maxPower);
		const finalTorque = Math.round(maxTorque);

		setVal('ui-specs-bhp', `${finalBhp} whp`);
		setVal('ui-specs-torque', `${finalTorque} Nm`);
		console.log(`[DEBUG] 出力計算: ${finalBhp} whp / ${finalTorque} Nm`);

		// 3. Power to Weight Ratio の計算
	if (weight > 0 && finalBhp > 0) {
		const pwRatio = (weight / finalBhp).toFixed(2);
		setVal('ui-specs-pwratio', `${pwRatio} kg/hp`);
		console.log(`[DEBUG] パワーウェイトレシオ: ${pwRatio} kg/hp`);
	}

	// 4. 最高速度の算出
	let maxSpeed = 0;
	if (window.currentEngineData && window.currentEngineData.ENGINE_DATA && window.gearSetList && window.tyreCompoundList) {
		const limiter = parseFloat(window.currentEngineData.ENGINE_DATA.LIMITER);
		
		let finalRatio = 0;
		let topGearRatio = 0;
		
		const gearIdx = window.activeGearIdx !== undefined ? window.activeGearIdx : 0;
		const activeGearSet = window.gearSetList[gearIdx];
		
		// ★修正: データが `data.GEARS` の中にある仕様に合わせました
		if (activeGearSet && activeGearSet.data && activeGearSet.data.GEARS) {
			const gears = activeGearSet.data.GEARS;
			
			// COUNT(最大段数) を取得し、それを元にトップギア(例: GEAR_5)の数値を取得
			const count = parseInt(gears.COUNT) || 5;
			topGearRatio = parseFloat(gears[`GEAR_${count}`]);
			
			// ギアセット内に FINAL が存在する場合は取得
			if (gears.FINAL !== undefined) {
				finalRatio = parseFloat(gears.FINAL);
			}
		}
		
		// もしギアセット内に FINAL が無く、finalRtoList 側に存在する場合の処理
		if ((!finalRatio || isNaN(finalRatio)) && window.finalRtoList && window.finalRtoList.length > 0) {
			// drivetrain.js の仕様に合わせ、プレビュー用のインデックスを参照
			const finalIdx = window.previewSetupFinalIdx !== undefined ? window.previewSetupFinalIdx : 0;
			if (window.finalRtoList[finalIdx]) {
				finalRatio = parseFloat(window.finalRtoList[finalIdx].value || window.finalRtoList[finalIdx].ratio);
			}
		}
		
		const activeTyre = window.tyreCompoundList[window.activeTyreIdx !== undefined ? window.activeTyreIdx : 0];
		const radius = (activeTyre && activeTyre.data && activeTyre.data.REAR) ? parseFloat(activeTyre.data.REAR.RADIUS) : 0;

		console.log(`[DEBUG] 最高速計算用: Limiter=${limiter}, Final=${finalRatio}, TopGear=${topGearRatio}, Radius=${radius}`);

		if (limiter > 0 && finalRatio > 0 && topGearRatio > 0 && radius > 0) {
			maxSpeed = Math.round((limiter / (finalRatio * topGearRatio)) * (radius * 2 * Math.PI) * 0.06);
		}
	} else {
		console.warn("[DEBUG] 最高速計算: 必要なデータオブジェクトが存在しません");
	}
	setVal('ui-specs-topspeed', maxSpeed > 0 ? `${maxSpeed} km/h` : "");

	// 5. 加速時間の算出 (目安: PWR × 1.2)
	let accel = 0;
	if (weight > 0 && finalBhp > 0) {
		// 係数を1.2に調整 (例: PWR 3.93 × 1.2 = 約4.7秒)
		accel = ((weight / finalBhp) * 1.2).toFixed(1);
		console.log(`[DEBUG] 加速時間計算: Weight=${weight}, BHP=${finalBhp}, Result=${accel}`);
	}
	setVal('ui-specs-acceleration', accel > 0 ? `${accel} s` : "");
	} else {
		console.warn("[DEBUG] engine.ini または power.lut のデータ不足により馬力計算をスキップ");
	}
};
window.updateSpecsFromPhysics = updateSpecsFromPhysics;