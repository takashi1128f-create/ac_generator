// js/car.js

/**
 * 車両設定（car.ini）の詳細版UI生成
 */
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
			keys: ['DRIVEREYES', 'ONBOARD_EXPOSURE', 'OUTBOARD_EXPOSURE', 'ON_BOARD_PITCH_ANGLE', 'BUMPER_CAMERA_POS', 'BONNET_CAMERA_POS', 'MIRROR_POSITION', 'SHAKE_MUL', 'USE_ANIMATED_SUSPENSIONS', 'FUEL_LIGHT_MIN_LITERS', 'BUMPER_CAMERA_PITCH', 'BONNET_CAMERA_PITCH', 'VIRTUAL_MIRROR_ENABLED']
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
					window.currentCarData[section][key] = inputs[0].value;
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
				if (typeof window.requestRender === 'function') window.requestRender();
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
		});
		tab.items.forEach(itemDef => {
			if (!itemDef.isCustom && !data[itemDef.section]) return;
			const sectionWrapper = document.createElement('article');
			sectionWrapper.innerHTML = `<div class="suspension-item-title_box"><p>${itemDef.section}</p></div>`;
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