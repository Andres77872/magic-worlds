import { useContext, useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdventureSnapshot } from '../../shared'

// Auth: always authenticated so saveInProgressSnapshot proceeds.
vi.mock('@/app/hooks', () => ({
    useAuth: () => ({ isAuthenticated: true, openLoginModal: vi.fn() }),
    useData: () => ({}),
    useNavigation: () => ({}),
}))

vi.mock('../hooks/useAuth', () => ({
    useAuth: () => ({ isAuthenticated: true, openLoginModal: vi.fn() }),
}))

// API: stub the reads loadData performs, and spy on the writes we care about.
vi.mock('@/infrastructure', () => {
    class ApiError extends Error {
        isTransient = false
    }
    return {
        ApiError,
        apiService: {
            getCharacters: vi.fn().mockResolvedValue([]),
            getWorlds: vi.fn().mockResolvedValue([]),
            getItems: vi.fn().mockResolvedValue([]),
            getAdventureTemplates: vi.fn().mockResolvedValue([]),
            getAdventureSessions: vi.fn().mockResolvedValue([]),
            getCharacterChats: vi.fn().mockResolvedValue([]),
            getLorebooks: vi.fn().mockResolvedValue([]),
            getStories: vi.fn().mockResolvedValue([]),
            createAdventureSession: vi.fn().mockResolvedValue({}),
            createCharacterChat: vi.fn().mockResolvedValue({}),
            createCharacterGroupChat: vi.fn().mockResolvedValue({}),
            updateAdventureSnapshot: vi.fn().mockResolvedValue({}),
            updateCharacter: vi.fn().mockResolvedValue({}),
            updateWorld: vi.fn().mockResolvedValue({}),
            updateItem: vi.fn().mockResolvedValue({}),
            addCharacterChatCodexCards: vi.fn().mockResolvedValue({}),
            updateCharacterChatCodexCard: vi.fn().mockResolvedValue({}),
            deleteCharacterChatCodexCard: vi.fn().mockResolvedValue({}),
            deleteAllUserData: vi.fn().mockResolvedValue({ message: 'ok', deleted: {} }),
            deleteCharacter: vi.fn().mockResolvedValue({}),
            deleteWorld: vi.fn().mockResolvedValue({}),
            deleteItem: vi.fn().mockResolvedValue({}),
            deleteAdventureTemplate: vi.fn().mockResolvedValue({}),
            deleteAdventureSession: vi.fn().mockResolvedValue({}),
            deleteCharacterChat: vi.fn().mockResolvedValue({}),
        },
    }
})

import { apiService } from '@/infrastructure'
import { DataContext, DataProvider } from './DataProvider'

const SNAPSHOT: AdventureSnapshot = {
    schema_version: 1,
    source: 'mysql_card_body',
    template_card_id: 'tpl-1',
    template: {
        id: 'tpl-1',
        description: 'Edited scenario',
        characters: [{ id: 'c1', name: 'Dorn the Bold', race: 'Dwarf' }],
    },
}

function Saver() {
    const ctx = useContext(DataContext)
    return <button onClick={() => ctx?.saveInProgressSnapshot('7', SNAPSHOT)}>save</button>
}

describe('DataProvider.saveInProgressSnapshot', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('persists to the adventure snapshot endpoint, never the library card endpoints', async () => {
        render(
            <DataProvider>
                <Saver />
            </DataProvider>,
        )

        fireEvent.click(screen.getByText('save'))

        await waitFor(() => {
            expect(apiService.updateAdventureSnapshot).toHaveBeenCalledWith(7, SNAPSHOT)
        })
        // The original character / world library cards must stay untouched.
        expect(apiService.updateCharacter).not.toHaveBeenCalled()
        expect(apiService.updateWorld).not.toHaveBeenCalled()
    })
})

/** A chat row as GET /character-chats/ returns it. */
const CHAT_ROW = {
    chat_id: 9,
    character_id: 'c1',
    persona_id: 'p1',
    character: { id: 'c1', name: 'Lyra', greeting: 'Well met.' },
    persona: { id: 'p1', name: 'Aria', role: 'persona' },
    codex_cards: [
        {
            id: 'codex-1',
            kind: 'world',
            card_id: 'w1',
            enabled: true,
            precedence: 0,
            snapshot: { name: 'Moon Gate', description: 'A city under silver weather.' },
        },
    ],
    last_turn: JSON.stringify({ turns: [{ id: 't1', type: 'ai', content: 'Well met.', timestamp: '' }] }),
    created_at: '2026-06-09T00:00:00',
    updated_at: '2026-06-09T00:00:00',
}

const CHAT_CHARACTER = { id: 'c1', name: 'Lyra', race: 'Elf', description: 'A ranger.', role: 'character' as const, stats: {} }
const CHAT_PERSONA = { id: 'p1', name: 'Aria', race: 'Human', description: 'A traveler.', role: 'persona' as const, stats: {} }
const TEMPLATE = { id: 't1', scenario: 'Open the gate', characters: [], turns: [], status: 'draft' as const }

function ChatProbe() {
    const ctx = useContext(DataContext)
    return (
        <div>
            <span data-testid="chat-count">{ctx?.characterChats.length}</span>
            <span data-testid="active-chat">{ctx?.activeCharacterChat?.id ?? 'none'}</span>
            <span data-testid="active-chat-mode">{ctx?.activeCharacterChatMode ?? 'none'}</span>
            <span data-testid="active-persona">{ctx?.activeCharacterChat?.persona?.name ?? 'none'}</span>
            <span data-testid="active-codex-count">{ctx?.activeCharacterChat?.codexCards?.length ?? 0}</span>
            <span data-testid="first-chat-codex-count">{ctx?.characterChats[0]?.codexCards?.length ?? 0}</span>
            {ctx?.characterChats.map((chat) => (
                <span key={chat.id} data-testid={`chat-${chat.id}`}>{chat.character?.name}</span>
            ))}
            <button onClick={() => ctx?.startCharacterChat(CHAT_CHARACTER, CHAT_PERSONA)}>start chat</button>
            <button onClick={() => ctx?.startCharacterGroupChat([CHAT_CHARACTER, { id: 'c2', name: 'Dorn', race: 'Dwarf', role: 'character' as const, stats: {} }], CHAT_PERSONA)}>
                start group chat
            </button>
            <button onClick={() => ctx?.resumeCharacterChat(ctx.characterChats[0])}>resume</button>
            <button onClick={() => ctx?.resumeCharacterChat(ctx.characterChats[0], { mode: 'voice' })}>resume voice</button>
            <button onClick={() => ctx?.addCharacterChatCodexCards('9', [{ kind: 'item', cardId: 'i1' }])}>add codex</button>
            <button onClick={() => ctx?.toggleCharacterChatCodexCard('9', 'codex-1', false)}>toggle codex</button>
            <button onClick={() => ctx?.removeCharacterChatCodexCard('9', 'codex-1')}>remove codex</button>
            <button onClick={() => ctx?.deleteCharacterChat('9')}>delete</button>
        </div>
    )
}

describe('DataProvider character chats', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(apiService.getCharacterChats).mockResolvedValue([CHAT_ROW])
    })

    it('loads the chat list with parsed turns and the chat character', async () => {
        render(
            <DataProvider>
                <ChatProbe />
            </DataProvider>,
        )

        await waitFor(() => expect(screen.getByTestId('chat-count')).toHaveTextContent('1'))
        expect(screen.getByTestId('chat-9')).toHaveTextContent('Lyra')
        expect(screen.getByTestId('first-chat-codex-count')).toHaveTextContent('1')
    })

    it('starts a fresh character chat with the selected persona id', async () => {
        vi.mocked(apiService.createCharacterChat).mockResolvedValue({
            chat_id: 10,
            character_id: 'c1',
            persona_id: 'p1',
            persona: CHAT_PERSONA,
            last_turn: '{}',
            created_at: '2026-06-10T00:00:00',
            updated_at: '2026-06-10T00:00:00',
        })
        render(
            <DataProvider>
                <ChatProbe />
            </DataProvider>,
        )
        await waitFor(() => expect(screen.getByTestId('chat-count')).toHaveTextContent('1'))

        fireEvent.click(screen.getByText('start chat'))

        await waitFor(() => expect(apiService.createCharacterChat).toHaveBeenCalledWith('c1', 'p1'))
        await waitFor(() => expect(screen.getByTestId('active-chat')).toHaveTextContent('10'))
        expect(screen.getByTestId('active-chat-mode')).toHaveTextContent('text')
        expect(screen.getByTestId('active-persona')).toHaveTextContent('Aria')
        expect(screen.getByTestId('chat-count')).toHaveTextContent('2')
    })

    it('creates a fresh group chat with selected character ids', async () => {
        vi.mocked(apiService.createCharacterGroupChat).mockResolvedValue({
            chat_id: 12,
            kind: 'character_group',
            character_ids: ['c1', 'c2'],
            characters: [
                CHAT_CHARACTER,
                { id: 'c2', name: 'Dorn', race: 'Dwarf', role: 'character', stats: {} },
            ],
            persona_id: 'p1',
            persona: CHAT_PERSONA,
            title: 'Lyra, Dorn',
            last_turn: '{}',
            created_at: '2026-06-10T00:00:00',
            updated_at: '2026-06-10T00:00:00',
        })
        render(
            <DataProvider>
                <ChatProbe />
            </DataProvider>,
        )

        fireEvent.click(screen.getByText('start group chat'))

        await waitFor(() => expect(apiService.createCharacterGroupChat).toHaveBeenCalledWith(['c1', 'c2'], 'p1'))
        await waitFor(() => expect(screen.getByTestId('active-chat')).toHaveTextContent('12'))
        expect(screen.getByTestId('active-chat-mode')).toHaveTextContent('text')
        expect(screen.getByTestId('active-persona')).toHaveTextContent('Aria')
    })

    it('resume sets the active chat without any network call', async () => {
        render(
            <DataProvider>
                <ChatProbe />
            </DataProvider>,
        )
        await waitFor(() => expect(screen.getByTestId('chat-count')).toHaveTextContent('1'))

        fireEvent.click(screen.getByText('resume'))

        await waitFor(() => expect(screen.getByTestId('active-chat')).toHaveTextContent('9'))
        expect(screen.getByTestId('active-chat-mode')).toHaveTextContent('text')
        expect(apiService.getCharacterChats).toHaveBeenCalledTimes(1) // only the initial load
    })

    it('resume can mark an existing character chat as voice mode without network calls', async () => {
        render(
            <DataProvider>
                <ChatProbe />
            </DataProvider>,
        )
        await waitFor(() => expect(screen.getByTestId('chat-count')).toHaveTextContent('1'))

        fireEvent.click(screen.getByText('resume voice'))

        await waitFor(() => expect(screen.getByTestId('active-chat')).toHaveTextContent('9'))
        expect(screen.getByTestId('active-chat-mode')).toHaveTextContent('voice')
        expect(apiService.getCharacterChats).toHaveBeenCalledTimes(1)
    })

    it('updates active chat and list when chat codex changes', async () => {
        vi.mocked(apiService.addCharacterChatCodexCards).mockResolvedValue({
            ...CHAT_ROW,
            codex_cards: [
                ...(CHAT_ROW.codex_cards),
                {
                    id: 'codex-2',
                    kind: 'item',
                    card_id: 'i1',
                    enabled: true,
                    precedence: 1,
                    snapshot: { name: 'Glass Key', description: 'Opens locked weather.' },
                },
            ],
        })
        render(
            <DataProvider>
                <ChatProbe />
            </DataProvider>,
        )
        await waitFor(() => expect(screen.getByTestId('chat-count')).toHaveTextContent('1'))
        fireEvent.click(screen.getByText('resume'))
        await waitFor(() => expect(screen.getByTestId('active-codex-count')).toHaveTextContent('1'))

        fireEvent.click(screen.getByText('add codex'))

        await waitFor(() => expect(apiService.addCharacterChatCodexCards).toHaveBeenCalledWith(9, [{ kind: 'item', cardId: 'i1' }]))
        await waitFor(() => expect(screen.getByTestId('active-codex-count')).toHaveTextContent('2'))
        expect(screen.getByTestId('first-chat-codex-count')).toHaveTextContent('2')
    })

    it('delete removes the row and clears a matching active chat', async () => {
        render(
            <DataProvider>
                <ChatProbe />
            </DataProvider>,
        )
        await waitFor(() => expect(screen.getByTestId('chat-count')).toHaveTextContent('1'))
        fireEvent.click(screen.getByText('resume'))
        await waitFor(() => expect(screen.getByTestId('active-chat')).toHaveTextContent('9'))

        fireEvent.click(screen.getByText('delete'))

        await waitFor(() => expect(apiService.deleteCharacterChat).toHaveBeenCalledWith(9))
        await waitFor(() => expect(screen.getByTestId('chat-count')).toHaveTextContent('0'))
        expect(screen.getByTestId('active-chat')).toHaveTextContent('none')
    })
})

function AdventureProbe() {
    const ctx = useContext(DataContext)
    const [startedId, setStartedId] = useState('none')
    const [error, setError] = useState('')
    return (
        <div>
            <span data-testid="started-adventure">{startedId}</span>
            {error && <span role="alert">{error}</span>}
            <button
                onClick={() => {
                    void ctx?.startTemplate(TEMPLATE, CHAT_PERSONA)
                        .then((adventure) => setStartedId(adventure.id))
                        .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to start adventure'))
                }}
            >
                start adventure
            </button>
        </div>
    )
}

describe('DataProvider adventure starts', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(apiService.createAdventureSession).mockResolvedValue({
            adventure_id: 11,
            adventure_template: 't1',
            adventure_last_turn: '{}',
            template_snapshot: {
                schema_version: 1,
                source: 'mysql_card_body',
                template_card_id: 't1',
                template: { id: 't1', description: 'Open the gate', persona: CHAT_PERSONA, characters: [] },
            },
        })
    })

    it('starts an adventure session with the selected persona id', async () => {
        render(
            <DataProvider>
                <AdventureProbe />
            </DataProvider>,
        )

        fireEvent.click(screen.getByText('start adventure'))

        await waitFor(() => expect(apiService.createAdventureSession).toHaveBeenCalledWith('t1', 'p1'))
        await waitFor(() => expect(screen.getByTestId('started-adventure')).toHaveTextContent('11'))
    })

    it('rejects the returned promise when adventure session creation fails', async () => {
        vi.mocked(apiService.createAdventureSession).mockRejectedValueOnce(new Error('session failed'))
        render(
            <DataProvider>
                <AdventureProbe />
            </DataProvider>,
        )

        fireEvent.click(screen.getByText('start adventure'))

        expect(await screen.findByRole('alert')).toHaveTextContent('session failed')
        expect(screen.getByTestId('started-adventure')).toHaveTextContent('none')
    })
})

function Clearer() {
    const ctx = useContext(DataContext)
    return <button onClick={() => ctx?.clearAllData()}>clear</button>
}

describe('DataProvider.clearAllData', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('wipes all data through the single DELETE /user/data endpoint, not item-by-item', async () => {
        render(
            <DataProvider>
                <Clearer />
            </DataProvider>,
        )

        fireEvent.click(screen.getByText('clear'))

        await waitFor(() => {
            expect(apiService.deleteAllUserData).toHaveBeenCalledTimes(1)
        })
        // The legacy per-item delete path must no longer be used.
        expect(apiService.deleteCharacter).not.toHaveBeenCalled()
        expect(apiService.deleteWorld).not.toHaveBeenCalled()
        expect(apiService.deleteItem).not.toHaveBeenCalled()
        expect(apiService.deleteAdventureTemplate).not.toHaveBeenCalled()
        expect(apiService.deleteAdventureSession).not.toHaveBeenCalled()
    })
})
