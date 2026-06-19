import { useEffect, useState } from 'react'
import type { GuidanceDimension } from '../types/cocreate'
import type { ChildProfile, ContentSafety, GuidancePrefs } from '../types/settings'
import { defaultPrefs, defaultSafety } from '../types/settings'
import {
  listProfiles, saveProfile, deleteProfile, newProfileId,
  getPrefs, savePrefs, getSafety, saveSafety, getActiveChildId, setActiveChildId, getGate,
  getPrivacy, setPrivacy, listStories, setFamilyNote,
} from '../store/family'
import { listWorks } from '../store/persist'
import { aggregateStories, type ChildReport } from '../guidance/report'
import type { GuidancePrefs as _GP, LearningStory } from '../types/settings'

const PACE_CN: Record<_GP['pace'], string> = { often: '每拍都引导', balanced: '均衡', spacious: '多留白' }
const CREA_CN: Record<_GP['creativityFocus'], string> = { diverge: '发散', deepen: '深耕' }

const DIMS: { key: GuidanceDimension; label: string }[] = [
  { key: 'observe_express', label: '观察表达' },
  { key: 'narrative_logic', label: '编故事' },
  { key: 'imagination', label: '想象力' },
  { key: 'problem_solving', label: '想办法' },
]
const EMOJIS = ['🦖', '🐱', '🚀', '🌈', '🦄', '🐰', '🌸', '⚽']
const nowMs = () => Date.now()

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
  const [tab, setTab] = useState<'overview' | 'system' | 'child' | 'companion' | 'guide' | 'safety' | 'report'>('overview')
  const [privacy, setPrivacyState] = useState(false)
  const [stories, setStories] = useState<LearningStory[]>([])
  const [report, setReport] = useState<ChildReport | null>(null)
  const [overview, setOverview] = useState<{ works: number; stories: number; thisWeek: number; recent?: string } | null>(null)

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
      setPrivacyState(await getPrivacy())
    })()
  }, [unlocked])

  // 报告/总览：加载活跃孩子的学习故事并聚合
  useEffect(() => {
    if (!unlocked || (tab !== 'report' && tab !== 'overview')) return
    void (async () => {
      const ss = await listStories(activeId ?? undefined)
      setStories(ss)
      setReport(aggregateStories(ss, nowMs()))
      const works = (await listWorks()).filter((w) => !activeId || w.childId === activeId)
      const r = aggregateStories(ss, nowMs())
      setOverview({ works: works.length, stories: ss.length, thisWeek: r.thisWeek, recent: ss[0]?.narrative })
    })()
  }, [unlocked, tab, activeId])

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
    const p: ChildProfile = { id, name: '宝贝', emoji: EMOJIS[profiles.length % EMOJIS.length], age: 7, interests: [], dispositions: {}, createdAt: nowMs() }
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

  const NAV: { k: typeof tab; label: string; icon: string }[] = [
    { k: 'overview', label: '总览', icon: '🏠' }, { k: 'child', label: '孩子', icon: '🧒' }, { k: 'companion', label: '伙伴', icon: '🤖' }, { k: 'guide', label: '引导', icon: '🧭' },
    { k: 'report', label: '成长报告', icon: '📈' }, { k: 'safety', label: '内容安全', icon: '🛡️' }, { k: 'system', label: '系统', icon: '⚙️' },
  ]
  return (
    <div className="settings-full">
      <aside className="settings-nav">
        <div className="settings-nav-title">设置 · 家长</div>
        {NAV.map((n) => (
          <button key={n.k} className={tab === n.k ? 'on' : ''} onClick={() => setTab(n.k)}><span>{n.icon}</span>{n.label}</button>
        ))}
        <button className="settings-back" onClick={onClose}>← 返回创作</button>
      </aside>
      <main className="settings-body">
        {tab === 'overview' ? (
          <div className="settings-sec">
            <h3>总览{active ? `（${active.name}）` : ''}</h3>
            {active ? (
              <div className="ov-childcard">
                <span className="ov-emoji">{active.emoji}</span>
                <div><b>{active.name}</b> · {active.age}岁
                  {active.interests.length ? <div className="ov-interests">{active.interests.map((i) => <span key={i} className="review-dim">{i}</span>)}</div> : null}
                </div>
              </div>
            ) : <p className="review-empty">先到「孩子」页添加一个孩子吧～</p>}
            {overview ? (
              <div className="ov-stats">
                <div className="ov-stat"><b>{overview.works}</b><span>幅创作</span></div>
                <div className="ov-stat"><b>{overview.stories}</b><span>学习故事</span></div>
                <div className="ov-stat"><b>{overview.thisWeek}</b><span>本周</span></div>
              </div>
            ) : null}
            {overview?.recent ? (<><h3>最近一篇学习故事</h3><div className="learning-story"><p className="story-narrative">{overview.recent}</p></div></>) : null}
            <h3>当前引导偏好</h3>
            <p className="review-empty">侧重{CREA_CN[prefs.creativityFocus]} · {PACE_CN[prefs.pace]} · 口吻{prefs.tone === 'lively' ? '活泼' : '温和'}{prefs.interestDriven ? ' · 从兴趣切入' : ''}</p>
          </div>
        ) : null}

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

        {tab === 'companion' ? (
          <div className="settings-sec">
            <h3>AI 伙伴的人设{active ? `（陪 ${active.name}）` : ''}</h3>
            <label>伙伴名字 <input value={prefs.companionName} onChange={(e) => patchPrefs({ companionName: e.target.value })} /></label>
            <label>性格
              <select value={prefs.persona} onChange={(e) => patchPrefs({ persona: e.target.value as GuidancePrefs['persona'] })}>
                <option value="curious">好奇宝宝</option>
                <option value="gentle">温柔耐心</option>
                <option value="funny">鬼马搞笑</option>
                <option value="scientist">爱较真的小科学家</option>
                <option value="steady">沉稳大朋友</option>
              </select>
            </label>
            <label>有主见 / 会坚持
              <select value={prefs.opinionatedness} onChange={(e) => patchPrefs({ opinionatedness: e.target.value as GuidancePrefs['opinionatedness'] })}>
                <option value="follow">多顺着孩子</option>
                <option value="balanced">均衡（有观点、会善意讨论）</option>
                <option value="opinionated">有想法、会多坚持一下</option>
              </select>
            </label>
            <label className="chk"><input type="checkbox" checked={prefs.humor} onChange={(e) => patchPrefs({ humor: e.target.checked })} /> 幽默感（爱开玩笑）</label>
            <p className="review-empty">朋友是诚实的、有想法的，不是只会附和的应声虫——但永远尊重「画是孩子的」。音色在「系统」页设置。</p>
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

        {tab === 'report' ? (
          <div className="settings-sec">
            <h3>成长报告{active ? `（${active.name}）` : ''}</h3>
            {report && report.count > 0 ? (
              <>
                <p className="review-stat">共 <b>{report.count}</b> 篇学习故事，本周 <b>{report.thisWeek}</b> 篇</p>
                <div className="torrance-bars">
                  {report.torrance.map((t) => (
                    <div key={t.key} className="torr-row">
                      <span className="torr-label">{t.label}</span>
                      <span className="torr-bar"><i style={{ width: `${(t.avg / 3) * 100}%` }} /></span>
                      <span className="torr-val">{t.avg}</span>
                    </div>
                  ))}
                </div>
                {report.dispositions.length ? (
                  <div className="review-dims">{report.dispositions.map((d) => <span key={d.name} className="review-dim">{d.name} ×{d.count}</span>)}</div>
                ) : null}
                <h3>最近的学习故事</h3>
                {stories.slice(0, 5).map((s) => (
                  <div key={s.id} className="learning-story">
                    <p className="story-narrative">{s.narrative}</p>
                    <label className="family-note">家人想说：
                      <input defaultValue={s.familyNote ?? ''} placeholder="给孩子留一句话…"
                        onBlur={(e) => void setFamilyNote(s.id, e.target.value)} />
                    </label>
                  </div>
                ))}
              </>
            ) : <p className="review-empty">还没有学习故事。在成长册里点「✨生成学习故事」就会出现在这里。</p>}
          </div>
        ) : null}

        {tab === 'safety' ? (
          <div className="settings-sec">
            <h3>内容安全</h3>
            <label>过滤强度 <select value={safety.filterLevel} onChange={(e) => patchSafety({ filterLevel: e.target.value as ContentSafety['filterLevel'] })}><option value="standard">标准</option><option value="strict">严格</option></select></label>
            <label>话题黑名单（逗号分隔）<input value={safety.blockedTopics.join('、')} onChange={(e) => patchSafety({ blockedTopics: e.target.value.split(/[、,，]/).map((s) => s.trim()).filter(Boolean) })} /></label>
            <label className="chk"><input type="checkbox" checked={privacy} onChange={(e) => { setPrivacyState(e.target.checked); void setPrivacy(e.target.checked); onChanged() }} /> 隐私模式（不上传画面，仅凭语音引导）</label>
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
      </main>
    </div>
  )
}
