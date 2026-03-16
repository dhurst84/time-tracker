import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTimerStore } from '../store/timerStore'
import { formatTimer } from '../lib/utils'
import api from '../lib/api'
import toast from 'react-hot-toast'

export default function ActiveTimerBar() {
  const { runningEntry, elapsedSeconds, setRunningEntry } = useTimerStore()
  const queryClient = useQueryClient()

  const stopMutation = useMutation({
    mutationFn: (id: string) => api.post(`/time-entries/stop/${id}`).then(r => r.data),
    onSuccess: () => {
      setRunningEntry(null)
      queryClient.invalidateQueries({ queryKey: ['time-entries'] })
      toast.success('Timer stopped')
    },
    onError: () => toast.error('Failed to stop timer'),
  })

  if (!runningEntry) return null

  return (
    <div className="bg-teal-600 text-white px-4 py-2.5 flex items-center gap-3">
      <div
        className="w-2 h-2 rounded-full bg-white animate-pulse flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {runningEntry.project.client.name} — {runningEntry.project.name}
        </p>
        <p className="text-xs text-teal-200 truncate">{runningEntry.task.name}</p>
      </div>
      <span className="font-mono text-sm font-medium flex-shrink-0">{formatTimer(elapsedSeconds)}</span>
      <button
        onClick={() => stopMutation.mutate(runningEntry.id)}
        disabled={stopMutation.isPending}
        className="flex-shrink-0 w-8 h-8 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center transition-colors"
        title="Stop timer"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
      </button>
    </div>
  )
}
