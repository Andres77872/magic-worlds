import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Character, CharacterChatSession } from '@/shared'
import { ChatroomPage } from './ChatroomPage'

const setPage = vi.fn()
const openLoginModal = vi.fn()
const resumeCharacterChat = vi.fn()
const deleteCharacterChat = vi.fn().mockResolvedValue(undefined)
const loadData = vi.fn().mockResolvedValue(undefined)
let authed = true
let characterChats: CharacterChatSession[] = []

const CHARACTERS: Character[] = [
    { id: 'c1', name: 'Lyra', race: 'Half-elf', stats: {}, role: 'character' },
    { id: 'c2', name: 'Sable', race: 'Tiefling', stats: {}, role: 'character' },
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
        characterChats,
        resumeCharacterChat,
        deleteCharacterChat,
        loadData,
    }),
}))

beforeEach(() => {
    authed = true
    characterChats = CHATS
    vi.stubEnv('VITE_FEATURE_GROUP_CHATS_ENABLED', 'true')
})

afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
})

describe('ChatroomPage', () => {
    it('renders saved character chats and resumes the selected chat', () => {
        render(<ChatroomPage />)

        expect(screen.getByTestId('chatroom-page')).toBeInTheDocument()
        expect(screen.getByText('Lyra')).toBeInTheDocument()
        expect(screen.getByText('Sable')).toBeInTheDocument()
        expect(screen.getByText('Lyra, Sable')).toBeInTheDocument()
        expect(loadData).toHaveBeenCalledWith({ silent: true })

        fireEvent.click(screen.getByRole('button', { name: 'Resume chat: Lyra' }))

        expect(resumeCharacterChat).toHaveBeenCalledWith(CHATS[0])
        expect(setPage).toHaveBeenCalledWith('character-chat')
    })

    it('filters chats by query and clears the search', () => {
        render(<ChatroomPage />)

        fireEvent.change(screen.getByLabelText('Search chats'), { target: { value: 'sable' } })

        expect(screen.queryByText('Lyra')).not.toBeInTheDocument()
        expect(screen.getByText('Sable')).toBeInTheDocument()
        expect(screen.getByText('Lyra, Sable')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))

        expect(screen.getByText('Lyra')).toBeInTheDocument()
    })

    it('navigates to character selection for a new group chat', () => {
        render(<ChatroomPage />)

        fireEvent.click(screen.getByRole('button', { name: 'New group chat' }))

        expect(setPage).toHaveBeenCalledWith('gallery-characters', {
            hash: '#/gallery/characters?mode=group-chat',
        })
    })

    it('hides voice-call actions while the frontend flag is off', async () => {
        vi.stubEnv('VITE_FEATURE_CALLS_ENABLED', 'false')
        render(<ChatroomPage />)

        fireEvent.click(screen.getByRole('button', { name: 'Actions for Lyra' }))

        expect(await screen.findByRole('menuitem', { name: 'Resume chat' })).toBeInTheDocument()
        expect(screen.queryByRole('menuitem', { name: 'Start voice call' })).not.toBeInTheDocument()
    })

    it('resumes an existing chat in voice mode when the flag is enabled', async () => {
        vi.stubEnv('VITE_FEATURE_CALLS_ENABLED', 'true')
        render(<ChatroomPage />)

        fireEvent.click(screen.getByRole('button', { name: 'Actions for Lyra' }))
        fireEvent.click(await screen.findByRole('menuitem', { name: 'Start voice call' }))

        expect(resumeCharacterChat).toHaveBeenCalledWith(CHATS[0], { mode: 'voice' })
        expect(setPage).toHaveBeenCalledWith('character-chat')
    })

    it('hides voice-call actions for group chats when the flag is enabled', async () => {
        vi.stubEnv('VITE_FEATURE_CALLS_ENABLED', 'true')
        render(<ChatroomPage />)

        fireEvent.click(screen.getByRole('button', { name: 'Actions for Lyra, Sable' }))

        expect(await screen.findByRole('menuitem', { name: 'Resume chat' })).toBeInTheDocument()
        expect(screen.queryByRole('menuitem', { name: 'Start voice call' })).not.toBeInTheDocument()
    })

    it('deletes a chat after confirmation', async () => {
        render(<ChatroomPage />)

        fireEvent.click(screen.getByRole('button', { name: 'Actions for Lyra' }))
        fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }))

        const dialog = screen.getByRole('dialog', { name: 'Delete chat' })
        expect(within(dialog).getByText('Delete "Lyra"? This cannot be undone.')).toBeInTheDocument()

        fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

        expect(deleteCharacterChat).toHaveBeenCalledWith('chat-1')
    })

    it('renders signed-out visitors and gates only new group chat', () => {
        authed = false
        characterChats = []

        render(<ChatroomPage />)

        expect(screen.getByTestId('chatroom-page')).toBeInTheDocument()
        expect(openLoginModal).not.toHaveBeenCalled()
        expect(setPage).not.toHaveBeenCalledWith('landing')

        fireEvent.click(screen.getByRole('button', { name: 'Find characters' }))
        expect(setPage).toHaveBeenCalledWith('gallery-characters')
        expect(openLoginModal).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole('button', { name: 'New group chat' }))
        expect(openLoginModal).toHaveBeenCalledTimes(1)
    })
})
