export type ReceiptStatus = 'uploaded' | 'processing' | 'pending_review' | 'synced' | 'failed'
export type ReceiptCategory = 'Grocery' | 'Fuel' | 'F&B' | 'Retail' | 'Service' | 'Other'
export type ReceiptDocType = 'Receipt' | 'Invoice' | 'Credit Note' | 'Expense'
export type ReceiptTag = 'Business' | 'Personal' | 'Tax Deductible' | 'Pending'

export interface ReceiptItem {
  id?: string
  receipt_id?: string
  user_id?: string
  name: string
  qty: number
  unit: string | null
  unit_price: number
  line_total: number
  sort_order?: number
}

export interface Receipt {
  id: string
  user_id: string
  filename: string
  mime_type: string | null
  file_path: string | null
  status: ReceiptStatus
  merchant_name: string | null
  company_reg_no: string | null
  address: string | null
  phone: string | null
  invoice_no: string | null
  date: string | null
  time: string | null
  category: ReceiptCategory
  doc_type: ReceiptDocType
  subtotal: number
  discount: number
  tax: number
  service_charge: number
  rounding: number
  grand_total: number
  payment_method: string | null
  change: number
  subsidy_details: Record<string, unknown> | null
  tags: ReceiptTag[]
  confidence_score: number
  raw_ocr?: string | null
  raw_ai?: Record<string, unknown> | null
  error_message: string | null
  processed_at: string | null
  created_at: string
  updated_at: string
  receipt_items?: ReceiptItem[]
}

export interface ReceiptFilters {
  search?: string
  status?: ReceiptStatus | 'All'
  docType?: ReceiptDocType | 'All'
  category?: ReceiptCategory | 'All'
  tag?: ReceiptTag | 'All'
}

