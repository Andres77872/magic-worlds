import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { CharacterChatList } from './CharacterChatList'
import { characterChats } from './fixtures'

afterEach(cleanup)

describe('CharacterChatList', () => {
    it('renders a card per chat with the character name, mode badge, and last line', () => {
        render(<CharacterChatList chats={characterChats} onResume={() => {}} onDelete={() => {}} />)
        expect(screen.getByText('Lyra Dawnwhisper')).toBeInTheDocument()
        expect(screen.getByText('Sable')).toBeInTheDocument()
        expect(screen.getAllByText('Chat')).toHaveLength(characterChats.length)
        // Last spoken line, not the first.
        expect(screen.getByText(/owed money by half the coast/)).toBeInTheDocument()
    })

    it('resumes on card click', () => {
        const onResume = vi.fn()
        render(<CharacterChatList chats={characterChats} onResume={onResume} onDelete={() => {}} />)
        fireEvent.click(screen.getByText('Lyra Dawnwhisper'))
        expect(onResume).toHaveBeenCalledWith(characterChats[0])
    })

    it('deletes only after confirming, and names the character in the dialog', async () => {
        const onDelete = vi.fn().mockResolvedValue(undefined)
        render(<CharacterChatList chats={[characterChats[0]]} onResume={() => {}} onDelete={onDelete} />)

        fireEvent.click(screen.getByLabelText('Card actions'))
        fireEvent.click(screen.getByText('Delete'))
        expect(onDelete).not.toHaveBeenCalled()
        expect(screen.getByText(/Delete your chat with/)).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
        expect(onDelete).toHaveBeenCalledWith('cc1')
    })

    it('shows the empty state when there are no chats', () => {
        render(<CharacterChatList chats={[]} onResume={() => {}} onDelete={() => {}} />)
        expect(screen.getByText('No chats yet')).toBeInTheDocument()
    })
})
