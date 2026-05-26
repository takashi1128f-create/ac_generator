// js/step.js
// --- エディターの入力ステップを一括管理する司令塔 ---
window.getEditorStep = function(key, val) {
	const safeKey = String(key).trim();
	const stepsConfig = [
		// --- 1. 最優先：細かく調整したい特殊項目 ---
		//exact:  完全一致
		//prefix: 前方一致
		//include:部分一致
		// ★ 追加：デフ（LSD）専用の安全装置
		{
			step: "0.1",
			min: "0",
			max: "1",
			exact: ['POWER', 'COAST']
		}, {
			step: "10",
			min: "0",
			max: "100",
			exact: ['PRELOAD']
		}, {
			min: "0",
			exact: ['FRONT', 'REAR', 'GEAR_1', 'GEAR_2', 'GEAR_3', 'GEAR_4', 'GEAR_5', 'GEAR_6', 'GEAR_7'],
			include: ['DAMP_FAST_BUMPTHRESHOLD', 'PROGRESSIVE_SPRING_RATE', 'VERSION', 'SIZE', 'WIDTH', 'RADIUS', 'RIM_RADIUS', 'ANGULAR_INERTIA', 'DAMP', 'RATE', 'RADIUS', 'RIM_RADIUS', 'TOTALMASS', 'CHORD', 'SPAN', 'DEFAULT_TURBO_ADJUSTMENT', 'ALTITUDE_SENSITIVITY', 'INERTIA', 'LIMITER', 'MINIMUM', 'LIMITER_HZ', 'GAMMA', 'COCKPIT_ADJUSTABLE', 'ARB']
		}, {
			max: "0",
			exact: ['GEAR_R'],
		}, {
			max: "1",
			exact: ['DEFAULT_TURBO_ADJUSTMENT'],
		}, {
			max: "5",
			exact: ['LINK_COUNT'],
		}, {
			max: "7",
			exact: ['COUNT'],
		}, {
			min: "1",
			exact: ['COUNT'],
		}, {
			step: "0.5",
			include: ['POS_X']
		}, {
			step: "0.01",
			include: ['BUMPTHRESHOLD', 'REBOUNDTHRESHOLD', 'ANGLE']
		}, {
			step: "1000",
			exact: ['BUMP_STOP_RATE', 'PROGRESSIVE_SPRING_RATE']
		}, {
			step: "500",
			prefix: ['RATE'],
			exact: ['LIMITER']
		}, {
			step: "100",
			exact: ['SPRING_RATE', 'DAMP_BUMP', 'DAMP_REBOUND', 'DAMP_FAST_BUMP', 'DAMP_FAST_REBOUND', 'FRONT', 'REAR', 'REFERENCE_RPM','TORSIONAL_STIFFNESS'],
			include: ['ARB']
		}, {
			step: "10", // ★減衰用：10単位で調整
			exact: ['TORSIONAL_DAMPING']
		},{
			step: "0.005",
			exact: ['WIDTH']
		}, {
			step: "0.001",
			prefix: ['GEAR_', 'WIDTH', 'ANGLE', 'RADIUS', 'RIM_RADIUS']
		}, {
			step: "0.1",
			prefix: ['SPAN', 'CHORD', 'POSITION', 'ANGLE', 'DEFAULT_TURBO_ADJUSTMENT', 'WING_', 'SIZE', 'CENTRE'],
			exact: ['GAMMA', 'STATIC_CAMBER']
		}, {
			step: "0.01",
			exact: ['RADIUS', 'RIM_RADIUS', 'ANGLE', 'STRUT_', 'WBTYRE_', 'WBCAR_'],
			prefix: ['EXT_', 'TEST_'],
			include: ['POSITION', 'CENTRE', '_CAR', '_TYRE', 'OFFSET', 'RANGE', 'LENGTH', 'GRAPHICS_OFFSET']
		},
		// --- ★ここから追加：タイヤ専用の安全装置 ---
		{
			step: "0.01",
			min: "0.1",
			max: "3.0",
			exact: ['DX_REF', 'DY_REF', 'XMU']
		}, {
			step: "0.01",
			min: "0.01",
			max: "1.0",
			exact: ['FALLOFF_LEVEL']
		}, {
			step: "0.1",
			min: "1.0",
			max: "20.0",
			exact: ['FALLOFF_SPEED', 'FRICTION_LIMIT_ANGLE']
		}, {
			step: "0.0001",
			min: "0",
			max: "0.01",
			exact: ['FLEX']
		}, {
			step: "0.001",
			exact: ['FLEX_GAIN', 'RELAXATION_LENGTH']
		}, {
			step: "0.01",
			min: "0",
			max: "2.0",
			exact: ['CAMBER_GAIN']
		}, {
			step: "0.1",
			min: "-10.0",
			max: "10.0",
			exact: ['DCAMBER_0']
		}, {
			step: "1",
			min: "-100",
			max: "100",
			exact: ['DCAMBER_1']
		},
		// --- ★ここまで追加 ---
	];
	let resultStep = undefined;
	let resultMin = undefined;
	let resultMax = undefined;
	for (const conf of stepsConfig) {
		const isExact = conf.exact ? conf.exact.includes(safeKey) : false;
		const isPrefix = conf.prefix ? conf.prefix.some(p => safeKey.startsWith(p)) : false;
		const isInclude = conf.include ? conf.include.some(i => safeKey.includes(i)) : false;
		if (isExact || isPrefix || isInclude) {
			// まだ値が入っていなければ、見つけた設定を反映する（上のブロックが優先）
			if (conf.step !== undefined && resultStep === undefined) resultStep = conf.step;
			if (conf.min !== undefined && resultMin === undefined) resultMin = conf.min;
			if (conf.max !== undefined && resultMax === undefined) resultMax = conf.max;
		}
	}
	// リストの最後まで見ても step が決まらなかった場合の自動判定
	if (resultStep === undefined) {
		resultStep = String(val).includes('.') ? "0.01" : "1";
	}
	// 最終的に合体させたデータを返す
	return {
		step: resultStep,
		min: resultMin !== undefined ? resultMin : "",
		max: resultMax !== undefined ? resultMax : ""
	};
};