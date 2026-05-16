import { describe, expect, it } from 'vitest'
import { formatDocumentType, mergeDocumentTypeOptions, normalizeDocumentType } from '../lib/documentTypes'

describe('document types', () => {
  it('keeps E-invoice as a standard type', () => {
    expect(normalizeDocumentType('E-invoice')).toEqual({ doc_type: 'E-invoice', custom_doc_type: null })
  })

  it('stores custom labels separately from standard doc type', () => {
    expect(normalizeDocumentType('Custom', 'Delivery Order')).toEqual({ doc_type: 'Receipt', custom_doc_type: 'Delivery Order' })
    expect(formatDocumentType({ doc_type: 'Receipt', custom_doc_type: 'Delivery Order' })).toBe('Delivery Order')
  })

  it('deduplicates custom options and excludes standard labels', () => {
    const labels = mergeDocumentTypeOptions(['Delivery Order', 'delivery order', 'Receipt']).map((option) => option.label)

    expect(labels.filter((label) => label === 'Delivery Order')).toHaveLength(1)
    expect(labels.filter((label) => label === 'Receipt')).toHaveLength(1)
  })
})
