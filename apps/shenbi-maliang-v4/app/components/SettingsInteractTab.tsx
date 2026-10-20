'use client'

import {
	msToSec,
	resetSystemPrefs,
	saveSystemPrefs,
	secToMs,
	type SystemPrefs,
	SYSTEM_PREFS_DEFAULTS,
} from '../lib/store/systemPrefs'

type Props = {
	prefs: SystemPrefs
	onChange: (p: SystemPrefs) => void
}

/**
 * 互动 / 系统参数：适时主动、续听、看图增量、打断等。
 */
export function SettingsInteractTab({ prefs, onChange }: Props) {
	const patch = async (partial: Partial<SystemPrefs>) => {
		const next = await saveSystemPrefs(partial)
		onChange(next)
	}

	const numField = (
		label: string,
		hint: string,
		valueSec: number,
		onSec: (sec: number) => void,
		min: number,
		max: number,
		step = 0.5
	) => (
		<tr>
			<th>{label}</th>
			<td>
				<div className="pref-num-row">
					<input
						type="number"
						className="pref-num"
						min={min}
						max={max}
						step={step}
						value={valueSec}
						onChange={(e) => onSec(Number(e.target.value))}
					/>
					<span className="pref-unit">秒</span>
				</div>
				<p className="pref-hint">{hint}</p>
			</td>
		</tr>
	)

	return (
		<>
			<h2>互动与系统</h2>
			<p className="muted">本机保存，改完立即生效（无需重启）。密钥仍在服务端 .env。</p>

			<h3>适时主动（只画不说）</h3>
			<table className="kv">
				<tbody>
					<tr>
						<th>启用</th>
						<td>
							<label className="pref-check">
								<input
									type="checkbox"
									checked={prefs.proactiveEnabled}
									onChange={(e) => void patch({ proactiveEnabled: e.target.checked })}
								/>
								停笔后伙伴可主动说一句
							</label>
						</td>
					</tr>
					{numField(
						'停笔多久',
						'画完停住多久算「告一段落」（建议 2.5～5）',
						msToSec(prefs.drawIdleMs),
						(sec) => void patch({ drawIdleMs: secToMs(sec) }),
						1.5,
						20
					)}
					{numField(
						'主动冷却',
						'两次主动/对话之间至少间隔（建议 30～90）',
						msToSec(prefs.proactiveCooldownMs),
						(sec) => void patch({ proactiveCooldownMs: secToMs(sec) }),
						10,
						300,
						1
					)}
					<tr>
						<th>最少新笔触</th>
						<td>
							<div className="pref-num-row">
								<input
									type="number"
									className="pref-num"
									min={1}
									max={8}
									step={1}
									value={prefs.minNewShapes}
									onChange={(e) => void patch({ minNewShapes: Number(e.target.value) })}
								/>
								<span className="pref-unit">处</span>
							</div>
							<p className="pref-hint">新增形状少于此数时不主动（原地改且画变满仍可触发）</p>
						</td>
					</tr>
				</tbody>
			</table>

			<h3>对话节奏</h3>
			<table className="kv">
				<tbody>
					{numField(
						'免唤醒续听',
						'答完后多久内可直接说，不必再喊伙伴名字',
						msToSec(prefs.followUpMs),
						(sec) => void patch({ followUpMs: secToMs(sec) }),
						5,
						120,
						1
					)}
				</tbody>
			</table>

			<h3>看画与速度</h3>
			<table className="kv">
				<tbody>
					<tr>
						<th>快速看画</th>
						<td>
							<label className="pref-check">
								<input
									type="checkbox"
									checked={prefs.preferFastVision}
									onChange={(e) => void patch({ preferFastVision: e.target.checked })}
								/>
								更小截图、更短回复（推荐开，体感更快）
							</label>
						</td>
					</tr>
					<tr>
						<th>新区特写</th>
						<td>
							<label className="pref-check">
								<input
									type="checkbox"
									checked={prefs.sendDetailCrop}
									onChange={(e) => void patch({ sendDetailCrop: e.target.checked })}
								/>
								有新增笔触时多传一张特写（稍慢一点、更贴新画）
							</label>
						</td>
					</tr>
					<tr>
						<th>上一拍对照</th>
						<td>
							<label className="pref-check">
								<input
									type="checkbox"
									checked={prefs.sendPrevImage}
									onChange={(e) => void patch({ sendPrevImage: e.target.checked })}
								/>
								再传上一拍全图（更慢，默认关）
							</label>
						</td>
					</tr>
				</tbody>
			</table>

			<h3>语音与打断</h3>
			<table className="kv">
				<tbody>
					<tr>
						<th>播报 TTS</th>
						<td>
							<label className="pref-check">
								<input
									type="checkbox"
									checked={prefs.ttsEnabled}
									onChange={(e) => void patch({ ttsEnabled: e.target.checked })}
								/>
								伙伴回复时出声（关则只显示文字）
							</label>
						</td>
					</tr>
					<tr>
						<th>浏览器朗读回落</th>
						<td>
							<label className="pref-check">
								<input
									type="checkbox"
									checked={prefs.browserTtsFallback}
									onChange={(e) => void patch({ browserTtsFallback: e.target.checked })}
								/>
								云 TTS 失败时用系统朗读（默认关，避免系统音）
							</label>
							<p className="pref-hint">主路径应走云 TTS；密钥/配额异常时请先修 .env，不要依赖系统音。</p>
						</td>
					</tr>
					<tr>
						<th>听写回落</th>
						<td>
							<label className="pref-check">
								<input
									type="checkbox"
									checked={prefs.browserSttFallback}
									onChange={(e) => void patch({ browserSttFallback: e.target.checked })}
								/>
								云听写失败时用浏览器听写
							</label>
						</td>
					</tr>
					<tr>
						<th>可打断</th>
						<td>
							<label className="pref-check">
								<input
									type="checkbox"
									checked={prefs.bargeEnabled}
									onChange={(e) => void patch({ bargeEnabled: e.target.checked })}
								/>
								伙伴说话时侦测插话（门闩公式不变）
							</label>
						</td>
					</tr>
					{numField(
						'起播保护',
						'刚开口多少秒内不轻易打断，防自激',
						msToSec(prefs.bargePlayGuardMs),
						(sec) => void patch({ bargePlayGuardMs: secToMs(sec) }),
						0,
						2,
						0.1
					)}
					{numField(
						'人声最短',
						'像人声持续多久才算 G1（建议 0.3～0.6）',
						msToSec(prefs.bargeSpeechMinMs),
						(sec) => void patch({ bargeSpeechMinMs: secToMs(sec) }),
						0.2,
						2,
						0.1
					)}
				</tbody>
			</table>

			<div className="row">
				<button
					type="button"
					className="btn btn-ghost"
					onClick={() => void resetSystemPrefs().then(onChange)}
				>
					恢复默认
				</button>
				<span className="pref-hint inline">
					默认：停笔 {msToSec(SYSTEM_PREFS_DEFAULTS.drawIdleMs)}s · 冷却{' '}
					{msToSec(SYSTEM_PREFS_DEFAULTS.proactiveCooldownMs)}s · 续听{' '}
					{msToSec(SYSTEM_PREFS_DEFAULTS.followUpMs)}s
				</span>
			</div>
		</>
	)
}
