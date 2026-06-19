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