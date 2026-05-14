import type { ReceiptTag } from '../types/receipt'

interface TagSelectorProps {
  value: string[]
  options?: string[]
  onChange: (tags: string[]) => void
}

const defaultOptions: ReceiptTag[] = ['Business', 'Personal', 'Tax Deductible', 'Pending']

export function TagSelector({ value, options = defaultOptions, onChange }: TagSelectorProps) {
  const mergedOptions = Array.from(new Set([...options, ...value]))

  const toggle = (tag: string) => {
    onChange(value.includes(tag) ? value.filter((item) => item !== tag) : [...value, tag])
  }

  return (
    <div className="flex flex-wrap gap-2">
      {mergedOptions.map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => toggle(tag)}
          className={`rounded-lg px-2.5 py-1 text-[10px] font-black transition ${
            value.includes(tag)
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
          }`}
        >
          {tag}
        </button>
      ))}
    </div>
  )
}
