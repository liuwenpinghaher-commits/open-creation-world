import type { GuidanceMove, PartnerResponse } from '../types/cocreate'

export async function requestPartner(payload: {
  imageDataUrl?: string
  childUtterance: string
  history: { role: 'child' | 'partner'; text: string }[]
  move: GuidanceMove
}): Promise<PartnerResponse> {
  const resp = await fetch('/api/partner', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!resp.ok) throw new Error(`partner failed: ${resp.status}`)
  return resp.json()
}
