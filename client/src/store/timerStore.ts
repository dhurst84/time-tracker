import { create } from 'zustand'

interface TimeEntry {
  id: string
  projectId: string
  taskId: string
  notes?: string
  startedAt: string
  project: {
    id: string
    name: string
    color: string
    client: { id: string; name: string }
  }
  task: { id: string; name: string }
}

interface TimerState {
  runningEntry: TimeEntry | null
  elapsedSeconds: number
  intervalId: ReturnType<typeof setInterval> | null
  setRunningEntry: (entry: TimeEntry | null) => void
  startInterval: () => void
  stopInterval: () => void
  tick: () => void
}

export const useTimerStore = create<TimerState>((set, get) => ({
  runningEntry: null,
  elapsedSeconds: 0,
  intervalId: null,

  setRunningEntry: (entry) => {
    const { stopInterval, startInterval } = get()
    stopInterval()
    if (entry) {
      const elapsed = Math.floor((Date.now() - new Date(entry.startedAt).getTime()) / 1000)
      set({ runningEntry: entry, elapsedSeconds: elapsed })
      startInterval()
    } else {
      set({ runningEntry: null, elapsedSeconds: 0 })
    }
  },

  startInterval: () => {
    const { stopInterval } = get()
    stopInterval()
    const id = setInterval(() => get().tick(), 1000)
    set({ intervalId: id })
  },

  stopInterval: () => {
    const { intervalId } = get()
    if (intervalId) {
      clearInterval(intervalId)
      set({ intervalId: null })
    }
  },

  tick: () => set((state) => ({ elapsedSeconds: state.elapsedSeconds + 1 })),
}))
