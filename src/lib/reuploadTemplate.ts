import type { Receipt } from '../types/receipt'

const reasonLabels: Record<string, string> = {
  blurry_image: 'the receipt image is blurry',
  duplicate: 'this looks like a duplicate submission',
  amount_not_clear: 'the amount is not clear',
  not_receipt: 'the uploaded file is not a receipt or invoice',
  missing_required_info: 'required receipt information is missing',
  other: 'the receipt needs to be resubmitted',
}

export function buildReuploadRequestMessage(receipt: Pick<Receipt, 'merchant_name' | 'filename' | 'invoice_no' | 'date' | 'deleted_reason' | 'deleted_note'>): string {
  const title = receipt.merchant_name || receipt.filename || 'this receipt'
  const reason = reasonLabels[receipt.deleted_reason || 'other'] || reasonLabels.other
  const details = [
    receipt.invoice_no ? `Invoice No: ${receipt.invoice_no}` : null,
    receipt.date ? `Date: ${receipt.date}` : null,
  ].filter(Boolean)
  const note = receipt.deleted_note?.trim()

  return [
    `Please resubmit ${title}.`,
    `Reason: ${reason}.`,
    details.length > 0 ? details.join(' / ') : null,
    note ? `Note: ${note}` : null,
    'Please upload a clearer complete image so we can process it again.',
  ].filter(Boolean).join('\n')
}
