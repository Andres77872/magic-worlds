import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Character, CharacterChatSession } from '@/shared'
import { ChatroomPage } from './ChatroomPage'

const setPage = vi.fn()
const openLoginModal = vi.fn()
const resumeCharacterChat = vi.fn()
const startCharacterChat = vi.fn().mockResolvedValue(undefined)
const deleteCharacterChat = vi.fn().mockResolvedValue(undefined)
const loadData = vi.fn().mockResolvedValue(undefined)
let authed = true
let characterChats: CharacterChatSession[] = []
let characters: Character[] = []

const CHARACTERS: Character[] = [
    { id: 'c1', name: 'Lyra', race: 'Half-elf', stats: {}, role: 'character' },
    { id: 'c2', name: 'Sable', race: 'Tiefling', stats: {}, role: 'character' },
] as Character[]

const PERSONAS: Character[] = [
    { id: 'p1', name: 'Aria', stats: {}, role: 'persona', is_default_persona: true },
    { id: 'p2', name: 'Rowan', stats: {}, role: 'persona' },
] as Character[]

const CHATS: CharacterChatSession[] = [
    {
        id: 'chat-1',
        character_id: 'c1',
        character: CHARACTERS[0],
        persona: { id: 'p1', name: 'Aria', stats: {}, role: 'persona' } as Character,
        turns: [{ id: 't1', type: 'ai', content: 'The fire knows your name.', timestamp: '' }],
        updatedAt: '2026-06-12 09:00:00',
    },
    {
        id: 'chat-2',
        character_id: 'c2',
        character: CHARACTERS[1],
        turns: [{ id: 't2', type: 'user', content: 'Where is the key?', timestamp: '' }],
        updatedAt: '2026-06-11 09:00:00',
    },
    {
        id: 'chat-3',
        kind: 'character_group',
        character_ids: ['c1', 'c2'],
        title: 'Lyra, Sable',
        characters: CHARACTERS,
        persona: { id: 'p1', name: 'Aria', stats: {}, role: 'persona' } as Character,
        turns: [{ id: 't3', type: 'ai', content: 'Lyra: The door listens.', timestamp: '' }],
        updatedAt: '2026-06-10 09:00:00',
    },
]

vi.mock('@/app/hooks', () => ({
    useAuth: () => ({ isAuthenticated: authed, openLoginModal }),
    useNavigation: () => ({ setPage }),
    useData: () => ({
        characters,
        characterChats,
        startCharacterChat,
        resumeCharacterChat,
        deleteCharacterChat,
        loadData,
        loadingState: { isLoading: false, error: null },
    }),
}))

beforeEach(() => {
    authed = true
    characterChats = CHATS
    characters = [...CHARACTERS, ...PERSONAS]
    startCharacterChat.mockReset().mockResolvedValue(undefined)
    loadData.mockReset().mockResolvedValue(undefined)
    vi.stubEnv('VITE_FEATURE_GROUP_CHATS_ENABLED', 'true')
})

async function renderChatroom() {
    await act(async () => {
        render(<ChatroomPage />)
    })
}

function selectNewChat(characterName = 'Lyra', personaName = 'Rowan') {
    fireEvent.click(screen.getByRole('button', { name: 'New chat' }))
    const dialog = screen.getByRole('dialog', { name: 'New chat' })
    fireEvent.click(within(dialog).getByRole('button', { name: `Chat with ${characterName}` }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Choose persona' }))
    fireEvent.click(within(dialog).getByRole('button', { name: `Play as ${personaName}` }))
    return dialog
}

afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
})

describe('ChatroomPage', () => {
    it('renders saved character chats and resumes the selected chat', async () => {
        await renderChatroom()

        expect(screen.getByTestId('chatroom-page')).toBeInTheDocument()
        expect(screen.getByText('Lyra')).toBeInTheDocument()
        expect(screen.getByText('Sable')).toBeInTheDocument()
        expect(screen.getByText('Lyra, Sable')).toBeInTheDocument()
        expect(loadData).toHaveBeenCalledWith({ silent: true })

        fireEvent.click(screen.getByRole('button', { name: 'Resume chat: Lyra' }))

        expect(resumeCharacterChat).toHaveBeenCalledWith(CHATS[0])
        expect(setPage).toHaveBeenCalledWith('character-chat')
    })

    it('filters chats by query and clears the search', async () => {
        await renderChatroom()

        fireEvent.change(screen.getByLabelText('Search chats'), { target: { value: 'sable' } })

        expect(screen.queryByText('Lyra')).not.toBeInTheDocument()
        expect(screen.getByText('Sable')).toBeInTheDocument()
        expect(screen.getByText('Lyra, Sable')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))

        expect(screen.getByText('Lyra')).toBeInTheDocument()
    })

    it('navigates to character selection for a new group chat', async () => {
        await renderChatroom()

        fireEvent.click(screen.getByRole('button', { name: 'New group chat' }))

        expect(setPage).toHaveBeenCalledWith('gallery-characters', {
            hash: '#/gallery/characters?mode=group-chat',
        })
    })

    it('hides voice-call actions while the frontend flag is off', async () => {
        vi.stubEnv('VITE_FEATURE_CALLS_ENABLED', 'false')
        await renderChatroom()

        fireEvent.click(screen.getByRole('button', { name: 'Actions for Lyra' }))

        expect(await screen.findByRole('menuitem', { name: 'Resume chat' })).toBeInTheDocument()
        expect(screen.queryByRole('menuitem', { name: 'Start voice call' })).not.toBeInTheDocument()
    })

    it('resumes an existing chat in voice mode when the flag is enabled', async () => {
        vi.stubEnv('VITE_FEATURE_CALLS_ENABLED', 'true')
        await renderChatroom()

        fireEvent.click(screen.getByRole('button', { name: 'Actions for Lyra' }))
        fireEvent.click(await screen.findByRole('menuitem', { name: 'Start voice call' }))

        expect(resumeCharacterChat).toHaveBeenCalledWith(CHATS[0], { mode: 'voice' })
        expect(setPage).toHaveBeenCalledWith('character-chat')
    })

    it('hides voice-call actions for group chats when the flag is enabled', async () => {
        vi.stubEnv('VITE_FEATURE_CALLS_ENABLED', 'true')
        await renderChatroom()

        fireEvent.click(screen.getByRole('button', { name: 'Actions for Lyra, Sable' }))

        expect(await screen.findByRole('menuitem', { name: 'Resume chat' })).toBeInTheDocument()
        expect(screen.queryByRole('menuitem', { name: 'Start voice call' })).not.toBeInTheDocument()
    })

    it('deletes a chat after confirmation', async () => {
        await renderChatroom()

        fireEvent.click(screen.getByRole('button', { name: 'Actions for Lyra' }))
        fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }))

        const dialog = screen.getByRole('dialog', { name: 'Delete chat' })
        expect(within(dialog).getByText('Delete "Lyra"? This cannot be undone.')).toBeInTheDocument()

        fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

        expect(deleteCharacterChat).toHaveBeenCalledWith('chat-1')
        expect(await screen.findByText('Chat deleted')).toBeInTheDocument()
    })

    it('shows the group title when deleting a group chat', async () => {
        await renderChatroom()

        fireEvent.click(screen.getByRole('button', { name: 'Actions for Lyra, Sable' }))
        fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }))

        const dialog = screen.getByRole('dialog', { name: 'Delete chat' })
        expect(within(dialog).getByText('Delete "Lyra, Sable"? This cannot be undone.')).toBeInTheDocument()

        fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

        expect(deleteCharacterChat).toHaveBeenCalledWith('chat-3')
        expect(await screen.findByText('Chat deleted')).toBeInTheDocument()
    })

    it('lets signed-out visitors browse characters and gates starting chats', async () => {
        authed = false
        characterChats = []

        await renderChatroom()

        expect(screen.getByTestId('chatroom-page')).toBeInTheDocument()
        expect(openLoginModal).not.toHaveBeenCalled()
        expect(setPage).not.toHaveBeenCalledWith('landing')

        fireEvent.click(screen.getByRole('button', { name: 'Find characters' }))
        expect(setPage).toHaveBeenCalledWith('gallery-characters')
        expect(openLoginModal).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole('button', { name: 'New chat' }))
        expect(openLoginModal).toHaveBeenCalledTimes(1)
        expect(screen.queryByRole('dialog', { name: 'New chat' })).not.toBeInTheDocument()
        expect(startCharacterChat).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole('button', { name: 'New group chat' }))
        expect(openLoginModal).toHaveBeenCalledTimes(2)
    })

    it('creates a separate chat with the selected character and persona before navigating', async () => {
        let finishStart!: () => void
        startCharacterChat.mockReturnValueOnce(new Promise<void>((resolve) => { finishStart = resolve }))
        await renderChatroom()

        const dialog = selectNewChat('Sable', 'Rowan')
        expect(startCharacterChat).not.toHaveBeenCalled()
        fireEvent.click(within(dialog).getByRole('button', { name: 'Start chat' }))

        expect(startCharacterChat).toHaveBeenCalledExactlyOnceWith(CHARACTERS[1], PERSONAS[1])
        expect(resumeCharacterChat).not.toHaveBeenCalled()
        expect(setPage).not.toHaveBeenCalled()
        expect(within(dialog).getByRole('button', { name: 'Starting chat…' })).toBeDisabled()

        await act(async () => { finishStart() })

        expect(setPage).toHaveBeenCalledExactlyOnceWith('character-chat')
        expect(screen.queryByRole('dialog', { name: 'New chat' })).not.toBeInTheDocument()
    })

    it('keeps the selected cards available for retry after chat creation fails', async () => {
        startCharacterChat.mockRejectedValueOnce(new Error('Service unavailable'))
        await renderChatroom()

        const dialog = selectNewChat()
        fireEvent.click(within(dialog).getByRole('button', { name: 'Start chat' }))

        expect(await within(dialog).findByRole('alert')).toHaveTextContent('Could not start this chat')
        expect(setPage).not.toHaveBeenCalled()
        expect(within(dialog).getByRole('button', { name: 'Play as Rowan' })).toHaveAttribute('aria-pressed', 'true')
        fireEvent.click(within(dialog).getByRole('button', { name: 'Start chat' }))

        await waitFor(() => expect(setPage).toHaveBeenCalledExactlyOnceWith('character-chat'))
        expect(startCharacterChat).toHaveBeenNthCalledWith(1, CHARACTERS[0], PERSONAS[1])
        expect(startCharacterChat).toHaveBeenNthCalledWith(2, CHARACTERS[0], PERSONAS[1])
    })

    it('does not navigate back to chat after the user leaves during creation', async () => {
        let finishStart!: () => void
        startCharacterChat.mockReturnValueOnce(new Promise<void>((resolve) => { finishStart = resolve }))
        const view = render(<ChatroomPage />)
        await act(async () => {})
        const dialog = selectNewChat()
        fireEvent.click(within(dialog).getByRole('button', { name: 'Start chat' }))

        view.unmount()
        await act(async () => { finishStart() })

        expect(startCharacterChat).toHaveBeenCalledExactlyOnceWith(CHARACTERS[0], PERSONAS[1])
        expect(setPage).not.toHaveBeenCalled()
    })

    it('starts one-to-one chats when group chats are disabled', async () => {
        vi.stubEnv('VITE_FEATURE_GROUP_CHATS_ENABLED', 'false')
        await renderChatroom()

        expect(screen.queryByRole('button', { name: 'New group chat' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Resume chat: Lyra, Sable' })).not.toBeInTheDocument()
        const dialog = selectNewChat()
        fireEvent.click(within(dialog).getByRole('button', { name: 'Start chat' }))

        await waitFor(() => expect(setPage).toHaveBeenCalledWith('character-chat'))
        expect(startCharacterChat).toHaveBeenCalledExactlyOnceWith(CHARACTERS[0], PERSONAS[1])
    })

    it('shows loading before announcing an empty conversation list', async () => {
        characterChats = []
        let finishLoad!: () => void
        loadData.mockReturnValueOnce(new Promise<void>((resolve) => { finishLoad = resolve }))
        render(<ChatroomPage />)

        expect(screen.getByText('Loading conversations…')).toBeInTheDocument()
        expect(screen.getAllByRole('button', { name: 'New chat' })).toHaveLength(1)

        await act(async () => { finishLoad() })

        expect(screen.queryByText('Loading conversations…')).not.toBeInTheDocument()
        expect(screen.getAllByRole('button', { name: 'New chat' })).toHaveLength(2)
    })
})
