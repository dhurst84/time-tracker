import { useState, useRef, useEffect } from 'react'

interface Task { id: string; name: string; isBillable: boolean }

interface Props {
  tasks: Task[]
  value: string
  onChange: (id: string) => void
  disabled?: boolean
  placeholder?: string
}

export default function TaskSelect({ tasks, value, onChange, disabled, placeholder = 'Select task...' }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const selected = tasks.find(t => t.id === value)

  const filtered = tasks.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase())
  )

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { if (!disabled) setOpen(!open) }}
        disabled={disabled || tasks.length === 0}
        className="input text-left flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {selected ? (
          <>
            <span className="flex-1 truncate text-stone-900">{selected.name}</span>
            {!selected.isBillable && <span className="text-xs text-stone-400 flex-shrink-0">non-billable</span>}
          </>
        ) : (
          <span className="text-stone-400">{disabled || tasks.length === 0 ? 'Select a project first' : placeholder}</span>
        )}
        <svg className="w-4 h-4 text-stone-400 flex-shrink-0 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-stone-200 rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-stone-100">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full px-2 py-1.5 text-base text-stone-900 placeholder:text-stone-400 focus:outline-none touch-manipulation"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="px-3 py-3 text-sm text-stone-400 text-center">No tasks found</p>
            )}
            {filtered.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => { onChange(t.id); setOpen(false); setSearch('') }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-stone-50 transition-colors text-left"
              >
                <span className="flex-1 text-stone-900">{t.name}</span>
                {!t.isBillable && <span className="text-xs text-stone-400 flex-shrink-0">non-billable</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
