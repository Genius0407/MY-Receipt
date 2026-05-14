export const SYSTEM_PROMPT = `You extract structured data from Malaysian receipts and invoices.
Return strict JSON only. Do not include markdown.
Use null when a field is not visible.
Use numbers for amounts and quantities.
Allowed category values: Grocery, Fuel, F&B, Retail, Service, Other.
Allowed doc_type values: Receipt, Invoice, Credit Note, Expense.
Allowed tags: Business, Personal, Tax Deductible, Pending.
`

export function buildUserPrompt(ocrText: string) {
  return `Extract this receipt into the JSON shape below.

{
  "merchant_name": string | null,
  "company_reg_no": string | null,
  "address": string | null,
  "phone": string | null,
  "invoice_no": string | null,
  "date": "YYYY-MM-DD" | null,
  "time": string | null,
  "category": "Grocery" | "Fuel" | "F&B" | "Retail" | "Service" | "Other",
  "doc_type": "Receipt" | "Invoice" | "Credit Note" | "Expense",
  "subtotal": number,
  "discount": number,
  "tax": number,
  "service_charge": number,
  "rounding": number,
  "grand_total": number,
  "payment_method": string | null,
  "change": number,
  "subsidy_details": object | null,
  "tags": string[],
  "confidence_score": number,
  "items": [
    {
      "name": string,
      "qty": number,
      "unit": string | null,
      "unit_price": number,
      "line_total": number
    }
  ]
}

OCR text:
${ocrText}`
}
