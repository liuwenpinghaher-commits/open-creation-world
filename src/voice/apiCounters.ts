// 可观测：统计 partner/stt 调用是否在 sleep 期发生（J1）

export type ApiCounters = {
  partner: number
  stt: number
  tts: number
  partnerWhileSleep: number
  sttWhileSleep: number
}

export function emptyCounters(): ApiCounters {
  return { partner: 0, stt: 0, tts: 0, partnerWhileSleep: 0, sttWhileSleep: 0 }
}

export function recordCall(
  c: ApiCounters,
  kind: 'partner' | 'stt' | 'tts',
  phaseIsSleep: boolean
): ApiCounters {
  const next = { ...c, [kind]: c[kind] + 1 }
  if (phaseIsSleep && kind === 'partner') next.partnerWhileSleep += 1
  if (phaseIsSleep && kind === 'stt') next.sttWhileSleep += 1
  return next
}
