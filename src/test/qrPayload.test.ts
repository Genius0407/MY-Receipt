import { describe, expect, it } from 'vitest'
import { decodeQrPayloadFromImageFile, looksLikeEInvoiceQrPayload } from '../lib/qrPayload'

describe('qr payload helpers', () => {
  it('detects Malaysian e-invoice-like QR payloads', () => {
    expect(looksLikeEInvoiceQrPayload('https://myinvois.hasil.gov.my/validation/abc')).toBe(true)
    expect(looksLikeEInvoiceQrPayload('Invoice UUID: 123')).toBe(true)
    expect(looksLikeEInvoiceQrPayload('plain loyalty receipt qr')).toBe(false)
    expect(looksLikeEInvoiceQrPayload(null)).toBe(false)
  })

  it('returns null when the browser QR detector is unavailable', async () => {
    const originalDetector = (globalThis as typeof globalThis & { BarcodeDetector?: unknown }).BarcodeDetector

    try {
      delete (globalThis as typeof globalThis & { BarcodeDetector?: unknown }).BarcodeDetector
      const file = new File(['not an image'], 'receipt.txt', { type: 'text/plain' })

      await expect(decodeQrPayloadFromImageFile(file)).resolves.toBeNull()
    } finally {
      if (originalDetector) {
        ;(globalThis as typeof globalThis & { BarcodeDetector?: unknown }).BarcodeDetector = originalDetector
      }
    }
  })
})
