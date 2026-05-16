export async function decodeQrPayloadFromImageFile(file: File): Promise<string | null> {
  const BarcodeDetectorConstructor = (globalThis as typeof globalThis & {
    BarcodeDetector?: new (options?: { formats?: string[] }) => {
      detect: (source: unknown) => Promise<Array<{ rawValue?: string }>>
    }
  }).BarcodeDetector

  if (!BarcodeDetectorConstructor || !globalThis.createImageBitmap) return null

  let image: ImageBitmap | null = null
  try {
    image = await createImageBitmap(file)
    const detector = new BarcodeDetectorConstructor({ formats: ['qr_code'] })
    const results = await detector.detect(image)
    return results.map((result) => result.rawValue?.trim()).find(Boolean) ?? null
  } catch (error) {
    console.warn('QR payload decode skipped:', error)
    return null
  } finally {
    image?.close()
  }
}

export function looksLikeEInvoiceQrPayload(payload: string | null | undefined): boolean {
  if (!payload) return false
  return /myinvois|e-?invoice|invoice|lhdn|hasil|tax|uuid|validation/i.test(payload)
}
