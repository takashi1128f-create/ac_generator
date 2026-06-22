// 設定や一時データの保存・読込専用のクラス
const AppStorage = {
		// 汎用保存
		save(key, value) {
				localStorage.setItem(key, JSON.stringify(value));
		},
		// 汎用読込
		load(key) {
				const data = localStorage.getItem(key);
				return data ? JSON.parse(data) : null;
		},
		// 最後に読み込んだファイルを保存
		saveLastFile(text, type) {
				localStorage.setItem('last_file_content', text);
				localStorage.setItem('last_file_type', type);
		},
		// 最後に読み込んだファイルを読込
		getLastFile() {
				return {
						content: localStorage.getItem('last_file_content'),
						type: localStorage.getItem('last_file_type')
				};
		}
};