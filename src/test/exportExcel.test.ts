import { describe, expect, it } from 'vitest'
import { flattenReceipts } from '../lib/exportExcel'
import type { Receipt } from '../types/receipt'

describe('flattenReceipts', () => {
  it('creates one export row per receipt item and repeats receipt fields', () => {
    const rows = flattenReceipts([
      {
        id: 'receipt-1',
        user_id: 'user-1',
        filename: 'receipt.jpg',
        mime_type: 'image/jpeg',
        file_path: 'user-1/receipt-1/original.jpg',
        status: 'pending_review',
        merchant_name: 'Test Merchant',
        company_reg_no: null,
        address: null,
        phone: null,
        invoice_no: 'INV-1',
        date: '2026-05-14',
        time: null,
        category: 'Grocery',
        doc_type: 'Receipt',
        subtotal: 30,
        discount: 0,
        tax: 0,
        service_charge: 0,
        rounding: 0,
        grand_total: 30,
        payment_method: null,
        change: 0,
        subsidy_details: null,
        tags: ['Business'],
        confidence_score: 0.9,
        error_message: null,
        processed_at: null,
        created_at: '2026-05-14T00:00:00Z',
        updated_at: '2026-05-14T00:00:00Z',
        receipt_items: [
          { name: 'Item A', qty: 1, unit: null, unit_price: 10, line_total: 10 },
          { name: 'Item B', qty: 2, unit: null, unit_price: 10, line_total: 20 },
        ],
      } satisfies Receipt,
    ])

    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      receipt_id: 'receipt-1',
      merchant_name: 'Test Merchant',
      invoice_no: 'INV-1',
      item_name: 'Item A',
      item_line_total: 10,
    })
    expect(rows[1]).toMatchObject({
      receipt_id: 'receipt-1',
      merchant_name: 'Test Merchant',
      item_name: 'Item B',
      item_line_total: 20,
    })
  })

  it('exports fuel subsidy fields separately from grand total', () => {
    const rows = flattenReceipts([
      {
        id: 'receipt-fuel',
        user_id: 'user-1',
        filename: 'shell.jpg',
        mime_type: 'image/jpeg',
        file_path: 'user-1/receipt-fuel/original.jpg',
        status: 'pending_review',
        merchant_name: 'APPLE LEAF ENTERPRISE',
        company_reg_no: 'PG0187462-K',
        address: null,
        phone: null,
        invoice_no: 'IRF150NDW',
        date: '2026-04-14',
        time: null,
        category: 'Fuel',
        doc_type: 'Receipt',
        subtotal: 138.01,
        discount: 0,
        tax: 0,
        service_charge: 0,
        rounding: 0,
        grand_total: 138.01,
        payment_method: 'VISA',
        change: 0,
        subsidy_details: {
          program: 'BUDI MADANI RON95',
          government_subsidy: 73.69,
          payable_total: 64.32,
        },
        tags: ['Business'],
        confidence_score: 0.9,
        error_message: null,
        processed_at: null,
        created_at: '2026-05-14T00:00:00Z',
        updated_at: '2026-05-14T00:00:00Z',
        receipt_items: [
          { name: 'FuelSave 95', qty: 32.32, unit: 'L', unit_price: 4.27, line_total: 138.01 },
        ],
      } satisfies Receipt,
    ])

    expect(rows[0]).toMatchObject({
      grand_total: 138.01,
      subsidy_program: 'BUDI MADANI RON95',
      government_subsidy: 73.69,
      payable_total: 64.32,
    })
  })
})
