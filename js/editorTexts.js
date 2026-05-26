window.EDITOR_TITLES = {
	'sus-editor': 'Suspension Editor',
	'tyre-editor': 'Tyres Editor',
	'car-editor': 'Car Editor',
	'colliders-editor': 'Colloder Editor',
	'wing-editor': 'Aero Editor',
	'engine-editor': 'Engine Editor',
	'gear-editor': 'Drivetrain Editor',
	'setup-editor': 'SetUp Editor',
};
window.EDITOR_DESCRIPTIONS = {
	'sus-editor':
	'<h3>suspensions.iniの調整をします</h3><p>アームなどのラインを表示させるときは右下の｢✅｣を操作して下さい。<br>こちらでの調整は今までのやり方に比べ｢視覚的｣に調整できるようになっています。<br>ぜひぜひ楽しみながら調整してください。</p>',
	'tyre-editor':
	'<h3>tyres.iniの調整</h3><p>タイヤの幅、半径、グリップ力、摩耗特性などを設定します。<br>私が解析できていない為、現状では数値を入力したりするだけです。<br>解析できたら可視化させ分かる様にしたいです。</p>',
	'car-editor':
	'<h3>car.iniの調整</h3><p>車体の質量・タイヤと車体の位置、慣性モーメント、視点、ステアリングの切れ角やFFBの強さ、燃料タンクを設定します。<br>※｢GRAPHICS｣の調整は準備中です。</p>',
	'colliders-editor':
	'<h3>colliders.iniの調整</h3><p>車体の衝突判定（当たり判定）のサイズと中心位置を設定します。<br>主に腰折れに影響するところです。左のデータを確認しながら地上高がストローク以上になるようにしましょう。</p>',
	'wing-editor':
	'<h3>aero.iniの調整</h3><p>フロント・リアウイング等の空力パーツのサイズ、位置、角度を設定し、ダウンフォースを調整します。</p>',
	'engine-editor':
	'<h3>engine.ini・power.lutの調整</h3><p>エンジンのトルクカーブ（power.lut）やターボのブースト圧、レブリミットを設定します。<br>※現在はシングルターボのみですが、いずれは追加できるようにする予定です。</p>',
	'gear-editor':
	'<h3>drivetrain.iniおよびfinal.rto(setup.ini)の調整</h3><p>ギア比、ファイナルギア、デフ（LSD）の効き具合、シフトチェンジの速度などを設定します。<br>｢drivetrain.ini｣・｢final.rto｣・｢setup.ini｣が密接に関わってきますが、分かりづらい設定をやり易く調整しています。</p>',
	'setup-editor':
	'<h3>setup.iniの調整</h3><p>ゲーム内のピット画面でプレイヤーが調整できる項目（スライダー）の範囲や初期値を設定します。<br>｢drivetrain.ini｣および｢final.rto｣の調整が密接に関わってきますが、このアプリでは考えずに出来るようになっています。こちらではあくまでピット内でのUIを調整や確認が出来ます。</p>',
};