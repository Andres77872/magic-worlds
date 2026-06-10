import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { CharacterList } from './CharacterList'
import { characters } from './fixtures'

afterEach(cleanup)

describe('CharacterList', () => {
    it('shows a Chat footer button per card when onChat is wired', () => {
        render(<CharacterList characters={characters} onChat={() => {}} onEdit={() => {}} onDelete={() => {}} />)
        expect(screen.getAllByRole('button', { name: /^Chat with / })).toHaveLength(characters.length)
    })

    it('hides the Chat button when onChat is absent', () => {
        render(<CharacterList characters={characters} onEdit={() => {}} onDelete={() => {}} />)
        expect(screen.queryByRole('button', { name: /^Chat with / })).not.toBeInTheDocument()
    })

    it('Chat starts the chat without also triggering the card edit click', () => {
        const onChat = vi.fn()
        const onEdit = vi.fn()
        render(<CharacterList characters={[characters[0]]} onChat={onChat} onEdit={onEdit} onDelete={() => {}} />)

        fireEvent.click(screen.getByRole('button', { name: `Chat with ${characters[0].name}` }))

        expect(onChat).toHaveBeenCalledWith(characters[0])
        expect(onEdit).not.toHaveBeenCalled()
    })

    it('renders the description snippet on the card body', () => {
        render(<CharacterList characters={[characters[0]]} onEdit={() => {}} onDelete={() => {}} />)
        expect(screen.getByText(/card-sharp innkeeper/)).toBeInTheDocument()
    })
})
