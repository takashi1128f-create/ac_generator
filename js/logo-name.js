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
	try {
		window.uiCarData = (typeof data === 'string') ? JSON.parse(data) : data;
		const parsedData = window.uiCarData;
		if (!parsedData) return;

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
		setVal('ui-country', parsedData.country);
		setVal('ui-version', parsedData.version);
		setVal('ui-url', parsedData.url);
		setVal('ui-year', parsedData.year);
	} catch (e) {
		console.error("[Logo-Name] ui_car.json 適用エラー:", e);
	}
};
window.updateUiCarData = updateUiCarData;

export const collectUiCarData = () => {
    // 値取得の補助関数
    const getVal = (id) => {
        const el = document.getElementById(id);
        if (!el) return "";
        return (el.tagName === "INPUT" || el.tagName === "TEXTAREA") ? el.value : el.textContent.trim();
    };

    const data = {
        name: getVal('ui-name'),
        author: getVal('ui-author'),
        brand: getVal('ui-brand'),
        tags: getVal('ui-tags'),
        class: getVal('ui-class'),
        country: getVal('ui-country'),
        version: getVal('ui-version'),
        url: getVal('ui-url'),
        year: getVal('ui-year')
    };

    console.log("🔍 [DEBUG] collectUiCarData 実行。取得値:", data);
    return data;
};

// 確実に window へ登録する（これが漏れているとmain.jsから見えない）
window.collectUiCarData = collectUiCarData;
export const restoreUiCarData = (data) => {
	if (!data) return;
	
    // ログを追加：復元時のデータ構造を確認
    console.log("🛠 [DEBUG] restoreUiCarData 実行。currentCarData:", window.currentCarData);

	const setVal = (id, val) => {
		const el = document.getElementById(id);
		if (el) {
			if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
				el.value = val || "";
			} else {
				el.textContent = val || "";
			}
		}
	};

	setVal('ui-name', data.name);
	setVal('ui-author', data.author);
	setVal('ui-brand', data.brand);
	setVal('ui-tags', data.tags);
	setVal('ui-class', data.class);
	setVal('ui-country', data.country);
	setVal('ui-version', data.version);
	setVal('ui-url', data.url);
	setVal('ui-year', data.year);

    // 重量の判定ロジックを詳細化
	if (window.currentCarData && window.currentCarData.BASIC) {
        const mass = window.currentCarData.BASIC.TOTALMASS;
        console.log("🛠 [DEBUG] TOTALMASS:", mass);
		window.updateSpecsDisplay({ weight: mass });
	} else {
        console.warn("⚠️ [DEBUG] currentCarData または BASIC が定義されていません。");
    }

	if (typeof window.updateSpecsFromPhysics === 'function') {
		window.updateSpecsFromPhysics();
	}
	console.log("✅ [RESTORE] UIデータを復元しました:", data);
};

window.restoreUiCarData = restoreUiCarData;
//スペック
// スペック状態を記憶する変数
window.currentSpecs = { whp: null, torque: null, weight: null, topspeed: null, acceleration: null, pwratio: null };

window.updateSpecsDisplay = function(specs) {
	if (window.isMultiUploading || window.isRestoring) return;
    if (!specs) return;
		console.log("🛠 [DEBUG] updateSpecsDisplay 呼び出し:", specs);
    console.log("🛠 [DEBUG] 更新前の specs:", window.currentSpecs);
    // 新しいデータを記憶変数にマージ（更新された項目だけを記憶）
    Object.assign(window.currentSpecs, specs);

    const setSpec = (id, val, unit) => {
        const el = document.getElementById(id);
        if (el) {
            // 現在記憶している値を使用する
            const displayVal = window.currentSpecs[valKeyByElementId(id)];
            el.textContent = (displayVal !== undefined && displayVal !== null && displayVal !== '') ? `${displayVal} ${unit}` : '--';
        }
    };

    // ヘルパー：IDからキーを特定
    function valKeyByElementId(id) {
        if (id === 'ui-specs-ps') return 'whp';
        if (id === 'ui-specs-torque') return 'torque';
        if (id === 'ui-specs-weight') return 'weight';
        if (id === 'ui-specs-topspeed') return 'topspeed';
        if (id === 'ui-specs-acceleration') return 'acceleration';
        if (id === 'ui-specs-pwratio') return 'pwratio';
        return '';
    }

    setSpec('ui-specs-ps', 'whp', 'ps');
    setSpec('ui-specs-torque', 'torque', 'Nm');
    setSpec('ui-specs-weight', 'weight', 'kg');
    setSpec('ui-specs-topspeed', 'topspeed', 'km/h');
    setSpec('ui-specs-acceleration', 'acceleration', 's');
    setSpec('ui-specs-pwratio', 'pwratio', 'kg/ps');
};
