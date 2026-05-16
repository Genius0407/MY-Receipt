import type { Receipt } from './receipt'

export interface DuplicateCandidate {
  receipt: Receipt
  score: number
  reasons: string[]
}
