import { AlertTriangle, Info, ShieldAlert } from 'lucide-react'
import type { ReceiptWarning } from '../types/receipt'

interface WarningPanelProps {
  warnings?: ReceiptWarning[] | null
  compact?: boolean
}

export function WarningPanel({ warnings = [], compact = false }: WarningPanelProps) {
  const visibleWarnings = warnings ?? []
  if (visibleWarnings.length === 0) {
    if (compact) return null
    return (
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-emerald-700">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wide">
          <Info className="h-4 w-4" /> No warnings
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-2xl border border-amber-200 bg-amber-50 text-amber-900 ${compact ? 'px-3 py-2' : 'p-4'}`}>
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wide">
        <ShieldAlert className="h-4 w-4" /> {visibleWarnings.length} warning{visibleWarnings.length > 1 ? 's' : ''}
      </div>
      {!compact && (
        <div className="mt-3 space-y-2">
          {visibleWarnings.map((warning, index) => (
            <div key={`${warning.code}-${warning.field ?? ''}-${index}`} className="rounded-xl bg-white/70 px-3 py-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className={`mt-0.5 h-3.5 w-3.5 ${warning.severity === 'error' ? 'text-rose-600' : 'text-amber-600'}`} />
                <div>
                  <p className="text-[10px] font-black uppercase">{warning.code.replace(/_/g, ' ')}</p>
                  <p className="text-xs font-bold leading-5">{warning.message}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
