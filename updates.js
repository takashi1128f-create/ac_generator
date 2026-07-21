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
	// {
	// 	version: "V0.0.7",
	// 	date: "2026/06/16",
	// 	desc: "engine.iniの調整(テスト)",
	// 	items: ["engine.iniのツインターボ以上に対応", "engine.iniの複数のターボの書き出し変更","上記変更に伴いengineのグラフの調整"]
	// },
	{
		version: "V0.1.7",
		date: "2026/07/21",
		desc: "読込み方法の変更・各種編集できるカテゴリを追加・その他",
		items: [
			{ title: "編集・車両作成", list: ["Assetto Corsa ルートフォルダを選択できるようにしました。", "ベース車両を選択することで手軽に決めれます","【新規作成】ベースの車両を選ぶことで新しい車両を追加編集できます。","【車両編集】選択した車両を編集できます。","【フォルダ名変更】車両の名前を変えたい時に使います。全てAutoで変わるのでお手軽になってます。"] },
			{ title: "プロジェクト管理", list: ["メニューからの編集を手軽に出来るようにしました。"] },
			{ title: "エンジン・サウンドスワッSプ", list: ["お手軽にエンジン・サウンドの載せ替えが出来ます。※ただし、これは直接載替えます。各フォルダにあるので復旧は手動でお願いします。"] },
			{ title: "車輌データ", list: ["uiフォルダにある「ロゴ」「ui_car.json」の編集が出来ます。入力は仕様以外は手動での入力です。","【ロゴ画像】希望のロゴを選択するだけで置き換えできます。"] },
			{ title: "スペック", list: ["エンジンの出力をグラフで確認できます。車両選択時のイメージ画像として考えてください。","【詳細説明】手動で入力出来ます。好きなことを書いてください。"] },
			{ title: "LIVE SYNC", list: ["各種機能追加により、対応している個所の追加をしました。"] },
			{ title: "UIのデザイン調整", list: ["各所の見やすさを向上させるために修正しました。"] },
			{ title: "その他",
				list: [
					"まだ対応していないこと、出来ていないことがあります。順次進めていきます。",
					"マニュアルに関しては基本的なことは動画で説明していきます。（準備中）"
				]}
		]
	},
	{
		version: "V0.0.7",
		date: "2026/06/17",
		desc: "engine.iniの調整およびLIVE SYNCの調整",
		items: [
			{ title: "engine.ini", list: ["engine.iniのツインターボ以上に対応", "engine.iniの複数のターボの書き出し変更","上記変更に伴いengineのグラフの調整"] },
			{ title: "LIVE", list: ["タイヤの複製でリアルタイムでの反映を修正"] }
		]
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
				<p>${u.desc}</p>
				${u.items ? (
					typeof u.items[0] === 'object' ? 
						u.items.map(sub => `<h4>${sub.title}</h4><ul class="update-data_box">${sub.list.map(i => `<li>${i}</li>`).join('')}</ul>`).join('') :
						`<h4>更新項目</h4><ul class="update-data_box">${u.items.map(i => `<li>${i}</li>`).join('')}</ul>`
				) : ''}
			</li>
		</ul>
	`).join('');
}

document.addEventListener('DOMContentLoaded', renderUpdateList);