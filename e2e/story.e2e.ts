import { test, expect, type Page } from '@playwright/test'
import type { PartnerResponse } from '../src/types/cocreate'

// 复杂真实业务：孩子画一只龙 → AI 只激发不替他画 → 孩子命名/扩展剧情 → 孩子明确要"飞" →
// 孩子自己画的笔触整体飞起来作为兑现 → 持久化恢复 → 新的一张清空。
const TURNS: PartnerResponse[] = [
  {
    noticed: '我看到一个圆圆的，下面还有长长的',
    dimension: 'observe_express', crowd: 'open',
    provoke: '哇，这是什么呀？你给它起个名字好不好？',
    fulfill: null, childSignal: '画了一个有圆头和长身体的东西',
  },
  {
    noticed: '一个有名字的角色',
    dimension: 'narrative_logic', crowd: 'wh',
    peer: { evaluate: '小火这个名字真好听', expand: '一只会喷火的小火龙' },
    provoke: '那小火住在什么地方呀？',
    fulfill: null, childSignal: '给它起名小火，说是一只龙',
  },
  {
    noticed: '孩子明确要让它飞',
    dimension: 'imagination', crowd: 'open',
    provoke: '看，小火飞起来啦！它最想飞去哪儿呢？',
    fulfill: { behavior: 'fly', trigger: '让小火飞起来' },
    childSignal: '想让小火飞',
  },
]

async function stubApi(page: Page) {
  let turn = 0
  await page.route('**/api/partner', async (route) => {
    const body = TURNS[Math.min(turn, TURNS.length - 1)]
    turn += 1
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.route('**/api/tts', (route) => route.fulfill({ status: 200, contentType: 'audio/wav', body: '' }))
  // 默认：AnimatedDrawings 未配置(501) → 兑现降级到轻量木偶动画
  await page.route('**/api/animate-figure', (route) => route.fulfill({ status: 501, contentType: 'application/json', body: '{}' }))
  // 自动成文(B4)会调 story
  await page.route('**/api/story', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ narrative: '今天画了一会儿。', highlights: [], tags: { torrance: {}, dispositions: [] }, interests: [] }) }))
}

function shapeIds(page: Page) {
  return page.evaluate(() => {
    const ed = (window as unknown as { __editor?: { getCurrentPageShapeIds: () => Set<string> } }).__editor
    return ed ? [...ed.getCurrentPageShapeIds()] : []
  })
}
function shapeX(page: Page, id: string) {
  return page.evaluate((sid) => {
    const ed = (window as unknown as { __editor?: { getShape: (i: string) => { x: number } | undefined } }).__editor
    return ed?.getShape(sid)?.x ?? null
  }, id)
}
// 模拟"孩子画了一笔"：直接在画布上建一个真实形状（代表孩子的笔触）
async function childDraws(page: Page, id: string, x: number, y: number) {
  await page.evaluate(({ id, x, y }) => {
    const ed = (window as unknown as { __editor?: { createShape: (s: unknown) => void } }).__editor
    ed?.createShape({ id: `shape:${id}`, type: 'geo', x, y, props: { geo: 'ellipse', w: 90, h: 90, color: 'black', dash: 'draw', fill: 'none' } })
  }, { id, x, y })
}
async function sendTurn(page: Page, text: string) {
  const input = page.locator('.talk-bar input')
  await input.fill(text)
  await input.press('Enter')
}
// 首启会弹"谁在玩"建档引导（全屏遮罩）；测试里点"先随便玩玩"跳过
async function dismissOnboarding(page: Page) {
  try { await page.locator('.who-skip').click({ timeout: 3000 }) } catch { /* 无引导则跳过 */ }
}

test('创作伙伴：AI 只激发不替画，孩子指定后让"孩子自己的画"动起来', async ({ page }) => {
  await stubApi(page)
  await page.goto('/')
  await expect.poll(async () => page.evaluate(() => !!(window as unknown as { __editor?: unknown }).__editor)).toBe(true)
  await dismissOnboarding(page)

  // P10 首屏空状态引导
  await expect(page.locator('.empty-hint')).toBeVisible()

  // 孩子画一只"龙"（一笔）
  await childDraws(page, 'dragon', 300, 300)
  expect(await shapeIds(page)).toEqual(['shape:dragon'])

  // 第 1 拍：AI 不命名、只问（全语音，AI 文字不在主屏）；AI 没有往画布加任何东西
  await sendTurn(page, '你看我画的')
  await expect(page.locator('.heard')).toContainText('我听到你说：你看我画的') // P4 语音回显
  await expect(page.locator('.empty-hint')).toHaveCount(0) // 开聊后空状态消失
  expect(await shapeIds(page)).toEqual(['shape:dragon']) // AI 没作画

  // 第 2 拍：孩子命名+扩展
  await sendTurn(page, '它叫小火，是一只龙')
  await expect(page.locator('.heard')).toContainText('它叫小火')
  expect(await shapeIds(page)).toEqual(['shape:dragon'])

  // 第 3 拍：孩子明确要"飞" → 兑现：孩子自己画的 dragon 真的动起来（x 显著变化），且仍没有 AI 新增形状
  const xBefore = await shapeX(page, 'shape:dragon')
  await sendTurn(page, '让小火飞起来')
  await expect.poll(async () => {
    const x = await shapeX(page, 'shape:dragon')
    return xBefore != null && x != null && Math.abs(x - xBefore) > 50
  }, { timeout: 8000 }).toBe(true)
  expect(await shapeIds(page)).toEqual(['shape:dragon']) // 兑现动的是孩子的画，不是 AI 新画的

  // 兑现是非破坏性的：演完 dragon 回到原位附近
  await expect.poll(async () => {
    const x = await shapeX(page, 'shape:dragon')
    return x != null && Math.abs(x - (xBefore as number)) < 1
  }, { timeout: 8000 }).toBe(true)

  // 成长册（家长回顾，多作品）：当前这张计入，统计开口次数/产出/能力
  await page.locator('.kid-tools button[title="成长册（给爸爸妈妈看）"]').click()
  await expect(page.locator('.review-card')).toContainText('共 1 张')
  await expect(page.locator('.journal-item.current')).toContainText('开口 3 次')
  await expect(page.locator('.journal-item.current')).toContainText('给它起名小火')
  await expect(page.locator('.journal-item.current .review-dims')).toContainText('想象力')
  // P3 故事回放：展开看这次的对话
  await page.locator('.journal-item.current button', { hasText: '看这次聊了什么' }).click()
  await expect(page.locator('.journal-dialog')).toContainText('它叫小火')
  await expect(page.locator('.journal-dialog')).toContainText('这是什么') // AI 激发文字存在对话里（主屏全语音）
  await expect(page.locator('.journal-dialog')).toContainText('飞起来')
  await page.locator('.review-close').click()
  await expect(page.locator('.review-card')).toHaveCount(0)

  // 持久化：刷新后画与对话恢复（dragon 仍在）
  await page.reload()
  await expect.poll(async () => page.evaluate(() => !!(window as unknown as { __editor?: unknown }).__editor)).toBe(true)
  await dismissOnboarding(page)
  await expect.poll(() => shapeIds(page).then((ids) => ids.includes('shape:dragon'))).toBe(true)

  // 新的一张：清空 → 回到空状态
  await page.locator('.kid-tools button[title="新的一张"]').click()
  await expect.poll(() => shapeIds(page).then((ids) => ids.length), { timeout: 8000 }).toBe(0)
  await expect(page.locator('.empty-hint')).toBeVisible()
})

test('B1 纯画画也回应：孩子只画不说，停顿后 AI 自动发起一拍', async ({ page }) => {
  const reqs: string[] = []
  await page.route('**/api/partner', async (route) => {
    reqs.push(route.request().postData() ?? '')
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ noticed: '一个圆', dimension: 'observe_express', crowd: 'open', provoke: '这是什么呀？', fulfill: null }) })
  })
  await page.route('**/api/tts', (route) => route.fulfill({ status: 200, contentType: 'audio/wav', body: '' }))

  await page.goto('/')
  await expect.poll(async () => page.evaluate(() => !!(window as unknown as { __editor?: unknown }).__editor)).toBe(true)
  await dismissOnboarding(page)

  // 真实画一笔，但一句话都不说
  await page.mouse.move(300, 320); await page.mouse.down()
  await page.mouse.move(340, 360); await page.mouse.move(380, 320); await page.mouse.up()

  // 停顿 ~2.6s 后应自动发起一拍（不需要孩子开口）
  await expect.poll(() => reqs.length, { timeout: 10000 }).toBeGreaterThan(0)
  const body = JSON.parse(reqs[0])
  expect(body.childUtterance === '' || body.childUtterance == null).toBe(true) // 没说话
  expect(typeof body.imageDataUrl === 'string' && body.imageDataUrl.startsWith('data:image')).toBe(true) // 带着画
})

test('豪华兑现：AnimatedDrawings 可用时播放绑骨动画视频', async ({ page }) => {
  // partner 第一拍即返回 fulfill；animate-figure 返回视频 URL
  await page.route('**/api/partner', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ noticed: '一个人', dimension: 'imagination', crowd: 'open', provoke: '让它动起来咯！', fulfill: { behavior: 'walk', trigger: '让它走' } }),
  }))
  await page.route('**/api/tts', (route) => route.fulfill({ status: 200, contentType: 'audio/wav', body: '' }))
  await page.route('**/api/animate-figure', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ videoUrl: 'http://example.test/anim.mp4' }),
  }))

  await page.goto('/')
  await expect.poll(async () => page.evaluate(() => !!(window as unknown as { __editor?: unknown }).__editor)).toBe(true)
  await dismissOnboarding(page)
  await childDraws(page, 'person', 300, 300)

  await sendTurn(page, '让我画的小人走起来')
  // 出现绑骨动画视频，且 src 指向上游返回的地址
  const video = page.locator('.figure-video')
  await expect(video).toHaveAttribute('src', 'http://example.test/anim.mp4', { timeout: 8000 })
})

test('防假兑现：画布空时要求"飞"，不谎称它动了，改引导先画', async ({ page }) => {
  await page.route('**/api/partner', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ noticed: '', dimension: 'imagination', crowd: 'open', provoke: '看它飞起来啦！', fulfill: { behavior: 'fly', trigger: '让它飞' } }),
  }))
  await page.route('**/api/tts', (route) => route.fulfill({ status: 200, contentType: 'audio/wav', body: '' }))
  await page.route('**/api/animate-figure', (route) => route.fulfill({ status: 501, contentType: 'application/json', body: '{}' }))

  await page.goto('/')
  await expect.poll(async () => page.evaluate(() => !!(window as unknown as { __editor?: unknown }).__editor)).toBe(true)
  await dismissOnboarding(page)

  // 不画任何东西，直接要求"飞"
  await sendTurn(page, '让它飞')
  await expect(page.locator('.heard')).toContainText('让它飞')
  await expect(page.locator('.talk-btn')).toBeEnabled() // 等这一拍处理完
  // 画布仍然空（没假装动）；AI 实际说的是"先画"，不是模型原话"看它飞起来啦"——查对话记录
  expect(await shapeIds(page)).toEqual([])
  await page.locator('.kid-tools button[title="成长册（给爸爸妈妈看）"]').click()
  await page.locator('.journal-item.current button', { hasText: '看这次聊了什么' }).click()
  await expect(page.locator('.journal-dialog')).toContainText('先在纸上画')
  await expect(page.locator('.journal-dialog')).not.toContainText('飞起来啦')
})

test('对象定位：选中一个，兑现只动选中的那个', async ({ page }) => {
  await page.route('**/api/partner', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ noticed: '', dimension: 'imagination', crowd: 'open', provoke: '飞咯！', fulfill: { behavior: 'fly', trigger: '让它飞' } }),
  }))
  await page.route('**/api/tts', (route) => route.fulfill({ status: 200, contentType: 'audio/wav', body: '' }))
  await page.route('**/api/animate-figure', (route) => route.fulfill({ status: 501, contentType: 'application/json', body: '{}' }))

  await page.goto('/')
  await expect.poll(async () => page.evaluate(() => !!(window as unknown as { __editor?: unknown }).__editor)).toBe(true)
  await dismissOnboarding(page)
  await childDraws(page, 'bird', 200, 300)
  await childDraws(page, 'tree', 600, 300)
  // 只选中 bird
  await page.evaluate(() => {
    const ed = (window as unknown as { __editor?: { setSelectedShapes: (ids: string[]) => void } }).__editor
    ed?.setSelectedShapes(['shape:bird'])
  })

  const treeX0 = await shapeX(page, 'shape:tree')
  await sendTurn(page, '让它飞')
  // bird 动过（飞行中 x 变化）；tree 始终不动
  await expect.poll(async () => {
    const x = await shapeX(page, 'shape:bird')
    return x != null && Math.abs(x - 200) > 30
  }, { timeout: 8000 }).toBe(true)
  const treeX1 = await shapeX(page, 'shape:tree')
  expect(Math.abs((treeX1 as number) - (treeX0 as number))).toBeLessThan(0.5) // tree 没被动
})

test('家长门 + 设置：算术门通过、添加孩子、改引导偏好', async ({ page }) => {
  await page.route('**/api/config', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ model: { id: 'qwen-vl-max', baseUrl: 'x', apiKey: { set: true, last4: '1234' } }, voice: { sttEnabled: true, ttsEnabled: true, ttsVoice: 'Cherry', apiKey: { set: false, last4: '' } }, fulfill: { enabled: true, behaviors: ['fly'], animatedDrawingsUrl: '' } }),
  }))
  await page.goto('/')
  await expect.poll(async () => page.evaluate(() => !!(window as unknown as { __editor?: unknown }).__editor)).toBe(true)
  await dismissOnboarding(page)

  await page.locator('.kid-tools button[title="设置（家长）"]').click()
  // 家长门：读出算术题、长按 2 秒、答对
  const q = (await page.locator('.gate-card b').textContent()) ?? ''
  const [a, b] = (q.match(/\d+/g) ?? ['0', '0']).map(Number)
  await page.locator('.gate-hold').dispatchEvent('pointerdown')
  await page.waitForTimeout(2200)
  await page.locator('.gate-input').fill(String(a + b))
  await page.locator('.gate-card .review-close').click()

  // 进入设置 → 默认总览页 → 切到孩子页添加孩子
  await expect(page.locator('.settings-full')).toBeVisible()
  await page.locator('.settings-nav button', { hasText: '孩子' }).click()
  await page.locator('.profile.add').click()
  await expect(page.locator('.profile-edit')).toBeVisible()

  // 伙伴页 → 改人设（主见程度）
  await page.locator('.settings-nav button', { hasText: '伙伴' }).click()
  await expect(page.locator('.settings-sec h3')).toContainText('人设')
  await page.locator('.settings-sec label', { hasText: '有主见' }).locator('select').selectOption('opinionated')

  // 切到引导页 → 把"想办法"设为重点（按钮变 on）
  await page.locator('.settings-nav button', { hasText: '引导' }).click()
  await expect(page.locator('.settings-sec h3')).toContainText('引导偏好')
  const focusBtn = page.locator('.settings-sec .emoji-pick button', { hasText: '想办法' })
  await focusBtn.click()
  await expect(focusBtn).toHaveClass(/on/)

  // 系统页能看到掩码密钥（placeholder 里）
  await page.locator('.settings-nav button', { hasText: '系统' }).click()
  await expect(page.locator('input[placeholder*="1234"]')).toBeVisible()
})

test('成长故事：把一次创作生成强项导向的学习故事', async ({ page }) => {
  await page.route('**/api/partner', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ noticed: '一个圆', dimension: 'imagination', crowd: 'open', provoke: '它叫什么呀？', fulfill: null, childSignal: '画了一条龙' }),
  }))
  await page.route('**/api/tts', (route) => route.fulfill({ status: 200, contentType: 'audio/wav', body: '' }))
  await page.route('**/api/story', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ narrative: '今天小宝画了一条龙，还自己给它起了名字，真有想象力！', highlights: ['自己起名字'], tags: { torrance: {}, dispositions: ['爱表达'] } }),
  }))

  await page.goto('/')
  await expect.poll(async () => page.evaluate(() => !!(window as unknown as { __editor?: unknown }).__editor)).toBe(true)
  await dismissOnboarding(page)
  await childDraws(page, 'd', 300, 300)
  await sendTurn(page, '你看我画的龙')
  await expect(page.locator('.heard')).toBeVisible()
  await expect(page.locator('.talk-btn')).toBeEnabled() // 等这一拍处理完（已存库）再开成长册

  await page.locator('.kid-tools button[title="成长册（给爸爸妈妈看）"]').click()
  await page.locator('.journal-item.current button', { hasText: '生成学习故事' }).click()
  await expect(page.locator('.learning-story')).toContainText('真有想象力')
  await expect(page.locator('.story-highlights')).toContainText('自己起名字')
})

async function passGate(page: Page) {
  await page.locator('.kid-tools button[title="设置（家长）"]').click()
  const q = (await page.locator('.gate-card b').textContent()) ?? ''
  const [a, b] = (q.match(/\d+/g) ?? ['0', '0']).map(Number)
  await page.locator('.gate-hold').dispatchEvent('pointerdown')
  await page.waitForTimeout(2200)
  await page.locator('.gate-input').fill(String(a + b))
  await page.locator('.gate-card .review-close').click()
  await expect(page.locator('.settings-full')).toBeVisible()
}

test('隐私模式 + 成长报告 + 兴趣识别', async ({ page }) => {
  const reqs: string[] = [] // 原始 body 字符串（大 body 用 postDataJSON 会失败）
  await page.route('**/api/partner', async (route) => {
    reqs.push(route.request().postData() ?? '')
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ noticed: '', dimension: 'imagination', crowd: 'open', provoke: '它叫什么呀？', fulfill: null, childSignal: '画了恐龙' }) })
  })
  await page.route('**/api/tts', (route) => route.fulfill({ status: 200, contentType: 'audio/wav', body: '' }))
  await page.route('**/api/config', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ model: { id: 'm', baseUrl: 'x', apiKey: { set: false, last4: '' } }, voice: { sttEnabled: true, ttsEnabled: true, ttsVoice: 'Cherry', apiKey: { set: false, last4: '' } }, fulfill: { enabled: true, behaviors: [], animatedDrawingsUrl: '' } }) }))
  await page.route('**/api/story', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ narrative: '今天画了恐龙，想象力真好。', highlights: ['想出恐龙'], tags: { torrance: { fluency: 2, flexibility: 2, originality: 3, elaboration: 1 }, dispositions: ['好奇'] }, interests: ['恐龙'] }) }))

  // 真实指针描边（触发 user 脏标记，真实孩子画笔即如此）
  const stroke = async (x0: number) => {
    await page.mouse.move(x0, 320); await page.mouse.down()
    await page.mouse.move(x0 + 40, 360); await page.mouse.move(x0 + 80, 320); await page.mouse.up()
  }

  await page.goto('/')
  await expect.poll(async () => page.evaluate(() => !!(window as unknown as { __editor?: unknown }).__editor)).toBe(true)
  await dismissOnboarding(page)

  // 第 1 拍：默认非隐私 → 带画面
  await stroke(280)
  await sendTurn(page, '你看我的恐龙')
  await expect(page.locator('.heard')).toBeVisible()
  await expect.poll(() => reqs.length).toBeGreaterThan(0)
  expect(reqs[0].includes('data:image')).toBe(true) // 非隐私：带画面

  // 开隐私模式
  await passGate(page)
  await page.locator('.settings-nav button', { hasText: '安全' }).click()
  await page.locator('.settings-sec label.chk', { hasText: '隐私模式' }).locator('input').check()
  await page.locator('.settings-back').click()

  // 第 2 拍：隐私模式 → 不带画面（即使又画了）
  await stroke(520)
  await sendTurn(page, '它在飞')
  await expect.poll(() => reqs.length).toBeGreaterThan(1)
  expect(reqs[1].includes('data:image')).toBe(false) // 隐私：不带画面

  // 生成学习故事 → 报告页能看到叙事与 Torrance 趋势
  await expect(page.locator('.talk-btn')).toBeEnabled() // 等这一拍处理完
  await page.locator('.kid-tools button[title="成长册（给爸爸妈妈看）"]').click()
  await page.locator('.journal-item.current button', { hasText: '生成学习故事' }).click()
  await expect(page.locator('.learning-story')).toBeVisible()
  await page.locator('.review-close').click()

  await passGate(page)
  await page.locator('.settings-nav button', { hasText: '报告' }).click()
  await expect(page.locator('.settings-sec')).toContainText('学习故事')
  await expect(page.locator('.story-narrative')).toContainText('想象力真好')
  await expect(page.locator('.torrance-bars')).toBeVisible()
})

test('首启建档(E2) + 切娃(E1)：欢迎引导创建孩子，顶部可切换/新增', async ({ page }) => {
  await page.goto('/')
  await expect.poll(async () => page.evaluate(() => !!(window as unknown as { __editor?: unknown }).__editor)).toBe(true)

  // E2 首启：弹出"谁在玩"建档引导
  await expect(page.locator('.who-card')).toContainText('这是给谁玩的')
  await page.locator('.who-name').fill('豆豆')
  await page.locator('.who-go').click()

  // 建档后：引导消失，顶部出现"谁在玩"小头像，显示豆豆
  await expect(page.locator('.who-card')).toHaveCount(0)
  await expect(page.locator('.who-chip')).toContainText('豆豆')

  // E1 切娃：点头像 → 加一个 → 建第二个孩子 → 头像切到妞妞
  await page.locator('.who-chip').click()
  await page.locator('.who-add').click()
  await expect(page.locator('.who-card')).toBeVisible()
  await page.locator('.who-name').fill('妞妞')
  await page.locator('.who-go').click()
  await expect(page.locator('.who-chip')).toContainText('妞妞')

  // 切回豆豆
  await page.locator('.who-chip').click()
  await page.locator('.who-list button', { hasText: '豆豆' }).click()
  await expect(page.locator('.who-chip')).toContainText('豆豆')
})

test('S2 服务诊断：AI 连不上时出现提示条，点击进设置', async ({ page }) => {
  await page.route('**/api/partner', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: '服务暂时不可用' }) }))
  await page.route('**/api/tts', (route) => route.fulfill({ status: 200, contentType: 'audio/wav', body: '' }))

  await page.goto('/')
  await expect.poll(async () => page.evaluate(() => !!(window as unknown as { __editor?: unknown }).__editor)).toBe(true)
  await dismissOnboarding(page)

  await sendTurn(page, '你好')
  // 连不上 → 出现诊断条
  await expect(page.locator('.svc-error')).toBeVisible()
  // 点击 → 进入设置（家长门）
  await page.locator('.svc-error').click()
  await expect(page.locator('.gate-card, .settings-full')).toBeVisible()
})
