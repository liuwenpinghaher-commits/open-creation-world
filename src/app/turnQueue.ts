/**
 * 串行一拍队列：硬打断在 runTurn 仍 await speak 时到达的 run_turn 不得丢弃。
 * latest-wins：连打断只保留最后一句。
 */
export type TurnQueue = {
  /** 入队执行；若正在跑则挂起为 pending（覆盖旧 pending） */
  enqueue: (utterance: string) => Promise<void>
  /** 是否有在飞一拍 */
  isRunning: () => boolean
  /** 测试/诊断 */
  pending: () => string | null
}

export function createTurnQueue(run: (utterance: string) => Promise<void>): TurnQueue {
  let running = false
  let pending: string | null = null
  let chain: Promise<void> = Promise.resolve()

  const enqueue = (utterance: string): Promise<void> => {
    if (running) {
      pending = utterance
      return chain
    }
    running = true
    const job = (async () => {
      try {
        await run(utterance)
        // 排空打断队列（可能在 speak 中途写入）
        while (pending !== null) {
          const next = pending
          pending = null
          await run(next)
        }
      } finally {
        running = false
      }
    })()
    chain = job.catch(() => { /* 错误由 run 内部处理；不阻断后续 */ })
    return job
  }

  return {
    enqueue,
    isRunning: () => running,
    pending: () => pending,
  }
}
