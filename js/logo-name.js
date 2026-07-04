// js/logo-name.js
/**
 * プロジェクトのデータフォルダからbadge.pngを表示する
 */
export const updateBadgeImage = (dataFolder) => {
	const badgeImg = document.getElementById('ui-badge');
	if (!badgeImg || !dataFolder) return;
	// --- 修正：末尾が /data でも /ui でも、どちらでも綺麗に削り取る ---
	const cleanFolder = dataFolder.replace(/[\\/](data|ui)$/i, '');
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
	// 「置換」ボタンをクリックした時にファイル選択ダイアログを開く
	badgeBtn.addEventListener('click', () => badgeInput.click());
	// ファイルが選択された時の処理
	badgeInput.addEventListener('change', (e) => {
		// 【重要】e.target.files（カゴ）から、0番目の要素（ファイル本体）を取り出す
		const file = e.target.files[0];
		// --- 掴んだファイルが正しいかコンソールで確認 ---
		if (file) {
			console.log(" [DEBUG-BADGE] カゴからファイルを取り出しました！");
			console.log(" ➔ 名前:", file.name);
			console.log(" ➔ 型:", file.type);
			// Electron環境であれば、ここでフルパスが表示されます
			if (file.path) {
				console.log(" ➔ 物理パスを確認:", file.path);
			}
		} else {
			console.warn(" [DEBUG-BADGE] ファイルが選択されませんでした。");
			return;
		}
		// 表示先の <img> 要素を取得
		const badgeImg = document.getElementById('ui-badge');
		if (!badgeImg) return;
		// --- 画像の表示処理 ---
		// ドラッグ＆ドロップ（D&D）と同じように、Electronのパスがあればそれを使用し、
		// なければ Web標準の ObjectURL を生成して表示します。
		if (file.path) {
			// Electron環境：物理パスをURL形式に変換
			const formattedPath = file.path.replace(/\\/g, '/');
			window.pendingBadgePath = formattedPath; // 保存用にパスを保持
			// あなたの環境で動作実績のある形式でセット
			badgeImg.src = `file:///${formattedPath}`;
			console.log(" [DEBUG-BADGE] file:/// 形式で表示を更新しました。");
			// LIVE SYNCがONなら、今すぐゲームフォルダにコピーを実行させる
			if (typeof window.triggerLiveSync === 'function') {
				window.triggerLiveSync(false);
			}
		} else {
			// ブラウザ環境：メモリ上の一時URLを生成
			const imageUrl = URL.createObjectURL(file);
			badgeImg.src = imageUrl;
			console.log(" [DEBUG-BADGE] createObjectURL 形式で表示を更新しました。");
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
		const tagsDisplay = Array.isArray(parsedData.tags) ? parsedData.tags.join(', ') : (parsedData.tags || '');
		setVal('ui-tags', tagsDisplay);
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
		tags: getVal('ui-tags').split(',').map(t => t.trim()).filter(t => t !== ""),
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
		window.updateSpecsDisplay({
			weight: mass
		});
	}
	if (typeof window.updateSpecsFromPhysics === 'function') {
		window.updateSpecsFromPhysics();
	}
};
window.restoreUiCarData = restoreUiCarData;
// スペック管理
window.currentSpecs = {
	whp: null,
	torque: null,
	weight: null,
	topspeed: null,
	acceleration: null,
	pwratio: null
};
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
	mainPreview.innerHTML = `<img src="file:///${skin.path}">`;
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
/**
 * プロジェクト一覧を更新する関数 (js/logo-name.js)
 */
window.updateProjectSidebar = async function() {
	const listUl = document.getElementById('project-sidebar-list');
	if (!listUl) return;
	// 1. 最近のプロジェクト履歴と現在の状態を取得 [1]
	const recentProjects = await window.electronAPI.getRecentProjects();
	const currentPath = window.currentProjectPath;
	const currentName = window.currentProject?.projectName || "名称未設定";
	// 2. 現在のプロジェクトが「未保存」かチェック (*マーク用) [1]
	const isModified = Object.values(window.modifiedStatus || {}).some(s => s === true);
	listUl.innerHTML = ''; // 一旦リストを空にする
	// --- A. 編集中のプロジェクトを最上部に作成 ---
	const activeLi = document.createElement('li');
	activeLi.className = 'active-project-item'; // CSSで色を変える用クラス
	activeLi.innerHTML = `
				<span class="p-delete-icon" style="cursor:pointer;" title="プロジェクトを削除">🗑</span>
				<div class="p-name-label" style="flex:1;">${currentName}</div>
				<div class="p-edit-icon_box">
						<span class="p-edit-name-e-icon" style="cursor:pointer;" title="名前を変更">✎</span>
						<span class="p-edit-name-unsaved" style="display: ${isModified ? 'inline' : 'none'}">*</span>
				</div>
		`;
	// 【削除】編集中のものを削除
	activeLi.querySelector('.p-delete-icon').onclick = async () => {
		if (confirm(`現在編集中のプロジェクト「${currentName}」を完全に削除しますか？\n※フォルダ内のデータも消去されます。`)) {
			const result = await window.electronAPI.deleteProject(currentPath);
			if (result.success) location.reload(); // 削除後は初期画面へ戻す
		}
	};
	// 【改名】showCustomPrompt を使用して保存・フォルダ名変更を実行
	activeLi.querySelector('.p-edit-name-e-icon').onclick = async () => {
		const oldPath = window.currentProjectPath;
		const newName = await window.showCustomPrompt("プロジェクト名を変更:", currentName);
		if (newName && newName.trim() !== "" && newName !== currentName) {
			const confirmedName = newName.trim();
			window.currentProject.projectName = confirmedName;
			// 1. 新しい名前で保存（新フォルダ作成）
			const result = await window.electronAPI.saveProject(window.currentProject);
			if (result.success) {
				// 2. 以前の古いプロジェクトフォルダを削除して「複製」を防ぐ
				if (oldPath) {
					await window.electronAPI.deleteProject(oldPath);
				}
				// 3. 情報を更新してリストを書き換える
				window.currentProjectPath = result.path;
				window.updateProjectSidebar();
				if (window.electronAPI.setWindowTitle) window.electronAPI.setWindowTitle(confirmedName);
			}
		}
	};
	listUl.appendChild(activeLi);
	// --- B. 他のプロジェクト（履歴）を並べる ---
	recentProjects.forEach(proj => {
		if (proj.path === currentPath) return; // 編集中のものは飛ばす
		const li = document.createElement('li');
		li.innerHTML = `
						<span class="p-delete-icon" style="cursor:pointer;" title="削除">🗑</span>
						<div class="p-name-click-area" style="flex:1; cursor:pointer;">${proj.name}</div>
						<div class="p-edit-icon_box"></div>
				`;
		// 【切替】クリックで読み込み [3]
		li.querySelector('.p-name-click-area').onclick = async () => {
			if (isModified && !confirm("未保存の変更があります。破棄して切り替えますか？")) return;
			const result = await window.electronAPI.loadProjectByPath(proj.path); // 番号を消去
			if (result.success) {
				window.currentProject = result.data;
				window.currentProjectPath = proj.path;
				window.loadProjectToUI(window.currentProject);
				window.updateProjectSidebar();
			}
		};
		// 【削除】履歴から削除
		li.querySelector('.p-delete-icon').onclick = async (e) => {
			e.stopPropagation();
			if (confirm(`プロジェクト「${proj.name}」を完全に削除しますか？`)) {
				await window.electronAPI.deleteProject(proj.path);
				window.updateProjectSidebar(); // サイドバーのみ更新
			}
		};
		listUl.appendChild(li);
	});
};
// フォルダ名変更
document.getElementById('car-name-edit').addEventListener('click', async () => {
	const newName = document.getElementById('new-car-project-name').value.trim();
	if (!newName) return alert("車両名を入力してください");
	// 【修正箇所】window.parent(path) ではなく、文字列操作で data フォルダを削る
	const oldDataPath = window.currentDataFolderPath; // 例: "C:\...\car_folder\data"
	const oldPath = oldDataPath ? oldDataPath.replace(/[\\/]data$/i, '') : null;
	// 1. 物理フォルダをリネーム（必要な場合のみ）
	if (oldPath && confirm(`フォルダ名を「${newName}」に変更しますか？`)) {
		// window.electronAPI.renameCarFolder が main-electron.js / preload.js に実装されている必要があります
		const res = await window.electronAPI.renameCarFolder(oldPath, newName);
		if (res.success) {
			// 保存パスを新しいフォルダ基準のdataフォルダに書き換える
			window.currentDataFolderPath = res.newPath + "\\data";
		} else {
			return alert("フォルダのリネームに失敗しました: " + res.error);
		}
	}
	// 2. 内部変数を新しい名前にセット
	window.currentCarDirectoryName = newName;
	alert(`車両名を「${newName}」に変更しました。`);
});