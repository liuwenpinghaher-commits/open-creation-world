import Dexie, { type Table } from 'dexie'
import type { GuidanceDimension } from '../guidance/types'
import type { DimensionState } from '../growth/model'
import type { GrowthEvent } from '../growth/events'

export type DialogTurn = {
	role: 'user' | 'assistant'
	content: string
	at: number
}

export type WorkRow = {
	id: string
	title: string
	createdAt: number
	updatedAt: number
	snapshotJson?: string
	dialog: DialogTurn[]
	dimHistory: GuidanceDimension[]
	sceneNote?: string
	childId?: string | null
}

export type ChildProfile = {
	id: string
	name: string
	age?: number
	interests?: string
	createdAt: number
}

export type GuidancePrefs = {
	childId: string
	weights?: Partial<Record<GuidanceDimension, number>>
	lockSupport?: 'auto' | 'high' | 'normal'
}

export type KvRow = { key: string; value: unknown }

export type DimensionStateRow = DimensionState
export type GrowthEventRow = GrowthEvent

class ShenbiDB extends Dexie {
	works!: Table<WorkRow, string>
	profiles!: Table<ChildProfile, string>
	prefs!: Table<GuidancePrefs, string>
	kv!: Table<KvRow, string>
	events!: Table<GrowthEventRow, string>
	dimensionStates!: Table<DimensionStateRow, string>

	constructor() {
		super('shenbi-maliang')
		this.version(1).stores({
			works: 'id, updatedAt, childId',
			profiles: 'id',
			prefs: 'childId',
			kv: 'key',
		})
		// v4 成长：事件 + 维度状态
		this.version(2).stores({
			works: 'id, updatedAt, childId',
			profiles: 'id',
			prefs: 'childId',
			kv: 'key',
			events: 'id, childId, workId, verb, at',
			dimensionStates: '[childId+dimension], childId, dimension',
		})
	}
}

let _db: ShenbiDB | null = null

export function getDb(): ShenbiDB {
	if (typeof window === 'undefined') {
		// 测试环境：用 fake-indexeddb 或内存；允许 Node 下用 globalThis.indexedDB
		if (typeof indexedDB === 'undefined') {
			throw new Error('Dexie 需要 IndexedDB（浏览器或测试 polyfill）')
		}
	}
	if (!_db) _db = new ShenbiDB()
	return _db
}

/** 测试辅助：重置单例 */
export function _resetDbForTests(): void {
	_db = null
}
