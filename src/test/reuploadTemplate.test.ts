import { describe, expect, it } from 'vitest'
import { buildReuploadRequestMessage } from '../lib/reuploadTemplate'

describe('reupload template', () => {
  it('builds a client-ready message from deleted receipt metadata', () => {
    const message = buildReuploadRequestMessage({
      merchant_name: 'ACME Sdn Bhd',
      filename: 'receipt.jpg',
      invoice_no: 'INV-1',
      date: '2026-05-16',
      deleted_reason: 'blurry_image',
      deleted_note: 'Top right corner is cropped.',
    })

    expect(message).toContain('Please resubmit ACME Sdn Bhd.')
    expect(message).toContain('the receipt image is blurry')
    expect(message).toContain('Invoice No: INV-1 / Date: 2026-05-16')
    expect(message).toContain('Top right corner is cropped.')
  })
})
