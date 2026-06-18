window.currentUiCarData = null;
window.uiTorqueChartInstance = null;

window.initLogoNameEditor = async function() {
	try {
		const res = await fetch('ui_car.json');
		if (res.ok) {
			window.currentUiCarData = await res.json();
			window.updateLogoNameUI(window.currentUiCarData);
			window.updateTorqueCurveChart(window.currentUiCarData);
		}
	} catch (error) {
		console.error("ui_car.jsonの読み込みに失敗しました:", error);
	}
};

window.updateLogoNameUI = function(data) {
	if (!data) return;

	const setInputValue = (id, value) => {
		const el = document.getElementById(id);
		if (el) el.value = value || "";
	};

	const setDivText = (id, value) => {
		const el = document.getElementById(id);
		if (el) el.textContent = value || "";
	};

	setInputValue('ui-name', data.name);
	setInputValue('ui-brand', data.brand);
	
	if (data.tags && Array.isArray(data.tags)) {
		setInputValue('ui-tags', data.tags.join(', '));
	}
	
	setInputValue('ui-class', data.class);

	if (data.description) {
		const formattedDesc = data.description.replace(/<br>/g, '\n');
		setInputValue('ui-description', formattedDesc);
	}

	if (data.specs) {
		setDivText('ui-specs-bhp', data.specs.bhp);
		setDivText('ui-specs-torque', data.specs.torque);
		setDivText('ui-specs-weight', data.specs.weight);
		setDivText('ui-specs-topspeed', data.specs.topspeed);
		setDivText('ui-specs-acceleration', data.specs.acceleration);
		setDivText('ui-specs-pwratio', data.specs.pwratio);
	}
};

window.updateTorqueCurveChart = function(data) {
	const canvas = document.getElementById('ui-torqueCurve');
	if (!canvas || !data) return;

	const labels = [];
	const torqueData = [];
	const powerData = [];

	if (data.torqueCurve && Array.isArray(data.torqueCurve)) {
		data.torqueCurve.forEach(point => {
			labels.push(point[0]);
			torqueData.push(point[1]);
		});
	}

	if (data.powerCurve && Array.isArray(data.powerCurve)) {
		data.powerCurve.forEach(point => {
			powerData.push(point[1]);
		});
	}

	if (window.uiTorqueChartInstance) {
		window.uiTorqueChartInstance.destroy();
	}

	window.uiTorqueChartInstance = new Chart(canvas, {
		type: 'line',
		data: {
			labels: labels,
			datasets: [
				{
					label: 'Torque (Nm)',
					data: torqueData,
					borderColor: '#3498db',
					yAxisID: 'y1',
					pointRadius: 0,
					tension: 0.1,
					borderWidth: 2
				},
				{
					label: 'Power (BHP)',
					data: powerData,
					borderColor: '#e74c3c',
					yAxisID: 'y2',
					pointRadius: 0,
					tension: 0.1,
					borderWidth: 2
				}
			]
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			animation: false,
			interaction: {
				mode: 'index',
				intersect: false,
			},
			scales: {
				x: {
					title: {
						display: true,
						text: 'RPM',
						color: '#888'
					},
					grid: {
						color: '#333'
					},
					ticks: {
						color: '#888'
					}
				},
				y1: {
					position: 'left',
					title: {
						display: true,
						text: 'Torque (Nm)',
						color: '#888'
					},
					grid: {
						color: '#333'
					},
					ticks: {
						color: '#888'
					}
				},
				y2: {
					position: 'right',
					title: {
						display: true,
						text: 'Power (BHP)',
						color: '#888'
					},
					grid: {
						drawOnChartArea: false
					},
					ticks: {
						color: '#888'
					}
				}
			},
			plugins: {
				legend: {
					display: true,
					labels: {
						color: '#eee'
					}
				}
			}
		}
	});
};

document.addEventListener('DOMContentLoaded', () => {
	window.initLogoNameEditor();
});
// ★追加：ロゴ画像の「置換」ボタンの動作
document.addEventListener('DOMContentLoaded', () => {
	const badgeImg = document.getElementById('ui-badge');
	const replaceBtn = document.querySelector('.logo-editor_box .btn_box button');

	if (replaceBtn && badgeImg) {
		replaceBtn.addEventListener('click', () => {
			const input = document.createElement('input');
			input.type = 'file';
			input.accept = 'image/png';
			input.onchange = (e) => {
				const file = e.target.files;
				if (file) {
					const reader = new FileReader();
					reader.onload = (re) => { badgeImg.src = re.target.result; };
					reader.readAsDataURL(file);
					if (window.modifiedStatus) window.modifiedStatus.car = true; // 編集フラグを立てる
				}
			};
			input.click();
		});
	}
});

// ★追加：car.ini や engine.ini のデータからロゴ画面のスペックを自動更新する関数
window.syncLogoNameFromOtherData = function() {
	const car = window.currentCarData || {};
	const lut = window.currentPowerLut || [];

	const nameInput = document.getElementById('ui-name');
	if (nameInput && !nameInput.value) nameInput.value = car.INFO?.SCREEN_NAME || "";

	const brandInput = document.getElementById('ui-brand');
	if (brandInput && !brandInput.value) brandInput.value = car.HEADER?.BRAND || "";

	const weightVal = car.BASIC?.TOTALMASS ? parseFloat(car.BASIC.TOTALMASS) : 0;
	const weightDisp = document.getElementById('ui-specs-weight');
	if (weightDisp) weightDisp.textContent = weightVal > 0 ? `${weightVal} kg` : "--- kg";

	let maxTorque = 0;
	let maxBhp = 0;
	lut.forEach(p => {
		if (p.torque > maxTorque) maxTorque = p.torque;
		const bhp = (p.torque * p.rpm) / 7120.8;
		if (bhp > maxBhp) maxBhp = bhp;
	});

	const bhpDisp = document.getElementById('ui-specs-bhp');
	if (bhpDisp) bhpDisp.textContent = maxBhp > 0 ? `${Math.round(maxBhp)} CV` : "--- CV";

	const torqueDisp = document.getElementById('ui-specs-torque');
	if (torqueDisp) torqueDisp.textContent = maxTorque > 0 ? `${Math.round(maxTorque)} Nm` : "--- Nm";

	const pwDisp = document.getElementById('ui-specs-pwratio');
	if (pwDisp && weightVal > 0 && maxBhp > 0) {
		pwDisp.textContent = (weightVal / maxBhp).toFixed(2) + " kg/CV";
	}

	const rightSideInfo = document.querySelector('.logo-name-outer_box > div:last-child');
	if (rightSideInfo) {
		rightSideInfo.innerHTML = `
			<article class="aero-section-box">
				<div class="suspension-item-title_box"><p>PROJECT INFO</p></div>
				<div class="suspension-item_box" style="font-size: 0.8rem; color: #ccc; line-height: 1.6;">
					<p>📁 フォルダ名: ${window.currentCarDirectoryName || "未特定"}</p>
					<p>📍 保存先パス: <br><small style="color: #888;">${window.currentDataFolderPath || "未設定"}</small></p>
				</div>
			</article>
		`;
	}
};

document.addEventListener('click', (e) => {
	if (e.target.closest('.logo-editor_box .btn_box button')) {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = 'image/png';
		input.onchange = (ev) => {
			const file = ev.target.files;
			if (file) {
				const reader = new FileReader();
				reader.onload = (re) => {
					document.getElementById('ui-badge').src = re.target.result;
				};
				reader.readAsDataURL(file);
				if (window.modifiedStatus) window.modifiedStatus.car = true;
			}
		};
		input.click();
	}
});