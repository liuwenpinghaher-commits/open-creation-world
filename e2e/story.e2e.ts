import { test, expect, type Page } from '@playwright/test'
import type { CocreateResponse } from '../src/types/cocreate'

// 一段完整的故事创作：小猫 → 皮球 → 小猫跑过去追皮球并把它吃掉（跨镜互动）
const TURNS: CocreateResponse[] = [
  {
    understanding: '孩子要一只小猫',
    addShapes: [
      { id: 'cat_head', kind: 'ellipse', x: 0.2, y: 0.4, w: 0.1, h: 0.1, color: 'orange' },
      { id: 'cat_body', kind: 'ellipse', x: 0.2, y: 0.5, w: 0.14, h: 0.1, color: 'orange' },
      { id: 'cat_tail', kind: 'line', points: [{ x: 0.27, y: 0.55 }, { x: 0.34, y: 0.5 }, { x: 0.36, y: 0.42 }], color: 'orange' },
    ],
    scenes: { append: [{ id: 's1', narration: '一只小猫出现啦。', actions: [{ shapeId: 'cat_head', do: 'enter', durationMs: 300 }] }] },
    story: { append: '从前有一只橘色的小猫。' },
    speak: '我给你画了一只小猫！',
  },
  {
    understanding: '加一个皮球',
    addShapes: [{ id: 'ball', kind: 'ellipse', x: 0.75, y: 0.55, w: 0.08, h: 0.08, color: 'red' }],
    scenes: { append: [{ id: 's2', narration: '一个红皮球滚了过来。', actions: [{ shapeId: 'ball', do: 'enter', durationMs: 300 }] }] },
    story: { append: '突然，一个红皮球滚了过来。' },
    speak: '皮球来啦！',
  },
  {
    understanding: '小猫去追皮球',
    scenes: {
      append: [
        { id: 's3', narration: '小猫飞快地跑过去。', actions: [{ shapeId: 'cat_head', do: 'moveTo', x: 0.7, y: 0.55, durationMs: 500 }, { shapeId: 'cat_body', do: 'moveTo', x: 0.7, y: 0.62, durationMs: 500 }] },
        { id: 's4', narration: '它一把抱住皮球，开心极了！', actions: [{ shapeId: 'ball', do: 'disappear', durationMs: 300 }, { shapeId: 'cat_head', do: 'wobble', durationMs: 400 }] },
      ],
    },
    story: { append: '小猫飞快跑过去，一把抱住了皮球。' },
    speak: '小猫追到皮球啦，它好开心～',
  },
]

async function stubApi(page: Page) {
  let turn = 0
  await page.route('**/api/cocreate', async (route) => {
    const body = TURNS[Math.min(turn, TURNS.length - 1)]
    turn += 1
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
  // TTS 返回空 → useVoice 检测 byteLength===0 跳过播放，不依赖音频设备
  await page.route('**/api/tts', (route) => route.fulfill({ status: 200, contentType: 'audio/wav', body: '' }))
}

function shapeX(page: Page, id: string) {
  return page.evaluate((sid) => {
    const ed = (window as unknown as { __editor?: { getShape: (i: string) => { x: number } | undefined } }).__editor
    return ed?.getShape(`shape:${sid}`)?.x ?? null
  }, id)
}
function shapeIds(page: Page) {
  return page.evaluate(() => {
    const ed = (window as unknown as { __editor?: { getCurrentPageShapeIds: () => Set<string> } }).__editor
    return ed ? [...ed.getCurrentPageShapeIds()] : []
  })
}

async function sendTurn(page: Page, text: string) {
  const input = page.locator('.talk-bar input')
  await input.fill(text)
  await input.press('Enter')
}

test('完整故事创作：分镜在真实浏览器里渲染并演出，回放可用', async ({ page }) => {
  await stubApi(page)
  await page.goto('/')

  // 等 tldraw 就绪
  await expect.poll(async () => (await page.evaluate(() => !!(window as unknown as { __editor?: unknown }).__editor))).toBe(true)

  // 第 1 拍：小猫
  await sendTurn(page, '画一只小猫')
  await expect.poll(() => shapeIds(page).then((ids) => ids.includes('shape:cat_head'))).toBe(true)
  // 原生手绘 line（尾巴）也真实渲染、未被 tldraw 校验拒绝
  await expect.poll(() => shapeIds(page).then((ids) => ids.includes('shape:cat_tail'))).toBe(true)
  await expect(page.locator('.story-strip')).toContainText('橘色的小猫')

  // 第 2 拍：皮球
  await sendTurn(page, '加一个皮球')
  await expect.poll(() => shapeIds(page).then((ids) => ids.includes('shape:ball'))).toBe(true)

  // 第 3 拍：小猫追皮球——验证分镜真的让 cat_head 移动了（x 显著变化）
  const xBefore = await shapeX(page, 'cat_head')
  await sendTurn(page, '让小猫跑过去追皮球')
  await expect.poll(async () => {
    const xNow = await shapeX(page, 'cat_head')
    return xBefore != null && xNow != null && Math.abs(xNow - xBefore) > 50
  }, { timeout: 15000 }).toBe(true)

  // 微动画"活起来"：一拍结束后角色持续轻微呼吸/摇摆——多次采样 rotation 或呼吸 w 应有变化
  const pose = () => page.evaluate(() => {
    const ed = (window as unknown as { __editor?: { getShape: (i: string) => { rotation: number; props: { w?: number } } | undefined } }).__editor
    const s = ed?.getShape('shape:cat_head')
    return s ? { rot: s.rotation, w: s.props?.w ?? 0 } : null
  })
  const samples: { rot: number; w: number }[] = []
  for (let k = 0; k < 4; k++) { const p = await pose(); if (p) samples.push(p); await page.waitForTimeout(250) }
  const rots = samples.map((s) => s.rot)
  const ws = samples.map((s) => s.w)
  const moved = Math.max(...rots) - Math.min(...rots) > 1e-4 || Math.max(...ws) - Math.min(...ws) > 1e-2
  expect(moved, `idle 应让角色微动，rot=${JSON.stringify(rots)} w=${JSON.stringify(ws)}`).toBe(true)

  // 故事推进 + 回放按钮可用
  await expect(page.locator('.story-strip')).toContainText('抱住了皮球')
  const replay = page.locator('.kid-tools button[title="再演一遍"]')
  await expect(replay).toBeEnabled()

  // 点回放，演出不崩溃：cat_head 仍在且最终重新可见
  await replay.click()
  await expect.poll(() => shapeIds(page).then((ids) => ids.includes('shape:cat_head')), { timeout: 20000 }).toBe(true)
  await expect.poll(async () => {
    const op = await page.evaluate(() => {
      const ed = (window as unknown as { __editor?: { getShape: (i: string) => { opacity: number } | undefined } }).__editor
      return ed?.getShape('shape:cat_head')?.opacity ?? null
    })
    return op != null && op > 0.5
  }, { timeout: 20000 }).toBe(true)

  // M1 持久化：刷新后自动恢复创作（画布与故事仍在）
  await page.reload()
  await expect.poll(async () => (await page.evaluate(() => !!(window as unknown as { __editor?: unknown }).__editor))).toBe(true)
  await expect.poll(() => shapeIds(page).then((ids) => ids.includes('shape:cat_head')), { timeout: 15000 }).toBe(true)
  await expect(page.locator('.story-strip')).toContainText('橘色的小猫')

  // 🆕 新故事：清空画布与故事
  await page.locator('.kid-tools button[title="新故事"]').click()
  await expect.poll(() => shapeIds(page).then((ids) => ids.length), { timeout: 10000 }).toBe(0)
  await expect(page.locator('.story-strip')).toHaveText('')
})
