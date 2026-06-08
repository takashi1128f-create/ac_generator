// js/tab.js
document.addEventListener('DOMContentLoaded', () => {
	const autoManualPages = document.querySelectorAll('.manual-page');
	autoManualPages.forEach((page, index) => {
		page.setAttribute('data-page', index + 1);
	});
	// 注意事項以外のページにあるタイトルボックスのみを対象にする
	const titleBoxes = document.querySelectorAll('.manual-page-title_box');
	titleBoxes.forEach((box, index) => {
			const h2 = box.querySelector('h2');
			if (h2) {
					h2.setAttribute('data-page', index + 1);
			}
	});
	// ==========================================
	// 1. メイン & エディタータブ切り替え
	// ==========================================
	const tabs = document.querySelectorAll('.tab-btn');
	const cameraContent = document.getElementById('camera-content');
	const suspensionContent = document.getElementById('suspension-content');
	const engineContent = document.getElementById('engine-content');
	const gearContent = document.getElementById('gear-content');
	const drivetrainContent = document.getElementById('drivetrain-content');
	const setupContent = document.getElementById('setup-content');
	const tireContent = document.getElementById('tire-content');
	const subContents = document.querySelectorAll('.sub-content');
	const editorTitle = document.getElementById('editor-title');
	const titleMap = window.EDITOR_TITLES || {};
	const descMap = window.EDITOR_DESCRIPTIONS || {};
	tabs.forEach(tab => {
		tab.addEventListener('click', () => {
			// ★追加：メインタブを切り替えた際に、視点と透過状態を必ずリセットする
			if (window.resetPreviewCameraVision) {
				window.resetPreviewCameraVision();
			}
			const target = tab.dataset.tab; // editor, suspension, engine, tire など
			const subTarget = tab.dataset.sub; // sus-editor, tyre-editor, 等
			// ボタンの活性状態切り替え
			tabs.forEach(t => t.classList.remove('active'));
			tab.classList.add('active');
			// --- ★ 大枠を全て確実に隠す ---
			if (cameraContent) cameraContent.classList.add('tab-hidden');
			if (suspensionContent) suspensionContent.classList.add('tab-hidden');
			if (tireContent) tireContent.classList.add('tab-hidden');
			if (engineContent) engineContent.classList.add('tab-hidden');
			if (drivetrainContent) drivetrainContent.classList.add('tab-hidden');
			if (setupContent) setupContent.classList.add('tab-hidden');
			if (gearContent) gearContent.classList.add('tab-hidden');
			// --- ターゲットだけを表示する ---
			if (target === 'editor') {
				if (cameraContent) cameraContent.classList.remove('tab-hidden');
			} else if (target === 'suspension') {
				if (suspensionContent) suspensionContent.classList.remove('tab-hidden');
			} else if (target === 'tire') {
				if (tireContent) tireContent.classList.remove('tab-hidden');
				setTimeout(() => {
					if (typeof window.updateTiresChart === 'function') {
						window.updateTiresChart();
					}
				}, 50);
			} else if (target === 'engine') {
				if (engineContent) engineContent.classList.remove('tab-hidden');
				if (typeof window.updateEngineGraph === 'function') {
					window.updateEngineGraph();
				}
			} else if (target === 'drivetrain' || target === 'gear') {
				if (drivetrainContent) drivetrainContent.classList.remove('tab-hidden');
				if (gearContent) gearContent.classList.remove('tab-hidden');
				if (typeof window.initDrivetrainEditor === 'function') {
					window.initDrivetrainEditor(window.currentDrivetrainData);
				}
				if (typeof window.updateGearChart === 'function') {
					window.updateGearChart();
				}
			} else if (target === 'setup') {
				if (setupContent) setupContent.classList.remove('tab-hidden');
			}
			// --- サブエディター（各入力画面）の切り替え ---
			if (subTarget) {
				if (editorTitle && titleMap[subTarget]) {
					editorTitle.textContent = titleMap[subTarget];
				}
				subContents.forEach(content => content.classList.add('tab-hidden'));
				const targetContent = document.getElementById(subTarget);
				if (targetContent) {
					targetContent.classList.remove('tab-hidden');
				}
			}
			// ... (以降のプレビュー領域切替、リサイズ対応などは元のまま) ...
			const previewArea = document.getElementById('preview-suspension');
			if (previewArea && target === 'suspension') {
				const alignmentGroup = previewArea.querySelector('.alignment-preview-group');
				const damperUI = document.getElementById('damper-special-ui');
				const visibilityControls = document.querySelector('.visibility-controls');
				if (subTarget === 'sus-editor') {
					const activeSusTab = document.querySelector('#suspension-data-container .suspension-tab-btn.active');
					const isDamper = activeSusTab && activeSusTab.textContent === 'ダンパー';
					if (alignmentGroup) alignmentGroup.style.display = isDamper ? 'none' : 'block';
					if (damperUI) damperUI.style.display = isDamper ? 'block' : 'none';
					if (visibilityControls) visibilityControls.style.display = isDamper ? 'none' : '';
					if (isDamper) {
						window.dispatchEvent(new Event('resize'));
					}
				} else {
					if (alignmentGroup) alignmentGroup.style.display = 'block';
					if (damperUI) damperUI.style.display = 'none';
					if (visibilityControls) visibilityControls.style.display = '';
				}
			}
			// リサイズ対応（描画の狂いを防ぐ）
			setTimeout(() => {
				if (typeof window.resizeAll === 'function') window.resizeAll();
				if (typeof frontCalculator !== 'undefined' && frontCalculator) frontCalculator.resize();
				if (typeof rearCalculator !== 'undefined' && rearCalculator) rearCalculator.resize();
			}, 10);
			const activeDescBox = document.getElementById(`desc-${target}`);
			const descText = descMap[subTarget] || descMap[`${target}-editor`];
			if (activeDescBox && descText) {
				// ふわっと切り替えるための処理
				activeDescBox.style.opacity = 0;
				setTimeout(() => {
					activeDescBox.innerHTML = descText;
					activeDescBox.style.opacity = 1;
				}, 150);
			}
		});
	});
	const initialActiveBtn = document.querySelector('.tab-btn.active');
	if (initialActiveBtn) {
		const target = initialActiveBtn.dataset.tab;
		const subTarget = initialActiveBtn.dataset.sub;
		const activeDescBox = document.getElementById(`desc-${target}`);
		const descText = descMap[subTarget] || descMap[`${target}-editor`];
		if (activeDescBox && descText) {
			activeDescBox.innerHTML = descText;
			activeDescBox.style.opacity = 1;
		}
	}
	// ==========================================
	// 2. サブタブ（アーム/ダンパー切替）
	// ==========================================
	const subtabButtons = document.querySelectorAll('.subtab-btn');
	const subtabPanes = document.querySelectorAll('.subtab-pane');
	subtabButtons.forEach(btn => {
		btn.addEventListener('click', () => {
			const target = btn.dataset.subtarget;
			subtabButtons.forEach(b => b.classList.remove('active'));
			btn.classList.add('active');
			subtabPanes.forEach(pane => {
				if (pane.id === `subtab-content-${target}`) {
					pane.classList.remove('tab-hidden');
					if (target === 'damper') {
						if (typeof frontCalculator !== 'undefined' && frontCalculator) frontCalculator.resize();
						if (typeof rearCalculator !== 'undefined' && rearCalculator) rearCalculator.resize();
					}
				} else {
					pane.classList.add('tab-hidden');
				}
			});
		});
	});
	// ==========================================
	// 3. モーダル（マニュアル）制御
	// ==========================================
	const infoBtn = document.getElementById('info-btn');
	const infoModal = document.getElementById('info-modal');
	const modalClose = document.getElementById('modal-close');
	let sliderInterval = null;
	// ★追加：無限ループのための下準備（クローン画像の追加）
	function initLoopSliders() {
		const tracks = document.querySelectorAll('.slider-img_box');
		tracks.forEach(track => {
			// 既にクローンを追加済みならスキップ
			if (track.dataset.looped) return;
			const slides = track.querySelectorAll('.slider-img');
			if (slides.length <= 1) return;
			// 最初の画像を複製（クローン）して、一番最後に追加する
			const firstClone = slides[0].cloneNode(true);
			firstClone.classList.add('clone-slide'); // 判別用のクラス
			track.appendChild(firstClone);
			// セットアップ完了の目印
			track.dataset.looped = "true";
		});
	}

	function startManualSlider() {
		initLoopSliders(); // 開始前に必ず下準備を実行
		if (sliderInterval) clearInterval(sliderInterval);
		sliderInterval = setInterval(() => {
			const tracks = document.querySelectorAll('.slider-img_box');
			tracks.forEach((track) => {
				// 画面に見えていない時はスキップ
				if (track.offsetWidth === 0) return;
				const slides = track.querySelectorAll('.slider-img');
				if (slides.length <= 1) return;
				// 1枚の幅を正確に取得
				const slideWidth = slides[0].offsetWidth;
				if (slideWidth === 0) return;
				// 現在位置から「いま何枚目か」を計算
				let currentSlide = Math.round(track.scrollLeft / slideWidth);
				currentSlide++; // 次の画像へ
				// スクロール実行（滑らかに移動）
				track.scrollTo({
					left: currentSlide * slideWidth,
					behavior: 'smooth'
				});
				// ★追加：シームレスループのトリック
				// 今移動したのが「最後にくっつけたクローン画像」だった場合
				if (currentSlide === slides.length - 1) {
					// アニメーション（滑らかな移動）が終わるのを待つ（約600ミリ秒）
					setTimeout(() => {
						// ユーザーに気付かれないよう、一瞬で（behavior: 'auto'）本物の1枚目に戻す
						track.scrollTo({
							left: 0,
							behavior: 'auto'
						});
					}, 600);
				}
			});
		}, 5000); // 3秒ごとにスライド
	}

	function stopManualSlider() {
		if (sliderInterval) {
			clearInterval(sliderInterval);
			sliderInterval = null;
		}
	}
	if (infoBtn && infoModal) {
		infoBtn.addEventListener('click', (e) => {
			e.preventDefault();
			infoModal.classList.remove('hidden');
			startManualSlider();
		});
		modalClose.addEventListener('click', () => {
			infoModal.classList.add('hidden');
			stopManualSlider();
		});
		infoModal.addEventListener('click', (e) => {
			if (e.target === infoModal) {
				infoModal.classList.add('hidden');
				stopManualSlider();
			}
		});
	}
	const modalTabBtns = document.querySelectorAll('.modal-tab-btn');
	const modalPanels = document.querySelectorAll('.modal-tab-panel');
	modalTabBtns.forEach(btn => {
		btn.addEventListener('click', () => {
			const target = btn.dataset.modaltab;
			modalTabBtns.forEach(b => b.classList.remove('active'));
			btn.classList.add('active');
			modalPanels.forEach(panel => {
				panel.classList.remove('active');
				if (panel.id === `modaltab-${target}`) {
					panel.classList.add('active');
				}
			});
		});
	});
	let currentManualPage = 1;
	const manualPages = document.querySelectorAll('#modaltab-manual .manual-page');
	const totalManualPages = manualPages.length;
	const btnPrev = document.getElementById('manual-prev');
	const btnNext = document.getElementById('manual-next');
	const indicator = document.getElementById('manual-page-indicator');

	function updateManualPage() {
		manualPages.forEach(page => {
			if (parseInt(page.dataset.page) === currentManualPage) {
				page.classList.add('active');
			} else {
				page.classList.remove('active');
			}
		});
		if (indicator) indicator.textContent = `${currentManualPage} / ${totalManualPages}`;
		if (btnPrev) btnPrev.disabled = (currentManualPage === 1);
		if (btnNext) btnNext.disabled = (currentManualPage === totalManualPages);
		const scrollArea = document.querySelector('.manual-pages-container');
		if (scrollArea) {
			scrollArea.scrollTop = 0;
		}
	}
	if (btnPrev && btnNext) {
		btnPrev.addEventListener('click', () => {
			if (currentManualPage > 1) {
				currentManualPage--;
				updateManualPage();
			}
		});
		btnNext.addEventListener('click', () => {
			if (currentManualPage < totalManualPages) {
				currentManualPage++;
				updateManualPage();
			}
		});
	}
	const manualPageBtns = document.querySelectorAll('.manual-page-btn');
	const manualPageContents = document.querySelectorAll('.manual-page-content');
	const pageIndicator = document.getElementById('manual-page-indicator');

	// 初期表示
	updateManualPage();

	manualPageBtns.forEach(btn => {
		btn.addEventListener('click', () => {
			const pageNum = btn.dataset.page;
			currentManualPage = parseInt(pageNum); // 変数を更新

			updateIndicator(currentManualPage); // 関数を呼び出して更新

			manualPageBtns.forEach(b => b.classList.remove('active'));
			btn.classList.add('active');
			manualPageContents.forEach(content => {
				content.classList.remove('active');
				if (content.id === `manual-page-${pageNum}`) {
					content.classList.add('active');
				}
			});
			const scrollArea = document.querySelector('.manual-pages-container');
			if (scrollArea) scrollArea.scrollTop = 0;
		});
	});
	// ==========================================
	// 4. 全表示/非表示トグル制御（記憶・復元機能付き）
	// ==========================================
	const toggleAllBtn = document.getElementById('toggle-all-visibility');
	if (toggleAllBtn) {
		// ボタン形式ではなくトグル形式で反応するように change イベントに変更
		toggleAllBtn.addEventListener('change', (e) => {
			const isMasterOn = e.target.checked; // マスターがONかOFFか
			// ★追加：LINEトグルの文字と色を切り替える
			const lineStatus = document.getElementById('lineStatusText');
			if (lineStatus) {
				lineStatus.textContent = isMasterOn ? 'ON' : 'OFF';
				lineStatus.className = isMasterOn ? 'status-text on' : 'status-text off';
			}
			// IDとデータキーの紐付けリスト
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
					// ★ここが核心：
					// マスターONなら「強制的に表示(true)」
					// マスターOFFなら「記憶していた手動設定(manualVisibilityState)」に戻す
					const nextState = isMasterOn ? true : window.manualVisibilityState[key];
					
					el.checked = nextState;
					window.suspensionVisibility[key] = nextState;

					// コライダーの特殊処理
					if (key === 'collider' && window.colliderHelper) {
						window.colliderHelper.visible = nextState;
					}
				}
			});

			// 3D画面を最新の状態に更新する
			if (window.updateSuspensionVisuals) {
				window.updateSuspensionVisuals(window.currentSuspensionData);
			}
		});
	}
});
// ★追加：「解説ポップアップ」トグルの文字と色を切り替える設定
	const tyreTooltipSwitch = document.getElementById('toggle-tyre-tooltip');
	const tyreTooltipStatus = document.getElementById('tyreTooltipStatusText');
	if (tyreTooltipSwitch && tyreTooltipStatus) {
		tyreTooltipSwitch.addEventListener('change', (e) => {
			const isChecked = e.target.checked;
			tyreTooltipStatus.textContent = isChecked ? 'ON' : 'OFF';
			tyreTooltipStatus.className = isChecked ? 'status-text on' : 'status-text off';
		});
	}