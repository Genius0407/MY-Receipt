import { normalizeReceiptItem, normalizeReceiptPatch } from './normalizeReceipt'
import { requireSupabase } from './supabaseClient'
import type { Receipt, ReceiptFilters, ReceiptItem } from '../types/receipt'

export const RECEIPT_BUCKET = 'receipts'
export const MAX_RECEIPT_FILE_SIZE_BYTES = 20 * 1024 * 1024
export const ACCEPTED_RECEIPT_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf']

export interface UploadedReceiptResult {
  receipt: Receipt
  parseError: string | null
}

export function validateReceiptFile(file: File): string | null {
  if (!ACCEPTED_RECEIPT_MIME_TYPES.includes(file.type)) {
    return 'Only JPEG, PNG, and PDF receipts are supported.'
  }

  if (file.size > MAX_RECEIPT_FILE_SIZE_BYTES) {
    return 'Receipt file must be 20MB or smaller.'
  }

  return null
}

export async function createReceiptFromFile(file: File): Promise<UploadedReceiptResult> {
  const validationError = validateReceiptFile(file)
  if (validationError) {
    throw new Error(validationError)
  }

  const client = requireSupabase()
  const user = await getCurrentUser()

  const { data: inserted, error: insertError } = await client
    .from('receipts')
    .insert({
      user_id: user.id,
      filename: file.name,
      mime_type: file.type,
      status: 'uploaded',
      category: 'Other',
      doc_type: 'Receipt',
      tags: ['Pending'],
    })
    .select('*')
    .single()

  if (insertError) throw insertError

  const receipt = inserted as Receipt
  const filePath = `${user.id}/${receipt.id}/original.${getFileExtension(file)}`

  const { error: uploadError } = await client.storage.from(RECEIPT_BUCKET).upload(filePath, file, {
    contentType: file.type,
    upsert: false,
  })

  if (uploadError) {
    await markReceiptFailed(receipt.id, uploadError.message)
    throw uploadError
  }

  const { data: updated, error: updateError } = await client
    .from('receipts')
    .update({
      file_path: filePath,
      mime_type: file.type,
      status: 'uploaded',
    })
    .eq('id', receipt.id)
    .select('*')
    .single()

  if (updateError) throw updateError

  const { error: functionError } = await client.functions.invoke('parse-receipt', {
    body: { receipt_id: receipt.id },
  })

  if (functionError) {
    const message = functionError.message || 'parse-receipt invocation failed'
    const failed = await markReceiptFailed(receipt.id, message)
    return { receipt: failed ?? (updated as Receipt), parseError: message }
  }

  const refreshed = await getReceipt(receipt.id)
  return { receipt: refreshed ?? (updated as Receipt), parseError: null }
}

export async function listReceipts(filters: ReceiptFilters = {}): Promise<Receipt[]> {
  const client = requireSupabase()
  let query = client
    .from('receipts')
    .select('*, receipt_items(*)')
    .order('created_at', { ascending: false })

  if (filters.status && filters.status !== 'All') {
    query = query.eq('status', filters.status)
  }

  if (filters.docType && filters.docType !== 'All') {
    query = query.eq('doc_type', filters.docType)
  }

  if (filters.category && filters.category !== 'All') {
    query = query.eq('category', filters.category)
  }

  if (filters.tag && filters.tag !== 'All') {
    query = query.contains('tags', [filters.tag])
  }

  if (filters.search?.trim()) {
    const value = escapeIlike(filters.search.trim())
    query = query.or(`merchant_name.ilike.%${value}%,invoice_no.ilike.%${value}%,filename.ilike.%${value}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Receipt[]
}

export async function getReceipt(id: string): Promise<Receipt | null> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('receipts')
    .select('*, receipt_items(*)')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }

  return data as Receipt
}

export async function saveReceipt(receipt: Partial<Receipt>, items: Partial<ReceiptItem>[] = []): Promise<Receipt> {
  if (!receipt.id) {
    throw new Error('Receipt id is required.')
  }

  const client = requireSupabase()
  const user = await getCurrentUser()
  const patch = normalizeReceiptPatch(receipt as Record<string, unknown>) as Record<string, any>

  const { data: updated, error: updateError } = await client
    .from('receipts')
    .update({
      merchant_name: patch.merchant_name ?? null,
      company_reg_no: patch.company_reg_no ?? null,
      address: patch.address ?? null,
      phone: patch.phone ?? null,
      invoice_no: patch.invoice_no ?? null,
      date: patch.date || null,
      time: patch.time || null,
      category: patch.category,
      doc_type: patch.doc_type,
      subtotal: patch.subtotal,
      discount: patch.discount,
      tax: patch.tax,
      service_charge: patch.service_charge,
      rounding: patch.rounding,
      grand_total: patch.grand_total,
      payment_method: patch.payment_method ?? null,
      change: patch.change,
      subsidy_details: patch.subsidy_details ?? null,
      tags: patch.tags,
      confidence_score: patch.confidence_score,
      status: patch.status ?? 'pending_review',
      error_message: null,
    })
    .eq('id', receipt.id)
    .select('*')
    .single()

  if (updateError) throw updateError

  const { error: deleteError } = await client.from('receipt_items').delete().eq('receipt_id', receipt.id)
  if (deleteError) throw deleteError

  const normalizedItems = items
    .map((item, index) => normalizeReceiptItem(item as Record<string, unknown>, index))
    .filter((item) => item.name.length > 0)
    .map((item) => ({
      ...item,
      receipt_id: receipt.id,
      user_id: user.id,
    }))

  if (normalizedItems.length > 0) {
    const { error: itemError } = await client.from('receipt_items').insert(normalizedItems)
    if (itemError) throw itemError
  }

  return (await getReceipt(receipt.id)) ?? (updated as Receipt)
}

export async function deleteReceipt(id: string): Promise<void> {
  const client = requireSupabase()
  const existing = await getReceipt(id)

  if (existing?.file_path) {
    const { error: storageError } = await client.storage.from(RECEIPT_BUCKET).remove([existing.file_path])
    if (storageError) throw storageError
  }

  const { error } = await client.from('receipts').delete().eq('id', id)
  if (error) throw error
}

export async function createReceiptFileSignedUrl(filePath: string | null, expiresInSeconds = 60 * 60): Promise<string | null> {
  if (!filePath) return null

  const client = requireSupabase()
  const { data, error } = await client.storage.from(RECEIPT_BUCKET).createSignedUrl(filePath, expiresInSeconds)

  if (error) {
    console.error('Failed to create receipt signed URL:', error)
    return null
  }

  return data.signedUrl
}

async function markReceiptFailed(id: string, message: string): Promise<Receipt | null> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('receipts')
    .update({
      status: 'failed',
      error_message: message,
    })
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    console.error('Failed to mark receipt as failed:', error)
    return null
  }

  return data as Receipt
}

async function getCurrentUser() {
  const client = requireSupabase()
  const {
    data: { user },
    error,
  } = await client.auth.getUser()

  if (error) throw error
  if (!user) throw new Error('You must sign in before uploading receipts.')
  return user
}

function getFileExtension(file: File): string {
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (extension) return extension.replace(/[^a-z0-9]/g, '') || mimeToExtension(file.type)
  return mimeToExtension(file.type)
}

function mimeToExtension(mimeType: string): string {
  if (mimeType === 'image/jpeg') return 'jpg'
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'application/pdf') return 'pdf'
  return 'bin'
}

function escapeIlike(value: string): string {
  return value.replace(/[%,]/g, '')
}
