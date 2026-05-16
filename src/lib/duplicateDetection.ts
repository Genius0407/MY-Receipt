import type { DuplicateCandidate } from '../types/duplicate'
import type { Receipt } from '../types/receipt'

export async function computeFileSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function computeImageAverageHash(file: File): Promise<string | null> {
  if (!file.type.startsWith('image/') || !globalThis.createImageBitmap) return null

  let bitmap: ImageBitmap | null = null
  try {
    bitmap = await createImageBitmap(file)
    const canvas = document.createElement('canvas')
    canvas.width = 8
    canvas.height = 8
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return null

    context.drawImage(bitmap, 0, 0, 8, 8)
    const data = context.getImageData(0, 0, 8, 8).data
    const grayValues: number[] = []
    for (let index = 0; index < data.length; index += 4) {
      grayValues.push((data[index] + data[index + 1] + data[index + 2]) / 3)
    }

    const average = grayValues.reduce((sum, value) => sum + value, 0) / grayValues.length
    return grayValues.map((value) => (value >= average ? '1' : '0')).join('')
  } catch (error) {
    console.warn('Image perceptual hash skipped:', error)
    return null
  } finally {
    bitmap?.close()
  }
}

export function scoreDuplicateCandidate(receipt: Receipt, candidate: Receipt): DuplicateCandidate | null {
  const reasons: string[] = []
  let score = 0

  if (receipt.file_hash && candidate.file_hash && receipt.file_hash === candidate.file_hash) {
    score += 1
    reasons.push('same_file_hash')
  }

  if (sameText(receipt.invoice_no, candidate.invoice_no) && sameText(receipt.merchant_name, candidate.merchant_name)) {
    score += 0.8
    reasons.push('same_invoice_and_merchant')
  }

  if (sameText(receipt.merchant_name, candidate.merchant_name) && sameDate(receipt.date, candidate.date) && sameAmount(receipt.grand_total, candidate.grand_total)) {
    score += 0.7
    reasons.push('same_merchant_date_total')
  }

  if (sameText(receipt.invoice_no, candidate.invoice_no) && sameDate(receipt.date, candidate.date)) {
    score += 0.5
    reasons.push('same_invoice_and_date')
  }

  if (similarText(receipt.merchant_name, candidate.merchant_name) && nearDate(receipt.date, candidate.date) && similarAmount(receipt.grand_total, candidate.grand_total)) {
    score += 0.45
    reasons.push('similar_merchant_date_total')
  }

  const ocrSimilarity = tokenSimilarity(receipt.raw_ocr, candidate.raw_ocr)
  if (ocrSimilarity >= 0.72) {
    score += 0.55
    reasons.push('similar_ocr_text')
  }

  const receiptImageHash = readPerceptualHash(receipt)
  const candidateImageHash = readPerceptualHash(candidate)
  if (receiptImageHash && candidateImageHash && hammingDistance(receiptImageHash, candidateImageHash) <= 8) {
    score += 0.65
    reasons.push('similar_image_hash')
  }

  const normalizedScore = Math.min(1, Math.round(score * 100) / 100)
  if (normalizedScore < 0.5) return null

  return { receipt: candidate, score: normalizedScore, reasons }
}

export function findBestDuplicateCandidate(receipt: Receipt, candidates: Receipt[]): DuplicateCandidate | null {
  return candidates
    .filter((candidate) => candidate.id !== receipt.id && !candidate.deleted_at)
    .map((candidate) => scoreDuplicateCandidate(receipt, candidate))
    .filter((candidate): candidate is DuplicateCandidate => Boolean(candidate))
    .sort((a, b) => b.score - a.score)[0] ?? null
}

function sameText(left: string | null | undefined, right: string | null | undefined) {
  return Boolean(left && right && normalizeText(left) === normalizeText(right))
}

function sameDate(left: string | null | undefined, right: string | null | undefined) {
  return Boolean(left && right && left.slice(0, 10) === right.slice(0, 10))
}

function sameAmount(left: number | null | undefined, right: number | null | undefined) {
  return Number.isFinite(Number(left)) && Number.isFinite(Number(right)) && Math.abs(Number(left) - Number(right)) <= 0.05
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function similarText(left: string | null | undefined, right: string | null | undefined) {
  if (!left || !right) return false
  const normalizedLeft = normalizeText(left)
  const normalizedRight = normalizeText(right)
  if (normalizedLeft.length < 4 || normalizedRight.length < 4) return false
  const distance = levenshteinDistance(normalizedLeft, normalizedRight)
  return 1 - distance / Math.max(normalizedLeft.length, normalizedRight.length) >= 0.82
}

function nearDate(left: string | null | undefined, right: string | null | undefined) {
  if (!left || !right) return false
  const leftTime = Date.parse(left.slice(0, 10))
  const rightTime = Date.parse(right.slice(0, 10))
  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) return false
  return Math.abs(leftTime - rightTime) <= 3 * 24 * 60 * 60 * 1000
}

function similarAmount(left: number | null | undefined, right: number | null | undefined) {
  const leftAmount = Number(left)
  const rightAmount = Number(right)
  if (!Number.isFinite(leftAmount) || !Number.isFinite(rightAmount)) return false
  const delta = Math.abs(leftAmount - rightAmount)
  return delta <= 1 || delta <= Math.max(leftAmount, rightAmount) * 0.02
}

export function tokenSimilarity(left: string | null | undefined, right: string | null | undefined): number {
  const leftTokens = tokenize(left)
  const rightTokens = tokenize(right)
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0

  let intersection = 0
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) intersection += 1
  })

  return Math.round((2 * intersection / (leftTokens.size + rightTokens.size)) * 100) / 100
}

function tokenize(value: string | null | undefined) {
  return new Set(
    (value ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length >= 3),
  )
}

function readPerceptualHash(receipt: Receipt) {
  const imageProcessing = receipt.image_processing
  if (!imageProcessing || typeof imageProcessing !== 'object') return null
  const hash = (imageProcessing as Record<string, unknown>).perceptual_hash
  return typeof hash === 'string' && /^[01]{64}$/.test(hash) ? hash : null
}

export function hammingDistance(left: string, right: string): number {
  if (left.length !== right.length) return Number.POSITIVE_INFINITY
  let distance = 0
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) distance += 1
  }
  return distance
}

function levenshteinDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  const current = Array.from({ length: right.length + 1 }, () => 0)

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + cost,
      )
    }
    previous.splice(0, previous.length, ...current)
  }

  return previous[right.length]
}
