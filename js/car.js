// js/car.js

// ==========================================
// ★追加：フォーカスを破壊しない、綺麗なカスタムポップアップを表示する関数
// ==========================================
window.showCustomPopup = function(messageHtml) {
	const overlay = document.createElement('div');
	overlay.className = 'custom-popup-overlay';

	const box = document.createElement('div');
	box.className = 'custom-popup-box';
	box.innerHTML = messageHtml;

	const btnWrap = document.createElement('div');
	btnWrap.className = 'custom-popup-btn-wrap';

	const btn = document.createElement('button');
	btn.className = 'custom-popup-btn';
	btn.textContent = 'OK';

	// OKボタンを押したらポップアップを消す
	btn.onclick = () => {
		document.body.removeChild(overlay);
	};

	btnWrap.appendChild(btn);
	box.appendChild(btnWrap);
	overlay.appendChild(box);
	document.body.appendChild(overlay);
};

/**
 * 車両設定（car.ini）の詳細版UI生成
 */
window.updateCarEditorUI = function(data) {
	const container = document.getElementById('car-data-container');
	if (!container || !data) return;
	const carTabDefinitions = [{
		id: 'car-info',
		label: 'INFO',
		items: [{
			section: 'HEADER', // ★追加：HEADERセクション
			keys: ['VERSION']  // ★追加：VERSIONを表示
		}, {
			section: 'INFO',
			keys: ['SCREEN_NAME']
		}, {
			section: 'BASIC',
			keys: ['TOTALMASS', 'INERTIA', 'GRAPHICS_OFFSET']
		}]
	}, {
		id: 'car-graphics',
		label: 'GRAPHICS',
		items: [{
			section: 'GRAPHICS',
			title: '💺 シートポジション設定 (view.ini)', // ★修正：view.ini専用グループ
			keys: ['DRIVEREYES', 'ON_BOARD_PITCH_ANGLE', 'ON_BOARD_YAW_ANGLE']
		}, {
			section: 'GRAPHICS',
			title: 'メーター・ダッシュボード視点 (dash_cam.ini)', // ★修正：dash_cam.ini専用グループ
			keys: ['DASH_CAM_POS']
		}, {
			section: 'GRAPHICS',
			title: 'F1 CAMERA SETTINGS (car.ini)', // ★修正：car.iniの外部カメラグループ
			keys: ['BUMPER_CAMERA_POS', 'BUMPER_CAMERA_PITCH', 'BONNET_CAMERA_POS', 'BONNET_CAMERA_PITCH', 'CHASE_CAMERA_PITCH']
		}, {
			section: 'GRAPHICS',
			title: 'GRAPHICS & SYSTEM SETTINGS', // ★修正：システム・画面効果用のサブタイトル（スペルミス修正）
			keys: ['ONBOARD_EXPOSURE', 'OUTBOARD_EXPOSURE', 'MIRROR_POSITION', 'SHAKE_MUL', 'USE_ANIMATED_SUSPENSIONS', 'FUEL_LIGHT_MIN_LITERS', 'VIRTUAL_MIRROR_ENABLED']
		}]
	}, {
		id: 'car-controls',
		label: 'CONTROLS',
		items: [{
			section: 'CONTROLS',
			keys: ['FFMULT', 'STEER_ASSIST', 'STEER_LOCK', 'STEER_RATIO', 'LINEAR_STEER_ROD_RATIO']
		}, {
			section: 'STEER_TEST',
			isCustom: true
		}]
	}, {
		id: 'car-fueltank',
		label: 'FUEL',
		items: [{
			section: 'FUEL',
			keys: ['CONSUMPTION', 'MAX_FUEL']
		}, {
			section: 'FUELTANK',
			keys: ['POSITION']
		}]
	}];
	const activeBtn = container.querySelector('.suspension-tab-btn.active');
	const currentActiveLabel = activeBtn ? activeBtn.textContent : 'INFO';
	container.innerHTML = '';
	const tabMenu = document.createElement('div');
	tabMenu.className = 'suspension-tab-menu';
	container.appendChild(tabMenu);
	const contentArea = document.createElement('div');
	contentArea.className = 'suspension-tab-content';
	container.appendChild(contentArea);
	const addCarInput = (parent, section, key, val) => {
		const isCoord = String(val).includes(',');
		const vals = isCoord ? val.split(',').map(v => v.trim()) : [val];
		const itemDiv = document.createElement('div');
		itemDiv.className = 'suspension-item' + (isCoord ? ' is-coordinate' : '');
		// ★修正：mapループの中で、それぞれの input に step, min, max を割り当てる
		let inputsHtml = vals.map((v, i) => {
			// ★修正：VERSIONの場合は自動拡張機能付きのセレクトボックスにする
			if (key === 'VERSION') {
				const options = ['1', '2', 'extended-2'];
				// 未知のバージョンが来たら、その場だけ選択肢に追加する
				if (!options.includes(v) && v !== "") options.push(v);
				
				const optionsHtml = options.map(opt => 
					`<option value="${opt}" ${opt === v ? 'selected' : ''}>${opt}</option>`
				).join('');
				
				return `<select class="text-input" data-idx="${i}">${optionsHtml}</select>`;
			}
			// ★追加：USE_ANIMATED_SUSPENSIONS や VIRTUAL_MIRROR_ENABLED などのON/OFFフラグはチェックボックスにする
			if (key === 'USE_ANIMATED_SUSPENSIONS' || key === 'VIRTUAL_MIRROR_ENABLED') {
				const isChecked = parseInt(v) === 1 ? 'checked' : '';
				return `<input type="checkbox" class="suspension-item-toggle text-input" data-idx="${i}" ${isChecked} style="width:auto; height:auto; transform:scale(1.2); margin-left:5px; cursor:pointer;">`;
			}
			const editorRule = window.getEditorStep(key, val);
			const currentStep = typeof editorRule === 'object' ? editorRule.step : editorRule;
			const currentMin = typeof editorRule === 'object' && editorRule.min !== "" ? ` min="${editorRule.min}"` : "";
			const currentMax = typeof editorRule === 'object' && editorRule.max !== "" ? ` max="${editorRule.max}"` : "";
			return `<input type="${isNaN(v) ? 'text' : 'number'}" class="text-input" data-idx="${i}" value="${v}" step="${currentStep}"${currentMin}${currentMax}>`;
		}).join('');
		itemDiv.innerHTML = `
			<div class="input-unit">
				<label>${key} ${isCoord ? '<span class="coord-label">(X, Y, Z)</span>' : ''}</label>
				<div class="input-with-range">${inputsHtml}</div>
			</div>
		`;
		parent.appendChild(itemDiv);
		
		// ★修正：inputだけでなくselectの変更も検知できるようにする
		const inputs = itemDiv.querySelectorAll('input, select');
		inputs.forEach(input => {
			input.addEventListener('input', () => {
				if (isCoord) {
					const newVals = Array.from(inputs).map(i => i.value);
					window.currentCarData[section][key] = newVals.join(',');
				} else {
					// ★修正：対象がチェックボックスの場合は 1 / 0 を、それ以外は通常の value を取得して記憶する
					if (inputs[0].type === 'checkbox') {
						window.currentCarData[section][key] = inputs[0].checked ? '1' : '0';
					} else {
						window.currentCarData[section][key] = inputs[0].value;
					}
					
					if (key === 'STEER_LOCK' || key === 'STEER_RATIO') {
						const steerSlider = document.getElementById('steer-tester');
						if (steerSlider) {
							const cData = window.currentCarData.CONTROLS || {};
							const lock = Math.abs(parseFloat(cData.STEER_LOCK)) || 450;
							steerSlider.min = -lock;
							steerSlider.max = lock;
						}
					}
				}
				// ★修正：描画更新を即座に実行する命令を追加
				if (window.updateSuspensionVisuals) window.updateSuspensionVisuals();
				
				// ★追加：数値を変更した時、フォーカス中の視点プレビューもリアルタイムに更新する
				if (window.updateCameraPreviewWithCurrentData) {
					window.updateCameraPreviewWithCurrentData();
				}
				// ★追加：カメラ・目線・ミラー位置のいずれかの数値が変わったら3Dのミラー表示も更新する
				const cameraKeys = [
					'DRIVEREYES', 'ON_BOARD_PITCH_ANGLE', 
					'BUMPER_CAMERA_POS', 'BUMPER_CAMERA_PITCH', 
					'BONNET_CAMERA_POS', 'BONNET_CAMERA_PITCH', 
					'CHASE_CAMERA_PITCH', 'MIRROR_POSITION'
				];
				if (cameraKeys.includes(key)) {
					if (typeof window.updateMirrorsVisuals === 'function') {
						window.updateMirrorsVisuals();
					}
				}
				if (typeof window.requestRender === 'function') window.requestRender();
			});

			// ==========================================
			// ★追加：入力欄にフォーカス（選択）された時の処理
			// ==========================================
			input.addEventListener('focus', () => {
				// カメラ関連のキー（座標またはピッチ角）かどうかを判定
				// ★修正：不要になった DASH_CAM_PITCH を消し、ON_BOARD_YAW_ANGLE を追加
				const cameraKeys = ['DRIVEREYES', 'ON_BOARD_PITCH_ANGLE', 'ON_BOARD_YAW_ANGLE', 'DASH_CAM_POS', 'BUMPER_CAMERA_POS', 'BUMPER_CAMERA_PITCH', 'BONNET_CAMERA_POS', 'BONNET_CAMERA_PITCH', 'MIRROR_POSITION'];
				
				// ★修正：特殊なファイル（マイドキュメントの view.ini）に保存されるキーの判定（dash_camは除外）
				const specialFileKeys = ['DRIVEREYES', 'ON_BOARD_PITCH_ANGLE', 'ON_BOARD_YAW_ANGLE'];
				if (cameraKeys.includes(key)) {
					
					// ★追加：特殊な視点を初めて触った時だけ、ブラウザの記憶（localStorage）を利用して1回だけ案内を出す
					if (specialFileKeys.includes(key)) {
						const isNoticed = localStorage.getItem('view_ini_noticed');
						// localStorage.removeItem('view_ini_noticed'); // ★テストが終わったらこの行は消すかコメントアウトしてください
						
						if (!isNoticed) {
							localStorage.setItem('view_ini_noticed', 'true'); // 案内済みフラグを立てる
							
							// ★修正：案内文から dash_cam.ini を削除し、view.ini 専用の案内に変更
							const msg = "💡 アセットコルサの仕様上、シートポジション（DRIVEREYES 等）は <b>view.ini</b> という特別なファイルに保存されます。<br><br>このツールでは書き出し時に自動でマイドキュメント内のフォルダを探し、安全にバックアップを取りながら保存を行います。";
							window.showCustomPopup(msg);
						}
					}

					// 1. グローバル変数に現在のキーを記憶させる

					// 1. グローバル変数に現在のキーを記憶させる
					window.currentActiveCameraKey = key;
					
					// 2. 他のすべてのハイライトを消す
					document.querySelectorAll('.active-camera-item').forEach(el => {
						el.classList.remove('active-camera-item');
					});
					
					// 3. 自分の親要素（.suspension-item）をハイライトする
					itemDiv.classList.add('active-camera-item');
					
					// 4. 3D画面側に「カメラを移動しろ」と命令を出す司令塔を呼ぶ
					if (window.updateCameraPreviewWithCurrentData) {
						window.updateCameraPreviewWithCurrentData();
					}
				}
			});
		});
	};
	carTabDefinitions.forEach((tab) => {
		const btn = document.createElement('button');
		btn.textContent = tab.label;
		const isActive = (tab.label === currentActiveLabel);
		btn.className = 'suspension-tab-btn' + (isActive ? ' active' : '');
		tabMenu.appendChild(btn);
		const panel = document.createElement('div');
		panel.className = 'suspension-tab-panel' + (isActive ? ' active' : '');
		contentArea.appendChild(panel);
		btn.addEventListener('click', () => {
			tabMenu.querySelectorAll('.suspension-tab-btn').forEach(b => b.classList.remove('active'));
			contentArea.querySelectorAll('.suspension-tab-panel').forEach(p => p.classList.remove('active'));
			btn.classList.add('active');
			panel.classList.add('active');
			
			// ★追加：タブが切り替わったらカメラを通常視点にリセットする
			if (window.resetPreviewCameraVision) {
				window.resetPreviewCameraVision();
			}
		});
		tab.items.forEach(itemDef => {
			if (!itemDef.isCustom && !data[itemDef.section]) return;
			const sectionWrapper = document.createElement('article');
			
			// ★修正：itemDefにtitleが定義されている場合はそれを使い、なければセクション名を表示する
			const displayTitle = itemDef.title ? itemDef.title : itemDef.section;
			sectionWrapper.innerHTML = `<div class="suspension-item-title_box"><p>${displayTitle}</p></div>`;
			
			const itemBox = document.createElement('div');
			itemBox.className = 'suspension-item_box';
			if (itemDef.keys) {
				itemDef.keys.forEach(key => {
					const val = data[itemDef.section][key] !== undefined ? data[itemDef.section][key] : "";
					addCarInput(itemBox, itemDef.section, key, val);
				});
			}
			if (itemDef.isCustom && itemDef.section === 'STEER_TEST') {
				const customBox = document.createElement('div');
				customBox.className = 'suspension-item_box';
				const inner = document.createElement('div');
				inner.className = 'suspension-item';
				const label = document.createElement('label');
				label.textContent = 'ステアリング';
				const input = document.createElement('input');
				input.type = 'range';
				input.id = 'steer-tester';
				const sData = (window.currentCarData && window.currentCarData.CONTROLS) ? window.currentCarData.CONTROLS : {};
				const sLock = Math.abs(parseFloat(sData.STEER_LOCK)) || 450;
				input.min = -sLock;
				input.max = sLock;
				input.value = -(window.currentSteerAngle || 0);
				input.step = '1';
				const span = document.createElement('span');
				span.id = 'steer-value';
				span.style.marginLeft = "10px";
				span.textContent = -parseFloat(input.value);
				input.addEventListener('input', (e) => {
					const val = -parseFloat(e.target.value);
					span.textContent = val;
					window.currentSteerAngle = val;
					if (window.updateSuspensionVisuals) window.updateSuspensionVisuals();
				});
				inner.appendChild(label);
				inner.appendChild(input);
				inner.appendChild(span);
				customBox.appendChild(inner);
				itemBox.appendChild(customBox);
			}
			sectionWrapper.appendChild(itemBox);
			panel.appendChild(sectionWrapper);
		});
	});
};
// ==========================================
// ★追加：car.iniの視点座標へカメラを移動させる関数
// ==========================================
window.savedPreviewCameraState = null; // ★追加：元のカメラ状態を記憶する変数
// ==========================================
// ★追加：カメラを滑らかにアニメーションさせる共通関数
// ==========================================
window.currentCameraAnimation = null;

window.animateCameraTransition = function(targetCamera, endPos, endQuat, endTarget, duration, onComplete) {
	// 既にアニメーション中なら前の動きをキャンセル（連続クリック対策）
	if (window.currentCameraAnimation) {
		cancelAnimationFrame(window.currentCameraAnimation);
	}
	
	const startPos = targetCamera.position.clone();
	const startQuat = targetCamera.quaternion.clone();
	
	let startTarget = null;
	if (window.controls) {
		startTarget = window.controls.target.clone();
	}

	let startTime = performance.now();

	function update() {
		const now = performance.now();
		const elapsed = now - startTime;
		let t = Math.min(elapsed / duration, 1.0);
		
		// イージング関数 (滑らかに加速して滑らかに減速する計算式)
		const easeT = t * t * (3 - 2 * t);
		
		// 位置と角度を少しずつ目標へ近づける
		targetCamera.position.lerpVectors(startPos, endPos, easeT);
		targetCamera.quaternion.slerpQuaternions(startQuat, endQuat, easeT);
		
		// OrbitControlsの注視点も一緒に移動させる
		if (window.controls && endTarget && startTarget) {
			window.controls.target.lerpVectors(startTarget, endTarget, easeT);
			window.controls.update();
		}

		if (window.requestRender) window.requestRender();

		// まだ時間が来ていなければ次のコマ（フレーム）を描画
		if (t < 1.0) {
			window.currentCameraAnimation = requestAnimationFrame(update);
		} else {
			window.currentCameraAnimation = null;
			if (onComplete) onComplete(); // 終わったら完了報告
		}
	}
	window.currentCameraAnimation = requestAnimationFrame(update);
};
window.movePreviewCameraToCarVision = function(posX, posY, posZ, pitchAngleDeg, label) {
	if (!window.camera || !window.suspensionScene) return;

	// サスペンション用カメラの制御を一時的に上書きする
	const targetCamera = window.camera; 

	// ★追加：元のカメラ位置とOrbitControlsのターゲットを記憶する（まだ記憶していなければ）
	if (!window.savedPreviewCameraState) {
		window.savedPreviewCameraState = {
			position: targetCamera.position.clone(),
			quaternion: targetCamera.quaternion.clone(),
			target: window.controls ? window.controls.target.clone() : new THREE.Vector3()
		};
	}
	
	// ★追加：OrbitControlsが動いていると視点がマウスに引っ張られるため一時的に無効化する
	if (window.controls) {
		window.controls.enabled = false;
	}

	// 1. 座標のパース
	const x = parseFloat(posX) || 0;
	const y = parseFloat(posY) || 0;
	const z = parseFloat(posZ) || 0;
	const pitch = parseFloat(pitchAngleDeg) || 0;

	// 2. 最終座標の決定
  // ★修正：model_app.jsで動かされた車体(Scene)の傾きと位置を基準にし、カメラの相対座標を完璧にワールド座標へ変換する
  let finalX = x;
  let finalY = y;
  let finalZ = z;

  // 空間内から本物の車体オブジェクト(Scene)を特定
  let carGroup = null;
  if (window.suspensionScene) {
    carGroup = window.suspensionScene.children.find(child => child.name === 'Scene');
  }
  if (!carGroup && window.scene) {
    carGroup = window.scene.children.find(child => child.name === 'Scene');
  }

  if (carGroup) {
    // カメラの生数値(x, y, z)は車体基準のローカル座標なので、THREE.Vector3 を使って
    // 車体(carGroup)が現在持っている位置・高さ・前後の傾きをすべて含んだ「本物のワールド座標」へ自動変換する
    const localPos = new THREE.Vector3(x, y, z);
    
    // 車体の現在の行列（マトリクス）を強制更新して最新の状態にする
    carGroup.updateMatrixWorld(true);
    
    // ローカル座標をワールド座標に変換
    localPos.applyMatrix4(carGroup.matrixWorld);
    
    finalX = localPos.x;
    finalY = localPos.y;
    finalZ = localPos.z;
  }
	// ★追加：BONNETとBUMPERの場合のみ、GRAPHICS_OFFSETのY軸を加算対象から除外（相殺）する
		if (label === 'BONNET' || label === 'BUMPER') {
			if (window.currentCarData && window.currentCarData.BASIC && window.currentCarData.BASIC.GRAPHICS_OFFSET) {
				const offsetParts = String(window.currentCarData.BASIC.GRAPHICS_OFFSET).split(',');
				if (offsetParts.length >= 2) {
					const offsetY = parseFloat(offsetParts[1].trim()) || 0;
					finalY -= offsetY; // 車体マトリクスで加算された高さを引き算して元に戻す
				}
			}
		}
  // 3. カメラを移動
  targetCamera.position.set(finalX, finalY, finalZ);

  // ★修正：DRIVER（運転席調整）の時は内装が見えるように残し、MIRRORの時だけ車体を非表示にする
  const isHide = (label === 'MIRROR');

  const hideOnlyCarMeshes = (sceneObj) => {
    if (!sceneObj) return;
    sceneObj.children.forEach(child => {
      // 床や空（名前なしメッシュ）は完全にスルーし、車体（Scene）とタイヤ（WHEEL_）の配下だけを対象にする
      if (child && (child.name === 'Scene' || child.name.startsWith('WHEEL_'))) {
        child.traverse((node) => {
          if (node.isMesh || node.type === 'Mesh') {
            node.visible = !isHide;
          }
        });
      }
    });
  };

  hideOnlyCarMeshes(window.suspensionScene);
  hideOnlyCarMeshes(window.scene);
  // 4. 視点の向き（方向とピッチ角）を設定
  // ★修正：ワールドのZ軸ではなく、車体の「現在の向き」に合わせてカメラを向かせる
  let lookDirection = new THREE.Vector3(0, 0, (label === 'MIRROR') ? -1 : 1); // Z軸プラスが前、マイナスが後ろ
  
  if (carGroup) {
      // 車体の回転情報を方向ベクトルに適用
      lookDirection.applyQuaternion(carGroup.quaternion);
  }
  
  // カメラ位置から、上で計算した方向へ少し先のポイントを見る
  const targetPoint = new THREE.Vector3(finalX, finalY, finalZ).add(lookDirection.multiplyScalar(10));
  
  // ★修正：瞬時に移動させず、まずは「最終的な目標の姿（ダミー）」を計算する
  const dummyCamera = targetCamera.clone();
  dummyCamera.position.set(finalX, finalY, finalZ);
  dummyCamera.lookAt(targetPoint);
  dummyCamera.rotateX(-pitch * (Math.PI / 180));

  // ★追加：上で計算した「最終的な姿（位置と角度）」に向けて、800ミリ秒（0.8秒）かけて滑らかに移動する
  window.animateCameraTransition(targetCamera, dummyCamera.position, dummyCamera.quaternion, targetPoint, 800);

	// 5. プレビュー画面上に現在の視点名をオーバーレイ表示する
	let overlay = document.getElementById('vision-overlay');
	if (!overlay) {
		overlay = document.createElement('div');
		overlay.id = 'vision-overlay';
		overlay.style.position = 'absolute';
		overlay.style.top = '16%;';
		overlay.style.left = '47vw';
		overlay.style.padding = '5px 10px';
		overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
		overlay.style.color = '#00ffff';
		overlay.style.fontWeight = 'bold';
		overlay.style.borderRadius = '5px';
		// overlay.style.pointerEvents = 'none'; // マウス操作の邪魔にならないように
		overlay.style.zIndex = '1000';
		// プレビューエリアに追加
		const previewArea = document.querySelector('.preview_inner_box') || document.body;
		previewArea.appendChild(overlay);
	}
	overlay.textContent = `👁️ ${label} VIEW`;
	overlay.style.display = 'block';

	if (window.requestRender) window.requestRender();
};

// 視点リセット（通常視点に戻す）用の関数
window.resetPreviewCameraVision = function() {
	const overlay = document.getElementById('vision-overlay');
	if (overlay) overlay.style.display = 'none';
	
	// ★修正：非表示になっていた車体モデルを「メッシュ単位で」確実に再表示させる
	const showOnlyCarMeshes = (sceneObj) => {
		if (!sceneObj) return;
		sceneObj.children.forEach(child => {
			if (child && (child.name === 'Scene' || child.name.startsWith('WHEEL_'))) {
				child.traverse((node) => {
					if (node.isMesh || node.type === 'Mesh') {
						node.visible = true;
					}
				});
			}
		});
	};
	showOnlyCarMeshes(window.suspensionScene);
	showOnlyCarMeshes(window.scene);

	// ★追加：カメラを元あった場所へ復旧させる
	if (window.savedPreviewCameraState && window.camera) {
		// ★修正：瞬時に戻さず、記憶しておいた状態に向けて800ミリ秒かけて滑らかに戻る
		window.animateCameraTransition(
			window.camera,
			window.savedPreviewCameraState.position,
			window.savedPreviewCameraState.quaternion,
			window.savedPreviewCameraState.target,
			800, // アニメーション時間（ミリ秒）
			() => {
				// ★アニメーションが完了した「後」に実行する処理
				if (window.controls) {
					window.controls.enabled = true; // OrbitControlsの操作を再有効化
				}
				
				// メモリをクリア
				window.savedPreviewCameraState = null;
				
				// フォーカスによるハイライトを消す
				document.querySelectorAll('.active-camera-item').forEach(el => {
					el.classList.remove('active-camera-item');
				});
				window.currentActiveCameraKey = null;
			}
		);
	}
	
	if (window.requestRender) window.requestRender();
};
// ==========================================
// ★追加：現在のデータから座標と角度を抽出してカメラを移動する司令塔
// ==========================================
window.updateCameraPreviewWithCurrentData = function() {
	const activeKey = window.currentActiveCameraKey;
	const carData = window.currentCarData;
	if (!activeKey || !carData || !carData.GRAPHICS) return;

	let posKey = null;
	let pitchKey = null;
	let label = '';

	// 1. フォーカスされたキーから、対になる座標と角度のキー名を割り出す
	// ★修正：ON_BOARD_YAW_ANGLE もドライバー視点のグループに追加し、ダッシュボード視点の対応も追加
	if (activeKey === 'DRIVEREYES' || activeKey === 'ON_BOARD_PITCH_ANGLE' || activeKey === 'ON_BOARD_YAW_ANGLE') {
		posKey = 'DRIVEREYES';
		pitchKey = 'ON_BOARD_PITCH_ANGLE'; // ※Yaw（左右の首振り）はThree.jsのカメラ挙動として現状は固定しているためピッチのみ使用
		label = 'DRIVER';
	} else if (activeKey === 'DASH_CAM_POS') {
		posKey = 'DASH_CAM_POS';
		pitchKey = null; // ダッシュボード視点は固定
		label = 'DASH_CAM';
	} else if (activeKey === 'BUMPER_CAMERA_POS' || activeKey === 'BUMPER_CAMERA_PITCH') {
		posKey = 'BUMPER_CAMERA_POS';
		pitchKey = 'BUMPER_CAMERA_PITCH';
		label = 'BUMPER';
	} else if (activeKey === 'BONNET_CAMERA_POS' || activeKey === 'BONNET_CAMERA_PITCH') {
		posKey = 'BONNET_CAMERA_POS';
		pitchKey = 'BONNET_CAMERA_PITCH';
		label = 'BONNET';
	} else if (activeKey === 'MIRROR_POSITION') {
		posKey = 'MIRROR_POSITION';
		pitchKey = null; // ミラーは角度設定がないため null
		label = 'MIRROR';
	} else {
		return;
	}

	let x = 0, y = 1.0, z = 0;
	let pitch = 0;

	// 2. INIデータから実際の座標を数値として取得する
	// ※ACエンジンの解析結果に基づき、GRAPHICS_OFFSET 等は一切加味せず、純粋な生の値を使用する
	if (posKey && carData.GRAPHICS[posKey]) {
		const parts = String(carData.GRAPHICS[posKey]).split(',').map(v => parseFloat(v.trim()));
		if (parts.length === 3 && !parts.some(isNaN)) {
			x = parts[0];
			y = parts[1];
			z = parts[2];
		}
	}

	// 3. INIデータから実際のピッチ角を数値として取得する
	if (pitchKey && carData.GRAPHICS[pitchKey]) {
		pitch = parseFloat(carData.GRAPHICS[pitchKey]) || 0;
	}

	// 4. 末尾にある実際のカメラ移動関数へ数値を渡して実行する
	if (typeof window.movePreviewCameraToCarVision === 'function') {
		window.movePreviewCameraToCarVision(x, y, z, pitch, label);
	}
};