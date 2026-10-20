import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { _resetDbForTests } from './db'
import {
	DEFAULT_PARTNER_NAME,
	builtinPersonaForName,
	getPartnerName,
	normalizePartnerName,
	partnerUiCopy,
	resetPartnerIdentity,
	savePartnerName,
} from './partnerIdentity'

describe('normalizePartnerName', () => {
	it('defaults empty to 马良', () => {
		expect(normalizePartnerName('')).toBe(DEFAULT_PARTNER_NAME)
		expect(normalizePartnerName('  ')).toBe(DEFAULT_PARTNER_NAME)
	})

	it('strips spaces and quotes, clamps length', () => {
		expect(normalizePartnerName(' 小 画 仙 ')).toBe('小画仙')
		expect(normalizePartnerName('「亮亮」')).toBe('亮亮')
		expect(normalizePartnerName('一二三四五六七八九')).toBe('一二三四五六七八')
	})
})

describe('partnerUiCopy / persona', () => {
	it('builds kid-facing copy from name', () => {
		const c = partnerUiCopy('亮亮')
		expect(c.bubbleLabel).toBe('亮亮')
		expect(c.hintIdle).toMatch(/亮亮/)
		expect(c.wakeWords).toContain('亮亮')
		expect(c.wakeWords).toContain('嘿亮亮')
	})

	it('persona embeds the name', () => {
		const p = builtinPersonaForName('小鹿')
		expect(p).toMatch(/「小鹿」/)
		expect(p).not.toMatch(/「马良」/)
	})
})

describe('partnerIdentity persistence', () => {
	beforeEach(() => {
		_resetDbForTests()
		// eslint-disable-next-line no-global-assign
		indexedDB = new IDBFactory()
	})

	it('saves and resets name', async () => {
		expect(await getPartnerName()).toBe(DEFAULT_PARTNER_NAME)
		await savePartnerName('豆豆')
		expect(await getPartnerName()).toBe('豆豆')
		await resetPartnerIdentity()
		expect(await getPartnerName()).toBe(DEFAULT_PARTNER_NAME)
	})
})
