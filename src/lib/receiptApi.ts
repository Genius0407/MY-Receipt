import { normalizeReceiptItem, normalizeReceiptPatch } from './normalizeReceipt'
import { requireSupabase } from './supabaseClient'
import type { Receipt, ReceiptFilters, ReceiptItem } from '../types/receipt'
import type { ImageProcessingMetadata } from './imagePreprocess'

export const RECEIPT_BUCKET = 'receipts'
export const MAX_RECEIPT_FILE_SIZE_BYTES = 20 * 1024 * 1024
export const ACCEPTED_RECEIPT_MIME_TYPES = ['image/jpeg', 'image/png']

export interface UploadedReceiptResult {
  receipt: Receipt
  parseError: string | null
}

export interface CreateReceiptFromFileOptions {
  processedFile?: File | null
  imageProcessing?: ImageProcessingMetadata | null
  autoParse?: boolean
  awaitParse?: boolean
  parseMode?: ParseMode
}

export interface PollReceiptOptions {
  intervalMs?: number
  timeoutMs?: number
  onPoll?: (receipt: Receipt) => void
}

export type ParseMode = 'ocr' | 'repair' | 'vision' | 'smart'

export function validateReceiptFile(file: File): string | null {
  if (!ACCEPTED_RECEIPT_MIME_TYPES.includes(file.type)) {
    return 'Only JPEG and PNG receipts are supported.'
  }

  if (file.size > MAX_RECEIPT_FILE_SIZE_BYTES) {
    return 'Receipt file must be 20MB or smaller.'
  }

  return null
}

export async function createReceiptFromFile(file: File, options: CreateReceiptFromFileOptions = {}): Promise<UploadedReceiptResult> {
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
  const processedFile = options.processedFile ?? null
  const processedFilePath = processedFile ? `${user.id}/${receipt.id}/processed.${getFileExtension(processedFile)}` : null

  if (processedFile) {
    const processedValidationError = validateReceiptFile(processedFile)
    if (processedValidationError) {
      await markReceiptFailed(receipt.id, processedValidationError)
      throw new Error(processedValidationError)
    }
  }

  const uploads = [
    client.storage.from(RECEIPT_BUCKET).upload(filePath, file, {
      contentType: file.type,
      upsert: false,
    }),
  ]

  if (processedFile && processedFilePath) {
    uploads.push(client.storage.from(RECEIPT_BUCKET).upload(processedFilePath, processedFile, {
      contentType: processedFile.type,
      upsert: false,
    }))
  }

  const uploadResults = await Promise.all(uploads)
  const uploadError = uploadResults.find((result) => result.error)?.error
  if (uploadError) {
    await markReceiptFailed(receipt.id, uploadError.message)
    throw uploadError
  }

  const shouldAutoParse = options.autoParse !== false
  const { data: updated, error: updateError } = await client
    .from('receipts')
    .update({
      file_path: filePath,
      processed_file_path: processedFilePath,
      image_processing: options.imageProcessing ?? null,
      mime_type: file.type,
      status: shouldAutoParse ? 'processing' : 'uploaded',
    })
    .eq('id', receipt.id)
    .select('*')
    .single()

  if (updateError) throw updateError

  if (!shouldAutoParse) {
    return { receipt: updated as Receipt, parseError: null }
  }

  if (options.awaitParse === false) {
    void invokeReceiptParser(receipt.id, options.parseMode).catch((error) => {
      console.error('parse-receipt async invocation failed:', error)
    })
    return { receipt: updated as Receipt, parseError: null }
  }

  const parseError = await invokeReceiptParser(receipt.id, options.parseMode)
  if (parseError) return { receipt: (await getReceipt(receipt.id)) ?? (updated as Receipt), parseError }

  const refreshed = await getReceipt(receipt.id)
  return { receipt: refreshed ?? (updated as Receipt), parseError: null }
}

export async function pollReceiptUntilParsed(id: string, options: PollReceiptOptions = {}): Promise<Receipt> {
  const intervalMs = options.intervalMs ?? 1800
  const timeoutMs = options.timeoutMs ?? 90000
  const deadline = Date.now() + timeoutMs

  while (Date.now() <= deadline) {
    const receipt = await getReceipt(id)
    if (!receipt) throw new Error('Receipt not found while polling parse result.')
    options.onPoll?.(receipt)
    if (!isReceiptParsing(receipt)) return receipt
    await delay(intervalMs)
  }

  throw new Error(`OCR parsing is still running after ${Math.round(timeoutMs / 1000)} seconds.`)
}

export function isReceiptParsing(receipt: Pick<Receipt, 'status'>): boolean {
  return receipt.status === 'uploaded' || receipt.status === 'processing'
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

export async function repairReceiptWithDeepSeek(id: string): Promise<UploadedReceiptResult> {
  const message = await invokeReceiptParser(id, 'repair')
  if (message) {
    const current = await getReceipt(id)
    if (!current) throw new Error(message)
    return { receipt: current, parseError: message }
  }

  const refreshed = await getReceipt(id)
  if (!refreshed) throw new Error('Receipt not found after DeepSeek text repair.')
  return { receipt: refreshed, parseError: null }
}

export async function reparseReceiptWithVision(id: string): Promise<UploadedReceiptResult> {
  const message = await invokeReceiptParser(id, 'vision')
  if (message) {
    const current = await getReceipt(id)
    if (!current) throw new Error(message)
    return { receipt: current, parseError: message }
  }

  const refreshed = await getReceipt(id)
  if (!refreshed) throw new Error('Receipt not found after Qwen vision reparse.')
  return { receipt: refreshed, parseError: null }
}

export async function smartParseReceipt(id: string): Promise<UploadedReceiptResult> {
  const message = await invokeReceiptParser(id, 'smart')
  if (message) {
    const current = await getReceipt(id)
    if (!current) throw new Error(message)
    return { receipt: current, parseError: message }
  }

  const refreshed = await getReceipt(id)
  if (!refreshed) throw new Error('Receipt not found after smart parse.')
  return { receipt: refreshed, parseError: null }
}

export async function uploadProcessedReceiptImage(
  id: string,
  processedFile: File,
  imageProcessing: ImageProcessingMetadata,
): Promise<Receipt> {
  const validationError = validateReceiptFile(processedFile)
  if (validationError) throw new Error(validationError)

  const client = requireSupabase()
  const user = await getCurrentUser()
  const processedFilePath = `${user.id}/${id}/processed.${getFileExtension(processedFile)}`

  const { error: uploadError } = await client.storage.from(RECEIPT_BUCKET).upload(processedFilePath, processedFile, {
    contentType: processedFile.type,
    upsert: true,
  })
  if (uploadError) throw uploadError

  const { data, error } = await client
    .from('receipts')
    .update({
      processed_file_path: processedFilePath,
      image_processing: imageProcessing,
      status: 'processing',
      error_message: null,
    })
    .eq('id', id)
    .select('*, receipt_items(*)')
    .single()

  if (error) throw error
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

  const paths = [existing?.file_path, existing?.processed_file_path].filter(Boolean) as string[]
  if (paths.length > 0) {
    const { error: storageError } = await client.storage.from(RECEIPT_BUCKET).remove(paths)
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

async function invokeReceiptParser(id: string, mode?: ParseMode): Promise<string | null> {
  const client = requireSupabase()
  const { error } = await client.functions.invoke('parse-receipt', {
    body: mode ? { receipt_id: id, mode } : { receipt_id: id },
  })

  if (!error) return null

  const message = error.message || (mode === 'repair' ? 'DeepSeek text repair failed' : 'parse-receipt invocation failed')
  await markReceiptFailed(id, message)
  return message
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
  return 'bin'
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms))
}

function escapeIlike(value: string): string {
  return value.replace(/[%,]/g, '')
}
