import type { CocreateResponse } from '../types/cocreate'

export async function requestCocreate(payload: {
  imageDataUrl: string
  childUtterance: string
  history: { role: 'child' | 'system'; text: string }[]
  shapes?: unknown[]
}): Promise<CocreateResponse> {
  const resp = await fetch('/api/cocreate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!resp.ok) throw new Error(`cocreate failed: ${resp.status}`)
  return resp.json()
}
