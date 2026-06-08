import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAdventureChatSocket } from './useAdventureChatSocket'

let socketHandlers: { onMessage: (message: unknown) => void; onStatusChange?: (status: string) => void } | null = null

vi.mock('../../../infrastructure/api', () => ({
  AdventureChatSocket: class {
    constructor(_sessionId: number, handlers: { onMessage: (message: unknown) => void; onStatusChange?: (status: string) => void }) {
      socketHandlers = handlers
    }
    connect = vi.fn()
    close = vi.fn()
    sendChat = vi.fn()
    cancel = vi.fn()
  },
}))

describe('useAdventureChatSocket image lifecycle dispatch', () => {
  afterEach(() => {
    socketHandlers = null
    vi.clearAllMocks()
  })

  it('dispatches image lifecycle frames and ignores unknown frames', () => {
    const onImageJob = vi.fn()
    const onImageComplete = vi.fn()
    const onImageFailed = vi.fn()
    const onError = vi.fn()

    renderHook(() =>
      useAdventureChatSocket(7, {
        onImageJob,
        onImageComplete,
        onImageFailed,
        onError,
      }),
    )

    socketHandlers?.onMessage({ type: 'image_job', job_id: 'img-1', assistant_message_id: 101, turn_id: 'turn-1' })
    socketHandlers?.onMessage({ type: 'image_complete', job_id: 'img-1', assistant_message_id: 101, turn_id: 'turn-1', assets: [] })
    socketHandlers?.onMessage({ type: 'image_failed', job_id: null, assistant_message_id: 101, turn_id: 'turn-1', error: { category: 'unavailable', detail: 'Unavailable.' } })
    socketHandlers?.onMessage({ type: 'reserved_future_frame', payload: 'safe-ignore' })

    expect(onImageJob).toHaveBeenCalledTimes(1)
    expect(onImageComplete).toHaveBeenCalledTimes(1)
    expect(onImageFailed).toHaveBeenCalledTimes(1)
    expect(onError).not.toHaveBeenCalled()
  })
})
