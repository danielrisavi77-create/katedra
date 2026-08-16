type AutosaveStatus = 'saving' | 'saved' | 'error'

export function createAutosaveController<T>({
  save,
  delayMs = 500,
  onStatus,
}: {
  save: (value: T) => Promise<void>
  delayMs?: number
  onStatus?: (status: AutosaveStatus) => void
}) {
  let timer: ReturnType<typeof setTimeout> | null = null

  const clearTimer = () => {
    if (timer) clearTimeout(timer)
    timer = null
  }

  const persist = async (value: T) => {
    onStatus?.('saving')
    try {
      await save(value)
      onStatus?.('saved')
    } catch (error) {
      onStatus?.('error')
      throw error
    }
  }

  return {
    schedule(value: T): void {
      clearTimer()
      timer = setTimeout(() => {
        timer = null
        void persist(value).catch(() => undefined)
      }, delayMs)
    },
    flush(value: T | null): Promise<void> {
      clearTimer()
      return value === null ? Promise.resolve() : persist(value)
    },
    cancel(): void {
      clearTimer()
    },
  }
}
