import * as XLSX from 'xlsx'
import type { Receipt } from '../types/receipt'

export interface ReceiptExportRow {
  receipt_id: string
  merchant_name: string
  invoice_no: string
  date: string
  category: string
  doc_type: string
  status: string
  tags: string
  grand_total: number
  item_name: string
  item_qty: number
  item_unit_price: number
  item_line_total: number
}

export function flattenReceipts(receipts: Receipt[]): ReceiptExportRow[] {
  return receipts.flatMap((receipt) => {
    const items = receipt.receipt_items && receipt.receipt_items.length > 0
      ? receipt.receipt_items
      : [{ name: '', qty: 0, unit_price: 0, line_total: 0 }]

    return items.map((item) => ({
      receipt_id: receipt.id,
      merchant_name: receipt.merchant_name || '',
      invoice_no: receipt.invoice_no || '',
      date: receipt.date || '',
      category: receipt.category,
      doc_type: receipt.doc_type,
      status: receipt.status,
      tags: (receipt.tags || []).join(', '),
      grand_total: Number(receipt.grand_total || 0),
      item_name: item.name,
      item_qty: Number(item.qty || 0),
      item_unit_price: Number(item.unit_price || 0),
      item_line_total: Number(item.line_total || 0),
    }))
  })
}

export function downloadReceiptsXlsx(receipts: Receipt[], filename = buildExportFilename()) {
  const rows = flattenReceipts(receipts)
  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Receipts')
  XLSX.writeFile(workbook, filename)
}

function buildExportFilename() {
  const dateStr = new Date().toISOString().replace(/[:\-T]/g, '').slice(0, 14)
  return `Receipts_Export_${dateStr}.xlsx`
}
