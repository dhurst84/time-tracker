import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'

const COLORS = ['#2563eb','#7c3aed','#db2777','#ea580c','#16a34a','#0ea5e9','#ca8a04','#dc2626']

interface SimpleClient { id: string; name: string }

interface ProjectFormProps {
  clientId?: string
  onSave: (d: Record<string, unknown>) => void
  onCancel: () => void
  submitLabel?: string
  showClientSelect?: boolean
  initial?: Partial<{
    name: string
    type: string
    recurringPeriod: string
    budgetHours: number
    notes: string
    color: string
    clientId: string
  }>
}

export default function ProjectForm({
  clientId,
  onSave,
  onCancel,
  submitLabel = 'Create',
  showClientSelect = false,
  initial,
}: ProjectFormProps) {
  const [name, setName] = useState(initial?.name || '')
  const [type, setType] = useState(initial?.type || 'one_time')
  const [recurringPeriod, setRecurringPeriod] = useState(initial?.recurringPeriod || 'monthly')
  const [budgetHours, setBudgetHours] = useState(initial?.budgetHours?.toString() || '')
  const [color, setColor] = useState(initial?.color || COLORS[0])
  const [notes, setNotes] = useState(initial?.notes || '')
  const [selectedClientId, setSelectedClientId] = useState(initial?.clientId || clientId || '')

  const { data: clients = [] } = useQuery<SimpleClient[]>({
    queryKey: ['clients'],
    queryFn: () => api.get('/clients').then(r => r.data),
    enabled: showClientSelect,
  })

  return (
    <form onSubmit={e => {
      e.preventDefault()
      const effectiveClientId = showClientSelect ? selectedClientId : clientId
      onSave({
        name,
        clientId: effectiveClientId,
        type,
        recurringPeriod: type === 'recurring' ? recurringPeriod : undefined,
        budgetHours: budgetHours ? parseFloat(budgetHours) : null,
        color,
        notes,
      })
    }} className="space-y-3">
      {showClientSelect && (
        <div>
          <label className="label">Client *</label>
          <select value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)} className="input" required>
            <option value="">Select a client...</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}
      <div>
        <label className="label">Project name *</label>
        <input value={name} onChange={e => setName(e.target.value)} className="input" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Type</label>
          <select value={type} onChange={e => setType(e.target.value)} className="input">
            <option value="one_time">One-Time (Fixed Scope)</option>
            <option value="recurring">Ongoing (Recurring)</option>
          </select>
        </div>
        {type === 'recurring' && (
          <div>
            <label className="label">Period</label>
            <select value={recurringPeriod} onChange={e => setRecurringPeriod(e.target.value)} className="input">
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="biannually">Bi-Annually</option>
              <option value="annually">Annually</option>
            </select>
          </div>
        )}
      </div>
      <div>
        <label className="label">Budget (hours)</label>
        <input type="number" step="1" value={budgetHours} onChange={e => setBudgetHours(e.target.value)} className="input" placeholder="No limit" />
      </div>
      <div>
        <label className="label">Notes</label>
        <input value={notes} onChange={e => setNotes(e.target.value)} className="input" />
      </div>
      <div>
        <label className="label">Color</label>
        <div className="flex gap-2">
          {COLORS.map(c => (
            <button key={c} type="button" onClick={() => setColor(c)}
              className={`w-7 h-7 rounded-full ${color === c ? 'ring-2 ring-offset-2 ring-stone-400 scale-110' : ''}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button type="submit" className="btn-primary flex-1 justify-center">{submitLabel}</button>
      </div>
    </form>
  )
}
