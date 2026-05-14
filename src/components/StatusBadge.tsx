import type { ReceiptStatus } from '../types/receipt'

const statusStyles: Record<string, string> = {
  uploaded: 'bg-slate-100 text-slate-700',
  processing: 'bg-indigo-50 text-indigo-700',
  pending_review: 'bg-amber-50 text-amber-700',
  synced: 'bg-emerald-50 text-emerald-700',
  failed: 'bg-rose-50 text-rose-700',
  Pending: 'bg-amber-50 text-amber-700',
  Synced: 'bg-emerald-50 text-emerald-700',
  Failed: 'bg-rose-50 text-rose-700',
}

const statusLabels: Record<string, string> = {
  uploaded: 'Uploaded',
  processing: 'Processing',
  pending_review: 'Pending Review',
  synced: 'Synced',
  failed: 'Failed',
}

interface StatusBadgeProps {
  status: ReceiptStatus | string
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-black uppercase ${statusStyles[status] || statusStyles.uploaded}`}>
      {statusLabels[status] || status}
    </span>
  )
}
