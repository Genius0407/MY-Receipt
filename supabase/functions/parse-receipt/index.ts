import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { corsHeaders } from './cors.ts'
import { buildUserPrompt, SYSTEM_PROMPT } from './prompt.ts'

const validCategories = ['Grocery', 'Fuel', 'F&B', 'Retail', 'Service', 'Other']
const validDocTypes = ['Receipt', 'Invoice', 'Credit Note', 'Expense']
const validTags = ['Business', 'Personal', 'Tax Deductible', 'Pending']

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let receiptId: string | null = null

  try {
    assertEnv('SUPABASE_URL')
    assertEnv('SUPABASE_ANON_KEY')
    assertEnv('SUPABASE_SERVICE_ROLE_KEY')
    assertEnv('GOOGLE_VISION_KEY')
    assertEnv('OPENAI_API_KEY')

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Missing Authorization header' }, 401)
    }

    const body = await req.json()
    receiptId = body.receipt_id
    if (!receiptId) {
      return json({ error: 'receipt_id is required' }, 400)
    }

    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const serviceClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser()
    if (userError || !user) {
      return json({ error: 'Invalid user session' }, 401)
    }

    const { data: receipt, error: receiptError } = await serviceClient
      .from('receipts')
      .select('id,user_id,file_path,mime_type')
      .eq('id', receiptId)
      .eq('user_id', user.id)
      .single()

    if (receiptError || !receipt) {
      return json({ error: 'Receipt not found' }, 404)
    }

    if (!receipt.file_path) {
      throw new Error('Receipt file_path is missing')
    }

    await updateReceipt(serviceClient, receiptId, { status: 'processing', error_message: null })

    const { data: fileBlob, error: downloadError } = await serviceClient.storage
      .from('receipts')
      .download(receipt.file_path)
    if (downloadError || !fileBlob) {
      throw downloadError ?? new Error('Failed to download receipt file')
    }

    const base64File = await blobToBase64(fileBlob)
    const ocrText = await runGoogleVision(base64File, receipt.mime_type || fileBlob.type || 'application/octet-stream')
    const aiJson = await runOpenAI(ocrText)
    const normalizedReceipt = normalizeReceipt(aiJson)
    const normalizedItems = normalizeItems(aiJson.items)

    await serviceClient.from('receipt_items').delete().eq('receipt_id', receiptId)

    if (normalizedItems.length > 0) {
      const { error: itemError } = await serviceClient.from('receipt_items').insert(
        normalizedItems.map((item, index) => ({
          ...item,
          receipt_id: receiptId,
          user_id: receipt.user_id,
          sort_order: index,
        })),
      )
      if (itemError) throw itemError
    }

    const { data: updated, error: updateError } = await serviceClient
      .from('receipts')
      .update({
        ...normalizedReceipt,
        raw_ocr: ocrText,
        raw_ai: aiJson,
        status: 'pending_review',
        error_message: null,
        processed_at: new Date().toISOString(),
      })
      .eq('id', receiptId)
      .select('*, receipt_items(*)')
      .single()

    if (updateError) throw updateError

    return json({ receipt: updated })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown parse error'
    console.error('parse-receipt failed:', error)

    if (receiptId) {
      try {
        const serviceClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
        await updateReceipt(serviceClient, receiptId, { status: 'failed', error_message: message })
      } catch (updateError) {
        console.error('Failed to record parse error:', updateError)
      }
    }

    return json({ error: message }, 500)
  }
})

async function runGoogleVision(base64File: string, mimeType: string): Promise<string> {
  const key = Deno.env.get('GOOGLE_VISION_KEY')!

  if (mimeType === 'application/pdf') {
    const response = await fetch(`https://vision.googleapis.com/v1/files:annotate?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            inputConfig: {
              content: base64File,
              mimeType,
            },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
            pages: [1, 2, 3, 4, 5],
          },
        ],
      }),
    })
    const payload = await response.json()
    if (!response.ok) {
      throw new Error(payload.error?.message || 'Google Vision PDF OCR failed')
    }

    const pages = payload.responses?.[0]?.responses ?? []
    return pages.map((page: any) => page.fullTextAnnotation?.text).filter(Boolean).join('\n\n')
  }

  const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [
        {
          image: { content: base64File },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
        },
      ],
    }),
  })

  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.error?.message || 'Google Vision OCR failed')
  }

  const text = payload.responses?.[0]?.fullTextAnnotation?.text
  if (!text) throw new Error('Google Vision returned no OCR text')
  return text
}

async function runOpenAI(ocrText: string): Promise<Record<string, any>> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')!}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(ocrText) },
      ],
    }),
  })

  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.error?.message || 'OpenAI receipt parsing failed')
  }

  const content = payload.choices?.[0]?.message?.content
  if (!content) throw new Error('OpenAI returned an empty response')
  return parseJsonObject(content)
}

function normalizeReceipt(input: Record<string, any>) {
  const category = validCategories.includes(input.category) ? input.category : 'Other'
  const docType = validDocTypes.includes(input.doc_type) ? input.doc_type : 'Receipt'
  const tags = Array.isArray(input.tags)
    ? input.tags.filter((tag: string) => validTags.includes(tag))
    : ['Pending']

  return {
    merchant_name: stringOrNull(input.merchant_name),
    company_reg_no: stringOrNull(input.company_reg_no),
    address: stringOrNull(input.address),
    phone: stringOrNull(input.phone),
    invoice_no: stringOrNull(input.invoice_no),
    date: normalizeDate(input.date),
    time: stringOrNull(input.time),
    category,
    doc_type: docType,
    subtotal: normalizeMoney(input.subtotal),
    discount: normalizeMoney(input.discount),
    tax: normalizeMoney(input.tax),
    service_charge: normalizeMoney(input.service_charge),
    rounding: normalizeMoney(input.rounding),
    grand_total: normalizeMoney(input.grand_total),
    payment_method: stringOrNull(input.payment_method),
    change: normalizeMoney(input.change),
    subsidy_details: input.subsidy_details && typeof input.subsidy_details === 'object' ? input.subsidy_details : null,
    tags,
    confidence_score: clamp(Number(input.confidence_score) || 0, 0, 1),
  }
}

function normalizeItems(items: unknown) {
  if (!Array.isArray(items)) return []

  return items
    .map((raw) => {
      const item = raw as Record<string, unknown>
      return {
        name: String(item.name ?? '').trim(),
        qty: normalizeQuantity(item.qty),
        unit: stringOrNull(item.unit),
        unit_price: normalizeMoney(item.unit_price),
        line_total: normalizeMoney(item.line_total) || normalizeMoney(normalizeQuantity(item.qty) * normalizeMoney(item.unit_price)),
      }
    })
    .filter((item) => item.name.length > 0)
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

async function updateReceipt(client: any, receiptId: string, patch: Record<string, unknown>) {
  const { error } = await client.from('receipts').update(patch).eq('id', receiptId)
  if (error) throw error
}

function parseJsonObject(content: string): Record<string, any> {
  const cleaned = content
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')

  const parsed = JSON.parse(cleaned)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('OpenAI response was not a JSON object')
  }
  return parsed
}

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function assertEnv(name: string) {
  if (!Deno.env.get(name)) {
    throw new Error(`Missing ${name}`)
  }
}

function stringOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== 'string') return null
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
}

function normalizeMoney(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0
}

function normalizeQuantity(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 1000) / 1000 : 1
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
