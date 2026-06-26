// js/logo-name.js

/**
 * プロジェクトのデータフォルダからbadge.pngを表示する
 */
export const updateBadgeImage = (dataFolder) => {
    const badgeImg = document.getElementById('ui-badge');
    if (!badgeImg || !dataFolder) return;
    const cleanFolder = dataFolder.replace(/\\data$/, '').replace(/\/data$/, '');
    const badgePath = `${cleanFolder}/ui/badge.png`.replace(/\\/g, '/');
    badgeImg.src = `file:///${badgePath}`;
};
window.updateBadgeImage = updateBadgeImage;

/**
 * バッジ画像の置換機能を初期化する
 */
export const initBadgeHandler = () => {
    const badgeInput = document.getElementById('badge-file-input');
    const badgeBtn = document.getElementById('btn-change-badge');
    if (!badgeBtn || !badgeInput) return;

    badgeBtn.addEventListener('click', () => badgeInput.click());
    badgeInput.addEventListener('change', (e) => {
        const file = e.target.files;
        if (file && file.path) {
            const formattedPath = file.path.replace(/\\/g, '/');
            window.pendingBadgePath = formattedPath;
            const badgeImg = document.getElementById('ui-badge');
            if (badgeImg) badgeImg.src = `file:///${formattedPath}`;
        }
    });
};

/**
 * ui_car.json をパースして適用する（<br>を改行コードに変換）
 */
export const updateUiCarData = (data) => {
    try {
        window.uiCarData = (typeof data === 'string') ? JSON.parse(data) : data;
        const parsedData = window.uiCarData;
        if (!parsedData) return;

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (!el) return;
            // INPUT または TEXTAREA の場合は value をセット
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.value = val || '';
            } else {
                el.textContent = val || '';
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

        // ★追加：description の <br> を改行コード \n に変換してエディターへ反映
        const descEl = document.getElementById('ui-description');
        if (descEl && parsedData.description) {
            descEl.value = parsedData.description.replace(/<br\s*\/?>/gi, '\n');
        }
    } catch (e) {
        console.error("[Logo-Name] ui_car.json 適用エラー:", e);
    }
};
window.updateUiCarData = updateUiCarData;

/**
 * UIから ui_car データを回収する（改行コードを<br>に変換）
 */
export const collectUiCarData = () => {
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
        year: getVal('ui-year'),
        // ★追加：エディターの改行を <br> タグに戻してJSONに保存
        description: getVal('ui-description').replace(/\n/g, '<br>')
    };
    return data;
};
window.collectUiCarData = collectUiCarData;

/**
 * 復元処理
 */
export const restoreUiCarData = (data) => {
    if (!data) return;
    updateUiCarData(data); // 共通のパース関数を呼ぶ

    if (window.currentCarData && window.currentCarData.BASIC) {
        const mass = window.currentCarData.BASIC.TOTALMASS;
        window.updateSpecsDisplay({ weight: mass });
    }
    if (typeof window.updateSpecsFromPhysics === 'function') {
        window.updateSpecsFromPhysics();
    }
};
window.restoreUiCarData = restoreUiCarData;

// スペック管理
window.currentSpecs = { whp: null, torque: null, weight: null, topspeed: null, acceleration: null, pwratio: null };

window.updateSpecsDisplay = function(specs) {
    if (window.isMultiUploading || window.isRestoring) return;
    if (!specs) return;

    Object.assign(window.currentSpecs, specs);

    const setSpec = (id, valKey, unit) => {
        const el = document.getElementById(id);
        if (el) {
            const displayVal = window.currentSpecs[valKey];
            el.textContent = (displayVal !== undefined && displayVal !== null && displayVal !== '') ? `${displayVal} ${unit}` : '--';
        }
    };

    setSpec('ui-specs-ps', 'whp', 'ps');
    setSpec('ui-specs-torque', 'torque', 'Nm');
    setSpec('ui-specs-weight', 'weight', 'kg');
    setSpec('ui-specs-topspeed', 'topspeed', 'km/h');
    setSpec('ui-specs-acceleration', 'acceleration', 's (0-100)'); // 単位をs (0-100)に明示
    setSpec('ui-specs-pwratio', 'pwratio', 'kg/ps');
};
// --- ★追加：スキンギャラリーの管理 ---
window.allCarSkins = [];
window.currentSkinIdx = 0;

window.initSkinGallery = function(skins) {
    console.log("🖼 [Gallery] 初期化開始。受信データ:", skins);
    window.allCarSkins = skins || [];
    window.currentSkinIdx = 0;
		// ★追加：要素の取得と表示・非表示の判定
    const listContainer = document.querySelector('.color-list_box'); // リストの外枠
    const arrowContainer = document.getElementById('color-preview-arrow'); // 矢印の枠
    
    // スキンが2種類以上ある時だけ表示する（1つ以下の場合は隠す）
    const isVisible = window.allCarSkins.length >= 2;
    if (listContainer) listContainer.style.display = isVisible ? 'block' : 'none';
    if (arrowContainer) arrowContainer.style.display = isVisible ? 'flex' : 'none';
    const listUl = document.querySelector('.color-list_box ul');
    const mainPreview = document.getElementById('car-color-preview');
    if (!listUl || !mainPreview) return;

    listUl.innerHTML = ''; // 既存のダミーを消去

    if (window.allCarSkins.length === 0) {
        mainPreview.innerHTML = 'スキンなし';
        console.warn("⚠ [Gallery] 有効なスキン画像が見つかりませんでした。");
        return;
    }

    // リストの生成
    window.allCarSkins.forEach((skin, idx) => {
        const li = document.createElement('li');
        // Electronのプロトコルを使用してローカル画像を表示
        li.innerHTML = `<img src="file:///${skin.path}" alt="${skin.name}" title="${skin.name}">`;
        li.addEventListener('click', () => window.selectSkin(idx));
        listUl.appendChild(li);
    });

    window.selectSkin(0); // 最初の画像を表示
    window.setupGalleryArrows(); // ◀ ▶ ボタンを有効化
};

window.selectSkin = function(idx) {
    if (idx < 0 || idx >= window.allCarSkins.length) return;
    window.currentSkinIdx = idx;
    const skin = window.allCarSkins[idx];
    const mainPreview = document.getElementById('car-color-preview');
    
    // メインプレビューの画像を差し替え
    mainPreview.innerHTML = `<img src="file:///${skin.path}" style="width:100%; height:100%; object-fit:cover;">`;

    // 選択中の <li> に枠を付ける（is-activeクラス）
    const items = document.querySelectorAll('.color-list_box li');
    items.forEach((item, i) => {
        if (i === idx) item.classList.add('is-active');
        else item.classList.remove('is-active');
    });
};

window.setupGalleryArrows = function() {
    // 付与していただいたID「color-preview-arrow」を使ってボタンを探します
    const arrowContainer = document.getElementById('color-preview-arrow');
    if (!arrowContainer) return;

    const arrows = arrowContainer.querySelectorAll('span');
    if (arrows.length >= 2) {
        // ★修正点： を付けることで左ボタンを特定します
        arrows[0].onclick = () => window.selectSkin(window.currentSkinIdx - 1); // ◀ 左
        arrows[1].onclick = () => window.selectSkin(window.currentSkinIdx + 1); // ▶ 右
    }
};