import { describe, expect, it } from 'vitest'
import { findBestDuplicateCandidate, hammingDistance, scoreDuplicateCandidate, tokenSimilarity } from '../lib/duplicateDetection'
import type { Receipt } from '../types/receipt'

describe('duplicate detection', () => {
  it('scores exact file hash matches as definite duplicates', () => {
    const duplicate = scoreDuplicateCandidate(createReceipt({ file_hash: 'abc' }), createReceipt({ id: 'other', file_hash: 'abc' }))

    expect(duplicate?.score).toBe(1)
    expect(duplicate?.reasons).toContain('same_file_hash')
  })

  it('scores invoice and merchant matches', () => {
    const duplicate = scoreDuplicateCandidate(
      createReceipt({ invoice_no: 'INV-001', merchant_name: 'Acme Sdn Bhd' }),
      createReceipt({ id: 'other', invoice_no: 'inv001', merchant_name: 'ACME SDN BHD' }),
    )

    expect(duplicate?.score).toBeGreaterThanOrEqual(0.8)
    expect(duplicate?.reasons).toContain('same_invoice_and_merchant')
  })

  it('ignores deleted candidates when finding the best match', () => {
    const best = findBestDuplicateCandidate(createReceipt({ file_hash: 'abc' }), [
      createReceipt({ id: 'deleted', file_hash: 'abc', deleted_at: '2026-05-16T00:00:00Z' }),
      createReceipt({ id: 'active', file_hash: 'abc' }),
    ])

    expect(best?.receipt.id).toBe('active')
  })

  it('scores OCR text similarity as a duplicate signal', () => {
    const duplicate = scoreDuplicateCandidate(
      createReceipt({ raw_ocr: 'ACME SDN BHD invoice inv001 total 100.00' }),
      createReceipt({ id: 'other', raw_ocr: 'ACME SDN BHD invoice inv001 total 100.00 paid cash' }),
    )

    expect(duplicate?.score).toBeGreaterThanOrEqual(0.55)
    expect(duplicate?.reasons).toContain('similar_ocr_text')
    expect(tokenSimilarity('one two three four', 'one two three five')).toBeGreaterThan(0.5)
  })

  it('scores perceptual hash similarity as a duplicate signal', () => {
    const duplicate = scoreDuplicateCandidate(
      createReceipt({ image_processing: { perceptual_hash: '1111000011110000111100001111000011110000111100001111000011110000' } }),
      createReceipt({ id: 'other', image_processing: { perceptual_hash: '1111000011110000111100001111000011110000111100001111000011111111' } }),
    )

    expect(hammingDistance('1111', '1100')).toBe(2)
    expect(duplicate?.reasons).toContain('similar_image_hash')
  })
})

function createReceipt(overrides: Partial<Receipt> = {}): Receipt {
  return {
    id: 'receipt-1',
    user_id: 'user-1',
    filename: 'receipt.jpg',
    mime_type: 'image/jpeg',
    file_path: 'user-1/receipt-1/original.jpg',
    status: 'pending_review',
    merchant_name: 'Merchant',
    company_reg_no: null,
    address: null,
    phone: null,
    invoice_no: 'INV-1',
    date: '2026-05-16',
    time: null,
    category: 'Grocery',
    doc_type: 'Receipt',
    subtotal: 10,
    discount: 0,
    tax: 0,
    service_charge: 0,
    rounding: 0,
    grand_total: 10,
    payment_method: null,
    change: 0,
    subsidy_details: null,
    tags: ['Pending'],
    confidence_score: 0.9,
    error_message: null,
    processed_at: null,
    created_at: '2026-05-16T00:00:00Z',
    updated_at: '2026-05-16T00:00:00Z',
    ...overrides,
  }
}
