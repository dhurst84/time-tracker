import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'

interface Client { id: string; name: string; color: string }
interface Project { id: string; name: string; color: string; client: Client }

interface Props {
  value: string
  onChange: (projectId: string, project: Project) => void
  placeholder?: string
}

export default function ProjectSelect({ value, onChange, placeholder = 'Select project...' }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects').then(r => r.data),
  })

  const selected = projects.find(p => p.id === value)

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.client.name.toLowerCase().includes(search.toLowerCase())
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
        onClick={() => setOpen(!open)}
        className="input text-left flex items-center gap-2"
      >
        {selected ? (
          <>
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: selected.color }} />
            <span className="flex-1 truncate text-stone-900">{selected.client.name} — {selected.name}</span>
          </>
        ) : (
          <span className="text-stone-400">{placeholder}</span>
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
              className="w-full px-2 py-1.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="px-3 py-3 text-sm text-stone-400 text-center">No projects found</p>
            )}
            {filtered.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => { onChange(p.id, p); setOpen(false); setSearch('') }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-stone-50 transition-colors text-left"
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                <div>
                  <span className="text-stone-900">{p.name}</span>
                  <span className="text-stone-400 ml-1.5">{p.client.name}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
