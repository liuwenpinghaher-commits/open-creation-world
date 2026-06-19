import { useEffect, useState } from 'react'
import type { GuidanceDimension } from '../types/cocreate'
import type { ChildProfile, ContentSafety, GuidancePrefs } from '../types/settings'
import { defaultPrefs, defaultSafety } from '../types/settings'
import {
  listProfiles, saveProfile, deleteProfile, newProfileId,
  getPrefs, savePrefs, getSafety, saveSafety, getActiveChildId, setActiveChildId, getGate,
} from '../store/family'

const DIMS: { key: GuidanceDimension; label: string }[] = [
  { key: 'observe_express', label: '观察表达' },
  { key: 'narrative_logic', label: '编故事' },
  { key: 'imagination', label: '想象力' },
  { key: 'problem_solving', label: '想办法' },
]
const EMOJIS = ['🦖', '🐱', '🚀', '🌈', '🦄', '🐰', '🌸', '⚽']

// 简易非加密 hash（家用门，仅防孩子）
function hash(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return String(h)
}

function ParentGate({ onPass, onClose }: { onPass: () => void; onClose: () => void }) {
  const [a] = useState(() => 3 + Math.floor(Math.random() * 7))
  const [b] = useState(() => 2 + Math.floor(Math.random() * 7))
  const [ans, setAns] = useState('')
  const [pin, setPin] = useState('')
  const [held, setHeld] = useState(false)
  const [gateMode, setGateMode] = useState<'arith' | 'pin'>('arith')
  const [pinHash, setPinHash] = useState<string | undefined>(undefined)
  const [err, setErr] = useState('')

  useEffect(() => { void getGate().then((g) => { setGateMode(g.mode); setPinHash(g.pinHash) }) }, [])

  function tryPass() {
    if (gateMode === 'pin' && pinHash) {
      if (hash(pin) === pinHash) onPass(); else setErr('密码不对')
      return
    }
    if (held && Number(ans) === a + b) onPass()
    else setErr('请长按 2 秒，并答对算术')
  }

  return (
    <div className="review-mask" onClick={onClose}>
      <div className="review-card gate-card" onClick={(e) => e.stopPropagation()}>
        <h2>家长验证</h2>
        {gateMode === 'pin' && pinHash ? (
          <>
            <p className="review-empty">请输入 4 位家长密码</p>
            <input className="gate-input" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value)} />
          </>
        ) : (
          <>
            <p className="review-empty">长按下面按钮 2 秒，并算出：<b>{a} + {b} = ?</b></p>
            <button
              type="button" className="gate-hold"
              onPointerDown={() => window.setTimeout(() => setHeld(true), 2000)}
            >{held ? '✅ 已长按' : '长按我 2 秒'}</button>
            <input className="gate-input" inputMode="numeric" placeholder="答案" value={ans} onChange={(e) => setAns(e.target.value)} />
          </>
        )}
        {err ? <p className="gate-err">{err}</p> : null}
        <button type="button" className="review-close" onClick={tryPass}>进入设置</button>
      </div>
    </div>
  )
}

type MaskedConfig = {
  model: { id: string; baseUrl: string; apiKey: { set: boolean; last4: string } }
  voice: { sttEnabled: boolean; ttsEnabled: boolean; ttsVoice: string; apiKey: { set: boolean; last4: string } }
  fulfill: { enabled: boolean; behaviors: string[]; animatedDrawingsUrl: string }
}

export function Settings({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [unlocked, setUnlocked] = useState(false)
  const [tab, setTab] = useState<'system' | 'child' | 'guide' | 'safety'>('child')

  const [config, setConfig] = useState<MaskedConfig | null>(null)
  const [modelKey, setModelKey] = useState('')
  const [voiceKey, setVoiceKey] = useState('')
  const [testMsg, setTestMsg] = useState('')

  const [profiles, setProfiles] = useState<ChildProfile[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [prefs, setPrefs] = useState<GuidancePrefs>(defaultPrefs())
  const [safety, setSafety] = useState<ContentSafety>(defaultSafety())

  useEffect(() => {
    if (!unlocked) return
    void (async () => {
      try { setConfig(await (await fetch('/api/config')).json()) } catch { /* 离线 */ }
      const ps = await listProfiles(); setProfiles(ps)
      const aid = (await getActiveChildId()) ?? ps[0]?.id ?? null
      setActiveId(aid)
      if (aid) setPrefs(await getPrefs(aid))
      setSafety(await getSafety())
    })()
  }, [unlocked])

  async function reloadProfiles(active?: string | null) {
    const ps = await listProfiles(); setProfiles(ps)
    const aid = active ?? activeId ?? ps[0]?.id ?? null
    setActiveId(aid)
    if (aid) setPrefs(await getPrefs(aid))
  }

  if (!unlocked) return <ParentGate onPass={() => setUnlocked(true)} onClose={onClose} />

  const active = profiles.find((p) => p.id === activeId) ?? null

  async function addChild() {
    const id = newProfileId()
    const p: ChildProfile = { id, name: '宝贝', emoji: EMOJIS[profiles.length % EMOJIS.length], age: 7, interests: [], dispositions: {}, createdAt: Date.now() }
    await saveProfile(p); await setActiveChildId(id); await reloadProfiles(id); onChanged()
  }
  async function patchActive(patch: Partial<ChildProfile>) {
    if (!active) return
    const p = { ...active, ...patch }; await saveProfile(p); await reloadProfiles(); onChanged()
  }
  async function switchChild(id: string) { await setActiveChildId(id); await reloadProfiles(id); onChanged() }
  async function removeChild(id: string) { await deleteProfile(id); await setActiveChildId(null); await reloadProfiles(null); onChanged() }
  async function patchPrefs(patch: Partial<GuidancePrefs>) {
    if (!activeId) return
    const next = { ...prefs, ...patch }; setPrefs(next); await savePrefs(activeId, next); onChanged()
  }
  async function patchSafety(patch: Partial<ContentSafety>) {
    const next = { ...safety, ...patch }; setSafety(next); await saveSafety(next); onChanged()
  }

  async function saveConfigUi() {
    const body = {
      model: { id: config?.model.id, baseUrl: config?.model.baseUrl, ...(modelKey ? { apiKey: modelKey } : {}) },
      voice: { sttEnabled: config?.voice.sttEnabled, ttsEnabled: config?.voice.ttsEnabled, ttsVoice: config?.voice.ttsVoice, ...(voiceKey ? { apiKey: voiceKey } : {}) },
      fulfill: config?.fulfill,
    }
    const r = await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (r.ok) { setConfig(await r.json()); setModelKey(''); setVoiceKey(''); setTestMsg('已保存') }
  }
  async function testConn() {
    setTestMsg('测试中…')
    try { const r = await (await fetch('/api/config/test', { method: 'POST' })).json(); setTestMsg(r.ok ? '连接正常 ✅' : `失败：${r.status}`) }
    catch { setTestMsg('连接失败') }
  }

  return (
    <div className="review-mask" onClick={onClose}>
      <div className="review-card settings-card" onClick={(e) => e.stopPropagation()}>
        <div className="settings-tabs">
          <button className={tab === 'child' ? 'on' : ''} onClick={() => setTab('child')}>孩子</button>
          <button className={tab === 'guide' ? 'on' : ''} onClick={() => setTab('guide')}>引导</button>
          <button className={tab === 'safety' ? 'on' : ''} onClick={() => setTab('safety')}>安全</button>
          <button className={tab === 'system' ? 'on' : ''} onClick={() => setTab('system')}>系统</button>
        </div>

        {tab === 'child' ? (
          <div className="settings-sec">
            <h3>孩子档案</h3>
            <div className="profile-row">
              {profiles.map((p) => (
                <button key={p.id} className={p.id === activeId ? 'profile on' : 'profile'} onClick={() => switchChild(p.id)}>{p.emoji} {p.name}</button>
              ))}
              <button className="profile add" onClick={addChild}>＋ 添加</button>
            </div>
            {active ? (
              <div className="profile-edit">
                <label>昵称 <input value={active.name} onChange={(e) => patchActive({ name: e.target.value })} /></label>
                <label>年龄 <input type="number" min={3} max={12} value={active.age} onChange={(e) => patchActive({ age: Number(e.target.value) })} /></label>
                <label>头像 <span className="emoji-pick">{EMOJIS.map((em) => <button key={em} className={em === active.emoji ? 'on' : ''} onClick={() => patchActive({ emoji: em })}>{em}</button>)}</span></label>
                <label>兴趣（逗号分隔）<input value={active.interests.join('、')} onChange={(e) => patchActive({ interests: e.target.value.split(/[、,，]/).map((s) => s.trim()).filter(Boolean) })} /></label>
                <button className="journal-del" onClick={() => removeChild(active.id)}>删除这个孩子</button>
              </div>
            ) : <p className="review-empty">先添加一个孩子吧～</p>}
          </div>
        ) : null}

        {tab === 'guide' ? (
          <div className="settings-sec">
            <h3>引导偏好{active ? `（${active.name}）` : ''}</h3>
            <label>重点多练
              <span className="emoji-pick">{DIMS.map((d) => <button key={d.key} className={(prefs.dimensionWeights[d.key] ?? 1) > 1 ? 'on' : ''} onClick={() => patchPrefs({ dimensionWeights: { ...prefs.dimensionWeights, [d.key]: (prefs.dimensionWeights[d.key] ?? 1) > 1 ? 1 : 3 } })}>{d.label}</button>)}</span>
            </label>
            <label>创造力侧重
              <select value={prefs.creativityFocus} onChange={(e) => patchPrefs({ creativityFocus: e.target.value as GuidancePrefs['creativityFocus'] })}>
                <option value="diverge">发散（多想点子）</option><option value="deepen">深耕（做深做细）</option>
              </select>
            </label>
            <label>激发节奏
              <select value={prefs.pace} onChange={(e) => patchPrefs({ pace: e.target.value as GuidancePrefs['pace'] })}>
                <option value="often">每拍都引导</option><option value="balanced">均衡</option><option value="spacious">多留白</option>
              </select>
            </label>
            <label>口吻 <select value={prefs.tone} onChange={(e) => patchPrefs({ tone: e.target.value as GuidancePrefs['tone'] })}><option value="gentle">温和</option><option value="lively">活泼</option></select></label>
            <label>兑现频率 <select value={prefs.fulfillFrequency} onChange={(e) => patchPrefs({ fulfillFrequency: e.target.value as GuidancePrefs['fulfillFrequency'] })}><option value="conservative">保守</option><option value="normal">正常</option><option value="generous">大方</option></select></label>
            <label>支架 <select value={prefs.lockSupport} onChange={(e) => patchPrefs({ lockSupport: e.target.value as GuidancePrefs['lockSupport'] })}><option value="auto">自适应</option><option value="high">总是更多帮助</option><option value="normal">固定常规</option></select></label>
            <label className="chk"><input type="checkbox" checked={prefs.interestDriven} onChange={(e) => patchPrefs({ interestDriven: e.target.checked })} /> 从孩子的兴趣切入</label>
            <label className="chk"><input type="checkbox" checked={prefs.sel} onChange={(e) => patchPrefs({ sel: e.target.checked })} /> 偶尔引导表达感受（同理心）</label>
          </div>
        ) : null}

        {tab === 'safety' ? (
          <div className="settings-sec">
            <h3>内容安全</h3>
            <label>过滤强度 <select value={safety.filterLevel} onChange={(e) => patchSafety({ filterLevel: e.target.value as ContentSafety['filterLevel'] })}><option value="standard">标准</option><option value="strict">严格</option></select></label>
            <label>话题黑名单（逗号分隔）<input value={safety.blockedTopics.join('、')} onChange={(e) => patchSafety({ blockedTopics: e.target.value.split(/[、,，]/).map((s) => s.trim()).filter(Boolean) })} /></label>
            <p className="review-empty">「只鼓励不否定」始终开启，不可关闭。</p>
          </div>
        ) : null}

        {tab === 'system' ? (
          <div className="settings-sec">
            <h3>系统配置</h3>
            {config ? (
              <>
                <label>多模态模型 <input value={config.model.id} onChange={(e) => setConfig({ ...config, model: { ...config.model, id: e.target.value } })} /></label>
                <label>Base URL <input value={config.model.baseUrl} onChange={(e) => setConfig({ ...config, model: { ...config.model, baseUrl: e.target.value } })} /></label>
                <label>模型密钥 <input placeholder={config.model.apiKey.set ? `已设 ****${config.model.apiKey.last4}（留空不改）` : '未设置'} value={modelKey} onChange={(e) => setModelKey(e.target.value)} /></label>
                <label>语音密钥 <input placeholder={config.voice.apiKey.set ? `已设 ****${config.voice.apiKey.last4}（留空不改）` : '未设置'} value={voiceKey} onChange={(e) => setVoiceKey(e.target.value)} /></label>
                <label>音色 <input value={config.voice.ttsVoice} onChange={(e) => setConfig({ ...config, voice: { ...config.voice, ttsVoice: e.target.value } })} /></label>
                <label className="chk"><input type="checkbox" checked={config.voice.sttEnabled} onChange={(e) => setConfig({ ...config, voice: { ...config.voice, sttEnabled: e.target.checked } })} /> 语音识别(STT)</label>
                <label className="chk"><input type="checkbox" checked={config.voice.ttsEnabled} onChange={(e) => setConfig({ ...config, voice: { ...config.voice, ttsEnabled: e.target.checked } })} /> 语音播报(TTS)</label>
                <label>AnimatedDrawings 地址 <input value={config.fulfill.animatedDrawingsUrl} onChange={(e) => setConfig({ ...config, fulfill: { ...config.fulfill, animatedDrawingsUrl: e.target.value } })} /></label>
                <div className="journal-actions">
                  <button onClick={saveConfigUi}>保存配置</button>
                  <button onClick={testConn}>测试连接</button>
                  {testMsg ? <span className="test-msg">{testMsg}</span> : null}
                </div>
              </>
            ) : <p className="review-empty">读取配置中…（后端未连接时无法配置）</p>}
          </div>
        ) : null}

        <button type="button" className="review-close" onClick={onClose}>完成</button>
      </div>
    </div>
  )
}
