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
  subsidy_program: string
  government_subsidy: number
  payable_total: number
  item_name: string
  item_qty: number
  item_unit_price: number
  item_line_total: number
}

function getSubsidyNumber(details: Record<string, unknown> | null, keys: string[]) {
  if (!details) return 0
  for (const key of keys) {
    const value = details[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value.replace(/[^\d.-]/g, ''))
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return 0
}

function getSubsidyText(details: Record<string, unknown> | null, keys: string[]) {
  if (!details) return ''
  for (const key of keys) {
    const value = details[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

export function flattenReceipts(receipts: Receipt[]): ReceiptExportRow[] {
  return receipts.flatMap((receipt) => {
    const items = receipt.receipt_items && receipt.receipt_items.length > 0
      ? receipt.receipt_items
      : [{ name: '', qty: 0, unit_price: 0, line_total: 0 }]
    const subsidyDetails = receipt.subsidy_details

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
      subsidy_program: getSubsidyText(subsidyDetails, ['program', 'scheme', 'name']),
      government_subsidy: getSubsidyNumber(subsidyDetails, ['government_subsidy', 'subsidy_amount']),
      payable_total: getSubsidyNumber(subsidyDetails, ['payable_total', 'paid_total', 'opt', 'outstanding_payment_total']),
      item_name: item.name,
      item_qty: Number(item.qty || 0),
      item_unit_price: Number(item.unit_price || 0),
      item_line_total: Number(item.line_total || 0),
    }))
  })
}

export async function downloadReceiptsXlsx(receipts: Receipt[], filename = buildExportFilename()) {
  const rows = flattenReceipts(receipts)
  const ExcelJS = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Receipts')

  worksheet.columns = [
    { header: 'Receipt ID', key: 'receipt_id', width: 38 },
    { header: 'Merchant', key: 'merchant_name', width: 28 },
    { header: 'Invoice No', key: 'invoice_no', width: 20 },
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Category', key: 'category', width: 14 },
    { header: 'Doc Type', key: 'doc_type', width: 14 },
    { header: 'Status', key: 'status', width: 16 },
    { header: 'Tags', key: 'tags', width: 28 },
    { header: 'Grand Total', key: 'grand_total', width: 14 },
    { header: 'Subsidy Program', key: 'subsidy_program', width: 24 },
    { header: 'Government Subsidy', key: 'government_subsidy', width: 20 },
    { header: 'Payable Total', key: 'payable_total', width: 16 },
    { header: 'Item Name', key: 'item_name', width: 32 },
    { header: 'Qty', key: 'item_qty', width: 10 },
    { header: 'Unit Price', key: 'item_unit_price', width: 14 },
    { header: 'Line Total', key: 'item_line_total', width: 14 },
  ]

  rows.forEach((row) => worksheet.addRow(row))
  worksheet.getRow(1).font = { bold: true }

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function buildExportFilename() {
  const dateStr = new Date().toISOString().replace(/[:\-T]/g, '').slice(0, 14)
  return `Receipts_Export_${dateStr}.xlsx`
}
