// logo-name.js
export const updateBadgeImage = (dataFolder) => {
	const badgeImg = document.getElementById('ui-badge');
	// 起動時の待機ガード：dataFolderが空、またはフォルダパスとして不完全な場合はここで停止
	if (!badgeImg || !dataFolder || dataFolder === "") return;
	const cleanFolder = dataFolder.replace(/\/data$/, '').replace(/\\data$/, '');
	const badgePath = `${cleanFolder}/ui/badge.png`.replace(/\\/g, '/');

	const fs = require('fs');

	// 実際にファイルが存在する場合のみsrcを書き換える
	if (fs.existsSync(badgePath)) {
		badgeImg.src = `file:///${badgePath}`;
	}
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
window.addEventListener('error', (event) => {
    // 画像やリソースの読み込みエラーのみを捕捉
    if (event.target.tagName === 'IMG' || event.target.tagName === 'LINK' || event.target.tagName === 'SCRIPT') {
        console.error("🚨 読み込み失敗の犯人:", event.target.src || event.target.href);
    }
}, true);