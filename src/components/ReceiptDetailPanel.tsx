import type { Receipt, ReceiptItem } from '../types/receipt'
import { TagSelector } from './TagSelector'

interface ReceiptDetailPanelProps {
  receipt: Receipt
  items: ReceiptItem[]
  onChange: (receipt: Receipt) => void
  onItemsChange: (items: ReceiptItem[]) => void
  onClose: () => void
  onSave: () => void
}

export function ReceiptDetailPanel({ receipt, items, onChange, onItemsChange, onClose, onSave }: ReceiptDetailPanelProps) {
  const updateItem = (index: number, patch: Partial<ReceiptItem>) => {
    onItemsChange(items.map((item, currentIndex) => currentIndex === index ? { ...item, ...patch } : item))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-6">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-black text-slate-900">{receipt.merchant_name || receipt.filename}</h2>
            <p className="text-xs font-bold text-slate-400">{receipt.invoice_no || 'No invoice number'}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-xs font-black text-slate-500 hover:bg-slate-100">
            关闭
          </button>
        </div>

        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_1.2fr]">
          <section className="space-y-4">
            <label className="block">
              <span className="text-[10px] font-black uppercase text-slate-400">Merchant</span>
              <input
                value={receipt.merchant_name || ''}
                onChange={(event) => onChange({ ...receipt, merchant_name: event.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-black uppercase text-slate-400">Invoice No</span>
              <input
                value={receipt.invoice_no || ''}
                onChange={(event) => onChange({ ...receipt, invoice_no: event.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-black uppercase text-slate-400">Tags</span>
              <div className="mt-2">
                <TagSelector value={receipt.tags || []} onChange={(tags) => onChange({ ...receipt, tags: tags as Receipt['tags'] })} />
              </div>
            </label>
          </section>

          <section className="space-y-3">
            <div className="grid grid-cols-[1fr_80px_100px_100px] gap-2 text-[10px] font-black uppercase text-slate-400">
              <span>Item</span>
              <span>Qty</span>
              <span>Unit</span>
              <span>Total</span>
            </div>
            {items.map((item, index) => (
              <div key={item.id || index} className="grid grid-cols-[1fr_80px_100px_100px] gap-2">
                <input value={item.name} onChange={(event) => updateItem(index, { name: event.target.value })} className="rounded-lg border border-slate-200 px-2 py-2 text-sm" />
                <input type="number" value={item.qty} onChange={(event) => updateItem(index, { qty: Number(event.target.value) })} className="rounded-lg border border-slate-200 px-2 py-2 text-sm" />
                <input type="number" value={item.unit_price} onChange={(event) => updateItem(index, { unit_price: Number(event.target.value) })} className="rounded-lg border border-slate-200 px-2 py-2 text-sm" />
                <input type="number" value={item.line_total} onChange={(event) => updateItem(index, { line_total: Number(event.target.value) })} className="rounded-lg border border-slate-200 px-2 py-2 text-sm" />
              </div>
            ))}
          </section>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-xs font-black text-slate-500 hover:bg-slate-100">
            取消
          </button>
          <button type="button" onClick={onSave} className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-black text-white hover:bg-indigo-500">
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
