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
	console.log("✅ [RESTORE] UIデータを復元しました:", data);
};

window.restoreUiCarData = restoreUiCarData;