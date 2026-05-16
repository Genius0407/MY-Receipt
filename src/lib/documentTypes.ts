import type { DocumentTypeOption } from '../types/documentType'
import type { Receipt, ReceiptDocType } from '../types/receipt'

export const STANDARD_DOCUMENT_TYPES: DocumentTypeOption[] = [
  { value: 'Receipt', label: 'Receipt' },
  { value: 'Invoice', label: 'Invoice' },
  { value: 'Credit Note', label: 'Credit Note' },
  { value: 'Expense', label: 'Expense' },
  { value: 'E-invoice', label: 'E-invoice' },
]

export const CUSTOM_DOCUMENT_TYPE_OPTION: DocumentTypeOption = { value: 'Custom', label: 'Custom', custom: true }

export function mergeDocumentTypeOptions(customNames: string[] = []): DocumentTypeOption[] {
  const customOptions = uniqueCustomNames(customNames).map((name) => ({
    value: 'Custom' as const,
    label: name,
    custom: true,
  }))
  return [...STANDARD_DOCUMENT_TYPES, ...customOptions, CUSTOM_DOCUMENT_TYPE_OPTION]
}

export function normalizeDocumentType(value: unknown, customDocType?: unknown): { doc_type: ReceiptDocType; custom_doc_type: string | null } {
  const text = String(value ?? '').trim()
  const customText = String(customDocType ?? '').trim()
  const standard = STANDARD_DOCUMENT_TYPES.find((option) => option.value === text)

  if (standard) {
    return { doc_type: standard.value as ReceiptDocType, custom_doc_type: null }
  }

  if (text === 'Custom' || text === 'Custom (自定义)' || customText) {
    return { doc_type: 'Receipt', custom_doc_type: customText || (text.startsWith('Custom') ? null : text) }
  }

  return { doc_type: 'Receipt', custom_doc_type: null }
}

export function formatDocumentType(receipt: Pick<Receipt, 'doc_type' | 'custom_doc_type'>): string {
  return receipt.custom_doc_type?.trim() || receipt.doc_type
}

function uniqueCustomNames(names: string[]) {
  return Array.from(new Set(names.map((name) => name.trim()).filter(Boolean))).filter(
    (name) => !STANDARD_DOCUMENT_TYPES.some((option) => option.label.toLowerCase() === name.toLowerCase()),
  )
}
