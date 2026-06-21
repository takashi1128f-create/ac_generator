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