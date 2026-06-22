document.addEventListener('DOMContentLoaded', () => {
    const outputArea = document.getElementById('output-area');
    const dropZone = document.getElementById('drop-zone');

    // 共通の解析・表示関数
    function processFileData(content, type) {
        console.log("更新実行:", type);
        AppStorage.saveLastFile(content, type);
        // parser.js の関数を呼び出し
        executeAnalysis(content, type); 
    }

    // --- メニュー（Ctrl+O）からの受信設定 ---
    if (window.electronAPI && window.electronAPI.onFileOpened) {
        window.electronAPI.onFileOpened((data) => {
            console.log("メニューからファイルを受信しました");
            processFileData(data.content, data.type);
        });
    }

    // --- ドラッグ＆ドロップの受信設定 ---
    window.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        if (dropZone) dropZone.style.display = 'flex';
    });

    window.addEventListener('drop', (e) => {
        e.preventDefault();
        if (dropZone) dropZone.style.display = 'none';
        const file = e.dataTransfer.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const type = file.name.toLowerCase().endsWith('.lut') ? 'lut' : 'ini';
                processFileData(event.target.result, type);
            };
            reader.readAsText(file);
        }
    });

    // 解析・表示のメインロジック（executeAnalysis, displayINIResultなど）をここに含める
    function executeAnalysis(text, type) {
        outputArea.innerHTML = '';
        if (type === 'lut') {
            const points = AppParser.analyzeLUT(text);
            displayLUTResult(points);
        } else {
            const data = AppParser.analyzeINI(text);
            displayINIResult(data);
        }
    }

    function displayINIResult(data) {
        for (const section in data) {
            const h3 = document.createElement('h3');
            h3.textContent = `[${section}]`;
            h3.style.color = '#fcc419';
            outputArea.appendChild(h3);

            const table = document.createElement('table');
            table.className = 'result-table';
            let rows = '<thead><tr><th>キー</th><th>値</th></tr></thead><tbody>';
            for (const key in data[section]) {
                rows += `<tr><td>${key}</td><td>${data[section][key]}</td></tr>`;
            }
            rows += '</tbody>';
            table.innerHTML = rows;
            outputArea.appendChild(table);
        }
    }

    function displayLUTResult(points) {
        const h3 = document.createElement('h3');
        h3.textContent = 'LUT Data Points';
        outputArea.appendChild(h3);
        const pre = document.createElement('pre');
        pre.textContent = points.map(p => `${p.rpm.toFixed(0)} | ${p.torque.toFixed(2)}`).join('\n');
        outputArea.appendChild(pre);
    }

    // --- A. ドラッグ＆ドロップ (禁止マーク対策済み) ---
    window.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy'; // これで禁止マークが消えます
        if (dropZone) dropZone.style.display = 'flex';
    });

    window.addEventListener('dragleave', (e) => {
        if (e.relatedTarget === null && dropZone) dropZone.style.display = 'none';
    });

    window.addEventListener('drop', (e) => {
        e.preventDefault();
        if (dropZone) dropZone.style.display = 'none';
        
        const file = e.dataTransfer.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const type = file.name.toLowerCase().endsWith('.lut') ? 'lut' : 'ini';
                processFileData(event.target.result, type);
            };
            reader.readAsText(file);
        }
    });

    // --- B. ショートカット (Ctrl+O) 受信 ---
    if (window.electronAPI && window.electronAPI.onFileOpened) {
        window.electronAPI.onFileOpened((data) => {
            processFileData(data.content, data.type);
        });
    }

    // --- C. 起動時の復元 ---
    const lastFile = AppStorage.getLastFile();
    if (lastFile && lastFile.content) {
        executeAnalysis(lastFile.content, lastFile.type);
    }
});