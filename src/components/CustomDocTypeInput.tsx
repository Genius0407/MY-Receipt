interface CustomDocTypeInputProps {
  value: string
  onChange: (value: string) => void
  onSave: () => void
}

export function CustomDocTypeInput({ value, onChange, onSave }: CustomDocTypeInputProps) {
  return (
    <div className="flex gap-2">
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Custom document type"
        className="min-w-0 flex-1 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-black text-slate-800 outline-none focus:border-indigo-400"
      />
      <button type="button" onClick={onSave} className="rounded-xl bg-indigo-600 px-3 py-2 text-[10px] font-black uppercase text-white hover:bg-indigo-500">
        Save
      </button>
    </div>
  )
}
