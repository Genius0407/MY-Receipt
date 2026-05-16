import { Cpu, FileText } from 'lucide-react'

interface UploadQueueItem {
  id: string
  name: string
  status: string
  progress: number
}

interface UploadQueueProps {
  items: UploadQueueItem[]
  processingLabel: string
  config: {
    colorMode: string
    theme: {
      color: string
      light: string
      text: string
    }
  }
}

export function UploadQueue({ items, processingLabel, config }: UploadQueueProps) {
  if (items.length === 0) return null

  return (
    <div className={`rounded-[24px] border overflow-hidden shadow-sm transition-colors ${config.colorMode === 'Dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
      <div className={`px-6 py-3 border-b flex items-center justify-between ${config.colorMode === 'Dark' ? 'border-slate-800 bg-slate-900/80' : 'border-slate-100 bg-slate-50/80'}`}>
        <span className={`text-[10px] font-black uppercase flex items-center gap-2 ${config.theme.text}`}>
          <Cpu className="w-3.5 h-3.5 animate-pulse" /> {processingLabel}
        </span>
      </div>
      {items.map((item) => (
        <div key={item.id} className={`px-6 py-4 flex items-center justify-between border-b last:border-0 ${config.colorMode === 'Dark' ? 'border-slate-800/50' : 'border-slate-50'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${config.theme.light} ${config.theme.text} ${config.colorMode === 'Dark' ? 'bg-indigo-900/30' : ''}`}>
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold">{item.name}</p>
              <p className="text-[10px] font-black opacity-50 uppercase">{item.status}</p>
            </div>
          </div>
          <div className={`w-48 h-1.5 rounded-full overflow-hidden ${config.colorMode === 'Dark' ? 'bg-slate-800' : 'bg-slate-100'}`}>
            <div className={`${config.theme.color} h-full transition-all duration-300`} style={{ width: `${item.progress}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}
