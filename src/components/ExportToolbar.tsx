import { FileSpreadsheet } from 'lucide-react'
import type { Receipt } from '../types/receipt'
import { downloadReceiptsXlsx } from '../lib/exportExcel'

interface ExportToolbarProps {
  receipts: Receipt[]
  selectedReceipts?: Receipt[]
  label?: string
  onExported?: (count: number) => void
}

export function ExportToolbar({ receipts, selectedReceipts = [], label = '导出 Excel', onExported }: ExportToolbarProps) {
  const exportRows = selectedReceipts.length > 0 ? selectedReceipts : receipts

  const handleExport = async () => {
    if (exportRows.length === 0) return
    await downloadReceiptsXlsx(exportRows)
    onExported?.(exportRows.length)
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={exportRows.length === 0}
      className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2 text-[10px] font-black uppercase text-white shadow-md transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <FileSpreadsheet className="h-4 w-4" />
      {label}
    </button>
  )
}
