import type { ReceiptDocType } from './receipt'

export interface DocumentTypeOption {
  value: ReceiptDocType | 'Custom'
  label: string
  custom?: boolean
}

export interface CustomDocumentType {
  id: string
  user_id: string
  name: string
  created_at: string
}
