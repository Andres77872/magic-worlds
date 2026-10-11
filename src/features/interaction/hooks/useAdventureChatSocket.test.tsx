import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAdventureChatSocket } from './useAdventureChatSocket'
import { configureLlmPreparation } from '@/infrastructure/api/llmPreparation'
import { llmIntents } from '@/infrastructure/api/llmIntent'
import type { LlmRequest } from '@/shared/types/llm.types'
import { apiService } from '../../../infrastructure/api'
import { authSession } from '@/infrastructure/api/authSession'

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
  // A spent turn is confirmed with the server before offering a linked retry.
  apiService: { reconcileChatTurn: vi.fn(async (_basePath: string, _sessionId: number, requestId: string) => ({ status: 'failed', request_id: requestId, execution_id: '44444444-4444-4444-8444-444444444444', recovery_required: false })) },
  ChatSocket: class {
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
  it('discards narrative and completion frames from superseded requests while preserving media delivery', () => {
    const onDelta = vi.fn(), onDone = vi.fn(), onTurnStarted = vi.fn(), onImageComplete = vi.fn()
    const { result } = renderHook(() => useAdventureChatSocket(7, { onDelta, onDone, onTurnStarted, onImageComplete }))
    result.current.sendChat('First', 'req-1')
    result.current.sendChat('Next', 'req-2')
    socketHandlers?.onMessage({ type: 'turn_started', request_id: 'req-1', turn_id: 'old' })
    socketHandlers?.onMessage({ type: 'delta', request_id: 'req-1', delta: 'Old' })
    socketHandlers?.onMessage({ type: 'done', request_id: 'req-1' })
    socketHandlers?.onMessage({ type: 'image_complete', request_id: 'req-1', assets: [] })
    expect(onDelta).not.toHaveBeenCalled()
    expect(onDone).not.toHaveBeenCalled()
    expect(onTurnStarted).not.toHaveBeenCalled()
    expect(onImageComplete).toHaveBeenCalledOnce()
    socketHandlers?.onMessage({ type: 'delta', request_id: 'req-2', content: 'New' })
    socketHandlers?.onMessage({ type: 'done', request_id: 'req-2' })
    expect(onDelta).toHaveBeenCalledOnce()
    expect(onDone).toHaveBeenCalledOnce()
  })

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

  it('passes the error category and correlation ids to onError', () => {
    const onError = vi.fn()

    const { result } = renderHook(() => useAdventureChatSocket(7, { onError }))
    result.current.sendChat('Open the door', 'req-1')

    socketHandlers?.onMessage({
      type: 'error',
      message: 'The model returned an invalid response. Please try again.',
      category: 'upstream_contract',
      request_id: 'req-1',
      turn_id: 'turn-1',
    })

    expect(onError).toHaveBeenCalledWith('The model returned an invalid response. Please try again.', {
      category: 'upstream_contract',
      requestId: 'req-1',
      turnId: 'turn-1',
    })
  })

  it('dispatches parsed response segments', () => {
    const onSegments = vi.fn()

    renderHook(() =>
      useAdventureChatSocket(7, {
        onSegments,
      }),
    )

    socketHandlers?.onMessage({
      type: 'segments',
      responseFormat: 'mw_xml_v1',
      displayText: 'Lyra: The door listens.',
      segments: [{ kind: 'speech', speaker_id: 'lyra', speaker_name: 'Lyra', content: 'The door listens.' }],
    })

    expect(onSegments).toHaveBeenCalledWith({
      type: 'segments',
      responseFormat: 'mw_xml_v1',
      displayText: 'Lyra: The door listens.',
      segments: [{ kind: 'speech', speaker_id: 'lyra', speaker_name: 'Lyra', content: 'The door listens.' }],
    })
  })

  it('dispatches done frames with user and assistant message ids', () => {
    const onDone = vi.fn()

    renderHook(() =>
      useAdventureChatSocket(7, {
        onDone,
      }),
    )

    socketHandlers?.onMessage({ type: 'done', user_message_id: 100, assistant_message_id: 101, turn_id: 'turn-1' })

    expect(onDone).toHaveBeenCalledWith({
      interrupted: false,
      userMessageId: 100,
      assistantMessageId: 101,
      turnId: 'turn-1',
    })
  })

  it('keeps the same socket across a token refresh for the same session', async () => {
    const { result, rerender, unmount } = renderHook(
      ({ authKey }: { authKey: string | null }) => useAdventureChatSocket(7, {}, authKey),
      { initialProps: { authKey: 'old-token' as string | null } },
    )

    expect(socketInstances).toHaveLength(1)
    expect(socketInstances[0].sessionId).toBe(7)
    expect(socketInstances[0].connect).toHaveBeenCalledTimes(1)

    // A rotated access token must NOT tear down the socket: the socket reads the
    // stored token fresh on (re)connect, and recreating it here would drop a chat
    // frame queued behind the refresh that rotated the token in the first place.
    rerender({ authKey: 'new-token' })

    expect(socketInstances).toHaveLength(1)
    expect(socketInstances[0].close).not.toHaveBeenCalled()
    await act(async () => { result.current.sendChat('still flows on the same socket'); await Promise.resolve() })
    expect(socketInstances[0].sendChat).toHaveBeenCalledTimes(1)

    unmount()
    expect(socketInstances[0].close).toHaveBeenCalledTimes(1)
  })

  it('disconnects when auth becomes unavailable and reconnects when it returns', () => {
    const { rerender } = renderHook(
      ({ authKey }: { authKey: string | null }) => useAdventureChatSocket(7, {}, authKey),
      { initialProps: { authKey: 'token' as string | null } },
    )

    expect(socketInstances).toHaveLength(1)

    rerender({ authKey: null })
    expect(socketInstances[0].close).toHaveBeenCalledTimes(1)
    expect(socketInstances).toHaveLength(1)

    rerender({ authKey: 'token-2' })
    expect(socketInstances).toHaveLength(2)
    expect(socketInstances[1].connect).toHaveBeenCalledTimes(1)
  })

  it('stays disconnected when text chat is disabled for voice mode', () => {
    const { result } = renderHook(() => useAdventureChatSocket(null, {}))

    result.current.sendChat('this must not leave over ChatSocket')
    result.current.sendTts(101, 'turn-1')
    result.current.cancel()

    expect(socketInstances).toHaveLength(0)
  })

  it('passes stored chat content and request id to the socket', async () => {
    const { result } = renderHook(() => useAdventureChatSocket(7, {}))

    await act(async () => { result.current.sendChat('Look around', 'request-7'); await Promise.resolve() })

    expect(socketInstances[0].sendChat).toHaveBeenCalledWith(
      'Look around',
      'request-7',
      undefined,
      expect.any(Function),
    )
  })

  it('forwards the stored user message id when regenerating', async () => {
    const { result } = renderHook(() => useAdventureChatSocket(7, {}))
    await act(async () => { result.current.sendChat('Look around', 'retry-7', 100); await Promise.resolve() })
    expect(socketInstances[0].sendChat).toHaveBeenCalledWith('Look around', 'retry-7', 100, expect.any(Function))
  })

  it('ignores voice transport frames on the text chat hook', () => {
    const onDelta = vi.fn()
    const onDone = vi.fn()
    const onError = vi.fn()
    const onTtsComplete = vi.fn()

    renderHook(() =>
      useAdventureChatSocket(7, {
        onDelta,
        onDone,
        onError,
        onTtsComplete,
      }),
    )

    socketHandlers?.onMessage({ type: 'voice_audio_chunk', data_b64: 'raw-audio-must-stay-voice-only' })
    socketHandlers?.onMessage({ type: 'voice_state_snapshot', voice_session_id: 'voice-1', last_audio_seq: 1 })

    expect(onDelta).not.toHaveBeenCalled()
    expect(onDone).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
    expect(onTtsComplete).not.toHaveBeenCalled()
  })
})

describe('useAdventureChatSocket same-request recovery', () => {
  const PROFILE = '11111111-1111-4111-8111-111111111111'
  const flush = () => act(async () => { for (let i = 0; i < 10; i++) await Promise.resolve() })
  // Targets are kept per session, so another conversation never reuses this request's target.
  const retained = (id: string) => llmIntents.retained('chat_adventure', JSON.stringify(['adventure-sessions', 7, id]))
  const target = (revision: string, key?: string): LlmRequest => ({ selection: { mode: 'profile', profile_id: PROFILE },
    expected_revision_id: revision, ...(key ? { credentials: { api_key: key } } : {}) })
  let release: (() => void) | null = null
  const prepare = (revision: () => string) => {
    const calls: unknown[] = []
    release = configureLlmPreparation(async (_feature, _signal, selection) => {
      calls.push(selection)
      return () => target(revision(), 'FAKE_KEY')
    })
    return calls
  }
  const sent = () => socketInstances[0].sendChat.mock.calls.map(([content, id, existing, materialize]) =>
    ({ content, id, existing, llm: (materialize as () => LlmRequest)() }))

  afterEach(() => {
    release?.()
    release = null
    llmIntents.clear()
    socketHandlers = null
    socketInstances.length = 0
    vi.clearAllMocks()
  })

  it('resends a request with its frozen target and no key, and sends the key only when the server asks', async () => {
    const calls = prepare(() => '22222222-2222-4222-8222-222222222222')
    const onError = vi.fn()
    const { result } = renderHook(() => useAdventureChatSocket(7, { onError }))
    result.current.sendChat('Open the door', 'req-9')
    await flush()
    expect(sent()[0].llm.credentials).toEqual({ api_key: 'FAKE_KEY' })

    result.current.sendChat('Open the door', 'req-9')
    await flush()
    expect(calls).toHaveLength(1)
    expect(sent()[1]).toEqual({ content: 'Open the door', id: 'req-9', existing: undefined, llm: target('22222222-2222-4222-8222-222222222222') })

    socketHandlers?.onMessage({ type: 'error', message: 'Chat execution failed.', category: 'conflict', code: 'BYOK_CREDENTIAL_REQUIRED', request_id: 'req-9' })
    await flush()
    expect(onError).not.toHaveBeenCalled()
    expect(calls[1]).toEqual({ mode: 'profile', profile_id: PROFILE })
    expect(sent()[2]).toEqual({ content: 'Open the door', id: 'req-9', existing: undefined, llm: target('22222222-2222-4222-8222-222222222222', 'FAKE_KEY') })

    socketHandlers?.onMessage({ type: 'error', message: 'Chat execution failed.', category: 'conflict', code: 'BYOK_CREDENTIAL_REQUIRED', request_id: 'req-9' })
    expect(onError).toHaveBeenCalledWith('Chat execution failed.', expect.objectContaining({ code: 'BYOK_CREDENTIAL_REQUIRED', requestId: 'req-9' }))
  })

  it('never sends a key for a profile revision other than the frozen one', async () => {
    let revision = '22222222-2222-4222-8222-222222222222'
    prepare(() => revision)
    const onError = vi.fn()
    const { result } = renderHook(() => useAdventureChatSocket(7, { onError }))
    result.current.sendChat('Open the door', 'req-9')
    await flush()
    sent()
    result.current.sendChat('Open the door', 'req-9')
    await flush()
    revision = '33333333-3333-4333-8333-333333333333'

    socketHandlers?.onMessage({ type: 'error', message: 'Chat execution failed.', category: 'conflict', code: 'BYOK_CREDENTIAL_REQUIRED', request_id: 'req-9' })
    await flush()
    expect(socketInstances[0].sendChat).toHaveBeenCalledTimes(2)
    expect(onError).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ code: 'LLM_EXECUTION_INTENT_CHANGED', requestId: 'req-9' }))
    expect(retained('req-9')).toBeNull()
  })

  it('releases the frozen target when the turn finishes or its request is spent', async () => {
    prepare(() => '22222222-2222-4222-8222-222222222222')
    const onError = vi.fn()
    const { result } = renderHook(() => useAdventureChatSocket(7, { onError }))
    result.current.sendChat('Open the door', 'req-1')
    await flush()
    sent()
    expect(retained('req-1')).not.toBeNull()
    socketHandlers?.onMessage({ type: 'done', request_id: 'req-1' })
    expect(retained('req-1')).toBeNull()

    result.current.sendChat('Look around', 'req-2')
    await flush()
    sent()
    socketHandlers?.onMessage({ type: 'error', message: 'Chat execution failed.', category: 'conflict', code: 'LLM_EXECUTION_FINISHED', request_id: 'req-2' })
    expect(retained('req-2')).toBeNull()
    expect(onError).toHaveBeenCalledWith('Chat execution failed.', expect.objectContaining({ code: 'LLM_EXECUTION_FINISHED' }))
  })
})

describe('retained chat attempts', () => {
  const PROFILE = '11111111-1111-4111-8111-111111111111'
  const REVISION = '22222222-2222-4222-8222-222222222222'
  const PARENT = '44444444-4444-4444-8444-444444444444'
  const CHILD = '55555555-5555-4555-8555-555555555555'
  const target = { selection: { mode: 'profile' as const, profile_id: PROFILE }, expected_revision_id: REVISION }
  const flush = () => act(async () => { for (let i = 0; i < 12; i++) await Promise.resolve() })
  let release: (() => void) | undefined
  const capture = () => {
    const wires: Array<{ content: string; id: string; existing: number | undefined; llm: LlmRequest }> = []
    socketInstances[0].sendChat.mockImplementation((content, id, existing, materialize) => {
      wires.push({ content, id, existing, llm: materialize() })
    })
    return wires
  }
  const retained = { status: 'failed' as const, request_id: 'request-1', execution_id: PARENT, recovery_required: true,
    dispatch: { content: 'Open the door', existing_user_message_id: null, llm: target } }

  afterEach(() => {
    release?.(); release = undefined
    llmIntents.clear(); socketHandlers = null; socketInstances.length = 0
    vi.clearAllMocks(); authSession.continueSignedOut()
  })

  it('offers a confirmed parent and prepares a new key only for its new child', async () => {
    const calls: Array<{ parent?: string }> = []
    release = configureLlmPreparation(async (_feature, _signal, _selection, parent) => {
      calls.push({ parent })
      const key = parent ? 'FAKE_FRESH_CHILD_KEY' : 'FAKE_FIRST_KEY'
      return () => ({ ...target, credentials: { api_key: key } })
    })
    vi.mocked(apiService.reconcileChatTurn).mockResolvedValueOnce(retained)
    const onError = vi.fn()
    const { result } = renderHook(() => useAdventureChatSocket(7, { onError }))
    const wires = capture()
    result.current.sendChat('Open the door', 'request-1')
    await flush()
    socketHandlers?.onMessage({ type: 'turn_started', request_id: 'request-1', turn_id: PARENT, user_message_id: 100, assistant_message_id: 101 })
    socketHandlers?.onMessage({ type: 'error', request_id: 'request-1', turn_id: PARENT, code: 'LLM_EXECUTION_UPSTREAM_FAILED', message: 'Failed' })
    expect(onError).toHaveBeenLastCalledWith('Failed', expect.objectContaining({ retryPending: true }))
    await flush()
    const command = onError.mock.calls[onError.mock.calls.length - 1][1].llmRetry
    expect(command).toEqual({ ...target, retry_of_execution_id: PARENT })
    result.current.sendChat('Open the door', 'request-2', undefined, command)
    await flush()
    expect(calls).toEqual([{ parent: undefined }, { parent: PARENT }])
    expect(wires[1]).toEqual({ content: 'Open the door', id: 'request-2', existing: undefined,
      llm: { ...target, retry_of_execution_id: PARENT, credentials: { api_key: 'FAKE_FRESH_CHILD_KEY' } } })
    expect(JSON.stringify(onError.mock.calls) + JSON.stringify(localStorage) + JSON.stringify(sessionStorage)).not.toContain('FAKE_FRESH_CHILD_KEY')
  })

  it('recovers a child after reload without a key, then requests one for its retained revision', async () => {
    const preparation = vi.fn(async () => () => ({ ...target, credentials: { api_key: 'FAKE_REENTERED_KEY' } }))
    release = configureLlmPreparation(preparation)
    const onError = vi.fn()
    const { result } = renderHook(() => useAdventureChatSocket(7, { onError }))
    const wires = capture()
    const command = { ...target, retry_of_execution_id: PARENT }
    result.current.sendChat('Open the door', 'child-request', undefined, command, true)
    await flush()
    expect(preparation).not.toHaveBeenCalled()
    expect(wires[0].llm).toEqual(command)
    socketHandlers?.onMessage({ type: 'error', request_id: 'child-request', code: 'BYOK_CREDENTIAL_REQUIRED', message: 'Key required' })
    await flush()
    expect(preparation).toHaveBeenCalledWith('chat_adventure', expect.any(AbortSignal), target.selection, PARENT, 'child-request')
    expect(wires[1].llm).toEqual({ ...command, credentials: { api_key: 'FAKE_REENTERED_KEY' } })
    expect(onError).not.toHaveBeenCalled()
  })

  it('keeps inherited platform intent without adding a revision CAS to the child', async () => {
    release = configureLlmPreparation(async () => () => target)
    const { result } = renderHook(() => useAdventureChatSocket(7, {}))
    const wires = capture()
    result.current.sendChat('Open the door', 'new-child', undefined, { selection: { mode: 'inherit' }, retry_of_execution_id: PARENT })
    await flush()
    expect(wires[0].llm).toEqual({ selection: { mode: 'inherit' }, retry_of_execution_id: PARENT })
  })

  it('rejects a fresh key for another revision before dispatching the child', async () => {
    release = configureLlmPreparation(async () => () => ({ ...target, expected_revision_id: CHILD, credentials: { api_key: 'FAKE_WRONG_KEY' } }))
    const onError = vi.fn()
    const { result } = renderHook(() => useAdventureChatSocket(7, { onError }))
    const wires = capture()
    result.current.sendChat('Open the door', 'new-child', undefined, { ...target, retry_of_execution_id: PARENT })
    await flush()
    expect(wires).toEqual([])
    expect(onError).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ code: 'LLM_EXECUTION_INTENT_CHANGED' }))
    expect(JSON.stringify(onError.mock.calls)).not.toContain('FAKE_WRONG_KEY')
  })

  it.each(['content', 'execution', 'running'] as const)('does not offer an unproven parent when %s differs', async difference => {
    release = configureLlmPreparation(async () => () => target)
    vi.mocked(apiService.reconcileChatTurn).mockResolvedValueOnce({ ...retained,
      ...(difference === 'content' ? { dispatch: { ...retained.dispatch, content: 'Other input' } } : {}),
      ...(difference === 'execution' ? { execution_id: CHILD } : {}),
      ...(difference === 'running' ? { status: 'running', recovery_required: true } : {}) })
    const onError = vi.fn()
    const { result } = renderHook(() => useAdventureChatSocket(7, { onError }))
    capture()
    result.current.sendChat('Open the door', 'request-1')
    await flush()
    socketHandlers?.onMessage({ type: 'turn_started', request_id: 'request-1', turn_id: PARENT, user_message_id: 100, assistant_message_id: 101 })
    socketHandlers?.onMessage({ type: 'error', request_id: 'request-1', code: 'LLM_EXECUTION_FINISHED', message: 'Failed' })
    await flush()
    expect(onError.mock.calls[onError.mock.calls.length - 1][1].llmRetry).toBeUndefined()
  })

  it('discards a late status response after account ownership changes', async () => {
    authSession.authenticate('alice-fixture', 'FAKE_TOKEN')
    release = configureLlmPreparation(async () => () => target)
    let finish!: (value: typeof retained) => void
    vi.mocked(apiService.reconcileChatTurn).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const onError = vi.fn()
    const { result } = renderHook(() => useAdventureChatSocket(7, { onError }))
    capture()
    result.current.sendChat('Open the door', 'request-1')
    await flush()
    socketHandlers?.onMessage({ type: 'error', request_id: 'request-1', code: 'LLM_EXECUTION_FINISHED', message: 'Failed' })
    authSession.beginLogout(); authSession.authenticate('bob-fixture', 'FAKE_BOB_TOKEN')
    finish(retained)
    await flush()
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0][1].llmRetry).toBeUndefined()
  })

  it.each(['missing', 'parent', 'user', 'private'] as const)('rejects a %s attempt association and drops its following stream', async mutation => {
    const onTurnStarted = vi.fn(), onDelta = vi.fn(), onError = vi.fn()
    const { result } = renderHook(() => useAdventureChatSocket(7, { onTurnStarted, onDelta, onError }))
    capture()
    result.current.sendChat('Open the door', 'child', undefined, { ...target, retry_of_execution_id: PARENT }, true)
    await flush()
    const attempt = { parent_execution_id: mutation === 'parent' ? CHILD : PARENT, user_message_id: mutation === 'user' ? 999 : 100,
      accepted_conversation_version: 1, ...(mutation === 'private' ? { provider_key: 'FAKE_PRIVATE_KEY' } : {}) }
    socketHandlers?.onMessage({ type: 'turn_started', request_id: 'child', turn_id: CHILD, user_message_id: 100, assistant_message_id: 102,
      ...(mutation === 'missing' ? {} : { execution_attempt: attempt }) })
    socketHandlers?.onMessage({ type: 'delta', request_id: 'child', content: 'Must be discarded' })
    expect(onTurnStarted).not.toHaveBeenCalled(); expect(onDelta).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ code: 'CHAT_EXECUTION_RECORD_INVALID' }))
    expect(JSON.stringify(onError.mock.calls)).not.toContain('FAKE_PRIVATE_KEY')
  })
})
