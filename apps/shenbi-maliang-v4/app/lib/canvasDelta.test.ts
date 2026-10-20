import { describe, expect, it } from 'vitest'
import { diffSignatures, type CanvasSignature } from './canvasDelta'

function sig(fp: string, ids: string[], area = 100): CanvasSignature {
	return {
		fingerprint: fp,
		shapeCount: ids.length,
		ids: [...ids].sort(),
		area,
		at: 0,
	}
}

describe('diffSignatures', () => {
	it('first look + focusIds all', () => {
		const d = diffSignatures(null, sig('a', ['1', '2', '3']))
		expect(d.drewSinceLast).toBe(true)
		expect(d.added).toBe(3)
		expect(d.addedIds).toEqual(['1', '2', '3'])
		expect(d.focusIds).toEqual(['1', '2', '3'])
		expect(d.summary).toMatch(/第一眼/)
	})

	it('detects added shapes and focusIds', () => {
		const d = diffSignatures(sig('old', ['a', 'b']), sig('new', ['a', 'b', 'c']))
		expect(d.changed).toBe(true)
		expect(d.added).toBe(1)
		expect(d.addedIds).toEqual(['c'])
		expect(d.focusIds).toEqual(['c'])
		expect(d.summary).toMatch(/新画|特写/)
	})

	it('detects removed shapes', () => {
		const d = diffSignatures(sig('old', ['a', 'b', 'c']), sig('new', ['a', 'b']))
		expect(d.removed).toBe(1)
		expect(d.summary).toMatch(/擦掉|删/)
	})

	it('unchanged when fingerprint and ids same', () => {
		const d = diffSignatures(sig('same', ['a', 'b']), sig('same', ['a', 'b']))
		expect(d.changed).toBe(false)
		expect(d.drewSinceLast).toBe(false)
		expect(d.addedIds).toEqual([])
		expect(d.summary).toMatch(/没变/)
	})

	it('edited in place focuses all ids', () => {
		const d = diffSignatures(sig('v1', ['a', 'b']), sig('v2', ['a', 'b']))
		expect(d.editedInPlace).toBe(true)
		expect(d.focusIds).toEqual(['a', 'b'])
		expect(d.summary).toMatch(/改动|挪动/)
	})
})
