import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nextProvider } from 'react-i18next'
import { i18n } from '@/app/i18n'
import type { Character } from '@/shared'
import { NewCharacterChatDialog } from './NewCharacterChatDialog'

const lyra: Character = {
    id: 'lyra', name: 'Lyra', race: 'Half-elf', stats: {}, role: 'character',
    description: 'An innkeeper with a talent for secrets.', greeting: 'The fire knows your name.',
    default_persona_id: 'aria',
}
const sable: Character = { id: 'sable', name: 'Sable', race: 'Tiefling', stats: {}, description: 'A quiet courier.' }
const aria: Character = { id: 'aria', name: 'Aria', race: 'Human', stats: {}, role: 'persona' }
const mirren: Character = { id: 'mirren', name: 'Mirren', race: 'Elf', stats: {}, role: 'persona', is_default_persona: true }
const characters = [lyra, sable, aria, mirren]

function setup(props: Partial<Parameters<typeof NewCharacterChatDialog>[0]> = {}) {
    const handlers = { onStart: vi.fn().mockResolvedValue(undefined), onClose: vi.fn(), onRetry: vi.fn(), onBrowseCharacters: vi.fn() }
    const view = render(<NewCharacterChatDialog characters={characters} {...handlers} {...props} />)
    return { ...handlers, ...view }
}

function selectCharacter(name = 'Lyra') {
    fireEvent.click(screen.getByRole('button', { name: `Chat with ${name}` }))
    fireEvent.click(screen.getByRole('button', { name: 'Choose persona' }))
}

describe('NewCharacterChatDialog', () => {
    it('offers AI character cards and previews the opening line without starting a chat', () => {
        const { onStart } = setup()
        expect(screen.getByRole('dialog', { name: 'New chat' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Choose persona' })).toBeDisabled()
        expect(screen.queryByRole('button', { name: 'Chat with Aria' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Chat with Mirren' })).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Chat with Lyra' }))

        expect(screen.getByRole('button', { name: 'Chat with Lyra' })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByText('The fire knows your name.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Choose persona' })).toBeEnabled()
        expect(onStart).not.toHaveBeenCalled()
    })

    it('searches character names, races, and descriptions and recovers from no results', () => {
        setup()
        const search = screen.getByRole('searchbox', { name: 'Search characters' })
        for (const query of [' SABLE ', 'tiefling', 'courier']) {
            fireEvent.change(search, { target: { value: query } })
            expect(screen.getByRole('button', { name: 'Chat with Sable' })).toBeInTheDocument()
            expect(screen.queryByRole('button', { name: 'Chat with Lyra' })).not.toBeInTheDocument()
        }
        fireEvent.change(search, { target: { value: 'missing' } })
        expect(screen.getByText('No matching cards')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
        expect(search).toHaveValue('')
        expect(screen.getByRole('button', { name: 'Chat with Lyra' })).toBeInTheDocument()
    })

    it('preselects the character-specific persona and starts only after explicit confirmation', async () => {
        const { onStart, onClose } = setup()
        selectCharacter()

        expect(screen.getByRole('heading', { name: 'Choose who you play' })).toHaveFocus()
        expect(screen.getByRole('button', { name: 'Play as Aria' })).toHaveAttribute('aria-pressed', 'true')
        expect(within(screen.getByRole('button', { name: 'Play as Aria' })).getByText('Default persona')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Play as Mirren' })).toHaveAttribute('aria-pressed', 'false')
        expect(onStart).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole('button', { name: 'Start chat' }))

        expect(onStart).toHaveBeenCalledExactlyOnceWith(lyra, aria)
        await act(async () => {})
        expect(onClose).not.toHaveBeenCalled()
    })

    it('uses the library default when the chosen character has no persona preference', () => {
        setup()
        selectCharacter('Sable')
        expect(screen.getByRole('button', { name: 'Play as Mirren' })).toHaveAttribute('aria-pressed', 'true')
    })

    it('allows changing and searching personas, and preserves choices when going back', async () => {
        const { onStart } = setup()
        fireEvent.change(screen.getByRole('searchbox', { name: 'Search characters' }), { target: { value: 'Lyra' } })
        selectCharacter()
        fireEvent.change(screen.getByRole('searchbox', { name: 'Search personas' }), { target: { value: 'mirren' } })
        fireEvent.click(screen.getByRole('button', { name: 'Play as Mirren' }))
        fireEvent.click(screen.getByRole('button', { name: 'Back' }))

        expect(screen.getByRole('heading', { name: 'Choose who to chat with' })).toHaveFocus()
        expect(screen.getByRole('searchbox', { name: 'Search characters' })).toHaveValue('Lyra')
        expect(screen.getByRole('button', { name: 'Chat with Lyra' })).toHaveAttribute('aria-pressed', 'true')
        fireEvent.click(screen.getByRole('button', { name: 'Choose persona' }))
        expect(screen.getByRole('searchbox', { name: 'Search personas' })).toHaveValue('mirren')
        expect(screen.getByRole('button', { name: 'Play as Mirren' })).toHaveAttribute('aria-pressed', 'true')
        fireEvent.click(screen.getByRole('button', { name: 'Start chat' }))
        expect(onStart).toHaveBeenCalledExactlyOnceWith(lyra, mirren)
        await act(async () => {})
    })

    it('applies the new character default after changing characters', () => {
        setup()
        selectCharacter('Sable')
        fireEvent.click(screen.getByRole('button', { name: 'Back' }))
        selectCharacter('Lyra')
        expect(screen.getByRole('button', { name: 'Play as Aria' })).toHaveAttribute('aria-pressed', 'true')
    })

    it('allows a library character as the persona when no persona cards exist', async () => {
        const { onStart } = setup({ characters: [lyra, sable] })
        selectCharacter()
        fireEvent.click(screen.getByRole('button', { name: 'Play as Sable' }))
        fireEvent.click(screen.getByRole('button', { name: 'Start chat' }))
        expect(onStart).toHaveBeenCalledExactlyOnceWith(lyra, sable)
        await act(async () => {})
    })

    it('keeps the selected pair after a failure and permits retry', async () => {
        const onStart = vi.fn().mockRejectedValueOnce(new Error('Service unavailable')).mockResolvedValue(undefined)
        const { onClose } = setup({ onStart })
        selectCharacter()
        fireEvent.click(screen.getByRole('button', { name: 'Start chat' }))

        expect(await screen.findByRole('alert')).toHaveTextContent('Could not start this chat. Your choices are saved here; try again.')
        expect(screen.getByRole('button', { name: 'Play as Aria' })).toHaveAttribute('aria-pressed', 'true')
        expect(onClose).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole('button', { name: 'Start chat' }))
        expect(onStart).toHaveBeenCalledTimes(2)
        expect(onStart).toHaveBeenLastCalledWith(lyra, aria)
        await act(async () => {})
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('prevents duplicate starts, changes, and dismissal while the request is pending', async () => {
        let finish!: () => void
        const onStart = vi.fn(() => new Promise<void>((resolve) => { finish = resolve }))
        const { onClose } = setup({ onStart })
        selectCharacter()
        const start = screen.getByRole('button', { name: 'Start chat' })
        fireEvent.click(start)
        fireEvent.click(start)
        fireEvent.click(screen.getByRole('button', { name: 'Back' }))
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
        fireEvent.keyDown(document, { key: 'Escape' })
        const scrim = screen.getByRole('dialog').parentElement!
        fireEvent.pointerDown(scrim)
        fireEvent.click(scrim)

        expect(onStart).toHaveBeenCalledTimes(1)
        expect(onClose).not.toHaveBeenCalled()
        expect(screen.getByRole('status')).toHaveTextContent('Starting chat…')
        expect(screen.getByRole('button', { name: 'Play as Aria' })).toBeDisabled()
        expect(screen.getByRole('searchbox', { name: 'Search personas' })).toBeDisabled()
        expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
        await act(async () => { finish() })
    })

    it('cancels without creating a conversation', () => {
        const { onStart, onClose } = setup()
        selectCharacter()
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
        expect(onClose).toHaveBeenCalledTimes(1)
        expect(onStart).not.toHaveBeenCalled()
    })

    it('supports Escape dismissal before starting', () => {
        const { onClose } = setup()
        fireEvent.keyDown(document, { key: 'Escape' })
        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('offers the character library when only persona cards exist', () => {
        const { onBrowseCharacters } = setup({ characters: [aria, mirren] })
        expect(screen.getByText('No character cards yet')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Choose persona' })).toBeDisabled()
        fireEvent.click(screen.getByRole('button', { name: 'Browse characters' }))
        expect(onBrowseCharacters).toHaveBeenCalledTimes(1)
    })

    it('shows loading without a misleading empty-library state', () => {
        setup({ characters: [], loading: true })
        expect(screen.getByRole('status')).toHaveTextContent('Loading your characters…')
        expect(screen.queryByText('No character cards yet')).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Choose persona' })).toBeDisabled()
    })

    it('shows a localized load failure and offers both retry and browsing characters', () => {
        const { onRetry, onBrowseCharacters } = setup({ loadError: 'Network error' })
        expect(screen.getByRole('alert')).toHaveTextContent('Your library could not finish loading. Try again or browse characters.')
        expect(screen.queryByRole('button', { name: 'Chat with Lyra' })).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
        expect(onRetry).toHaveBeenCalledTimes(1)
        fireEvent.click(screen.getByRole('button', { name: 'Browse characters' }))
        expect(onBrowseCharacters).toHaveBeenCalledTimes(1)
    })

    it('renders both selection steps in Spanish', () => {
        render(
            <I18nextProvider i18n={i18n.cloneInstance({ lng: 'es' })}>
                <NewCharacterChatDialog characters={characters} onRetry={vi.fn()} onStart={vi.fn()} onClose={vi.fn()} onBrowseCharacters={vi.fn()} />
            </I18nextProvider>,
        )
        expect(screen.getByRole('dialog', { name: 'Nuevo chat' })).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Chatear con Lyra' }))
        fireEvent.click(screen.getByRole('button', { name: 'Elegir persona' }))
        expect(screen.getByRole('button', { name: 'Interpretar a Aria' })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByRole('button', { name: 'Iniciar chat' })).toBeEnabled()
    })
})
