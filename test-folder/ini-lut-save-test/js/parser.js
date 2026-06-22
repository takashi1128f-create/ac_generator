// ==========================================
// INI & LUT 解析ロジック専用
// ==========================================
const AppParser = {
		// LUT 解析
		analyzeLUT(text) {
				const lines = text.split(/\r?\n/);
				const points = [];

				lines.forEach((line) => {
						const clean = line.split(';')[0].split('//')[0].trim();
						if (!clean) return;

						const parts = clean.split('|');
						if (parts.length === 2) {
								const rpm = parseFloat(parts[0]);
								const torque = parseFloat(parts[1]);
								if (!isNaN(rpm) && !isNaN(torque)) {
										points.push({ rpm, torque });
								}
						}
				});

				points.sort((a, b) => a.rpm - b.rpm);
				return points;
		},

		// INI 解析
		analyzeINI(text) {
				const lines = text.split(/\r?\n/);
				let currentSection = null;
				const data = {};

				lines.forEach((line) => {
						let processingLine = line.trim();
						if (!processingLine || processingLine.startsWith(';')) return;

						if (processingLine.startsWith('[') && processingLine.endsWith(']')) {
								currentSection = processingLine.slice(1, -1);
								data[currentSection] = {};
								return;
						}

						if (currentSection && processingLine.includes('=')) {
								const parts = processingLine.split('=');
								const key = parts[0].trim();
								let cleanValue = parts.slice(1).join('=').split(';')[0].replace(/\t/g, ' ').trim();
								data[currentSection][key] = cleanValue;
						}
				});
				return data;
		},

		// INI テキスト生成
		generateINIText(data) {
				let output = "";
				for (const section in data) {
						output += `[${section}]\n`;
						for (const key in data[section]) {
								output += `${key}=${data[section][key]}\n`;
						}
						output += `\n`; 
				}
				return output;
		}
};
const { contextBridge, ipcRenderer } = require('electron');

// 一度だけ定義します
contextBridge.exposeInMainWorld('electronAPI', {
    // ウィンドウサイズ変更
    resizeWindow: (width, height) => ipcRenderer.send('resize-window', width, height),
    
    // ファイルが開かれた時の通知をメインから受け取る
    onFileOpened: (callback) => {
        // 二重登録を防ぐために一度削除してから登録
        ipcRenderer.removeAllListeners('file-opened');
        ipcRenderer.on('file-opened', (event, value) => callback(value));
    }
});