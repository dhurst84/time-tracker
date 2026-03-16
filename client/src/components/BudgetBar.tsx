import { getBudgetPercent, getBudgetStatus } from '../lib/utils'

interface Props {
  used: number
  budget: number | null
  showLabel?: boolean
}

export default function BudgetBar({ used, budget, showLabel = true }: Props) {
  if (!budget) return null
  const pct = getBudgetPercent(used, budget)
  const status = getBudgetStatus(used, budget)

  const barColor = status === 'over' ? 'bg-red-500' : status === 'warning' ? 'bg-amber-400' : 'bg-teal-500'
  const textColor = status === 'over' ? 'text-red-600' : status === 'warning' ? 'text-amber-600' : 'text-stone-500'

  return (
    <div>
      <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      {showLabel && (
        <p className={`text-xs mt-1 ${textColor}`}>
          {used.toFixed(1)}h / {budget}h ({pct}%)
          {status === 'over' && ' · Over budget'}
          {status === 'warning' && ' · Nearing limit'}
        </p>
      )}
    </div>
  )
}
