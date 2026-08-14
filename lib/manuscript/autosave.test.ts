import { describe, expect, it, vi } from 'vitest'

import { createAutosaveController } from './autosave'

describe('manuscript autosave controller', () => {
  it('flushes the newest value once and cancels the pending debounce', async () => {
    vi.useFakeTimers()
    const save = vi.fn(async (_value: string) => undefined)
    const controller = createAutosaveController({ save, delayMs: 500 })

    controller.schedule('old')
    await controller.flush('new')
    vi.advanceTimersByTime(500)

    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith('new')
    vi.useRealTimers()
  })
})
