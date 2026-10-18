import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { setTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { useEffect, useState } from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatSpeakerRosterEntry, TurnEntry } from '../../../shared'
import type { ChatSessionConfig } from '../chatSessionConfig'
import { apiService } from '../../../infrastructure/api'
import {
    createWorkspaceTestState,
    OTHER_WORKSPACE_ID,
    TEST_WORKSPACE_ID,
    testWorkspace,
    WorkspaceTestProvider,
    type WorkspaceTestState,
} from '@/shared/hooks/testing/workspaceTestUtils'
import { clearVoiceCapabilitiesCache, toVoiceCapabilities } from '@/shared/voice/voiceCapabilities'
import { gptProfile, kreaProfile, rootList } from '@/features/imageProfiles/imageProfileFixtures'
import { InteractionCenterPanel } from './InteractionCenterPanel'
import { SessionPersonaError } from '@/utils/characterRoles'

vi.mock('../../../infrastructure/api/useAuthenticatedMediaUrl', () => ({
    useAuthenticatedMediaUrl: (url?: string | null) => ({ src: url ?? undefined, loading: false, error: null }),
}))

const hookMocks = vi.hoisted(() => ({
    useAdventureChatSocket: vi.fn(),
    pageFocused: true,
    // Scene images poll while the page is visible, focused or not.
    pageVisible: true,
}))

vi.mock('../../../app/hooks', () => ({
    useAuth: () => ({
        isAuthenticated: true,
        openLoginModal: vi.fn(),
        token: 'token',
    }),
    useData: () => ({ lorebooks: [] }),
}))

vi.mock('../hooks/useAdventureChatSocket', () => ({
    useAdventureChatSocket: hookMocks.useAdventureChatSocket,
}))

vi.mock('@/app/hooks/usePageFocus', () => ({
    usePageFocus: () => hookMocks.pageFocused,
    isPageFocused: () => hookMocks.pageFocused,
    usePageVisible: () => hookMocks.pageVisible,
    isPageVisible: () => hookMocks.pageVisible,
}))

afterEach(() => vi.unstubAllEnvs())

const initialTurns: TurnEntry[] = [
    { id: '100', type: 'user', content: 'Open the door', timestamp: '2026-06-04T00:00:00' },
    { id: '101', type: 'ai', content: 'The door opens.', timestamp: '2026-06-04T00:00:01', assistantMessageId: 101, turnId: 'turn-1' },
]

function makeConfig(overrides: Partial<ChatSessionConfig> = {}): ChatSessionConfig {
    return {
        kind: 'adventure',
        basePath: 'adventure-sessions',
        workspaceId: TEST_WORKSPACE_ID,
        api: apiService,
        loadTurns: vi.fn(async () => []),
        updateMessage: vi.fn(async () => initialTurns),
        deleteMessage: vi.fn(async (_sessionId, messageId) => initialTurns.filter((turn) => turn.id !== String(messageId))),
        selectReply: vi.fn(async () => initialTurns),
        clearMessages: vi.fn(async () => []),
        aiLabel: 'Game Master',
        showForwardOptions: true,
        showImages: true,
        autoNarrateKeyPrefix: 'test:autonarrate:',
        copy: {
            emptyTitle: 'No turns',
            emptyBody: 'Start writing.',
            emptyHint: 'Begin.',
            waitingTitle: 'Waiting',
            waitingHint: 'Generate.',
            placeholder: 'What next?',
            loadingHint: 'Loading.',
            resetConfirm: 'Clear messages?',
        },
        ...overrides,
    }
}

let workspace: WorkspaceTestState

function renderPanel(config: ChatSessionConfig, seed: TurnEntry[] = initialTurns, sessionId = 7, speakerRoster?: ChatSpeakerRosterEntry[], observe?: (turns: TurnEntry[]) => void, ensureSession?: () => Promise<number>) {
    function Harness() {
        const [turns, setTurns] = useState<TurnEntry[]>(seed)
        useEffect(() => { observe?.(turns) }, [turns])
        return <InteractionCenterPanel sessionId={sessionId} ensureSession={ensureSession} turns={turns} setTurns={setTurns} config={config} speakerRoster={speakerRoster} />
    }

    const view = render(<WorkspaceTestProvider state={workspace}><Harness /></WorkspaceTestProvider>)
    return {
        ...view,
        /** Re-render after `workspace.switchTo(...)`. */
        rerenderWorkspace: () => view.rerender(<WorkspaceTestProvider state={workspace}><Harness /></WorkspaceTestProvider>),
    }
}

describe('InteractionCenterPanel message deletion', () => {
    beforeEach(() => {
        localStorage.clear()
        vi.restoreAllMocks()
        workspace = createWorkspaceTestState({ api: apiService })
        hookMocks.pageFocused = true
        hookMocks.pageVisible = true
        // The session-lore hook lists attachments on mount; keep it empty + offline-safe.
        vi.spyOn(apiService, 'listLorebookAttachments').mockResolvedValue([])
        // Narration availability reads the capabilities; offline reads fail open.
        vi.spyOn(apiService, 'getVoiceCapabilities').mockRejectedValue(new Error('offline'))
        // The composer's image control lists the image profiles.
        vi.spyOn(apiService, 'getImageProfiles').mockResolvedValue(rootList)
        // A plain failed turn is spent on the server, so Retry starts a new request.
        vi.spyOn(apiService, 'reconcileChatTurn').mockImplementation(async (_basePath, _sessionId, requestId) => {
            const send = hookMocks.useAdventureChatSocket.mock.results[hookMocks.useAdventureChatSocket.mock.results.length - 1]?.value.sendChat
            const command = send?.mock.calls.find((call: unknown[]) => call[1] === requestId)
            return { status: 'failed', request_id: requestId, execution_id: '44444444-4444-4444-8444-444444444444', recovery_required: true,
                dispatch: { content: command?.[0] ?? 'Open the door', existing_user_message_id: command?.[2] ?? null, llm: { selection: { mode: 'inherit' } } } }
        })
        hookMocks.useAdventureChatSocket.mockReturnValue({
            status: 'open',
            sendChat: vi.fn(),
            sendTts: vi.fn(),
            cancel: vi.fn(),
        })
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
            configurable: true,
            value: vi.fn(),
        })
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.unstubAllEnvs()
    })

    it('keeps a draft disconnected and ignores whitespace without creating a session', () => {
        const ensureSession = vi.fn(async () => 19)
        const config = makeConfig()
        renderPanel(config, [], Number.NaN, undefined, undefined, ensureSession)
        expect(hookMocks.useAdventureChatSocket).toHaveBeenLastCalledWith(null, expect.any(Object), 'token', 'adventure-sessions', undefined, TEST_WORKSPACE_ID)
        fireEvent.change(screen.getByPlaceholderText('What next?'), { target: { value: '  ' } })
        fireEvent.click(screen.getByLabelText('Send message'))
        expect(ensureSession).not.toHaveBeenCalled()
        expect(config.loadTurns).not.toHaveBeenCalled()
        expect(apiService.listLorebookAttachments).not.toHaveBeenCalled()
    })

    it('creates the draft on Send and sends the first message exactly once on its new socket', async () => {
        let finish!: (id: number) => void
        const ensureSession = vi.fn(() => new Promise<number>((resolve) => { finish = resolve }))
        const sendChat = vi.fn()
        hookMocks.useAdventureChatSocket.mockReturnValue({ status: 'closed', sendChat, sendTts: vi.fn(), cancel: vi.fn() })
        renderPanel(makeConfig(), [], Number.NaN, undefined, undefined, ensureSession)
        fireEvent.change(screen.getByPlaceholderText('What next?'), { target: { value: 'Hello Lyra' } })
        fireEvent.click(screen.getByLabelText('Send message'))
        expect(ensureSession).toHaveBeenCalledTimes(1)
        expect(sendChat).not.toHaveBeenCalled()
        await act(async () => { finish(19) })
        expect(hookMocks.useAdventureChatSocket).toHaveBeenLastCalledWith(19, expect.any(Object), 'token', 'adventure-sessions', undefined, TEST_WORKSPACE_ID)
        expect(sendChat).toHaveBeenCalledExactlyOnceWith('Hello Lyra', expect.any(String))
        expect(screen.getByText('Hello Lyra')).toBeInTheDocument()
    })

    it('preserves the first message when creation fails and retries from the composer', async () => {
        const ensureSession = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(19)
        const sendChat = vi.fn()
        hookMocks.useAdventureChatSocket.mockReturnValue({ status: 'closed', sendChat, sendTts: vi.fn(), cancel: vi.fn() })
        renderPanel(makeConfig(), [], Number.NaN, undefined, undefined, ensureSession)
        fireEvent.change(screen.getByPlaceholderText('What next?'), { target: { value: 'Hello Lyra' } })
        await act(async () => { fireEvent.click(screen.getByLabelText('Send message')) })
        expect(screen.getByPlaceholderText('What next?')).toHaveValue('Hello Lyra')
        expect(sendChat).not.toHaveBeenCalled()
        await act(async () => { fireEvent.click(screen.getByLabelText('Send message')) })
        expect(sendChat).toHaveBeenCalledExactlyOnceWith('Hello Lyra', expect.any(String))
        expect(ensureSession).toHaveBeenCalledTimes(2)
    })

    it.each([
        new SessionPersonaError('invalid'),
        { status: 422, message: 'persona_id must reference a persona card' },
        { status: 404, message: 'Persona not found' },
    ])('preserves the first message and explains persona setup rejection: %j', async (error) => {
        const ensureSession = vi.fn().mockRejectedValue(error)
        const sendChat = vi.fn()
        hookMocks.useAdventureChatSocket.mockReturnValue({ status: 'closed', sendChat, sendTts: vi.fn(), cancel: vi.fn() })
        renderPanel(makeConfig(), [], Number.NaN, undefined, undefined, ensureSession)
        fireEvent.change(screen.getByPlaceholderText('What next?'), { target: { value: 'Hello Lyra' } })
        await act(async () => { fireEvent.click(screen.getByLabelText('Send message')) })
        expect(screen.getByPlaceholderText('What next?')).toHaveValue('Hello Lyra')
        expect(screen.getByText(/Choose an available persona card before starting/)).toBeInTheDocument()
        expect(sendChat).not.toHaveBeenCalled()
    })

    it('does not send a first message if the draft was left while creation was pending', async () => {
        let finish!: (id: number) => void
        const ensureSession = vi.fn(() => new Promise<number>((resolve) => { finish = resolve }))
        const sendChat = vi.fn()
        hookMocks.useAdventureChatSocket.mockReturnValue({ status: 'closed', sendChat, sendTts: vi.fn(), cancel: vi.fn() })
        const { unmount } = renderPanel(makeConfig(), [], Number.NaN, undefined, undefined, ensureSession)
        fireEvent.change(screen.getByPlaceholderText('What next?'), { target: { value: 'Hello Lyra' } })
        fireEvent.click(screen.getByLabelText('Send message'))
        unmount()
        await act(async () => { finish(19) })
        expect(sendChat).not.toHaveBeenCalled()
    })

    it('opens a compact delete popover', () => {
        const deleteMessage = vi.fn(async () => [initialTurns[1]])
        const config = makeConfig({ deleteMessage })

        renderPanel(config)
        fireEvent.click(screen.getAllByLabelText('Delete message')[0])

        expect(screen.queryByRole('dialog', { name: 'Delete message' })).not.toBeInTheDocument()
        const popover = screen.getByRole('dialog', { name: 'Delete message?' })
        expect(within(popover).getByText('Delete message?')).toBeInTheDocument()

        fireEvent.click(within(popover).getByRole('button', { name: 'Cancel' }))

        expect(deleteMessage).not.toHaveBeenCalled()
        expect(screen.queryByRole('dialog', { name: 'Delete message?' })).not.toBeInTheDocument()
        expect(screen.getByText('Open the door')).toBeInTheDocument()
    })

    it('deletes stored messages through the session config and adopts the server projection', async () => {
        const deleteMessage = vi.fn(async () => [initialTurns[1]])
        const config = makeConfig({ deleteMessage })

        renderPanel(config)
        fireEvent.click(screen.getAllByLabelText('Delete message')[0])
        fireEvent.click(within(screen.getByRole('dialog', { name: 'Delete message?' })).getByRole('button', { name: 'Delete' }))

        await waitFor(() => expect(deleteMessage).toHaveBeenCalledWith(7, 100))
        expect(screen.queryByText('Open the door')).not.toBeInTheDocument()
        expect(screen.getByText('The door opens.')).toBeInTheDocument()
    })

    it('rolls back the local removal when stored delete fails', async () => {
        const deleteMessage = vi.fn(async () => {
            throw new Error('conflict')
        })
        const config = makeConfig({ deleteMessage })

        renderPanel(config)
        fireEvent.click(screen.getAllByLabelText('Delete message')[0])
        fireEvent.click(within(screen.getByRole('dialog', { name: 'Delete message?' })).getByRole('button', { name: 'Delete' }))

        expect(await screen.findByText('Failed to delete message. Please try again.')).toBeInTheDocument()
        expect(screen.getByText('Open the door')).toBeInTheDocument()
        expect(screen.getByText('The door opens.')).toBeInTheDocument()
    })

    it('clears messages through the stored clear endpoint', async () => {
        const clearMessages = vi.fn(async () => [])
        const config = makeConfig({ clearMessages })

        renderPanel(config)
        fireEvent.click(screen.getByRole('button', { name: 'Clear messages' }))

        const dialog = screen.getByRole('dialog', { name: 'Clear messages' })
        expect(within(dialog).getByText('Clear messages?')).toBeInTheDocument()
        fireEvent.click(within(dialog).getByRole('button', { name: 'Clear messages' }))

        await waitFor(() => expect(clearMessages).toHaveBeenCalledWith(7))
        expect(screen.queryByText('Open the door')).not.toBeInTheDocument()
        expect(screen.queryByText('The door opens.')).not.toBeInTheDocument()
        expect(screen.getByText('No turns')).toBeInTheDocument()
    })

    it('paints live speaker attribution from speakers + delta frames, then reconciles with authoritative segments', async () => {
        let handlers: { onSpeakers: Function; onDelta: Function; onSegments: Function; onDone: Function } | undefined
        const sendChat = vi.fn()
        hookMocks.useAdventureChatSocket.mockImplementation((_sessionId: unknown, h: never) => {
            handlers = h
            return { status: 'open', sendChat, sendTts: vi.fn(), cancel: vi.fn() }
        })

        const loadTurns = vi.fn()
            .mockResolvedValueOnce([])
            .mockResolvedValue([
                { id: '100', type: 'user', content: 'Look around', timestamp: '', turnId: 'turn-9' },
                {
                    id: '999',
                    type: 'ai',
                    content: 'Aria: Who goes there?',
                    timestamp: '',
                    assistantMessageId: 999,
                    turnId: 'turn-9',
                    segments: [{ kind: 'speech', speaker_id: 'aria', speaker_name: 'Aria', content: 'Who goes there?' }],
                },
            ])
        renderPanel(makeConfig({ loadTurns }), [])
        await waitFor(() => expect(loadTurns).toHaveBeenCalledTimes(1))

        // Start a generation so there is a streaming AI turn to paint into.
        fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Look around' } })
        fireEvent.click(screen.getByLabelText('Send message'))
        await waitFor(() => expect(sendChat).toHaveBeenCalled())

        // Roster + partial XML → live "Aria is speaking…" with her portrait.
        act(() => {
            handlers!.onSpeakers({
                roster: [{ speaker_id: 'aria', name: 'Aria', image_url: '/portraits/aria.png', has_voice: true }],
                narrator: { name: 'Game Master', image_url: null, kind: 'narrator' },
            })
            handlers!.onDelta('<response><say speaker_id="aria">Who goes')
        })

        expect(await screen.findByText('Aria is speaking…')).toBeInTheDocument()
        expect(screen.getByText('Who goes')).toBeInTheDocument()
        expect(screen.getByRole('img', { name: 'Aria' })).toHaveAttribute('src', '/portraits/aria.png')

        // Authoritative segments arrive and replace the live ones.
        act(() => {
            handlers!.onSegments({
                responseFormat: 'mw_xml_v1',
                segments: [{ kind: 'speech', speaker_id: 'aria', speaker_name: 'Aria', content: 'Who goes there?' }],
                displayText: 'Aria: Who goes there?',
            })
            handlers!.onDone({ interrupted: false, assistantMessageId: 999, turnId: 'turn-9' })
        })

        await waitFor(() => expect(loadTurns).toHaveBeenCalledTimes(2))
        expect(screen.getByText('Aria: Who goes there?', { selector: '.sr-only' })).toBeInTheDocument()
        // Live status line is gone once streaming ends.
        expect(screen.queryByText('Aria is speaking…')).not.toBeInTheDocument()
    })

    it('keeps structured dialog when post-done hydration returns a plain turn projection', async () => {
        let handlers: { onSpeakers: Function; onDelta: Function; onSegments: Function; onDone: Function } | undefined
        const sendChat = vi.fn()
        hookMocks.useAdventureChatSocket.mockImplementation((_sessionId: unknown, h: never) => {
            handlers = h
            return { status: 'open', sendChat, sendTts: vi.fn(), cancel: vi.fn() }
        })
        const hydratedPlainTurns: TurnEntry[] = [
            { id: '100', type: 'user', content: 'Look around', timestamp: '2026-06-04T00:00:00', turnId: 'turn-9' },
            {
                id: '999',
                type: 'ai',
                content: 'Aria: Who goes there?',
                timestamp: '2026-06-04T00:00:01',
                assistantMessageId: 999,
                turnId: 'turn-9',
            },
        ]
        const loadTurns = vi.fn()
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce(hydratedPlainTurns)
        renderPanel(makeConfig({ loadTurns }), [])
        await waitFor(() => expect(loadTurns).toHaveBeenCalledTimes(1))

        fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Look around' } })
        fireEvent.click(screen.getByLabelText('Send message'))
        await waitFor(() => expect(sendChat).toHaveBeenCalled())

        act(() => {
            handlers!.onSpeakers({
                roster: [{ speaker_id: 'aria', name: 'Aria', image_url: null, has_voice: true }],
                narrator: { name: 'Game Master', image_url: null, kind: 'narrator' },
            })
            handlers!.onSegments({
                responseFormat: 'mw_xml_v1',
                segments: [{ kind: 'speech', speaker_id: 'aria', speaker_name: 'Aria', content: 'Who goes there?' }],
                displayText: 'Aria: Who goes there?',
            })
            handlers!.onDone({ interrupted: false, userMessageId: 100, assistantMessageId: 999, turnId: 'turn-9' })
        })

        await waitFor(() => expect(loadTurns).toHaveBeenCalledTimes(2))
        expect(screen.getByText('Aria')).toBeInTheDocument()
        expect(screen.getByText('Who goes there?')).toBeInTheDocument()
        expect(screen.queryByText('Aria: Who goes there?', { selector: '.chat-prose *' })).not.toBeInTheDocument()
    })

    it('keeps live structured dialog after done when no authoritative segments frame arrives', async () => {
        let handlers: { onSpeakers: Function; onDelta: Function; onDone: Function } | undefined
        const sendChat = vi.fn()
        hookMocks.useAdventureChatSocket.mockImplementation((_sessionId: unknown, h: never) => {
            handlers = h
            return { status: 'open', sendChat, sendTts: vi.fn(), cancel: vi.fn() }
        })
        const hydratedPlainTurns: TurnEntry[] = [
            { id: '100', type: 'user', content: 'Look around', timestamp: '2026-06-04T00:00:00', turnId: 'turn-9' },
            {
                id: '999',
                type: 'ai',
                content: 'Aria: Who goes there?',
                timestamp: '2026-06-04T00:00:01',
                assistantMessageId: 999,
                turnId: 'turn-9',
            },
        ]
        const loadTurns = vi.fn()
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce(hydratedPlainTurns)

        renderPanel(makeConfig({ loadTurns }), [])
        await waitFor(() => expect(loadTurns).toHaveBeenCalledTimes(1))

        fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Look around' } })
        fireEvent.click(screen.getByLabelText('Send message'))
        await waitFor(() => expect(sendChat).toHaveBeenCalled())

        act(() => {
            handlers!.onSpeakers({
                roster: [{ speaker_id: 'aria', name: 'Aria', image_url: null, has_voice: true }],
                narrator: { name: 'Game Master', image_url: null, kind: 'narrator' },
            })
            handlers!.onDelta('<response><say speaker_id="aria">Who goes there?')
        })

        expect(await screen.findByText('Aria is speaking…')).toBeInTheDocument()

        act(() => {
            handlers!.onDone({ interrupted: false, userMessageId: 100, assistantMessageId: 999, turnId: 'turn-9' })
        })

        await waitFor(() => expect(loadTurns).toHaveBeenCalledTimes(2))
        expect(screen.getByText('Aria')).toBeInTheDocument()
        expect(screen.getByText('Who goes there?')).toBeInTheDocument()
        expect(screen.queryByText('Aria is speaking…')).not.toBeInTheDocument()
        expect(screen.queryByText('Aria: Who goes there?', { selector: '.chat-prose *' })).not.toBeInTheDocument()
    })

    it('does not yank a reader who scrolled up; offers a jump pill instead', async () => {
        let handlers: { onDelta: (chunk: string) => void } | undefined
        const sendChat = vi.fn()
        hookMocks.useAdventureChatSocket.mockImplementation((_sessionId: unknown, h: never) => {
            handlers = h
            return { status: 'open', sendChat, sendTts: vi.fn(), cancel: vi.fn() }
        })
        const scrollIntoView = vi.fn()
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView })
        const { container } = renderPanel(makeConfig(), initialTurns)

        fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Look around' } })
        fireEvent.click(screen.getByLabelText('Send message'))
        await waitFor(() => expect(sendChat).toHaveBeenCalled())

        // Reader scrolls far away from the bottom mid-stream.
        const scroller = container.querySelector('.overflow-y-auto') as HTMLElement
        Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 2000 })
        Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 600 })
        Object.defineProperty(scroller, 'scrollTop', { configurable: true, value: 0, writable: true })
        fireEvent.scroll(scroller)
        scrollIntoView.mockClear()

        act(() => {
            handlers!.onDelta('The gate creaks open…')
        })

        expect(scrollIntoView).not.toHaveBeenCalled()
        const pill = await screen.findByRole('button', { name: 'New messages' })

        fireEvent.click(pill)
        expect(scrollIntoView).toHaveBeenCalledTimes(1)
        expect(screen.queryByRole('button', { name: 'New messages' })).toBeNull()
    })

    it('keeps following the stream while the reader is near the bottom', async () => {
        let handlers: { onDelta: (chunk: string) => void } | undefined
        const sendChat = vi.fn()
        hookMocks.useAdventureChatSocket.mockImplementation((_sessionId: unknown, h: never) => {
            handlers = h
            return { status: 'open', sendChat, sendTts: vi.fn(), cancel: vi.fn() }
        })
        const scrollIntoView = vi.fn()
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView })
        const { container } = renderPanel(makeConfig(), initialTurns)

        fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Look around' } })
        fireEvent.click(screen.getByLabelText('Send message'))
        await waitFor(() => expect(sendChat).toHaveBeenCalled())

        const scroller = container.querySelector('.overflow-y-auto') as HTMLElement
        Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 2000 })
        Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 600 })
        Object.defineProperty(scroller, 'scrollTop', { configurable: true, value: 1_380, writable: true })
        fireEvent.scroll(scroller)
        scrollIntoView.mockClear()

        act(() => {
            handlers!.onDelta('The gate creaks open…')
        })

        await waitFor(() => expect(scrollIntoView).toHaveBeenCalled())
        expect(screen.queryByRole('button', { name: 'New messages' })).toBeNull()
    })

    it('regenerates a new version of the reply and keeps the current one', async () => {
        let handlers: import('../hooks/useAdventureChatSocket').AdventureChatHandlers = {}
        const sendChat = vi.fn()
        hookMocks.useAdventureChatSocket.mockImplementation((_sessionId: unknown, h: typeof handlers) => {
            handlers = h
            return { status: 'open', sendChat, sendTts: vi.fn(), cancel: vi.fn() }
        })
        const observe = vi.fn()
        const config = makeConfig()
        renderPanel(config, initialTurns, 7, undefined, observe)
        fireEvent.click(screen.getByLabelText('Regenerate'))

        await waitFor(() => expect(sendChat).toHaveBeenCalledWith('Open the door', expect.any(String), 100))
        expect(config.deleteMessage).not.toHaveBeenCalled()
        // The new version is written in the reply's slot, as the second of two.
        expect(screen.queryByText('The door opens.')).toBeNull()
        expect(screen.getByText('Version 2 of 2')).toBeInTheDocument()
        expect(screen.getByLabelText('Next version')).toBeDisabled()
        act(() => {
            handlers.onTurnStarted?.({ type: 'turn_started', user_message_id: 100, assistant_message_id: 102, turn_id: 'turn-2' })
            handlers.onDelta?.('The door is locked.')
            handlers.onDone?.({ interrupted: false, userMessageId: 100, assistantMessageId: 102, turnId: 'turn-2' })
        })

        const latest = observe.mock.calls[observe.mock.calls.length - 1][0] as TurnEntry[]
        expect(latest.map((turn) => [turn.id, turn.metadata?.inactive_variant === true])).toEqual([
            ['100', false], ['101', true], ['102', false],
        ])
        // (The live region repeats the finished text, so read the transcript itself.)
        const articles = document.querySelectorAll('article')
        expect(articles).toHaveLength(2)
        expect(articles[1]).toHaveTextContent('The door is locked.')
        expect(screen.queryByText('The door opens.')).toBeNull()
        expect(screen.getByLabelText('Previous version')).toBeEnabled()
    })

    it('switches the shown version through the server', async () => {
        const versions: TurnEntry[] = [
            initialTurns[0],
            { ...initialTurns[1], metadata: { inactive_variant: true } },
            { id: '102', type: 'ai', content: 'The door is locked.', timestamp: '', assistantMessageId: 102, turnId: 'turn-2' },
        ]
        const selectReply = vi.fn(async () => [versions[0], { ...versions[1], metadata: {} }, { ...versions[2], metadata: { inactive_variant: true } }])
        const config = makeConfig({ selectReply })
        renderPanel(config, versions)
        expect(screen.getByText('The door is locked.')).toBeInTheDocument()
        expect(screen.queryByText('The door opens.')).toBeNull()
        expect(screen.getByText('Version 2 of 2')).toBeInTheDocument()

        const previous = screen.getByLabelText('Previous version')
        previous.focus()
        fireEvent.click(previous)
        // Optimistic: the earlier version shows at once, in the same slot.
        expect(screen.getByText('The door opens.')).toBeInTheDocument()
        expect(screen.getByText('Version 1 of 2')).toBeInTheDocument()
        expect(document.activeElement).toBe(previous)
        await waitFor(() => expect(selectReply).toHaveBeenCalledWith(7, 101))
        expect(screen.queryByText('The door is locked.')).toBeNull()
        expect(screen.getAllByLabelText('Regenerate')).toHaveLength(1)
    })

    it('rolls back a version switch the server rejects', async () => {
        const versions: TurnEntry[] = [
            initialTurns[0],
            { ...initialTurns[1], metadata: { inactive_variant: true } },
            { id: '102', type: 'ai', content: 'The door is locked.', timestamp: '', assistantMessageId: 102, turnId: 'turn-2' },
        ]
        const config = makeConfig({ selectReply: vi.fn(async () => { throw new Error('conflict') }) })
        renderPanel(config, versions)
        fireEvent.click(screen.getByLabelText('Previous version'))

        expect(await screen.findByText("Couldn't switch to that version. Please try again.")).toBeInTheDocument()
        expect(screen.getByText('The door is locked.')).toBeInTheDocument()
        expect(screen.getByText('Version 2 of 2')).toBeInTheDocument()
    })

    it('shows no version switcher on older exchanges', () => {
        renderPanel(makeConfig(), [
            initialTurns[0],
            { ...initialTurns[1], metadata: { inactive_variant: true } },
            { id: '102', type: 'ai', content: 'The door is locked.', timestamp: '', assistantMessageId: 102 },
            { id: '103', type: 'user', content: 'Knock', timestamp: '' },
            { id: '104', type: 'ai', content: 'Nobody answers.', timestamp: '', assistantMessageId: 104 },
        ])
        // The earlier exchange shows only the version the conversation continued from.
        expect(screen.getByText('The door is locked.')).toBeInTheDocument()
        expect(screen.queryByText('The door opens.')).toBeNull()
        expect(screen.queryByLabelText('Previous version')).toBeNull()
    })

    it('offers regenerate only on the latest reply', () => {
        renderPanel(makeConfig(), [
            ...initialTurns,
            { id: '102', type: 'user', content: 'Step inside', timestamp: '' },
            { id: '103', type: 'ai', content: 'The hall is dark.', timestamp: '', assistantMessageId: 103 },
        ])
        expect(screen.getAllByLabelText('Regenerate')).toHaveLength(1)
    })

    it('hides failed attempts and keeps every stored reply when regenerating', async () => {
        const sendChat = vi.fn()
        hookMocks.useAdventureChatSocket.mockReturnValue({ status: 'open', sendChat, sendTts: vi.fn(), cancel: vi.fn() })
        const seed: TurnEntry[] = [
            initialTurns[0],
            { id: '150', type: 'ai', content: '', timestamp: '', assistantMessageId: 150,
                metadata: { interrupted: true, error_category: 'execution_failed', request_id: 'first' } },
            { ...initialTurns[1], id: '151', assistantMessageId: 151 },
        ]
        const config = makeConfig({ loadTurns: vi.fn(async () => seed) })
        renderPanel(config, seed)
        expect(screen.queryByTestId('unsaved-reply')).toBeNull()
        expect(document.querySelectorAll('article')).toHaveLength(2)

        fireEvent.click(screen.getByLabelText('Regenerate'))
        // The server answers the stored player message again; nothing is deleted.
        await waitFor(() => expect(sendChat).toHaveBeenCalledWith('Open the door', expect.any(String), 100))
        expect(config.deleteMessage).not.toHaveBeenCalled()
    })

    it.each(['adventure', 'character'] as const)('keeps one stored user message after a failed %s turn, retry, and reload', async (kind) => {
        let handlers: import('../hooks/useAdventureChatSocket').AdventureChatHandlers = {}
        let stored: TurnEntry[] = []
        let nextId = 100
        const sendChat = vi.fn((content: string, requestId: string, existingUserMessageId?: number) => {
            const user = stored.find((turn) => turn.id === String(existingUserMessageId)) ?? {
                id: String(nextId++), type: 'user' as const, content, timestamp: '',
            }
            if (!stored.includes(user)) stored.push(user)
            const assistant: TurnEntry = {
                id: String(nextId++), type: 'ai', content: '', timestamp: '', isStreaming: true,
            }
            stored.push(assistant)
            assistant.assistantMessageId = Number(assistant.id)
            assistant.turnId = `turn-${assistant.id}`
            handlers.onTurnStarted?.({
                type: 'turn_started', request_id: requestId, user_message_id: Number(user.id),
                assistant_message_id: Number(assistant.id), turn_id: assistant.turnId,
            })
        })
        hookMocks.useAdventureChatSocket.mockImplementation((_sessionId: unknown, h: typeof handlers) => {
            handlers = h
            return { status: 'open', sendChat, sendTts: vi.fn(), cancel: vi.fn() }
        })
        const config = makeConfig({
            kind, basePath: kind === 'character' ? 'character-chats' : 'adventure-sessions',
            loadTurns: vi.fn(async () => stored.map((turn) => ({ ...turn }))),
            deleteMessage: vi.fn(async (_sessionId, messageId) => {
                stored = stored.filter((turn) => turn.id !== String(messageId))
                return [...stored]
            }),
        })
        const view = renderPanel(config, [])
        await waitFor(() => expect(config.loadTurns).toHaveBeenCalledOnce())
        fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Open the door' } })
        fireEvent.click(screen.getByLabelText('Send message'))
        act(() => {
            // The server stores a failed reply empty, outside the model's context.
            Object.assign(stored[1], { isStreaming: false, metadata: { interrupted: true, error_category: 'execution_failed' } })
            handlers.onError?.('Generation failed', {})
        })
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
        await waitFor(() => expect(sendChat).toHaveBeenCalledTimes(2))
        // The failed attempt stays stored, outside the context, and is not shown.
        expect(config.deleteMessage).not.toHaveBeenCalled()
        expect(sendChat).toHaveBeenLastCalledWith('Open the door', expect.any(String), 100)
        act(() => {
            const assistant = stored[stored.length - 1]
            assistant.content = 'The door opens.'
            assistant.isStreaming = false
            handlers.onDelta?.(assistant.content)
            handlers.onDone?.({
                interrupted: false, userMessageId: 100,
                assistantMessageId: Number(assistant.id), turnId: assistant.turnId,
            })
        })
        // Mount, the pre-regenerate sync, then the post-done reconciliation.
        await waitFor(() => expect(config.loadTurns).toHaveBeenCalledTimes(3))
        view.unmount()
        renderPanel(config, stored.map((turn) => ({ ...turn })))
        await waitFor(() => expect(config.loadTurns).toHaveBeenCalledTimes(4))
        expect(screen.getAllByText('Open the door')).toHaveLength(1)
        expect(screen.getByText('The door opens.')).toBeInTheDocument()
        expect(screen.queryByTestId('unsaved-reply')).toBeNull()
        expect(stored.map((turn) => [turn.type, turn.id])).toEqual([['user', '100'], ['ai', '101'], ['ai', '102']])
    })

    it('keeps the reply and skips generation when the conversation cannot be read first', async () => {
        const sendChat = vi.fn()
        hookMocks.useAdventureChatSocket.mockReturnValue({ status: 'open', sendChat, sendTts: vi.fn(), cancel: vi.fn() })
        const config = makeConfig({ loadTurns: vi.fn(async () => { throw new Error('offline') }) })

        renderPanel(config)
        fireEvent.click(screen.getByLabelText('Regenerate'))

        expect(await screen.findByText('Could not write another reply. Please try again.')).toBeInTheDocument()
        expect(sendChat).not.toHaveBeenCalled()
        expect(screen.getByText('The door opens.')).toBeInTheDocument()
    })

    it.each([true, false])('keeps the reply when a regeneration fails and tries again as another version (acknowledged: %s)', async (acknowledged) => {
        let handlers: import('../hooks/useAdventureChatSocket').AdventureChatHandlers = {}
        const sendChat = vi.fn()
        hookMocks.useAdventureChatSocket.mockImplementation((_sessionId: unknown, h: typeof handlers) => {
            handlers = h
            return { status: 'open', sendChat, sendTts: vi.fn(), cancel: vi.fn() }
        })
        const config = makeConfig()
        renderPanel(config)
        fireEvent.click(screen.getByLabelText('Regenerate'))
        await waitFor(() => expect(sendChat).toHaveBeenCalledOnce())
        act(() => {
            if (acknowledged) handlers.onTurnStarted?.({
                type: 'turn_started', user_message_id: 100, assistant_message_id: 201, turn_id: 'retry-turn',
            })
            handlers.onError?.('Generation failed', {})
        })
        // A failed version changes nothing: the current reply is still the one in context.
        expect(screen.getByText('The door opens.')).toBeInTheDocument()
        expect(screen.queryByText('Version 1 of 1')).toBeNull()
        expect(screen.getByTestId('unsaved-reply')).toHaveTextContent("Game Master couldn't finish this reply")
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
        await waitFor(() => expect(sendChat).toHaveBeenCalledTimes(2))
        expect(config.deleteMessage).not.toHaveBeenCalled()
        expect(sendChat).toHaveBeenLastCalledWith('Open the door', expect.any(String), 100)
        expect(sendChat.mock.calls[1][1]).not.toBe(sendChat.mock.calls[0][1])
    })

    it('reuses a trailing stored user message when requesting its missing reply', async () => {
        const sendChat = vi.fn()
        hookMocks.useAdventureChatSocket.mockReturnValue({ status: 'open', sendChat, sendTts: vi.fn(), cancel: vi.fn() })
        renderPanel(makeConfig(), [initialTurns[0]])
        fireEvent.click(screen.getByRole('button', { name: 'Generate Response' }))
        await waitFor(() => expect(sendChat).toHaveBeenCalledWith('Open the door', expect.any(String), 100))
    })

    it('treats an intentionally repeated user message as new input', async () => {
        const sendChat = vi.fn()
        hookMocks.useAdventureChatSocket.mockReturnValue({ status: 'open', sendChat, sendTts: vi.fn(), cancel: vi.fn() })
        renderPanel(makeConfig())
        fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Open the door' } })
        fireEvent.click(screen.getByLabelText('Send message'))
        await waitFor(() => expect(sendChat).toHaveBeenCalledWith('Open the door', expect.any(String)))
    })

    it('keeps speaker portraits when post-done hydration returns segments without image_url', async () => {
        let handlers: { onSpeakers: Function; onSegments: Function; onDone: Function } | undefined
        const sendChat = vi.fn()
        hookMocks.useAdventureChatSocket.mockImplementation((_sessionId: unknown, h: never) => {
            handlers = h
            return { status: 'open', sendChat, sendTts: vi.fn(), cancel: vi.fn() }
        })
        // The persisted projection strips image_url from segments — only the
        // roster (seed or live frame) knows the portraits.
        const hydratedTurns: TurnEntry[] = [
            { id: '100', type: 'user', content: 'Look around', timestamp: '2026-06-04T00:00:00', turnId: 'turn-9' },
            {
                id: '999',
                type: 'ai',
                content: 'Aria: Who goes there?',
                timestamp: '2026-06-04T00:00:01',
                assistantMessageId: 999,
                turnId: 'turn-9',
                segments: [{ kind: 'speech', speaker_id: 'aria', speaker_name: 'Aria', content: 'Who goes there?' }],
            } as TurnEntry,
        ]
        const loadTurns = vi.fn()
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce(hydratedTurns)

        renderPanel(makeConfig({ loadTurns }), [], 7, [
            { speaker_id: 'aria', name: 'Aria', image_url: '/portraits/aria.png', has_voice: true },
        ])
        await waitFor(() => expect(loadTurns).toHaveBeenCalledTimes(1))

        fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Look around' } })
        fireEvent.click(screen.getByLabelText('Send message'))
        await waitFor(() => expect(sendChat).toHaveBeenCalled())

        act(() => {
            handlers!.onSpeakers({
                roster: [{ speaker_id: 'aria', name: 'Aria', image_url: '/portraits/aria.png', has_voice: true }],
                narrator: { name: 'Game Master', image_url: null, kind: 'narrator' },
            })
            handlers!.onSegments({
                responseFormat: 'mw_xml_v1',
                segments: [{ kind: 'speech', speaker_id: 'aria', speaker_name: 'Aria', content: 'Who goes there?' }],
                displayText: 'Aria: Who goes there?',
            })
            handlers!.onDone({ interrupted: false, userMessageId: 100, assistantMessageId: 999, turnId: 'turn-9' })
        })

        await waitFor(() => expect(loadTurns).toHaveBeenCalledTimes(2))
        expect(screen.getByText('Who goes there?')).toBeInTheDocument()
        expect(screen.getByRole('img', { name: 'Aria' })).toHaveAttribute('src', '/portraits/aria.png')
    })

    it('resolves speaker portraits for hydrated turns at mount (reload)', () => {
        const seed: TurnEntry[] = [
            { id: '100', type: 'user', content: 'Hello', timestamp: '2026-06-04T00:00:00', turnId: 'turn-1' },
            {
                id: '101',
                type: 'ai',
                content: 'Aria: Well met.',
                timestamp: '2026-06-04T00:00:01',
                assistantMessageId: 101,
                turnId: 'turn-1',
                segments: [{ kind: 'speech', speaker_id: 'aria', speaker_name: 'Aria', content: 'Well met.' }],
            } as TurnEntry,
        ]

        renderPanel(makeConfig(), seed, 7, [
            { speaker_id: 'aria', name: 'Aria', image_url: '/portraits/aria.png', has_voice: true },
        ])

        expect(screen.getByText('Well met.')).toBeInTheDocument()
        expect(screen.getByRole('img', { name: 'Aria' })).toHaveAttribute('src', '/portraits/aria.png')
    })

    it('renders character-chat suggestions and generated image lifecycle from turn metadata', () => {
        const config = makeConfig({
            kind: 'character',
            basePath: 'character-chats',
            aiLabel: 'Lyra',
            showForwardOptions: true,
            showImages: true,
        })
        const seed: TurnEntry[] = [
            {
                id: '201',
                type: 'ai',
                content: 'The mirror catches candlelight.',
                timestamp: '2026-06-04T00:00:01',
                assistantMessageId: 201,
                turnId: 'turn-char-1',
                forwardOptions: [{ label: 'Ask about the mirror', message: 'What do you see in the mirror?' }],
                imagePrompt: 'A candlelit mirror in a fantasy parlor.',
                imageGenerations: [{ job_id: 'img-char-1', status: 'in_progress', assets: [] }],
            } as TurnEntry,
        ]

        renderPanel(config, seed)

        expect(screen.getByText('The mirror catches candlelight.')).toBeInTheDocument()
        expect(screen.getByText('Suggested Actions')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /ask about the mirror/i })).toBeInTheDocument()
        expect(screen.getByText('Generating image…')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /ask about the mirror/i }))
        expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('What do you see in the mirror?')
        expect(screen.getByRole('textbox', { name: 'Message' })).toHaveFocus()
        const socketResult = hookMocks.useAdventureChatSocket.mock.results[hookMocks.useAdventureChatSocket.mock.results.length - 1]
        expect(socketResult.value.sendChat).not.toHaveBeenCalled()
    })

    it('keeps the suggested-actions toggle removed and sends stored chat content with the default image choice', async () => {
        const sendChat = vi.fn()
        hookMocks.useAdventureChatSocket.mockReturnValue({
            status: 'open',
            sendChat,
            sendTts: vi.fn(),
            cancel: vi.fn(),
        })

        renderPanel(makeConfig(), [])

        expect(screen.queryByRole('button', { name: /suggested actions/i })).not.toBeInTheDocument()

        fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Look around' } })
        fireEvent.click(screen.getByLabelText('Send message'))

        await waitFor(() => expect(sendChat).toHaveBeenCalled())
        expect(sendChat).toHaveBeenCalledWith('Look around', expect.any(String))
    })
    it('keeps polling scene images while visible but unfocused, and pauses them while hidden', async () => {
        hookMocks.pageFocused = false
        const seed: TurnEntry[] = [{
            id: '201',
            type: 'ai',
            content: 'The mirror catches candlelight.',
            timestamp: '2026-06-04T00:00:01',
            assistantMessageId: 201,
            turnId: 'turn-char-1',
            imageGenerations: [{ job_id: 'img-char-1', status: 'in_progress', assets: [] }],
        }]
        const loadTurns = vi.fn(async () => seed)
        const getImageJob = vi.spyOn(apiService, 'getImageJob').mockResolvedValue({
            job_id: 'img-char-1',
            status: 'in_progress',
            status_url: '',
            result_url: '',
        })
        vi.useFakeTimers()
        renderPanel(makeConfig({ loadTurns }), seed)

        await act(async () => { await vi.advanceTimersByTimeAsync(2_000) })
        // Text hydration still waits for focus; the image poll does not.
        expect(loadTurns).not.toHaveBeenCalled()
        expect(getImageJob).toHaveBeenCalledTimes(1)

        hookMocks.pageVisible = false
        fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Hidden now' } })
        await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
        expect(getImageJob).toHaveBeenCalledTimes(1)

        hookMocks.pageVisible = true
        fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Visible again' } })
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        expect(getImageJob).toHaveBeenCalledTimes(2)
    })


    it('keeps image and narration polling single-flight during slow responses', async () => {
        const seed: TurnEntry[] = [{
            id: '201',
            type: 'ai',
            content: 'The mirror catches candlelight.',
            timestamp: '2026-06-04T00:00:01',
            assistantMessageId: 201,
            turnId: 'turn-char-1',
            imageGenerations: [{ job_id: 'img-char-1', status: 'in_progress', assets: [] }],
            ttsStatus: 'in_progress',
            ttsJobId: 'tts-char-1',
        }]
        const imageResult = { job_id: 'img-char-1', status: 'in_progress' as const, status_url: '', result_url: '' }
        const ttsResult = { job_id: 'tts-char-1', status: 'in_progress' as const, status_url: '', result_url: '' }
        let finishImage!: (value: typeof imageResult) => void
        let finishTts!: (value: typeof ttsResult) => void
        const getImageJob = vi.spyOn(apiService, 'getImageJob')
            .mockImplementationOnce(() => new Promise((resolve) => { finishImage = resolve }))
            .mockResolvedValue(imageResult)
        const getTtsJob = vi.spyOn(apiService, 'getTtsJob')
            .mockImplementationOnce(() => new Promise((resolve) => { finishTts = resolve }))
            .mockResolvedValue(ttsResult)
        vi.useFakeTimers()
        renderPanel(makeConfig({ loadTurns: vi.fn(async () => seed) }), seed)

        await act(async () => { await vi.advanceTimersByTimeAsync(12_000) })
        expect(getImageJob).toHaveBeenCalledTimes(1)
        expect(getTtsJob).toHaveBeenCalledTimes(1)

        await act(async () => {
            finishImage(imageResult)
            finishTts(ttsResult)
        })
        // The image backs off 4 s after its first answer; narration keeps its 3 s interval.
        await act(async () => { await vi.advanceTimersByTimeAsync(4_000) })
        expect(getImageJob).toHaveBeenCalledTimes(2)
        expect(getTtsJob).toHaveBeenCalledTimes(2)
    })


    it('stops a sequential media scan before its next job when the page goes away mid-request', async () => {
        const seed: TurnEntry[] = [201, 202].map((id) => ({
            id: String(id),
            type: 'ai',
            content: 'The mirror catches candlelight.',
            timestamp: '2026-06-04T00:00:01',
            assistantMessageId: id,
            turnId: 'turn-char-1',
            imageGenerations: [{ job_id: 'img-char-' + id, status: 'in_progress', assets: [] }],
            ttsStatus: 'in_progress',
            ttsJobId: 'tts-char-' + id,
        }))
        const imageResult = { job_id: 'img-char-201', status: 'in_progress' as const, status_url: '', result_url: '' }
        const ttsResult = { job_id: 'tts-char-201', status: 'in_progress' as const, status_url: '', result_url: '' }
        let finishImage!: (value: typeof imageResult) => void
        let finishTts!: (value: typeof ttsResult) => void
        const getImageJob = vi.spyOn(apiService, 'getImageJob')
            .mockImplementationOnce(() => new Promise((resolve) => { finishImage = resolve }))
            .mockResolvedValue(imageResult)
        const getTtsJob = vi.spyOn(apiService, 'getTtsJob')
            .mockImplementationOnce(() => new Promise((resolve) => { finishTts = resolve }))
            .mockResolvedValue(ttsResult)
        vi.useFakeTimers()
        renderPanel(makeConfig({ loadTurns: vi.fn(async () => seed) }), seed)

        await act(async () => { await vi.advanceTimersByTimeAsync(3_000) })
        expect(getImageJob).toHaveBeenCalledTimes(1)
        expect(getTtsJob).toHaveBeenCalledTimes(1)

        // This changes the live readings before React cleans up either poller.
        hookMocks.pageFocused = false
        hookMocks.pageVisible = false
        await act(async () => {
            finishImage(imageResult)
            finishTts(ttsResult)
        })
        expect(getImageJob).toHaveBeenCalledTimes(1)
        expect(getTtsJob).toHaveBeenCalledTimes(1)
    })

    it('carries a scene image from "starting" to painted, regenerates it and pages between both', async () => {
        type Handler = (...args: unknown[]) => void
        let handlers: { onTurnStarted: Handler; onDelta: Handler; onDone: Handler; onImageJob: Handler; onImageComplete: Handler } | undefined
        const sendChat = vi.fn()
        hookMocks.useAdventureChatSocket.mockImplementation((_sessionId: unknown, h: never) => {
            handlers = h
            return { status: 'open', capabilities: { chat_image_request: true, chat_images: true }, sendChat, sendTts: vi.fn(), cancel: vi.fn() }
        })
        vi.spyOn(apiService, 'getImageJob').mockImplementation(async (jobId) => ({ job_id: jobId, status: 'in_progress', status_url: '', result_url: '' }))
        const generate = vi.spyOn(apiService, 'generateChatMessageImage').mockResolvedValue({
            job_id: 'img-2', status: 'pending', assets: [], trigger: 'regenerate', image_profile_id: 'prof-1', created_at: '2026-06-04T00:05:00Z',
        })
        const projection: TurnEntry[] = [
            ...initialTurns,
            { id: '102', type: 'user', content: 'Look around', timestamp: '2026-06-04T00:00:02', turnId: 'turn-2' },
            { id: '103', type: 'ai', content: 'The hall glows.', timestamp: '2026-06-04T00:00:03', assistantMessageId: 103, turnId: 'turn-2' },
        ]
        const loadTurns = vi.fn(async () => projection)
        renderPanel(makeConfig({ loadTurns }))

        fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Look around' } })
        fireEvent.click(screen.getByLabelText('Send message'))
        await waitFor(() => expect(sendChat).toHaveBeenCalled())
        act(() => {
            handlers!.onTurnStarted({ type: 'turn_started', user_message_id: 102, assistant_message_id: 103, turn_id: 'turn-2' })
            handlers!.onDelta('The hall glows.')
            handlers!.onDone({ interrupted: false, userMessageId: 102, assistantMessageId: 103, turnId: 'turn-2', imageScheduled: true })
        })
        // The placeholder appears as the reply finishes, before any image frame.
        expect(await screen.findByText('Starting image generation…')).toBeInTheDocument()

        // Frames carry ids and status only.
        act(() => handlers!.onImageJob({ type: 'image_job', adventure_id: 7, assistant_message_id: 103, turn_id: 'turn-2', job_id: 'img-1', status: 'pending', status_url: '', result_url: '' }))
        expect(screen.getByText('Image queued…')).toBeInTheDocument()
        act(() => handlers!.onImageComplete({ type: 'image_complete', adventure_id: 7, assistant_message_id: 103, turn_id: 'turn-2', job_id: 'img-1', status: 'completed',
            assets: [{ asset_id: 'a1', url: '/generated-images/a1.png', content_type: 'image/png' }] }))
        const first = screen.getByRole('img', { name: 'Generated scene' })
        expect(first).toHaveAttribute('src', '/generated-images/a1.png')
        // The earlier reply never picked up this turn's image.
        expect(screen.getAllByRole('img', { name: 'Generated scene' })).toHaveLength(1)
        fireEvent.load(first)

        fireEvent.click(screen.getByRole('button', { name: 'Regenerate image' }))
        await waitFor(() => expect(generate).toHaveBeenCalledWith('adventure-sessions', 7, 103, {}))
        expect(await screen.findByText('Image 2 of 2')).toBeInTheDocument()
        expect(screen.getByText('Image queued…')).toBeInTheDocument()

        // Paging back while the new one is generating shows the first image again.
        fireEvent.click(screen.getByRole('button', { name: 'Previous image' }))
        expect(screen.getByText('Image 1 of 2')).toBeInTheDocument()
        expect(screen.getByRole('img', { name: 'Generated scene' })).toHaveAttribute('src', '/generated-images/a1.png')
    })

    it('asks for the provider key before regenerating a personal-key image', async () => {
        const generate = vi.spyOn(apiService, 'generateChatMessageImage')
        const seed: TurnEntry[] = [
            initialTurns[0],
            { ...initialTurns[1], imageGenerations: [{ job_id: 'img-1', status: 'completed', image_profile_id: 'prof-byok', provider: 'fal', credential_mode: 'user_byok',
                assets: [{ asset_id: 'a1', url: '/generated-images/a1.png', content_type: 'image/png' }] }] },
        ]
        renderPanel(makeConfig(), seed)
        fireEvent.load(screen.getByRole('img', { name: 'Generated scene' }))
        fireEvent.click(screen.getByRole('button', { name: 'Regenerate image' }))
        expect(await screen.findByRole('dialog', { name: /fal/i })).toBeInTheDocument()
        expect(generate).not.toHaveBeenCalled()
    })

    it('keeps a reply\'s scene images when its text is edited', async () => {
        const seed: TurnEntry[] = [
            initialTurns[0],
            { ...initialTurns[1], imageGenerations: [{ job_id: 'img-1', status: 'completed', assets: [{ asset_id: 'a1', url: '/generated-images/a1.png', content_type: 'image/png' }] }] },
        ]
        // The edit's projection comes from a server that leaves images out of it.
        const updateMessage = vi.fn(async () => [initialTurns[0], { ...initialTurns[1], content: 'The door swings wide.' }])
        renderPanel(makeConfig({ updateMessage }), seed)
        expect(screen.getByRole('img', { name: 'Generated scene' })).toBeInTheDocument()

        const reply = screen.getByText('The door opens.').closest('article')!
        fireEvent.click(within(reply).getByRole('button', { name: 'Edit message' }))
        fireEvent.change(within(reply).getByRole('textbox'), { target: { value: 'The door swings wide.' } })
        fireEvent.click(within(reply).getByRole('button', { name: 'Save' }))

        await waitFor(() => expect(updateMessage).toHaveBeenCalledWith(7, 101, 'The door swings wide.'))
        expect(await screen.findByText('The door swings wide.')).toBeInTheDocument()
        expect(screen.getByRole('img', { name: 'Generated scene' })).toHaveAttribute('src', '/generated-images/a1.png')
    })

    it('sends turns with the scene image model picked in the composer', async () => {
        const sendChat = vi.fn()
        hookMocks.useAdventureChatSocket.mockReturnValue({ status: 'open', capabilities: { chat_image_request: true, chat_images: true }, sendChat, sendTts: vi.fn(), cancel: vi.fn() })
        renderPanel(makeConfig())

        fireEvent.click(await screen.findByRole('button', { name: 'Scene image model: Default · Krea 2 Turbo' }))
        fireEvent.click(within(screen.getByRole('dialog', { name: 'Scene image model' })).getByRole('combobox'))
        fireEvent.click(await screen.findByRole('option', { name: /GPT Image 2.5 Flare/ }))
        fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Look around' } })
        fireEvent.click(screen.getByLabelText('Send message'))

        await waitFor(() => expect(sendChat).toHaveBeenCalledWith('Look around', expect.any(String), undefined, undefined, false,
            { generate: true, image_profile_id: gptProfile.profile_id }))
    })

    it('turns scene images off for this chat from the composer', async () => {
        const sendChat = vi.fn()
        hookMocks.useAdventureChatSocket.mockReturnValue({ status: 'open', capabilities: { chat_image_request: true, chat_images: true }, sendChat, sendTts: vi.fn(), cancel: vi.fn() })
        renderPanel(makeConfig())

        fireEvent.click(screen.getByRole('button', { name: 'Generated images on' }))
        expect(screen.getByRole('button', { name: 'Generated images off' })).toHaveAttribute('aria-pressed', 'false')
        expect(screen.queryByRole('button', { name: /Scene image model/ })).toBeNull()
        expect(JSON.parse(localStorage.getItem('mw:chat-image:adventure:7')!)).toEqual({ enabled: false, profileId: null })

        fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Look around' } })
        fireEvent.click(screen.getByLabelText('Send message'))
        await waitFor(() => expect(sendChat).toHaveBeenCalledWith('Look around', expect.any(String), undefined, undefined, false, { generate: false }))
    })

    it('hides the image control when the server has no image engine', () => {
        hookMocks.useAdventureChatSocket.mockReturnValue({ status: 'open', capabilities: { chat_image_request: true, chat_images: false }, sendChat: vi.fn(), sendTts: vi.fn(), cancel: vi.fn() })
        renderPanel(makeConfig())
        expect(screen.queryByRole('button', { name: /Generated images/ })).toBeNull()
    })

    it('opens an image\'s prompt and model, and regenerates an edited prompt on another model', async () => {
        const generate = vi.spyOn(apiService, 'generateChatMessageImage').mockResolvedValue({
            job_id: 'img-2', status: 'pending', assets: [], trigger: 'regenerate', image_profile_id: gptProfile.profile_id, created_at: '2026-06-04T00:05:00Z',
        })
        const seed: TurnEntry[] = [
            initialTurns[0],
            { ...initialTurns[1], imageGenerations: [{ job_id: 'img-1', status: 'completed', trigger: 'auto', prompt: 'A heavy oak door creaks open.',
                image_profile_id: kreaProfile.profile_id, model_display_name: 'Krea 2 Turbo', credit_cost: 1,
                assets: [{ asset_id: 'a1', url: '/generated-images/a1.png', content_type: 'image/png' }] }] },
        ]
        renderPanel(makeConfig(), seed)
        await screen.findByRole('button', { name: /Scene image model/ })
        fireEvent.load(screen.getByRole('img', { name: 'Generated scene' }))

        fireEvent.click(screen.getByRole('button', { name: 'Image details' }))
        const dialog = screen.getByRole('dialog', { name: 'Scene image' })
        const prompt = within(dialog).getByRole('textbox', { name: 'Scene prompt' })
        expect(prompt).toHaveValue('A heavy oak door creaks open.')
        fireEvent.change(prompt, { target: { value: 'The door bursts into splinters.' } })
        fireEvent.click(within(dialog).getByRole('combobox'))
        fireEvent.click(await screen.findByRole('option', { name: /GPT Image 2.5 Flare/ }))
        fireEvent.click(within(dialog).getByRole('button', { name: 'Regenerate · 3 credits' }))

        await waitFor(() => expect(generate).toHaveBeenCalledWith('adventure-sessions', 7, 101,
            { prompt: 'The door bursts into splinters.', image_profile_id: gptProfile.profile_id }))
        expect(screen.queryByRole('dialog', { name: 'Scene image' })).toBeNull()
        expect(await screen.findByText('Image 2 of 2')).toBeInTheDocument()
    })

    it('defers interrupted-turn recovery until the page regains focus', async () => {
        hookMocks.pageFocused = false
        let handlers: { onConnectionLost: () => void } | undefined
        hookMocks.useAdventureChatSocket.mockImplementation((_sessionId: unknown, callbacks: never) => {
            handlers = callbacks
            return { status: 'open', sendChat: vi.fn(), sendTts: vi.fn(), cancel: vi.fn() }
        })
        const loadTurns = vi.fn(async () => [])
        vi.useFakeTimers()
        renderPanel(makeConfig({ loadTurns }), [])

        fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Look around' } })
        fireEvent.click(screen.getByLabelText('Send message'))
        act(() => handlers!.onConnectionLost())
        await act(async () => { vi.advanceTimersByTime(6_000) })
        expect(loadTurns).not.toHaveBeenCalled()

        hookMocks.pageFocused = true
        fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Back on this tab' } })
        await act(async () => {})
        expect(loadTurns).toHaveBeenCalledTimes(1)

        await act(async () => { vi.advanceTimersByTime(2_000) })
        expect(loadTurns).toHaveBeenCalledTimes(2)
    })


    describe('retained history after reload', () => {
        const parent = '44444444-4444-4444-8444-444444444444'
        const child = '55555555-5555-4555-8555-555555555555'
        const seed: TurnEntry[] = [
            { id: '100', type: 'user', content: 'Open the door', timestamp: '', turnId: parent, metadata: { request_id: 'original' } },
            { id: '101', type: 'ai', content: '', timestamp: '', assistantMessageId: 101, turnId: parent,
                metadata: { request_id: 'original', interrupted: true, error_category: 'execution_failed' } },
        ]
        const command = { content: 'Open the door', existing_user_message_id: null, llm: { selection: { mode: 'inherit' as const } } }

        it.each(['adventure', 'character'] as const)('answers a confirmed %s failure anew and keeps the attempt stored', async kind => {
            const sendChat = vi.fn(), observe = vi.fn()
            hookMocks.useAdventureChatSocket.mockReturnValue({ status: 'open', sendChat, sendTts: vi.fn(), cancel: vi.fn() })
            vi.mocked(apiService.reconcileChatTurn).mockResolvedValueOnce({ status: 'failed', request_id: 'original', execution_id: parent,
                recovery_required: true, dispatch: command })
            const config = makeConfig({ kind, basePath: kind === 'adventure' ? 'adventure-sessions' : 'character-chats', loadTurns: vi.fn(async () => seed) })
            renderPanel(config, seed, 7, undefined, observe)
            // A failed reply is a notice, not a message with its own actions.
            expect(screen.queryByLabelText('Regenerate')).toBeNull()
            fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
            await waitFor(() => expect(sendChat).toHaveBeenCalledOnce())
            expect(sendChat).toHaveBeenCalledWith('Open the door', expect.any(String), 100)
            expect(sendChat.mock.calls[0][1]).not.toBe('original')
            expect(config.deleteMessage).not.toHaveBeenCalled()
            const latest = observe.mock.calls[observe.mock.calls.length - 1][0] as TurnEntry[]
            expect(latest.map((turn) => turn.type)).toEqual(['user', 'ai', 'ai'])
            expect(latest[2].isStreaming).toBe(true)
            expect(screen.queryByTestId('unsaved-reply')).toBeNull()
        })

        it('recovers a pending child with its original request and tuple after reload', async () => {
            const sendChat = vi.fn()
            hookMocks.useAdventureChatSocket.mockReturnValue({ status: 'open', sendChat, sendTts: vi.fn(), cancel: vi.fn() })
            const pending: TurnEntry[] = [...seed, { id: '102', type: 'ai', content: '', timestamp: '', assistantMessageId: 102,
                turnId: child, metadata: { request_id: 'child-request', interrupted: true } }]
            const target = { selection: { mode: 'inherit' as const }, retry_of_execution_id: parent }
            vi.mocked(apiService.reconcileChatTurn).mockResolvedValueOnce({ status: 'running', request_id: 'child-request', execution_id: child,
                recovery_required: true, dispatch: { ...command, llm: target } })
            const config = makeConfig({ loadTurns: vi.fn(async () => pending) })
            renderPanel(config, pending)
            // Only the latest attempt surfaces, as a single notice.
            expect(screen.getAllByTestId('unsaved-reply')).toHaveLength(1)
            fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
            await waitFor(() => expect(sendChat).toHaveBeenCalledOnce())
            expect(sendChat).toHaveBeenCalledWith('Open the door', 'child-request', undefined, target, true)
            expect(config.deleteMessage).not.toHaveBeenCalled()
            expect(screen.getAllByText('Open the door')).toHaveLength(1)
        })

        it('does not send after a retry lookup was canceled', async () => {
            const sendChat = vi.fn()
            hookMocks.useAdventureChatSocket.mockReturnValue({ status: 'open', sendChat, sendTts: vi.fn(), cancel: vi.fn() })
            let finish!: (value: Awaited<ReturnType<typeof apiService.reconcileChatTurn>>) => void
            let signal: AbortSignal | undefined
            vi.mocked(apiService.reconcileChatTurn).mockImplementationOnce((_base, _id, _request, received) => {
                signal = received; return new Promise(resolve => { finish = resolve })
            })
            const config = makeConfig({ loadTurns: vi.fn(async () => seed) })
            renderPanel(config, seed)
            fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
            await waitFor(() => expect(signal).toBeDefined())
            await act(async () => { await new Promise(resolve => setTimeout(resolve, 25)) })
            fireEvent.click(screen.getByLabelText('Stop response'))
            expect(signal?.aborted).toBe(true)
            await act(async () => finish({ status: 'failed', request_id: 'original', execution_id: parent, recovery_required: true, dispatch: command }))
            expect(sendChat).not.toHaveBeenCalled(); expect(config.deleteMessage).not.toHaveBeenCalled()
        })
    })

    describe('same-request recovery', () => {
        function sendFirstTurn() {
            let handlers: import('../hooks/useAdventureChatSocket').AdventureChatHandlers = {}
            const sendChat = vi.fn()
            hookMocks.useAdventureChatSocket.mockImplementation((_sessionId: unknown, h: typeof handlers) => {
                handlers = h
                return { status: 'open', sendChat, sendTts: vi.fn(), cancel: vi.fn() }
            })
            const config = makeConfig()
            renderPanel(config, [])
            fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Open the door' } })
            fireEvent.click(screen.getByLabelText('Send message'))
            const requestId = sendChat.mock.calls[0][1] as string
            act(() => handlers.onTurnStarted?.({ type: 'turn_started', request_id: requestId, user_message_id: 100, assistant_message_id: 201, turn_id: 'turn-1' }))
            return { handlers: () => handlers, sendChat, config, requestId }
        }

        it('resumes an unfinished turn with its request ID and original frame, deleting nothing', async () => {
            const { handlers, sendChat, config, requestId } = sendFirstTurn()
            act(() => handlers().onError?.('Chat execution requires recovery.', { category: 'conflict', code: 'LLM_EXECUTION_RECOVERY_REQUIRED', requestId }))
            expect(screen.getByText('The connection dropped before the result arrived. Try again to recover it without running it twice.')).toBeInTheDocument()
            vi.mocked(apiService.reconcileChatTurn).mockResolvedValueOnce({ status: 'running', request_id: requestId, execution_id: '44444444-4444-4444-8444-444444444444', recovery_required: true, dispatch: { content: 'Open the door', existing_user_message_id: null, llm: { selection: { mode: 'inherit' } } } })

            fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
            await waitFor(() => expect(sendChat).toHaveBeenCalledTimes(2))
            expect(apiService.reconcileChatTurn).toHaveBeenCalledWith('adventure-sessions', 7, requestId, expect.any(AbortSignal))
            expect(sendChat.mock.calls[1]).toEqual(['Open the door', requestId, undefined, { selection: { mode: 'inherit' } }, true])
            expect(config.deleteMessage).not.toHaveBeenCalled()
        })

        it('follows a turn that is still running instead of starting it again', async () => {
            const { handlers, sendChat, requestId } = sendFirstTurn()
            act(() => handlers().onConnectionLost?.())
            vi.mocked(apiService.reconcileChatTurn).mockResolvedValueOnce({ status: 'running', request_id: requestId, execution_id: '44444444-4444-4444-8444-444444444444', recovery_required: false, dispatch: { content: 'Open the door', existing_user_message_id: null, llm: { selection: { mode: 'inherit' } } } })

            fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
            expect(await screen.findByText('This request is still running. Wait a moment, then try again to pick up its result.')).toBeInTheDocument()
            expect(sendChat).toHaveBeenCalledOnce()
        })

        it('starts a fresh reply in the same slot once the spent turn is confirmed', async () => {
            const { handlers, sendChat, config, requestId } = sendFirstTurn()
            act(() => handlers().onError?.('Chat execution failed.', { category: 'conflict', code: 'LLM_EXECUTION_FINISHED', requestId }))

            fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
            await waitFor(() => expect(sendChat).toHaveBeenCalledTimes(2))
            expect(apiService.reconcileChatTurn).toHaveBeenCalledOnce()
            expect(config.deleteMessage).not.toHaveBeenCalled()
            expect(sendChat.mock.calls[1]).toEqual(['Open the door', expect.any(String), 100])
            expect(sendChat.mock.calls[1][1]).not.toBe(requestId)
        })

        it('shows a stopped reply as a notice without a connection error', async () => {
            const { handlers } = sendFirstTurn()
            act(() => {
                handlers().onDelta?.('The door creaks')
                handlers().onDone?.({ interrupted: true, userMessageId: 100, assistantMessageId: 201, turnId: 'turn-1' })
            })
            const notice = await screen.findByTestId('unsaved-reply')
            expect(notice).toHaveTextContent('You stopped this reply')
            expect(screen.queryByText('The door creaks')).toBeNull()
            expect(screen.queryByRole('alert')).toBeNull()
        })
    })

    describe('Workspace R1', () => {
        function captureHandlers(sendChat = vi.fn()) {
            const ref: { current: import('../hooks/useAdventureChatSocket').AdventureChatHandlers } = { current: {} }
            hookMocks.useAdventureChatSocket.mockImplementation((_sessionId: unknown, h: typeof ref.current) => {
                ref.current = h
                return { status: 'open', sendChat, sendTts: vi.fn(), cancel: vi.fn() }
            })
            return ref
        }

        it('turns an archived workspace into a read-only notice instead of a failure with retry', async () => {
            const sendChat = vi.fn()
            const handlers = captureHandlers(sendChat)
            renderPanel(makeConfig())
            fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Open the gate' } })
            fireEvent.click(screen.getByLabelText('Send message'))
            await waitFor(() => expect(sendChat).toHaveBeenCalledOnce())

            act(() => handlers.current.onError?.('Workspace archived.', { category: 'conflict', code: 'WORKSPACE_ARCHIVED', requestId: sendChat.mock.calls[0][1] }))

            const notice = await screen.findByTestId('chat-read-only')
            expect(notice).toHaveTextContent('This workspace is archived. Restore it to continue the conversation.')
            expect(screen.queryByLabelText('Message')).toBeNull()
            expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
            expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
            expect(screen.queryByRole('alert')).toBeNull()
            expect(screen.queryByLabelText('Regenerate')).toBeNull()
        })

        it('explains a conversation the server no longer finds in this workspace', async () => {
            const handlers = captureHandlers()
            renderPanel(makeConfig())
            act(() => handlers.current.onError?.('This conversation is not available in this workspace.', { category: 'not_found', code: 'CHAT_SESSION_NOT_FOUND' }))

            expect(await screen.findByTestId('chat-read-only')).toHaveTextContent('This conversation is not available in this workspace.')
            expect(screen.queryByText(/reconnecting/i)).toBeNull()
        })

        it('opens a session of an archived workspace read-only', () => {
            workspace = createWorkspaceTestState({
                api: apiService,
                workspaces: [
                    testWorkspace(TEST_WORKSPACE_ID, 'Main library'),
                    testWorkspace(OTHER_WORKSPACE_ID, 'Novel A', { archived_at: '2026-10-02T00:00:00Z' }),
                ],
            })
            renderPanel(makeConfig({ workspaceId: OTHER_WORKSPACE_ID }))

            expect(screen.getByTestId('chat-read-only')).toHaveTextContent('This workspace is archived.')
        })

        it('keeps stored narration playable but stops requesting it in an archived workspace', () => {
            workspace = createWorkspaceTestState({
                api: apiService,
                workspaces: [
                    testWorkspace(TEST_WORKSPACE_ID, 'Main library'),
                    testWorkspace(OTHER_WORKSPACE_ID, 'Novel A', { archived_at: '2026-10-02T00:00:00Z' }),
                ],
            })
            const narrated: TurnEntry[] = [
                ...initialTurns,
                { id: '102', type: 'user', content: 'Listen', timestamp: '2026-06-04T00:00:02' },
                {
                    id: '103',
                    type: 'ai',
                    content: 'A song drifts in.',
                    timestamp: '2026-06-04T00:00:03',
                    assistantMessageId: 103,
                    turnId: 'turn-3',
                    ttsSegments: [{ segment_index: 0, status: 'completed', job_id: 'tts-103', url: '/tts/assets/asset-103.mp3' }],
                },
            ]
            renderPanel(makeConfig({ workspaceId: OTHER_WORKSPACE_ID }), narrated)

            // Only the stored clip offers Play; the turn without audio offers nothing to request.
            expect(screen.getAllByRole('button', { name: 'Play narration' })).toHaveLength(1)
            expect(screen.getByText('AI voice')).toBeInTheDocument()
        })

        it('offers narration requests in an active workspace', () => {
            renderPanel(makeConfig())
            expect(screen.getByRole('button', { name: 'Play narration' })).toBeInTheDocument()
        })

        it('shows the archived notice for a workspace_archived narration refusal', async () => {
            const handlers = captureHandlers()
            renderPanel(makeConfig())
            act(() => handlers.current.onTtsFailed?.({
                type: 'tts_failed',
                adventure_id: 7,
                assistant_message_id: 101,
                turn_id: 'turn-1',
                job_id: null,
                status: 'invalid',
                error: { category: 'invalid', detail: 'Workspace archived.', code: 'workspace_archived', retryable: false },
            }))

            expect(await screen.findByTestId('chat-read-only')).toHaveTextContent('This workspace is archived. Restore it to continue the conversation.')
            expect(screen.queryByText(/Narration failed/)).toBeNull()
            expect(screen.queryByRole('button', { name: 'Play narration' })).toBeNull()
        })

        it('passes the session workspace to the socket and keeps it after a switch', () => {
            const view = renderPanel(makeConfig())
            expect(hookMocks.useAdventureChatSocket).toHaveBeenLastCalledWith(7, expect.any(Object), 'token', 'adventure-sessions', undefined, TEST_WORKSPACE_ID)

            workspace.switchTo(OTHER_WORKSPACE_ID)
            view.rerenderWorkspace()
            // The hook closes it because the session's workspace is no longer selected; it never moves.
            expect(hookMocks.useAdventureChatSocket).toHaveBeenLastCalledWith(7, expect.any(Object), 'token', 'adventure-sessions', undefined, TEST_WORKSPACE_ID)
        })
    })
})

describe('InteractionCenterPanel narration allowance (D24)', () => {
    beforeEach(() => {
        localStorage.clear()
        vi.restoreAllMocks()
        workspace = createWorkspaceTestState({ api: apiService })
        hookMocks.pageFocused = true
        vi.spyOn(apiService, 'listLorebookAttachments').mockResolvedValue([])
        // Auto-narrate also reads the capabilities (pause flag); keep it offline.
        vi.spyOn(apiService, 'getVoiceCapabilities').mockRejectedValue(new Error('offline'))
        hookMocks.useAdventureChatSocket.mockReturnValue({ status: 'open', sendChat: vi.fn(), sendTts: vi.fn(), cancel: vi.fn() })
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
    })

    function profileWith(voiceUsage: Record<string, number> | null) {
        // Flat on the membership (03 §5.16 I-1).
        return { membership: { plan_code: 'free', ...voiceUsage } } as unknown as Awaited<ReturnType<typeof apiService.getUserProfile>>
    }

    it('reads nothing while narration is not in use', () => {
        const getUserProfile = vi.spyOn(apiService, 'getUserProfile').mockResolvedValue(profileWith(null))
        renderPanel(makeConfig())
        expect(getUserProfile).not.toHaveBeenCalled()
        expect(screen.queryByTestId('narration-allowance')).not.toBeInTheDocument()
    })

    it('shows the characters left while auto-narrate is on', async () => {
        localStorage.setItem('test:autonarrate:7', '1')
        vi.spyOn(apiService, 'getUserProfile').mockResolvedValue(profileWith({ narration_chars_used: 500, narration_chars_limit: 2500 }))
        renderPanel(makeConfig())

        expect(await screen.findByTestId('narration-allowance')).toHaveTextContent('2,000 narration characters left today')
    })

    it('shows the daily-limit copy once the characters run out', async () => {
        localStorage.setItem('test:autonarrate:7', '1')
        vi.spyOn(apiService, 'getUserProfile').mockResolvedValue(profileWith({ narration_chars_used: 2500, narration_chars_limit: 2500 }))
        renderPanel(makeConfig())

        expect(await screen.findByTestId('narration-allowance')).toHaveTextContent('Daily voice limit reached. Narration resumes tomorrow.')
    })

    it('stays hidden on a server without the usage fields', async () => {
        localStorage.setItem('test:autonarrate:7', '1')
        const getUserProfile = vi.spyOn(apiService, 'getUserProfile').mockResolvedValue(profileWith(null))
        renderPanel(makeConfig())

        await waitFor(() => expect(getUserProfile).toHaveBeenCalled())
        expect(screen.queryByTestId('narration-allowance')).not.toBeInTheDocument()
    })
})

describe('InteractionCenterPanel auto-narration pause (D37)', () => {
    type Handlers = import('../hooks/useAdventureChatSocket').AdventureChatHandlers

    beforeEach(() => {
        localStorage.clear()
        vi.restoreAllMocks()
        clearVoiceCapabilitiesCache()
        workspace = createWorkspaceTestState({ api: apiService })
        hookMocks.pageFocused = true
        vi.spyOn(apiService, 'listLorebookAttachments').mockResolvedValue([])
        vi.spyOn(apiService, 'getUserProfile').mockResolvedValue({ membership: { plan_code: 'free' } } as unknown as Awaited<ReturnType<typeof apiService.getUserProfile>>)
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
        localStorage.setItem('test:autonarrate:7', '1')
    })

    function capabilities(status?: Record<string, boolean>) {
        return toVoiceCapabilities({ surfaces: { narration: {} }, ...(status ? { status } : {}) })!
    }

    function captureSocket() {
        const ref: { current: Handlers } = { current: {} }
        const sendChat = vi.fn()
        const sendTts = vi.fn()
        hookMocks.useAdventureChatSocket.mockImplementation((_sessionId: unknown, h: Handlers) => {
            ref.current = h
            return { status: 'open', sendChat, sendTts, cancel: vi.fn() }
        })
        return { handlers: ref, sendChat, sendTts }
    }

    async function finishTurn(socket: ReturnType<typeof captureSocket>) {
        fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Open the gate' } })
        fireEvent.click(screen.getByLabelText('Send message'))
        await waitFor(() => expect(socket.sendChat).toHaveBeenCalledOnce())
        act(() => {
            socket.handlers.current.onTurnStarted?.({ type: 'turn_started', user_message_id: 200, assistant_message_id: 201, turn_id: 'turn-2' })
            socket.handlers.current.onDelta?.('The gate creaks.')
            socket.handlers.current.onDone?.({ interrupted: false, userMessageId: 200, assistantMessageId: 201, turnId: 'turn-2' })
        })
    }

    it('hides narration and makes no voice requests with voices off, even with calls and a saved preference on', async () => {
        setTestFeatureFlags({ voices: false })
        setTestFeatureFlags({ calls: true })
        const getCapabilities = vi.spyOn(apiService, 'getVoiceCapabilities').mockResolvedValue(capabilities())
        const getTtsJob = vi.spyOn(apiService, 'getTtsJob')
        const socket = captureSocket()
        renderPanel(makeConfig())
        await act(async () => {})
        expect(screen.queryByRole('button', { name: /auto.narrat/i })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /narrat/i })).not.toBeInTheDocument()
        expect(screen.queryByTestId('narration-availability-status')).not.toBeInTheDocument()
        await finishTurn(socket)
        expect(socket.sendTts).not.toHaveBeenCalled()
        expect(getCapabilities).not.toHaveBeenCalled()
        expect(getTtsJob).not.toHaveBeenCalled()
        expect(localStorage.getItem('test:autonarrate:7')).toBe('1')
    })

    it('auto-narrates with calls off when the parent voices flag is on', async () => {
        setTestFeatureFlags({ voices: true })
        setTestFeatureFlags({ calls: false })
        const getCapabilities = vi.spyOn(apiService, 'getVoiceCapabilities').mockResolvedValue(capabilities())
        const socket = captureSocket()
        renderPanel(makeConfig())
        await waitFor(() => expect(getCapabilities).toHaveBeenCalled())

        await finishTurn(socket)

        expect(socket.sendTts).toHaveBeenCalledWith(201, 'turn-2', expect.any(String))
        expect(screen.queryByTestId('auto-narration-paused')).toBeNull()
    })

    it('skips the auto request and shows the notice while capabilities report auto_narration_paused', async () => {
        vi.spyOn(apiService, 'getVoiceCapabilities').mockResolvedValue(capabilities({ auto_narration_paused: true }))
        const socket = captureSocket()
        renderPanel(makeConfig())

        expect(await screen.findByTestId('auto-narration-paused')).toHaveTextContent('Auto-narration is paused for now. You can still play turns.')
        await finishTurn(socket)

        expect(socket.sendTts).not.toHaveBeenCalled()
        // Manual play still requests narration.
        fireEvent.click(screen.getAllByRole('button', { name: 'Play narration' })[0])
        expect(socket.sendTts).toHaveBeenCalledWith(101, 'turn-1', expect.any(String))
    })

    it('treats a tts_failed auto_narration_paused refusal as a pause, not a failure', async () => {
        vi.spyOn(apiService, 'getVoiceCapabilities').mockResolvedValue(capabilities())
        const socket = captureSocket()
        renderPanel(makeConfig())

        act(() => socket.handlers.current.onTtsFailed?.({
            type: 'tts_failed',
            adventure_id: 7,
            assistant_message_id: 101,
            turn_id: 'turn-1',
            job_id: null,
            status: 'unavailable',
            error: { category: 'unavailable', detail: 'Auto-narration is paused.', code: 'auto_narration_paused', retryable: false },
        }))

        expect(await screen.findByTestId('auto-narration-paused')).toBeInTheDocument()
        expect(screen.queryByRole('alert')).toBeNull()
        expect(screen.queryByText(/Narration failed/)).toBeNull()
        // The refused turn stays playable by hand, not marked failed.
        expect(screen.getByRole('button', { name: 'Play narration' })).toBeInTheDocument()

        await finishTurn(socket)
        expect(socket.sendTts).not.toHaveBeenCalled()
    })

    it('reports a tapped request refused with auto_narration_paused as a failure, not a silent pause', async () => {
        vi.spyOn(apiService, 'getVoiceCapabilities').mockResolvedValue(capabilities())
        const socket = captureSocket()
        renderPanel(makeConfig())

        fireEvent.click(screen.getAllByRole('button', { name: 'Play narration' })[0])
        expect(socket.sendTts).toHaveBeenCalledWith(101, 'turn-1', expect.any(String))
        act(() => socket.handlers.current.onTtsFailed?.({
            type: 'tts_failed',
            adventure_id: 7,
            assistant_message_id: 101,
            turn_id: 'turn-1',
            job_id: null,
            status: 'unavailable',
            error: { category: 'unavailable', detail: 'Auto-narration is paused.', code: 'auto_narration_paused', retryable: false },
        }))

        expect(await screen.findByRole('alert')).toHaveTextContent('Narration failed: Auto-narration is paused.')
        expect(screen.queryByTestId('auto-narration-paused')).toBeNull()
        // The pending spinner is rolled back so the turn can be tried again.
        expect(screen.getAllByRole('button', { name: 'Play narration' })[0]).toBeInTheDocument()
    })

    it('keeps the pause live region mounted so a mid-session pause is announced', async () => {
        vi.spyOn(apiService, 'getVoiceCapabilities').mockResolvedValue(capabilities())
        const socket = captureSocket()
        renderPanel(makeConfig())

        const region = screen.getByTestId('auto-narration-status')
        expect(region).toHaveAttribute('role', 'status')
        expect(region).toHaveAttribute('aria-live', 'polite')
        expect(region).toBeEmptyDOMElement()

        act(() => socket.handlers.current.onTtsFailed?.({
            type: 'tts_failed',
            adventure_id: 7,
            assistant_message_id: 101,
            turn_id: 'turn-1',
            job_id: null,
            status: 'unavailable',
            error: { category: 'unavailable', detail: 'Auto-narration is paused.', code: 'auto_narration_paused', retryable: false },
        }))

        expect(await screen.findByTestId('auto-narration-paused')).toBeInTheDocument()
        expect(screen.getByTestId('auto-narration-status')).toBe(region)
        expect(region).toContainElement(screen.getByTestId('auto-narration-paused'))
    })

    it('shows no pause notice while auto-narrate is off', async () => {
        localStorage.setItem('test:autonarrate:7', '0')
        // Read for narration availability (09 §7); the pause flag itself is ignored.
        const getCapabilities = vi.spyOn(apiService, 'getVoiceCapabilities').mockResolvedValue(capabilities({ auto_narration_paused: true }))
        captureSocket()
        renderPanel(makeConfig())

        await waitFor(() => expect(getCapabilities).toHaveBeenCalled())
        await act(async () => {})
        expect(screen.queryByTestId('auto-narration-paused')).toBeNull()
        expect(screen.queryByTestId('auto-narration-status')).toBeNull()
        expect(screen.queryByTestId('narration-unavailable')).toBeNull()
    })

    it('disables narrate with copy and requests nothing while narration is unavailable', async () => {
        vi.spyOn(apiService, 'getVoiceCapabilities').mockResolvedValue(capabilities({ narration_available: false, calls_available: true }))
        const socket = captureSocket()
        renderPanel(makeConfig())

        // The live region is mounted before the switch-off lands, so the notice is announced.
        const region = screen.getByTestId('narration-availability-status')
        expect(region).toHaveAttribute('role', 'status')
        expect(region).toBeEmptyDOMElement()
        expect(await screen.findByTestId('narration-unavailable')).toHaveTextContent('Narration is unavailable right now. Saved narration still plays.')
        expect(screen.getByTestId('narration-availability-status')).toBe(region)
        expect(region).toContainElement(screen.getByTestId('narration-unavailable'))
        const button = screen.getByRole('button', { name: 'Narration is unavailable right now' })
        expect(button).toBeDisabled()
        expect(screen.queryByRole('button', { name: 'Play narration' })).toBeNull()
        fireEvent.click(button)
        // The pause notice does not stack on top of the unavailable one.
        expect(screen.queryByTestId('auto-narration-paused')).toBeNull()

        await finishTurn(socket)
        expect(socket.sendTts).not.toHaveBeenCalled()
    })

    it('fails open: a capabilities response without narration_available keeps narrate enabled', async () => {
        localStorage.setItem('test:autonarrate:7', '0')
        const getCapabilities = vi.spyOn(apiService, 'getVoiceCapabilities').mockResolvedValue(capabilities({ calls_available: false }))
        const socket = captureSocket()
        renderPanel(makeConfig())

        await waitFor(() => expect(getCapabilities).toHaveBeenCalled())
        await act(async () => {})
        expect(screen.queryByTestId('narration-unavailable')).toBeNull()
        fireEvent.click(screen.getByRole('button', { name: 'Play narration' }))
        expect(socket.sendTts).toHaveBeenCalledWith(101, 'turn-1', expect.any(String))
    })
})
