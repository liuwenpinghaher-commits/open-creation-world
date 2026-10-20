'use client'

import { useEffect, useState } from 'react'
import {
	getGate,
	makeArithChallenge,
	type ParentGate,
} from '../../lib/store/family'

const SESSION_KEY = 'shenbi-parent-unlocked'

export function isParentUnlocked(): boolean {
	if (typeof sessionStorage === 'undefined') return false
	return sessionStorage.getItem(SESSION_KEY) === '1'
}

export function setParentUnlocked(v: boolean) {
	if (typeof sessionStorage === 'undefined') return
	if (v) sessionStorage.setItem(SESSION_KEY, '1')
	else sessionStorage.removeItem(SESSION_KEY)
}

type Props = {
	onUnlocked: () => void
	title?: string
}

/**
 * 家长门：算术 / PIN / off；通过后写入 sessionStorage，同会话内设置/成长互通。
 * 不在 render 路径读 sessionStorage / 不在 useState 初值用随机题，避免 hydration 错位。
 */
export function ParentGateUnlock({ onUnlocked, title = '家长门' }: Props) {
	const [gate, setGate] = useState<ParentGate>({ mode: 'arith' })
	const [challenge, setChallenge] = useState<{ a: number; b: number; answer: number } | null>(
		null
	)
	const [input, setInput] = useState('')
	const [err, setErr] = useState('')
	const [ready, setReady] = useState(false)

	useEffect(() => {
		if (isParentUnlocked()) {
			onUnlocked()
			return
		}
		void getGate().then((g) => {
			setGate(g)
			if (g.mode === 'off') {
				setParentUnlocked(true)
				onUnlocked()
			} else {
				setChallenge(makeArithChallenge())
				setReady(true)
			}
		})
	}, [onUnlocked])

	const tryUnlock = () => {
		if (gate.mode === 'off') {
			setParentUnlocked(true)
			onUnlocked()
			return
		}
		if (gate.mode === 'pin') {
			if (input === (gate.pin || '0000')) {
				setParentUnlocked(true)
				onUnlocked()
			} else setErr('PIN 不正确')
			return
		}
		if (!challenge) return
		if (Number(input) === challenge.answer) {
			setParentUnlocked(true)
			onUnlocked()
		} else {
			setErr('答案不对')
			setChallenge(makeArithChallenge())
			setInput('')
		}
	}

	if (!ready) {
		return (
			<div className="parent-gate-card">
				<p className="muted">检查家长门…</p>
			</div>
		)
	}

	return (
		<div className="parent-gate-card">
			<h1>{title}</h1>
			<p className="muted">防止孩子误改配置或查看成长分析。</p>
			{gate.mode === 'arith' && challenge ? (
				<p className="gate-q">
					请计算：{challenge.a} + {challenge.b} = ?
				</p>
			) : (
				<p className="gate-q">请输入 PIN</p>
			)}
			<div className="row">
				<input
					className="composer-input"
					style={{ maxWidth: 180 }}
					value={input}
					onChange={(e) => setInput(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === 'Enter') tryUnlock()
					}}
					autoFocus
				/>
				<button type="button" className="btn btn-primary" onClick={tryUnlock}>
					进入
				</button>
			</div>
			{err ? <p className="err-inline">{err}</p> : null}
		</div>
	)
}
