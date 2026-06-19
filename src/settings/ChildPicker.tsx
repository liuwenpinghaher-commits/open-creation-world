import { useEffect, useState } from 'react'
import type { ChildProfile } from '../types/settings'
import { listProfiles, saveProfile, newProfileId, getActiveChildId, setActiveChildId } from '../store/family'

const EMOJIS = ['🦖', '🐱', '🚀', '🌈', '🦄', '🐰', '🌸', '⚽']
const nowMs = () => Date.now()

/**
 * 儿童端"谁在玩"：
 * - 首次没有任何孩子 → 友好建档引导（E2），让个性化/报告从一开始就生效。
 * - 已有孩子 → 顶部小头像，点开可切换/新增（E1），不必走家长门。
 * onChange 通知 App 重载家庭配置并切到该孩子的作品。
 */
export function ChildPicker({ onChange }: { onChange: () => void }) {
  const [profiles, setProfiles] = useState<ChildProfile[] | null>(null) // null=未加载
  const [activeId, setActiveId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  // 建档表单
  const [name, setName] = useState('')
  const [age, setAge] = useState(7)
  const [emoji, setEmoji] = useState('🦖')

  async function reload(active?: string | null) {
    const ps = await listProfiles()
    const aid = active ?? (await getActiveChildId()) ?? ps[0]?.id ?? null
    setProfiles(ps)
    setActiveId(aid)
  }
  useEffect(() => {
    void (async () => {
      const ps = await listProfiles()
      const aid = (await getActiveChildId()) ?? ps[0]?.id ?? null
      setProfiles(ps)
      setActiveId(aid)
    })()
  }, [])

  async function create() {
    const id = newProfileId()
    const p: ChildProfile = { id, name: name.trim() || '宝贝', emoji, age, interests: [], dispositions: {}, createdAt: nowMs() }
    await saveProfile(p)
    await setActiveChildId(id)
    setName('')
    await reload(id)
    setOpen(false)
    onChange()
  }
  async function pick(id: string) {
    await setActiveChildId(id)
    setActiveId(id)
    setOpen(false)
    onChange()
  }

  if (profiles === null) return null // 加载中

  // E2 首启建档（没有任何孩子且未跳过）
  if (profiles.length === 0 && !dismissed) {
    return (
      <div className="who-mask">
        <div className="who-card" onClick={(e) => e.stopPropagation()}>
          <h2>这是给谁玩的呀？</h2>
          <div className="emoji-pick big">{EMOJIS.map((em) => <button key={em} className={em === emoji ? 'on' : ''} onClick={() => setEmoji(em)}>{em}</button>)}</div>
          <input className="who-name" placeholder="宝贝的名字" value={name} onChange={(e) => setName(e.target.value)} />
          <label className="who-age">几岁啦？
            <input type="number" min={3} max={12} value={age} onChange={(e) => setAge(Number(e.target.value))} />
          </label>
          <button type="button" className="who-go" onClick={create}>开始一起画！</button>
          <button type="button" className="who-skip" onClick={() => setDismissed(true)}>先随便玩玩</button>
        </div>
      </div>
    )
  }

  if (profiles.length === 0) return null // 已跳过建档
  const active = profiles.find((p) => p.id === activeId) ?? profiles[0]

  return (
    <div className="who-chip-wrap">
      <button type="button" className="who-chip" onClick={() => setOpen((o) => !o)} title="谁在玩">
        <span className="who-emoji">{active.emoji}</span><span className="who-cname">{active.name}</span>
      </button>
      {open ? (
        <div className="who-list" onMouseLeave={() => setOpen(false)}>
          {profiles.map((p) => (
            <button key={p.id} className={p.id === activeId ? 'on' : ''} onClick={() => pick(p.id)}>{p.emoji} {p.name}</button>
          ))}
          <button className="who-add" onClick={() => { setOpen(false); setDismissed(false); setProfiles([]) }}>＋ 加一个</button>
        </div>
      ) : null}
    </div>
  )
}
