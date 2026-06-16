const updateData = [
	// {
	// 	version: "V0.0.7",
	// 	date: "2026/06/16",
	// 	desc: "engine.iniの調整(テスト)",
	// 	items: [
	// 		{ title: "タイトル", list: ["内容", "内容"] },
	// 		{ title: "タイトル", list: ["内容", "内容"] }
	// 	]
	// },
	{
		version: "V0.0.7",
		date: "2026/06/16",
		desc: "engine.iniの調整(テスト)",
		items: ["engine.iniのツインターボ以上に対応", "engine.iniの複数のターボの書き出し変更","上記変更に伴いengineのグラフの調整"]
	},
	{
		version: "V0.0.6",
		date: "2026/06/14",
		desc: "view.iniの動き修正。",
		items: ["view.iniのバックアップ時のファイル名「view.ini_old」に変更", "LIVE SYNCの対応とON・OFF切り替え時、「view.ini」の対応を修正"]
	},
	{
		version: "V0.0.5",
		date: "2026/06/13",
		desc: "インストールファイル名およびダウンロード先の変更",
		items: ["過去ソフトを保存", "新規ダウンロード先変更"]
	},
	{
		version: "V0.0.4",
		date: "2026/06/10",
		desc: "更新内容の表示の調整しました。",
		items: ["自動アップデート対応", "その他表示バランス等の調整"]
	},
	{
		version: "V0.0.3",
		date: "2026/06/09",
		desc: "LIVEにて調整可能<br>ただし、LIVEのON・OFFで切り替え可能。テストでやる時に、このアプリで調整して確認。問題なければ上書き保存すれば更新される。<br>保存しなければ元に戻ります。"
	},
	{
		version: "V0.0.2",
		date: "2026/06/07",
		desc: "一通り形にしました。"
	},
	{
		version: "0.0.1",
		date: "",
		desc: "ベータ版にて作成。"
	}
];

function renderUpdateList() {
	const container = document.getElementById('update-list-container');
	if (!container) return;

	container.innerHTML = updateData.map(u => `
		<ul>
			<li>
				<h3>${u.version}${u.date ? `<small>${u.date}</small>` : ''}</h3>
				${(u.items && typeof u.items[0] === 'object') ? 
					u.items.map(sub => `<h4>${sub.title}</h4><ul class="update-data_box">${sub.list.map(i => `<li>${i}</li>`).join('')}</ul>`).join('') :
					`<p>${u.desc}</p>${u.items ? `<h4>更新項目</h4><ul class="update-data_box">${u.items.map(i => `<li>${i}</li>`).join('')}</ul>` : ''}`
				}
			</li>
		</ul>
	`).join('');
}

document.addEventListener('DOMContentLoaded', renderUpdateList);