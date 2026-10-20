import { test, expect } from '@playwright/test'
import {
  childDraws,
  openApp,
  sendTurn,
  stubApis,
  voiceDispatch,
  voicePhase,
} from './helpers'

test.describe('语音 FSM（v2）', () => {
  test('V1 只画不说：不自动 partner', async ({ page }) => {
    const api = await stubApis(page)
    await openApp(page)
    await expect(page.locator('.voice-phase-dot')).toHaveAttribute('data-phase', 'sleep')

    await page.mouse.move(300, 320)
    await page.mouse.down()
    await page.mouse.move(340, 360)
    await page.mouse.move(380, 320)
    await page.mouse.up()

    await page.waitForTimeout(3500)
    expect(api.partnerReqs.length).toBe(0)
    expect(await voicePhase(page)).toBe('sleep')
  })

  test('V2 唤醒同句 + V3 免唤醒多轮', async ({ page }) => {
    const api = await stubApis(page, {
      partner: (_raw, turn) => ({
        noticed: '画',
        dimension: turn === 0 ? 'observe_express' : 'narrative_logic',
        crowd: 'open',
        peer: turn === 0 ? { evaluate: '真棒' } : undefined,
        provoke: turn === 0 ? '这是什么呀？' : '然后呢？',
        fulfill: null,
        childSignal: '说了',
      }),
    })
    await openApp(page)
    await childDraws(page, 'c1', 280, 300)

    await sendTurn(page, '你看我的城堡')
    await expect(page.locator('.heard')).toContainText('你看我的城堡')
    expect(api.partnerReqs.length).toBe(1)
    // 第一拍后应离开 sleep（follow_up / speaking 等）
    await expect
      .poll(async () => voicePhase(page), { timeout: 8000 })
      .not.toBe('sleep')

    // 免唤醒第二句
    await sendTurn(page, '门太小了')
    await expect(page.locator('.heard')).toContainText('门太小了')
    expect(api.partnerReqs.length).toBe(2)
    const body2 = JSON.parse(api.partnerReqs[1])
    expect(body2.childUtterance).toContain('门')
    // history 应带回上一轮
    expect(Array.isArray(body2.history)).toBe(true)
  })

  test('V4 静默休眠 + V5 再唤醒仍有历史', async ({ page }) => {
    await stubApis(page, {
      partner: {
        noticed: 'n',
        dimension: 'observe_express',
        crowd: 'wh',
        provoke: '叫什么名字呀？',
        fulfill: null,
        childSignal: '城堡',
      },
    })
    await openApp(page)
    await childDraws(page, 'k', 300, 300)
    await sendTurn(page, '我画了城堡')
    await expect(page.locator('.heard')).toBeVisible()

    // 强制 follow_up 超时 → sleep
    await voiceDispatch(page, { type: 'force_sleep', nowMs: Date.now() })
    await expect.poll(async () => voicePhase(page)).toBe('sleep')

    await sendTurn(page, '屋顶呢')
    await expect(page.locator('.heard')).toContainText('屋顶')

    await page.locator('.kid-tools button[title="成长册（给爸爸妈妈看）"]').click()
    await page.locator('.journal-item.current button', { hasText: '看这次聊了什么' }).click()
    await expect(page.locator('.journal-dialog')).toContainText('城堡')
    await expect(page.locator('.journal-dialog')).toContainText('屋顶')
  })

  test('V6 硬断：合成 G1+G2 后 phase 不卡死，可再输入', async ({ page }) => {
    await stubApis(page, {
      partner: {
        noticed: 'x',
        dimension: 'observe_express',
        crowd: 'open',
        provoke: '这是一句用来测试打断的话。',
        fulfill: null,
      },
    })
    await openApp(page)
    await sendTurn(page, '你好马良朋友')

    const t0 = Date.now()
    // 显式进入 speaking（不依赖真实 TTS 时长），再注入 barge
    await voiceDispatch(page, {
      type: 'tts_start',
      text: '这是一句用来测试打断的话',
      nowMs: t0,
    })
    expect(await voicePhase(page)).toBe('speaking')

    await voiceDispatch(page, {
      type: 'speech_frame',
      prob: 0.95,
      dtMs: 450,
      nowMs: t0 + 400,
    })
    await voiceDispatch(page, {
      type: 'partial',
      text: '不对是龙',
      nowMs: t0 + 500,
    })

    // 硬断后应为 listening（或队列立刻跑下一拍 thinking→结束），绝不能永久 thinking
    await expect
      .poll(async () => {
        const p = await voicePhase(page)
        return p === 'listening' || p === 'follow_up' || p === 'sleep' || p === 'thinking'
      }, { timeout: 5000 })
      .toBeTruthy()

    // 等打断句（若已入队）跑完
    await expect
      .poll(async () => (await voicePhase(page)) !== 'thinking', { timeout: 20000 })
      .toBe(true)
    await expect(page.locator('.talk-btn')).toBeEnabled()

    // 再输入不应死锁
    await page.locator('.talk-bar input').fill('它叫火龙')
    await page.locator('.talk-bar input').press('Enter')
    await expect(page.locator('.heard')).toContainText('火龙', { timeout: 20000 })
  })

  test('相位指示可见', async ({ page }) => {
    await stubApis(page)
    await openApp(page)
    await expect(page.locator('.voice-phase-dot')).toBeVisible()
    await expect(page.locator('.voice-phase-dot')).toHaveAttribute('data-phase', 'sleep')
  })
})
