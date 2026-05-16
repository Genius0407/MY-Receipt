import { describe, expect, it } from 'vitest'
import { getExportFieldKeys, isFieldEnabled, isFieldExportEnabled, mergeFieldPreferences, requiredValidationFieldKeys } from '../lib/fieldConfig'

describe('field config', () => {
  it('merges saved preferences with defaults', () => {
    const preferences = mergeFieldPreferences([{ field_key: 'payment_method', enabled: false, export_enabled: false }])

    expect(preferences.find((preference) => preference.field_key === 'merchant_name')?.enabled).toBe(true)
    expect(preferences.find((preference) => preference.field_key === 'payment_method')?.enabled).toBe(false)
  })

  it('only exports enabled export fields', () => {
    const preferences = [{ field_key: 'payment_method' as const, enabled: false, export_enabled: true }]

    expect(isFieldEnabled(preferences, 'payment_method')).toBe(false)
    expect(isFieldExportEnabled(preferences, 'payment_method')).toBe(false)
    expect(getExportFieldKeys(preferences)).not.toContain('payment_method')
  })

  it('keeps required validation fields discoverable', () => {
    expect(requiredValidationFieldKeys()).toEqual(expect.arrayContaining(['merchant_name', 'invoice_no', 'date', 'subtotal', 'grand_total']))
  })
})
