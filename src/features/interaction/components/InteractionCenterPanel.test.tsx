import { useState } from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatSpeakerRosterEntry, TurnEntry } from '../../../shared'
import type { ChatSessionConfig } from '../chatSessionConfig'
import { apiService } from '../../../infrastructure/api'
import { InteractionCenterPanel } from './InteractionCenterPanel'

vi.mock('../../../infrastructure/api/useAuthenticatedMediaUrl', () => ({
    useAuthenticatedMediaUrl: (url?: string | null) => ({ src: url ?? undefined, loading: false, error: null }),
}))

const hookMocks = vi.hoisted(() => ({
    useAdventureChatSocket: vi.fn(),
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

const initialTurns: TurnEntry[] = [
    { id: '100', type: 'user', content: 'Open the door', timestamp: '2026-06-04T00:00:00' },
    { id: '101', type: 'ai', content: 'The door opens.', timestamp: '2026-06-04T00:00:01', assistantMessageId: 101, turnId: 'turn-1' },
]

function makeConfig(overrides: Partial<ChatSessionConfig> = {}): ChatSessionConfig {
    return {
        kind: 'adventure',
        basePath: 'adventure-sessions',
        loadTurns: vi.fn(async () => []),
        saveTurns: vi.fn(async () => {}),
        deleteMessage: vi.fn(async (_sessionId, messageId) => initialTurns.filter((turn) => turn.id !== String(messageId))),
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

function renderPanel(config: ChatSessionConfig, seed: TurnEntry[] = initialTurns, sessionId = 7, speakerRoster?: ChatSpeakerRosterEntry[]) {
    function Harness() {
        const [turns, setTurns] = useState<TurnEntry[]>(seed)
        return <InteractionCenterPanel sessionId={sessionId} turns={turns} setTurns={setTurns} config={config} speakerRoster={speakerRoster} />
    }

    return render(<Harness />)
}

describe('InteractionCenterPanel message deletion', () => {
    beforeEach(() => {
        localStorage.clear()
        vi.restoreAllMocks()
        // The session-lore hook lists attachments on mount; keep it empty + offline-safe.
        vi.spyOn(apiService, 'listLorebookAttachments').mockResolvedValue([])
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
        vi.unstubAllEnvs()
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

    it('deletes canonical messages through the session config and adopts the server projection', async () => {
        const deleteMessage = vi.fn(async () => [initialTurns[1]])
        const saveTurns = vi.fn(async (_sessionId: number, _turns: TurnEntry[]) => {})
        const config = makeConfig({ deleteMessage, saveTurns })

        renderPanel(config)
        fireEvent.click(screen.getAllByLabelText('Delete message')[0])
        fireEvent.click(within(screen.getByRole('dialog', { name: 'Delete message?' })).getByRole('button', { name: 'Delete' }))

        await waitFor(() => expect(deleteMessage).toHaveBeenCalledWith(7, 100))
        expect(saveTurns).not.toHaveBeenCalled()
        expect(screen.queryByText('Open the door')).not.toBeInTheDocument()
        expect(screen.getByText('The door opens.')).toBeInTheDocument()
    })

    it('rolls back the local removal when canonical delete fails', async () => {
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

    it('clears messages through the canonical clear endpoint', async () => {
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

        renderPanel(makeConfig(), [])

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

        expect(await screen.findByText('Who goes there?')).toBeInTheDocument()
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
        const savedTurns: TurnEntry[][] = []
        const saveTurns = vi.fn(async (_sessionId: number, turnsToSave: TurnEntry[]) => {
            savedTurns.push(turnsToSave)
        })

        renderPanel(makeConfig({ loadTurns, saveTurns }), [])
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
        expect(savedTurns.some((turns) => turns.some((turn) => turn.id === '999' && turn.segments?.length))).toBe(true)
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

    it('defers hydration while a mirror save is in flight and runs it once after the queue drains', async () => {
        let handlers: { onDone: (frame: Record<string, unknown>) => void } | undefined
        const sendChat = vi.fn()
        hookMocks.useAdventureChatSocket.mockImplementation((_sessionId: unknown, h: never) => {
            handlers = h
            return { status: 'open', sendChat, sendTts: vi.fn(), cancel: vi.fn() }
        })
        const loadTurns = vi.fn(async () => [])
        const releases: Array<() => void> = []
        const saveTurns = vi.fn<(sessionId: number, turns: TurnEntry[]) => Promise<void>>(
            () =>
                new Promise<void>((resolve) => {
                    releases.push(resolve)
                }),
        )
        renderPanel(makeConfig({ loadTurns, saveTurns }), [])
        await waitFor(() => expect(loadTurns).toHaveBeenCalledTimes(1))

        fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Look around' } })
        fireEvent.click(screen.getByLabelText('Send message'))
        await waitFor(() => expect(saveTurns).toHaveBeenCalledTimes(1))

        // Finishing the stream queues a save + hydration behind the held save…
        act(() => {
            handlers!.onDone({ interrupted: false, userMessageId: 100, assistantMessageId: 999, turnId: 'turn-9' })
        })
        // …and a tab refocus while it is still writing must not fetch a stale projection.
        act(() => {
            document.dispatchEvent(new Event('visibilitychange'))
        })
        expect(loadTurns).toHaveBeenCalledTimes(1)

        await act(async () => {
            releases[0]()
        })
        await waitFor(() => expect(saveTurns).toHaveBeenCalledTimes(2))
        await act(async () => {
            releases[1]()
        })

        // Both parked triggers (post-done + refocus) collapse into one hydration.
        await waitFor(() => expect(loadTurns).toHaveBeenCalledTimes(2))
        expect(loadTurns).toHaveBeenCalledTimes(2)
    })

    it('collapses overlapping mirror saves to the newest snapshot', async () => {
        let handlers: { onDone: (frame: Record<string, unknown>) => void } | undefined
        const sendChat = vi.fn()
        hookMocks.useAdventureChatSocket.mockImplementation((_sessionId: unknown, h: never) => {
            handlers = h
            return { status: 'open', sendChat, sendTts: vi.fn(), cancel: vi.fn() }
        })
        const releases: Array<() => void> = []
        const saveTurns = vi.fn<(sessionId: number, turns: TurnEntry[]) => Promise<void>>(
            () =>
                new Promise<void>((resolve) => {
                    releases.push(resolve)
                }),
        )
        renderPanel(makeConfig({ saveTurns }), [])

        // First send: its user-turn save starts and is held in flight.
        fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'First message' } })
        fireEvent.click(screen.getByLabelText('Send message'))
        await waitFor(() => expect(saveTurns).toHaveBeenCalledTimes(1))

        // Finish the generation and immediately send again: both snapshots queue
        // behind the held save and only the newest one may be written.
        act(() => {
            handlers!.onDone({ interrupted: false, userMessageId: 100, assistantMessageId: 999, turnId: 'turn-9' })
        })
        fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Second message' } })
        fireEvent.click(screen.getByLabelText('Send message'))
        expect(saveTurns).toHaveBeenCalledTimes(1)

        await act(async () => {
            releases[0]()
        })
        await waitFor(() => expect(saveTurns).toHaveBeenCalledTimes(2))
        const lastSnapshot = saveTurns.mock.calls[1][1] as TurnEntry[]
        expect(lastSnapshot.some((turn) => turn.content === 'Second message')).toBe(true)

        await act(async () => {
            releases[1]()
        })
        expect(saveTurns).toHaveBeenCalledTimes(2)
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
        const pill = screen.getByRole('button', { name: 'New messages' })

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

        expect(scrollIntoView).toHaveBeenCalled()
        expect(screen.queryByRole('button', { name: 'New messages' })).toBeNull()
    })

    it('deletes the replaced canonical reply before regenerating', async () => {
        const sendChat = vi.fn()
        hookMocks.useAdventureChatSocket.mockReturnValue({ status: 'open', sendChat, sendTts: vi.fn(), cancel: vi.fn() })
        const deleteMessage = vi.fn(async () => [initialTurns[0]])
        const config = makeConfig({ deleteMessage })

        renderPanel(config)
        fireEvent.click(screen.getByLabelText('Regenerate'))

        // The old canonical assistant row goes first, or hydration resurrects it.
        await waitFor(() => expect(deleteMessage).toHaveBeenCalledWith(7, 101))
        await waitFor(() => expect(sendChat).toHaveBeenCalledWith(
            [{ role: 'user', content: 'Open the door' }],
            expect.anything(),
        ))
    })

    it('restores the previous reply and skips generation when the pre-regenerate delete fails', async () => {
        const sendChat = vi.fn()
        hookMocks.useAdventureChatSocket.mockReturnValue({ status: 'open', sendChat, sendTts: vi.fn(), cancel: vi.fn() })
        const deleteMessage = vi.fn(async () => {
            throw new Error('conflict')
        })
        const config = makeConfig({ deleteMessage })

        renderPanel(config)
        fireEvent.click(screen.getByLabelText('Regenerate'))

        expect(await screen.findByText('Could not generate a response. Please try again.')).toBeInTheDocument()
        expect(sendChat).not.toHaveBeenCalled()
        expect(screen.getByText('The door opens.')).toBeInTheDocument()
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
                imageStatus: 'in_progress',
                imageJobId: 'img-char-1',
            } as TurnEntry,
        ]

        renderPanel(config, seed)

        expect(screen.getByText('The mirror catches candlelight.')).toBeInTheDocument()
        expect(screen.getByText('Suggested Actions')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /ask about the mirror/i })).toBeInTheDocument()
        expect(screen.getByText(/conjuring the scene/i)).toBeInTheDocument()
    })

    it('defaults generation toggles on and sends them with chat frames', async () => {
        const sendChat = vi.fn()
        hookMocks.useAdventureChatSocket.mockReturnValue({
            status: 'open',
            sendChat,
            sendTts: vi.fn(),
            cancel: vi.fn(),
        })

        renderPanel(makeConfig(), [])

        expect(screen.getByRole('button', { name: 'Generated images on' })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByRole('button', { name: 'Suggested actions on' })).toHaveAttribute('aria-pressed', 'true')

        fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Look around' } })
        fireEvent.click(screen.getByLabelText('Send message'))

        await waitFor(() => expect(sendChat).toHaveBeenCalled())
        expect(sendChat).toHaveBeenCalledWith(
            [{ role: 'user', content: 'Look around' }],
            { generateImage: true, suggestActions: true },
        )
    })

    it('persists generation toggles per chat kind and session id', async () => {
        const sendChat = vi.fn()
        hookMocks.useAdventureChatSocket.mockReturnValue({
            status: 'open',
            sendChat,
            sendTts: vi.fn(),
            cancel: vi.fn(),
        })

        const view = renderPanel(makeConfig(), [])

        fireEvent.click(screen.getByRole('button', { name: 'Generated images on' }))
        fireEvent.click(screen.getByRole('button', { name: 'Suggested actions on' }))

        await waitFor(() => {
            expect(localStorage.getItem('mw:chat-options:adventure:7')).toBe(JSON.stringify({
                generateImage: false,
                suggestActions: false,
            }))
        })

        fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Wait quietly' } })
        fireEvent.click(screen.getByLabelText('Send message'))

        await waitFor(() =>
            expect(sendChat).toHaveBeenCalledWith(
                [{ role: 'user', content: 'Wait quietly' }],
                { generateImage: false, suggestActions: false },
            ),
        )

        view.unmount()
        const secondView = renderPanel(makeConfig(), [], 8)
        expect(screen.getByRole('button', { name: 'Generated images on' })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByRole('button', { name: 'Suggested actions on' })).toHaveAttribute('aria-pressed', 'true')

        secondView.unmount()
        renderPanel(makeConfig({ kind: 'character', basePath: 'character-chats' }), [], 7)
        expect(screen.getByRole('button', { name: 'Generated images on' })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByRole('button', { name: 'Suggested actions on' })).toHaveAttribute('aria-pressed', 'true')
    })

    it('does not hide existing images or suggested actions when generation toggles are off', () => {
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
                imageStatus: 'in_progress',
                imageJobId: 'img-char-1',
            } as TurnEntry,
        ]

        renderPanel(config, seed)

        fireEvent.click(screen.getByRole('button', { name: 'Generated images on' }))
        fireEvent.click(screen.getByRole('button', { name: 'Suggested actions on' }))

        expect(screen.getByText('Suggested Actions')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /ask about the mirror/i })).toBeInTheDocument()
        expect(screen.getByText(/conjuring the scene/i)).toBeInTheDocument()
    })
})
