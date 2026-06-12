import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAdventureChatSocket } from './useAdventureChatSocket'

let socketHandlers: { onMessage: (message: unknown) => void; onStatusChange?: (status: string) => void } | null = null
const socketInstances: Array<{
  sessionId: number
  connect: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
  sendChat: ReturnType<typeof vi.fn>
  sendTts: ReturnType<typeof vi.fn>
  cancel: ReturnType<typeof vi.fn>
}> = []

vi.mock('../../../infrastructure/api', () => ({
  AdventureChatSocket: class {
    readonly sessionId: number
    connect = vi.fn()
    close = vi.fn()
    sendChat = vi.fn()
    sendTts = vi.fn()
    cancel = vi.fn()

    constructor(_sessionId: number, handlers: { onMessage: (message: unknown) => void; onStatusChange?: (status: string) => void }) {
      this.sessionId = _sessionId
      socketHandlers = handlers
      socketInstances.push(this)
    }
  },
}))

describe('useAdventureChatSocket image lifecycle dispatch', () => {
  afterEach(() => {
    socketHandlers = null
    socketInstances.length = 0
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

  it('dispatches tts lifecycle frames', () => {
    const onTtsJob = vi.fn()
    const onTtsComplete = vi.fn()
    const onTtsFailed = vi.fn()
    const onError = vi.fn()

    renderHook(() =>
      useAdventureChatSocket(7, {
        onTtsJob,
        onTtsComplete,
        onTtsFailed,
        onError,
      }),
    )

    socketHandlers?.onMessage({ type: 'tts_job', job_id: 'tts-1', assistant_message_id: 101, turn_id: 'turn-1', status: 'synthesizing' })
    socketHandlers?.onMessage({ type: 'tts_complete', job_id: 'tts-1', assistant_message_id: 101, turn_id: 'turn-1', status: 'completed', url: '/tts/assets/asset-1.mp3', assets: [] })
    socketHandlers?.onMessage({ type: 'tts_failed', job_id: 'tts-1', assistant_message_id: 101, turn_id: 'turn-1', status: 'rate_limited', error: { category: 'rate_limited', detail: 'Too many requests.' } })

    expect(onTtsJob).toHaveBeenCalledTimes(1)
    expect(onTtsComplete).toHaveBeenCalledTimes(1)
    expect(onTtsFailed).toHaveBeenCalledTimes(1)
    expect(onError).not.toHaveBeenCalled()
  })

  it('recreates the socket when the auth key changes for the same session', () => {
    const { rerender, unmount } = renderHook(
      ({ authKey }) => useAdventureChatSocket(7, {}, authKey),
      { initialProps: { authKey: 'old-token' } },
    )

    expect(socketInstances).toHaveLength(1)
    expect(socketInstances[0].sessionId).toBe(7)
    expect(socketInstances[0].connect).toHaveBeenCalledTimes(1)

    rerender({ authKey: 'new-token' })

    expect(socketInstances).toHaveLength(2)
    expect(socketInstances[0].close).toHaveBeenCalledTimes(1)
    expect(socketInstances[1].sessionId).toBe(7)
    expect(socketInstances[1].connect).toHaveBeenCalledTimes(1)

    unmount()
    expect(socketInstances[1].close).toHaveBeenCalledTimes(1)
  })
})
