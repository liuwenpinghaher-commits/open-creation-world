import type { GuidanceMove, PartnerResponse } from '../types/cocreate'
import type { ChildContext } from '../types/settings'

export async function requestPartner(payload: {
  imageDataUrl?: string
  childUtterance: string
  history: { role: 'child' | 'partner'; text: string }[]
  move: GuidanceMove
  hasDrawing?: boolean
  childContext?: ChildContext
}): Promise<PartnerResponse> {
  const resp = await fetch('/api/partner', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!resp.ok) throw new Error(`partner failed: ${resp.status}`)
  return resp.json()
}
