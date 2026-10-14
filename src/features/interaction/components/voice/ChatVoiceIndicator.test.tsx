import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DataContext } from '@/app/providers/DataProvider'
import { ApiError, apiService } from '@/infrastructure/api'
import type { Adventure, Character, CharacterChatSession, EffectiveVoice, EffectiveVoiceResponse, SnapshotCard } from '@/shared'
import {
    createWorkspaceTestState,
    OTHER_WORKSPACE_ID,
    TEST_WORKSPACE_ID,
    testWorkspace,
    WorkspaceTestProvider,
} from '@/shared/hooks/testing/workspaceTestUtils'
import { InteractionTopBar } from '../InteractionTopBar'
import { ChatVoiceIndicator } from './ChatVoiceIndicator'
import { clearSessionVoicesCache } from './sessionVoiceCache'
import { REFRESH_DONE_VISIBLE_MS } from './useDoneReset'

type DataValue = NonNullable<ComponentProps<typeof DataContext.Provider>['value']>

const KEY_A = `vk_${'a'.repeat(32)}`
const KEY_B = `vk_${'b'.repeat(32)}`

function el(voiceKey: string, overrides: Partial<EffectiveVoice> = {}): EffectiveVoice {
    return {
        voice_key: voiceKey,
        display_name: voiceKey === KEY_A ? 'Aria' : 'Bram',
        provider_route: 'elevenlabs',
        substitution_reason: null,
        flags: [],
        badges: [],
        ...overrides,
    }
}

function card(effective?: EffectiveVoice | null): Character {
    return {
        id: 'card-1',
        name: 'Lyra',
        race: 'Elf',
        stats: {},
        voice: { voice_id: 'male-qn-qingse', preset_name: 'Calm' },
        ...(effective ? { effective_voice: effective } : {}),
    }
}

function chat(overrides: Partial<CharacterChatSession> = {}): CharacterChatSession {
    return { id: '9', kind: 'character', character_id: 'card-1', character_ids: ['card-1'], character: card(), turns: [], ...overrides }
}

function sessionResponse(effective: EffectiveVoice): EffectiveVoiceResponse {
    return { ref_type: 'session', ref_id: '9', voices: [{ json_path: 'character.voice', effective_voice: effective }] }
}

const getEffectiveVoice = vi.spyOn(apiService, 'getEffectiveVoice')
// Spied only to prove the indicator no longer reads capabilities (no network in tests).
const getVoiceCapabilities = vi.spyOn(apiService, 'getVoiceCapabilities')
const refreshCharacterChatVoice = vi.fn()
const refreshAdventureVoices = vi.fn()

interface RenderOptions {
    library?: Character[]
    active?: CharacterChatSession | null
    adventure?: Adventure | null
    workspaces?: ReturnType<typeof testWorkspace>[]
    selectedWorkspaceId?: string
}

function renderIndicator(node: ReactNode, { library = [card(el(KEY_B))], active = chat(), adventure = null, workspaces, selectedWorkspaceId }: RenderOptions = {}) {
    const dataFor = (next: CharacterChatSession | null) => ({
        activeCharacterChat: next,
        editingInProgress: adventure,
        characters: library,
        refreshCharacterChatVoice,
        refreshAdventureVoices,
    }) as unknown as DataValue
    const workspace = createWorkspaceTestState({ workspaces, selectedWorkspaceId })
    const view = (next: CharacterChatSession | null) => (
        <WorkspaceTestProvider state={workspace}>
            <DataContext.Provider value={dataFor(next)}>{node}</DataContext.Provider>
        </WorkspaceTestProvider>
    )
    const result = render(view(active))
    /** DataProvider upserting the chat (what every D36 refresh does, whichever entry point ran it). */
    const upsertChat = (next: CharacterChatSession) => result.rerender(view(next))
    return { ...result, upsertChat }
}

beforeEach(() => {
    clearSessionVoicesCache()
    getEffectiveVoice.mockReset()
    getVoiceCapabilities.mockReset()
    refreshCharacterChatVoice.mockReset()
    refreshAdventureVoices.mockReset().mockResolvedValue(undefined)
})

afterEach(() => {
    vi.useRealTimers()
})

describe('ChatVoiceIndicator gates', () => {
    it('reads the chat voices for every saved 1:1 chat, without a capabilities read', async () => {
        getEffectiveVoice.mockResolvedValue(sessionResponse(el(KEY_A)))
        renderIndicator(<ChatVoiceIndicator variant="panel" />)
        await waitFor(() => expect(getEffectiveVoice).toHaveBeenCalledWith('session', '9'))
        expect(await screen.findByRole('button', { name: 'Use the card’s current voice' })).toBeInTheDocument()
        expect(getVoiceCapabilities).not.toHaveBeenCalled()
    })

    it('renders nothing when the chat voices read fails', async () => {
        getEffectiveVoice.mockRejectedValue(new Error('offline'))
        const { container } = renderIndicator(<ChatVoiceIndicator variant="panel" />)
        await waitFor(() => expect(getEffectiveVoice).toHaveBeenCalled())
        await act(async () => {})
        expect(container).toBeEmptyDOMElement()
    })

    it('renders nothing for group chats and local drafts', async () => {
        const group = renderIndicator(<ChatVoiceIndicator variant="panel" />, {
            active: chat({ kind: 'character_group', character_ids: ['card-1', 'card-2'] }),
        })
        await act(async () => {})
        expect(group.container).toBeEmptyDOMElement()
        group.unmount()
        const draft = renderIndicator(<ChatVoiceIndicator variant="panel" />, { active: chat({ isDraft: true }) })
        await act(async () => {})
        expect(draft.container).toBeEmptyDOMElement()
        expect(getEffectiveVoice).not.toHaveBeenCalled()
        expect(getVoiceCapabilities).not.toHaveBeenCalled()
    })

    it('renders nothing when the chat already plays the card’s voice', async () => {
        getEffectiveVoice.mockResolvedValue(sessionResponse(el(KEY_B)))
        const { container } = renderIndicator(<ChatVoiceIndicator variant="panel" />)
        await waitFor(() => expect(getEffectiveVoice).toHaveBeenCalledWith('session', '9'))
        await act(async () => {})
        expect(container).toBeEmptyDOMElement()
    })

    it('renders nothing for another chat than the one it describes', async () => {
        const { container } = renderIndicator(<ChatVoiceIndicator variant="panel" chatId="12" />)
        await act(async () => {})
        expect(container).toBeEmptyDOMElement()
    })
})

describe('ChatVoiceIndicator header action (AC-C6)', () => {
    it('reads the chat on its workspace client and offers the refresh when the card voice changed', async () => {
        getEffectiveVoice.mockResolvedValue(sessionResponse(el(KEY_A)))
        renderIndicator(<ChatVoiceIndicator variant="panel" />)

        const action = await screen.findByRole('button', { name: 'Use the card’s current voice' })
        expect(screen.getByText('Card voice changed')).toBeInTheDocument()
        expect(screen.getByText('The card now uses Bram.')).toBeInTheDocument()
        expect(action).toHaveAccessibleDescription('The card now uses Bram.')
        const scope = (getEffectiveVoice.mock.contexts[0] as { workspaceScope?: { workspaceId: string } }).workspaceScope
        expect(scope?.workspaceId).toBe(TEST_WORKSPACE_ID)
    })

    it('shows "Voice replaced" for a substituted chat voice', async () => {
        getEffectiveVoice.mockResolvedValue(sessionResponse(el(KEY_A, { substitution_reason: 'voice_removed', badges: ['replaced'] })))
        renderIndicator(<ChatVoiceIndicator variant="panel" />)
        expect(await screen.findByText('Voice replaced')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Use the card’s current voice' })).toBeEnabled()
    })

    it('shows "Voice replaced" without the action when the source card is not in the library (D36/D39, 03 §5.12)', async () => {
        getEffectiveVoice.mockResolvedValue(sessionResponse(el(KEY_A, { substitution_reason: 'voice_removed', badges: ['replaced'] })))
        renderIndicator(<ChatVoiceIndicator variant="panel" />, { library: [] })
        expect(await screen.findByText('Voice replaced')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Use the card’s current voice' })).toBeNull()
        expect(screen.queryByText('Card voice changed')).toBeNull()
    })

    it('shows nothing for a chat without a source card whose voice is not replaced', async () => {
        getEffectiveVoice.mockResolvedValue(sessionResponse(el(KEY_A)))
        const { container } = renderIndicator(<ChatVoiceIndicator variant="panel" />, { library: [card(null)] })
        await waitFor(() => expect(getEffectiveVoice).toHaveBeenCalledWith('session', '9'))
        await act(async () => {})
        expect(container).toBeEmptyDOMElement()
    })

    it('offers no action when the card’s own voice cannot be copied (R-9: a defaulted V1 translation)', async () => {
        getEffectiveVoice.mockResolvedValue(sessionResponse(el(KEY_A, { substitution_reason: 'voice_removed', badges: ['replaced'] })))
        const unmapped = el(KEY_B, { substitution_reason: 'unmapped_legacy', badges: ['replaced', 'needs_reselect'] })
        renderIndicator(<ChatVoiceIndicator variant="panel" />, { library: [card(unmapped)] })
        expect(await screen.findByText('Voice replaced')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Use the card’s current voice' })).toBeNull()
    })

    it('shows the replacement without an action when the card plays the same substitute', async () => {
        getEffectiveVoice.mockResolvedValue(sessionResponse(el(KEY_B, { substitution_reason: 'voice_removed', badges: ['replaced'] })))
        renderIndicator(<ChatVoiceIndicator variant="panel" />)
        expect(await screen.findByText('Voice replaced')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Use the card’s current voice' })).toBeNull()
    })

    it('refreshes through DataProvider on the chat client, then hides once the voices match', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true })
        getEffectiveVoice.mockResolvedValueOnce(sessionResponse(el(KEY_A))).mockResolvedValue(sessionResponse(el(KEY_B)))
        refreshCharacterChatVoice.mockResolvedValue(chat())
        renderIndicator(<ChatVoiceIndicator variant="panel" />)

        fireEvent.click(await screen.findByRole('button', { name: 'Use the card’s current voice' }))

        await waitFor(() => expect(refreshCharacterChatVoice).toHaveBeenCalledTimes(1))
        const [chatId, api] = refreshCharacterChatVoice.mock.calls[0] as [string, { workspaceScope?: { workspaceId: string } }]
        expect(chatId).toBe('9')
        expect(api.workspaceScope?.workspaceId).toBe(TEST_WORKSPACE_ID)
        expect(await screen.findByRole('status')).toHaveTextContent('Voice updated. New replies use it.')
        await waitFor(() => expect(getEffectiveVoice).toHaveBeenCalledTimes(2))
        await waitFor(() => expect(screen.queryByText('Card voice changed')).toBeNull())
        expect(screen.queryByRole('button', { name: 'Use the card’s current voice' })).toBeNull()

        // Focus moved on (see the focus test below): the line settles after its delay.
        act(() => screen.getByRole('status').blur())
        await act(async () => {
            vi.advanceTimersByTime(REFRESH_DONE_VISIBLE_MS + 10)
        })
        expect(screen.queryByTestId('chat-voice-indicator')).toBeNull()
    })

    it('reads the chat again when the chat is upserted by a refresh run elsewhere (clip note, call end panel)', async () => {
        getEffectiveVoice.mockResolvedValueOnce(sessionResponse(el(KEY_A))).mockResolvedValue(sessionResponse(el(KEY_B)))
        const { upsertChat } = renderIndicator(<ChatVoiceIndicator variant="panel" />)
        expect(await screen.findByText('Card voice changed')).toBeInTheDocument()
        expect(getEffectiveVoice).toHaveBeenCalledTimes(1)

        upsertChat(chat())

        await waitFor(() => expect(getEffectiveVoice).toHaveBeenCalledTimes(2))
        await waitFor(() => expect(screen.queryByTestId('chat-voice-indicator')).toBeNull())
        expect(screen.queryByRole('button', { name: 'Use the card’s current voice' })).toBeNull()
    })

    it('mounted twice (header strip and sidebar), one upsert costs one read', async () => {
        getEffectiveVoice.mockResolvedValue(sessionResponse(el(KEY_A)))
        const { upsertChat } = renderIndicator(
            <>
                <ChatVoiceIndicator variant="bar" />
                <ChatVoiceIndicator variant="panel" chatId="9" />
            </>,
        )
        expect(await screen.findAllByText('Card voice changed')).toHaveLength(2)
        expect(getEffectiveVoice).toHaveBeenCalledTimes(1)
        upsertChat(chat())
        await waitFor(() => expect(getEffectiveVoice).toHaveBeenCalledTimes(2))
        await act(async () => {})
        expect(getEffectiveVoice).toHaveBeenCalledTimes(2)
    })

    it('moves focus to the status line and keeps "Voice updated" while it holds focus', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true })
        getEffectiveVoice.mockResolvedValueOnce(sessionResponse(el(KEY_A))).mockResolvedValue(sessionResponse(el(KEY_B)))
        refreshCharacterChatVoice.mockResolvedValue(chat())
        renderIndicator(
            <>
                <ChatVoiceIndicator variant="panel" />
                <button type="button">Next control</button>
            </>,
        )
        const action = await screen.findByRole('button', { name: 'Use the card’s current voice' })
        action.focus()
        fireEvent.click(action)

        const status = screen.getByRole('status')
        expect(status).toHaveFocus()
        await waitFor(() => expect(status).toHaveTextContent('Voice updated. New replies use it.'))
        await waitFor(() => expect(screen.queryByRole('button', { name: 'Use the card’s current voice' })).toBeNull())
        expect(status).toHaveFocus()

        await act(async () => {
            vi.advanceTimersByTime(REFRESH_DONE_VISIBLE_MS + 10)
        })
        expect(screen.getByRole('status')).toHaveFocus()
        expect(screen.getByRole('status')).toHaveTextContent('Voice updated. New replies use it.')

        act(() => screen.getByRole('button', { name: 'Next control' }).focus())
        await waitFor(() => expect(screen.queryByTestId('chat-voice-indicator')).toBeNull())
        expect(screen.getByRole('button', { name: 'Next control' })).toHaveFocus()
    })

    it('a 409 while a reply streams shows the busy copy and keeps the action', async () => {
        getEffectiveVoice.mockResolvedValue(sessionResponse(el(KEY_A)))
        refreshCharacterChatVoice.mockRejectedValue(new ApiError(409, 'busy', { code: 'voice_refresh_busy' }))
        renderIndicator(<ChatVoiceIndicator variant="panel" />)

        fireEvent.click(await screen.findByRole('button', { name: 'Use the card’s current voice' }))

        expect(await screen.findByText('Finish the current reply or call first.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Use the card’s current voice' })).toBeEnabled()
        expect(getEffectiveVoice).toHaveBeenCalledTimes(1)
    })

    it('a card no longer in the workspace shows the source copy', async () => {
        getEffectiveVoice.mockResolvedValue(sessionResponse(el(KEY_A)))
        refreshCharacterChatVoice.mockRejectedValue(new ApiError(409, 'gone', { code: 'voice_source_unavailable' }))
        renderIndicator(<ChatVoiceIndicator variant="panel" />)
        fireEvent.click(await screen.findByRole('button', { name: 'Use the card’s current voice' }))
        expect(await screen.findByText('The original card isn’t in this workspace anymore.')).toBeInTheDocument()
    })

    it('hides the action in an archived workspace (09 §4.11)', async () => {
        getEffectiveVoice.mockResolvedValue(sessionResponse(el(KEY_A, { badges: ['replaced'], substitution_reason: 'voice_removed' })))
        renderIndicator(<ChatVoiceIndicator variant="panel" workspaceId={OTHER_WORKSPACE_ID} />, {
            workspaces: [
                testWorkspace(TEST_WORKSPACE_ID, 'Main library'),
                testWorkspace(OTHER_WORKSPACE_ID, 'Novel A', { archived_at: '2026-10-02T00:00:00Z' }),
            ],
            selectedWorkspaceId: OTHER_WORKSPACE_ID,
        })
        expect(await screen.findByText('Voice replaced')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Use the card’s current voice' })).toBeNull()
    })

    it('does not compare against the library of another committed workspace (D39 item 6)', async () => {
        getEffectiveVoice.mockResolvedValue(sessionResponse(el(KEY_A)))
        const { container } = renderIndicator(<ChatVoiceIndicator variant="panel" workspaceId={OTHER_WORKSPACE_ID} />)
        await waitFor(() => expect(getEffectiveVoice).toHaveBeenCalled())
        await act(async () => {})
        expect(container).toBeEmptyDOMElement()
    })
})

describe('InteractionTopBar chat voice strip', () => {
    const topBar = (mode: 'chat' | 'adventure') => (
        <InteractionTopBar title="Lyra" mode={mode} onToggleLeft={vi.fn()} leftOpen={false} />
    )

    it('adds the strip under the chat bar for an affected chat, mobile only', async () => {
        getEffectiveVoice.mockResolvedValue(sessionResponse(el(KEY_A)))
        renderIndicator(topBar('chat'))
        const strip = await screen.findByTestId('chat-voice-indicator')
        expect(strip).toHaveClass('lg:hidden')
        expect(strip).toHaveAccessibleName('Chat voice')
        expect(screen.getByRole('button', { name: 'Use the card’s current voice' })).toHaveAccessibleDescription('The card now uses Bram.')
    })

    it('keeps the adventure bar and an unaffected chat bar unchanged', async () => {
        const adventure = renderIndicator(topBar('adventure'))
        await act(async () => {})
        expect(adventure.container.children).toHaveLength(1)
        expect(adventure.container.firstElementChild?.tagName).toBe('HEADER')
        adventure.unmount()
        getEffectiveVoice.mockResolvedValue(sessionResponse(el(KEY_B)))
        const plain = renderIndicator(topBar('chat'))
        await waitFor(() => expect(getEffectiveVoice).toHaveBeenCalled())
        await act(async () => {})
        expect(plain.container.children).toHaveLength(1)
    })
})

describe('InteractionTopBar adventure cast strip (05 §7.8, AC-C6)', () => {
    const V1 = { voice_id: 'male-qn-qingse', preset_name: 'Calm' }
    const topBar = <InteractionTopBar title="The gate" mode="adventure" onToggleLeft={vi.fn()} leftOpen={false} dockAt="xl" />

    function adventureWith(cast: SnapshotCard[], overrides: Partial<Adventure> = {}): Adventure {
        return {
            id: '77',
            scenario: 'Open the gate.',
            characters: [],
            turns: [],
            status: 'in-progress',
            snapshot: {
                schema_version: 2,
                source: 'resolved_library_clone',
                template_card_id: 'tpl-1',
                template: { id: 'tpl-1', description: 'Open the gate.', characters: cast, world: [] },
            },
            ...overrides,
        }
    }
    const libraryCard = (id: string, effective: EffectiveVoice | null): Character => ({
        id, name: id, race: '', stats: {}, role: 'character', voice: V1, ...(effective ? { effective_voice: effective } : {}),
    })
    const affected = adventureWith([
        { id: 'c1', name: 'Lyra', voice: V1, effective_voice: el(KEY_A, { substitution_reason: 'voice_removed', badges: ['replaced'] }) },
        { id: 'c2', name: 'Tess', voice: V1, effective_voice: el(KEY_B) },
    ])

    it('shows the cast block under the adventure bar below xl and refreshes from it', async () => {
        renderIndicator(topBar, { adventure: affected, library: [libraryCard('c1', el(KEY_B)), libraryCard('c2', el(KEY_B))] })
        const strip = screen.getByRole('group', { name: 'Cast voices' })
        expect(strip).toHaveClass('xl:hidden')
        expect(strip).toHaveTextContent('1 character sounds different from their card.')

        fireEvent.click(screen.getByRole('button', { name: 'Use the cards’ current voices' }))
        expect(screen.getByRole('checkbox', { name: 'Lyra' })).toBeChecked()
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Update 1 voice' }))
        })
        expect(refreshAdventureVoices).toHaveBeenCalledTimes(1)
        const [adventureId, cardIds, api] = refreshAdventureVoices.mock.calls[0] as [string, string[], { workspaceScope?: { workspaceId: string } }]
        expect([adventureId, cardIds, api.workspaceScope?.workspaceId]).toEqual(['77', ['c1'], TEST_WORKSPACE_ID])
        expect(within(strip).getByRole('status')).toHaveTextContent('Voice updated. New replies use it.')
        expect(within(strip).getByRole('status')).toHaveFocus()
    })

    it('adds nothing without projections, for a local draft, or in an archived workspace', async () => {
        const bare = adventureWith([{ id: 'c1', name: 'Lyra', voice: V1 }])
        const cases: RenderOptions[] = [
            { adventure: bare, library: [libraryCard('c1', null)] },
            { adventure: { ...affected, draft: { templateId: 'tpl-1', personaId: 'p1' } }, library: [libraryCard('c1', el(KEY_B))] },
            {
                adventure: affected,
                library: [libraryCard('c1', el(KEY_B))],
                workspaces: [testWorkspace(TEST_WORKSPACE_ID, 'Main library', { archived_at: '2026-10-02T00:00:00Z' })],
            },
        ]
        for (const options of cases) {
            const { container, unmount } = renderIndicator(topBar, options)
            await act(async () => {})
            expect(container.children).toHaveLength(1)
            expect(container.firstElementChild?.tagName).toBe('HEADER')
            unmount()
        }
    })
})
