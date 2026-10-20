import { expect, type Page, type Route } from '@playwright/test'
import type { PartnerResponse } from '../src/types/cocreate'

/** 44 字节静音 WAV，保证 speak() 能 onended */
export const MIN_WAV = Buffer.from(
  'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
  'base64'
)

export type PartnerStub = PartnerResponse | ((reqBody: string, turn: number) => PartnerResponse)

export async function stubApis(
  page: Page,
  opts: {
    partner?: PartnerStub
    partnerStatus?: number
    story?: Record<string, unknown>
    animate?: { status: number; body?: unknown }
    config?: unknown
  } = {}
) {
  let turn = 0
  const partnerReqs: string[] = []

  await page.route('**/api/partner', async (route: Route) => {
    const raw = route.request().postData() ?? ''
    partnerReqs.push(raw)
    if (opts.partnerStatus && opts.partnerStatus >= 400) {
      await route.fulfill({
        status: opts.partnerStatus,
        contentType: 'application/json',
        body: JSON.stringify({ error: '服务暂时不可用' }),
      })
      return
    }
    const body =
      typeof opts.partner === 'function'
        ? opts.partner(raw, turn)
        : opts.partner ?? {
            noticed: '一个形状',
            dimension: 'observe_express',
            crowd: 'open',
            provoke: '这是什么呀？',
            fulfill: null,
          }
    turn += 1
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    })
  })

  await page.route('**/api/tts', async (route) => {
    await route.fulfill({ status: 200, contentType: 'audio/wav', body: MIN_WAV })
  })
  await page.route('**/api/tts-chunks', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        parts: [{ mime: 'audio/wav', audioBase64: MIN_WAV.toString('base64'), text: 'x' }],
      }),
    })
  })
  await page.route('**/api/stt', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ text: '' }),
    })
  })
  await page.route('**/api/story', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        opts.story ?? {
          narrative: '今天画了一会儿。',
          highlights: [],
          tags: { torrance: {}, dispositions: [] },
          interests: [],
        }
      ),
    })
  })
  await page.route('**/api/animate-figure', async (route) => {
    const a = opts.animate ?? { status: 501, body: {} }
    await route.fulfill({
      status: a.status,
      contentType: 'application/json',
      body: JSON.stringify(a.body ?? {}),
    })
  })
  await page.route('**/api/config', async (route) => {
    if (route.request().method() === 'GET' || route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          opts.config ?? {
            model: { id: 'qwen-vl-max', baseUrl: 'x', apiKey: { set: true, last4: '1234' } },
            voice: {
              sttEnabled: true,
              ttsEnabled: true,
              ttsVoice: 'Cherry',
              apiKey: { set: false, last4: '' },
            },
            fulfill: { enabled: true, behaviors: ['fly', 'walk', 'spin'], animatedDrawingsUrl: '' },
          }
        ),
      })
      return
    }
    await route.continue()
  })
  await page.route('**/api/config/test', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, status: 200, ttsOk: true }),
    })
  })

  return {
    partnerReqs,
    partnerTurn: () => turn,
  }
}

export async function waitEditor(page: Page) {
  await expect
    .poll(async () => page.evaluate(() => !!(window as unknown as { __editor?: unknown }).__editor))
    .toBe(true)
}

export async function dismissOnboarding(page: Page) {
  try {
    await page.locator('.who-skip').click({ timeout: 3000 })
  } catch {
    /* 无引导 */
  }
}

export async function childDraws(page: Page, id: string, x: number, y: number) {
  await page.evaluate(
    ({ id, x, y }) => {
      const ed = (window as unknown as { __editor?: { createShape: (s: unknown) => void } }).__editor
      ed?.createShape({
        id: `shape:${id}`,
        type: 'geo',
        x,
        y,
        props: { geo: 'ellipse', w: 90, h: 90, color: 'black', dash: 'draw', fill: 'none' },
      })
    },
    { id, x, y }
  )
}

export function shapeIds(page: Page) {
  return page.evaluate(() => {
    const ed = (window as unknown as { __editor?: { getCurrentPageShapeIds: () => Set<string> } }).__editor
    return ed ? [...ed.getCurrentPageShapeIds()] : []
  })
}

export function shapeX(page: Page, id: string) {
  return page.evaluate((sid) => {
    const ed = (
      window as unknown as { __editor?: { getShape: (i: string) => { x: number } | undefined } }
    ).__editor
    return ed?.getShape(sid)?.x ?? null
  }, id)
}

export async function sendTurn(page: Page, text: string) {
  // 等上一拍彻底结束（非 thinking，且 talk 可用）
  await expect(page.locator('.talk-btn')).toBeEnabled({ timeout: 20000 })
  await expect
    .poll(async () => {
      const ph = await page.evaluate(() => {
        const st = (window as unknown as { __voiceState?: () => { phase: string } }).__voiceState?.()
        return st?.phase ?? 'unknown'
      })
      return ph !== 'thinking' && ph !== 'speaking' && ph !== 'barge_candidate'
    }, { timeout: 20000 })
    .toBe(true)

  const input = page.locator('.talk-bar input')
  await input.fill(text)
  await input.press('Enter')
  // heard 更新 = 本拍 runTurn 已启动并 setHeard
  await expect(page.locator('.heard')).toContainText(text.slice(0, Math.min(6, text.length)), {
    timeout: 20000,
  })
  await expect(page.locator('.talk-btn')).toBeEnabled({ timeout: 20000 })
  await expect
    .poll(async () => {
      const ph = await page.evaluate(() => {
        const st = (window as unknown as { __voiceState?: () => { phase: string } }).__voiceState?.()
        return st?.phase ?? 'unknown'
      })
      return ph !== 'thinking' && ph !== 'speaking' && ph !== 'barge_candidate'
    }, { timeout: 20000 })
    .toBe(true)
}

export async function voicePhase(page: Page): Promise<string> {
  return page.evaluate(() => {
    const st = (window as unknown as { __voiceState?: () => { phase: string } }).__voiceState?.()
    return st?.phase ?? 'unknown'
  })
}

export async function voiceDispatch(page: Page, ev: Record<string, unknown>) {
  await page.evaluate(async (e) => {
    const d = (window as unknown as { __voiceDispatch?: (x: unknown) => Promise<void> }).__voiceDispatch
    if (!d) throw new Error('__voiceDispatch missing (need dev)')
    await d(e)
  }, ev)
}

export async function passParentGate(page: Page) {
  await page.locator('.kid-tools button[title="设置（家长）"]').click()
  const q = (await page.locator('.gate-card b').textContent()) ?? ''
  const [a, b] = (q.match(/\d+/g) ?? ['0', '0']).map(Number)
  await page.locator('.gate-hold').dispatchEvent('pointerdown')
  await page.waitForTimeout(2200)
  await page.locator('.gate-input').fill(String(a + b))
  await page.locator('.gate-card .review-close').click()
  await expect(page.locator('.settings-full')).toBeVisible()
}

export async function openApp(page: Page) {
  await page.goto('/')
  await waitEditor(page)
  await dismissOnboarding(page)
}
