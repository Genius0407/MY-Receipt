# Supabase Receipt Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the production version of the Malaysia receipt OCR system as a static React app backed by Supabase Auth, Storage, Postgres, and Supabase Edge Functions for OCR/AI parsing.

**Architecture:** The browser hosts all UI and uses Supabase anon key under RLS for user-scoped data. OCR and AI calls run only inside the `parse-receipt` Supabase Edge Function, where Google Vision, OpenAI, and service role secrets are protected.

**Tech Stack:** React, Vite, TypeScript, Tailwind CSS, Supabase JS, Supabase Edge Functions, PostgreSQL RLS, SheetJS, Vitest, Playwright.

---

## File Structure

Create the production frontend under `frontend/` and keep existing planning docs under `docs/`.

```text
frontend/
  package.json
  vite.config.ts
  tsconfig.json
  index.html
  src/
    main.tsx
    App.tsx
    styles.css
    types/receipt.ts
    lib/supabaseClient.ts
    lib/receiptApi.ts
    lib/exportExcel.ts
    lib/normalizeReceipt.ts
    components/AuthGate.tsx
    components/UploadDropzone.tsx
    components/ReceiptList.tsx
    components/ReceiptDetailPanel.tsx
    components/TagSelector.tsx
    components/ExportToolbar.tsx
    components/StatusBadge.tsx
    components/ToastProvider.tsx
    test/
      normalizeReceipt.test.ts
      exportExcel.test.ts
supabase/
  functions/
    parse-receipt/
      index.ts
      prompt.ts
      cors.ts
```

## Task 1: Frontend Scaffold

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/styles.css`

- [ ] **Step 1: Create the Vite React TypeScript package**

Use this `frontend/package.json`:

```json
{
  "name": "malaysia-receipt-frontend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc -b && vite build",
    "preview": "vite preview --host 127.0.0.1",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.49.0",
    "@vitejs/plugin-react": "^4.3.4",
    "lucide-react": "^0.468.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "xlsx": "^0.18.5"
  },
  "devDependencies": {
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.2",
    "vite": "^6.0.3",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Add Vite config**

Use this `frontend/vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
})
```

- [ ] **Step 3: Add TypeScript config**

Use this `frontend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2020"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"],
  "references": []
}
```

- [ ] **Step 4: Add the minimal app shell**

Use this `frontend/src/App.tsx`:

```tsx
export function App() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <main className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-xl font-black">MY-Receipt</h1>
        <p className="mt-2 text-sm text-slate-500">Supabase receipt OCR platform</p>
      </main>
    </div>
  )
}
```

- [ ] **Step 5: Run scaffold verification**

Run:

```bash
cd frontend
npm install
npm run build
```

Expected: Vite builds without TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add frontend
git commit -m "feat: scaffold React frontend"
```

## Task 2: Shared Receipt Types and Normalization

**Files:**
- Create: `frontend/src/types/receipt.ts`
- Create: `frontend/src/lib/normalizeReceipt.ts`
- Test: `frontend/src/test/normalizeReceipt.test.ts`

- [ ] **Step 1: Define receipt types**

Use this `frontend/src/types/receipt.ts`:

```ts
export type ReceiptStatus = 'uploaded' | 'processing' | 'pending_review' | 'synced' | 'failed'
export type ReceiptCategory = 'Grocery' | 'Fuel' | 'F&B' | 'Retail' | 'Service' | 'Other'
export type ReceiptDocType = 'Receipt' | 'Invoice' | 'Credit Note' | 'Expense'
export type ReceiptTag = 'Business' | 'Personal' | 'Tax Deductible' | 'Pending'

export interface ReceiptItem {
  id?: string
  receipt_id?: string
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
  error_message: string | null
  processed_at: string | null
  created_at: string
  updated_at: string
  receipt_items?: ReceiptItem[]
}
```

- [ ] **Step 2: Write normalization tests**

Use this `frontend/src/test/normalizeReceipt.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { normalizeMoney, normalizeReceiptPatch } from '../lib/normalizeReceipt'

describe('normalizeMoney', () => {
  it('rounds finite numeric values to 2 decimals', () => {
    expect(normalizeMoney('12.345')).toBe(12.35)
    expect(normalizeMoney(10)).toBe(10)
  })

  it('returns 0 for invalid values', () => {
    expect(normalizeMoney('RM 12')).toBe(0)
    expect(normalizeMoney(null)).toBe(0)
  })
})

describe('normalizeReceiptPatch', () => {
  it('defaults invalid category and doc type', () => {
    const result = normalizeReceiptPatch({ category: 'Food', doc_type: 'Bill' })
    expect(result.category).toBe('Other')
    expect(result.doc_type).toBe('Receipt')
  })
})
```

- [ ] **Step 3: Implement normalization**

Use this `frontend/src/lib/normalizeReceipt.ts`:

```ts
import type { ReceiptCategory, ReceiptDocType } from '../types/receipt'

const validCategories: ReceiptCategory[] = ['Grocery', 'Fuel', 'F&B', 'Retail', 'Service', 'Other']
const validDocTypes: ReceiptDocType[] = ['Receipt', 'Invoice', 'Credit Note', 'Expense']

export function normalizeMoney(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0
}

export function normalizeReceiptPatch(input: Record<string, unknown>) {
  const category = validCategories.includes(input.category as ReceiptCategory)
    ? (input.category as ReceiptCategory)
    : 'Other'
  const doc_type = validDocTypes.includes(input.doc_type as ReceiptDocType)
    ? (input.doc_type as ReceiptDocType)
    : 'Receipt'

  return {
    ...input,
    category,
    doc_type,
    subtotal: normalizeMoney(input.subtotal),
    discount: normalizeMoney(input.discount),
    tax: normalizeMoney(input.tax),
    service_charge: normalizeMoney(input.service_charge),
    rounding: normalizeMoney(input.rounding),
    grand_total: normalizeMoney(input.grand_total),
    change: normalizeMoney(input.change),
  }
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
cd frontend
npm test -- normalizeReceipt
```

Expected: all normalization tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types frontend/src/lib frontend/src/test
git commit -m "feat: add receipt types and normalization"
```

## Task 3: Supabase Client and Auth Gate

**Files:**
- Create: `frontend/src/lib/supabaseClient.ts`
- Create: `frontend/src/components/AuthGate.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create Supabase client**

Use this `frontend/src/lib/supabaseClient.ts`:

```ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

- [ ] **Step 2: Add auth gate**

Create `frontend/src/components/AuthGate.tsx` with email magic-link login and sign-out. It must render children only when `session` exists.

- [ ] **Step 3: Wrap App content**

Modify `frontend/src/App.tsx`:

```tsx
import { AuthGate } from './components/AuthGate'

export function App() {
  return (
    <AuthGate>
      <div className="min-h-screen bg-slate-100 text-slate-900">
        <main className="mx-auto max-w-6xl px-6 py-8">
          <h1 className="text-xl font-black">MY-Receipt</h1>
          <p className="mt-2 text-sm text-slate-500">Supabase receipt OCR platform</p>
        </main>
      </div>
    </AuthGate>
  )
}
```

- [ ] **Step 4: Run build**

Run:

```bash
cd frontend
npm run build
```

Expected: TypeScript build passes.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat: add Supabase auth gate"
```

## Task 4: Supabase Database and Storage Setup

**Files:**
- Use: `docs/SUPABASE_SCHEMA.sql`
- Modify: `docs/DEPLOYMENT.md`

- [ ] **Step 1: Apply schema**

Run `docs/SUPABASE_SCHEMA.sql` in Supabase SQL Editor.

Expected:

```text
receipts table exists
receipt_items table exists
RLS enabled on both tables
policies created successfully
```

- [ ] **Step 2: Create Storage bucket**

In Supabase Dashboard create bucket:

```text
name: receipts
public: false
```

- [ ] **Step 3: Add storage policies**

Create policies so authenticated users can read/write only objects whose path starts with their user id segment.

- [ ] **Step 4: Document project-specific values**

Append to `docs/DEPLOYMENT.md` a section with:

```text
Supabase project ref:
Frontend deploy URL:
Storage bucket: receipts
```

- [ ] **Step 5: Commit**

```bash
git add docs/DEPLOYMENT.md
git commit -m "docs: record Supabase project setup"
```

## Task 5: Receipt API and Upload Flow

**Files:**
- Create: `frontend/src/lib/receiptApi.ts`
- Create: `frontend/src/components/UploadDropzone.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Implement `createReceiptFromFile`**

`receiptApi.ts` must:

1. Get current user.
2. Insert a `receipts` row with `status = uploaded`.
3. Upload file to `receipts/{user_id}/{receipt_id}/original.ext`.
4. Update the row with `file_path` and `mime_type`.
5. Invoke `parse-receipt` with `{ receipt_id }`.

- [ ] **Step 2: Implement upload dropzone**

`UploadDropzone.tsx` must accept JPEG, PNG, PDF, limit to 20MB, and call `createReceiptFromFile(file)`.

- [ ] **Step 3: Show uploaded status**

App should show a list of recently uploaded filenames and statuses.

- [ ] **Step 4: Run build**

Run:

```bash
cd frontend
npm run build
```

Expected: build passes.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat: add Supabase upload flow"
```

## Task 6: `parse-receipt` Edge Function

**Files:**
- Create: `supabase/functions/parse-receipt/index.ts`
- Create: `supabase/functions/parse-receipt/prompt.ts`
- Create: `supabase/functions/parse-receipt/cors.ts`

- [ ] **Step 1: Create prompt module**

`prompt.ts` must export `SYSTEM_PROMPT` and `buildUserPrompt(ocrText: string)`.

- [ ] **Step 2: Create CORS helper**

`cors.ts` must export:

```ts
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
```

- [ ] **Step 3: Implement Edge Function**

`index.ts` must:

1. Handle `OPTIONS`.
2. Read auth header.
3. Create user Supabase client and service Supabase client.
4. Check receipt ownership.
5. Mark receipt as `processing`.
6. Download file from Storage.
7. Convert file to base64.
8. Call Google Vision.
9. Call OpenAI.
10. Upsert receipt fields.
11. Delete and reinsert receipt items.
12. Mark `pending_review` or `failed`.

- [ ] **Step 4: Configure secrets**

Run:

```bash
supabase secrets set OPENAI_API_KEY=...
supabase secrets set GOOGLE_VISION_KEY=...
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
```

- [ ] **Step 5: Deploy function**

Run:

```bash
supabase functions deploy parse-receipt
```

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/parse-receipt
git commit -m "feat: add receipt parsing edge function"
```

## Task 7: Receipt List, Filters, and Detail Panel

**Files:**
- Create: `frontend/src/components/ReceiptList.tsx`
- Create: `frontend/src/components/ReceiptDetailPanel.tsx`
- Create: `frontend/src/components/TagSelector.tsx`
- Create: `frontend/src/components/StatusBadge.tsx`
- Modify: `frontend/src/lib/receiptApi.ts`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Add list query**

`receiptApi.ts` must expose `listReceipts(filters)` selecting:

```text
receipts.*, receipt_items(*)
```

with filters for `status`, `doc_type`, `tags`, and search over merchant/invoice number.

- [ ] **Step 2: Build receipt list**

`ReceiptList.tsx` must show merchant, invoice number, date, total, doc type, tags, status, and confidence.

- [ ] **Step 3: Build detail panel**

`ReceiptDetailPanel.tsx` must support editing merchant info, transaction fields, item rows, tags, and amount fields.

- [ ] **Step 4: Save edits**

`receiptApi.ts` must expose `saveReceipt(receipt, items)` and write to `receipts` and `receipt_items`.

- [ ] **Step 5: Run build**

Run:

```bash
cd frontend
npm run build
```

Expected: build passes.

- [ ] **Step 6: Commit**

```bash
git add frontend/src
git commit -m "feat: add receipt review workflow"
```

## Task 8: Excel Export

**Files:**
- Create: `frontend/src/lib/exportExcel.ts`
- Create: `frontend/src/components/ExportToolbar.tsx`
- Test: `frontend/src/test/exportExcel.test.ts`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Test flattening behavior**

`exportExcel.test.ts` must verify that each receipt item becomes one Excel row and base receipt fields repeat.

- [ ] **Step 2: Implement export helper**

`exportExcel.ts` must export `flattenReceipts(receipts)` and `downloadReceiptsXlsx(receipts)`.

- [ ] **Step 3: Add toolbar**

`ExportToolbar.tsx` must export all current filtered receipts or selected receipts.

- [ ] **Step 4: Run tests**

Run:

```bash
cd frontend
npm test
npm run build
```

Expected: tests and build pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat: add Excel export"
```

## Task 9: Verification and Deployment

**Files:**
- Modify: `README.md`
- Modify: `docs/DEPLOYMENT.md`

- [ ] **Step 1: Verify security**

Check:

```text
No OPENAI_API_KEY in frontend/
No GOOGLE_VISION_KEY in frontend/
No SUPABASE_SERVICE_ROLE_KEY in frontend/
RLS enabled on receipts and receipt_items
Storage bucket receipts is private
```

- [ ] **Step 2: Run production build**

Run:

```bash
cd frontend
npm run build
```

Expected: build passes and creates `frontend/dist`.

- [ ] **Step 3: Deploy frontend**

Deploy `frontend/` to Vercel, Netlify, Cloudflare Pages, or Supabase Hosting with:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

- [ ] **Step 4: End-to-end smoke test**

Use one clear receipt image and confirm:

```text
Upload succeeds
Storage object exists
Receipt row becomes processing
Edge Function returns pending_review
Items appear in detail panel
Edit and save works
Export downloads .xlsx
```

- [ ] **Step 5: Commit**

```bash
git add README.md docs/DEPLOYMENT.md
git commit -m "docs: add production deployment notes"
```

## Task 10: GitHub Setup

**Files:**
- No source files required.

- [ ] **Step 1: Create GitHub repository**

Create an empty GitHub repository named `malaixiya` or provide the final repository URL.

- [ ] **Step 2: Add remote**

Run:

```bash
git remote add origin https://github.com/<owner>/<repo>.git
```

- [ ] **Step 3: Push main**

Run:

```bash
git push -u origin main
```

Expected: GitHub shows the initial commit and docs.

## Self-Review

Spec coverage:

- Supabase Auth, Storage, Postgres, Edge Functions: covered in Tasks 3, 4, 5, 6.
- OCR/AI key security: covered in Tasks 6 and 9.
- Upload, list, detail editing, tags, filters: covered in Tasks 5 and 7.
- Excel export: covered in Task 8.
- GitHub publishing: covered in Task 10.

Placeholder scan:

- No `TBD` or empty implementation tasks remain.
- Tasks that depend on Supabase Dashboard include exact settings and expected results.

Type consistency:

- Canonical field names use `category`, `tax`, `subsidy_details`, and `doc_type`.
- Old demo fields `industry`, `tax_sst`, and `subsidy_info` are intentionally excluded from production types.

