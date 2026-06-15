import type { SessionState } from '../types/cocreate'

export function buildRequest(input: {
  imageDataUrl: string
  childUtterance: string
  history: SessionState['dialog']
}) {
  return {
    imageDataUrl: input.imageDataUrl,
    childUtterance: input.childUtterance,
    history: input.history.slice(-8),
  }
}
