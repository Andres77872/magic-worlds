import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CharacterChatCodexCard } from '@/shared'
import type { CardSourceStatus } from '@/shared/types/workspace.types'
import { CharacterChatCodexPanel } from './CharacterChatCodexPanel'

const sourceCheck = vi.hoisted(() => ({
    state: 'unchecked' as 'unchecked' | 'checking' | 'ready' | 'failed',
    statuses: new Map<string, CardSourceStatus>(), recheck: vi.fn(),
}))
vi.mock('@/features/codex/hooks/useCardSourceStatuses', () => ({ useCardSourceStatuses: () => sourceCheck }))
beforeEach(() => { sourceCheck.state = 'unchecked'; sourceCheck.statuses.clear(); sourceCheck.recheck.mockClear() })

vi.mock('@/app/hooks/useFloatingWindows', () => ({
    useFloatingWindows: () => ({ openWindow: vi.fn() }),
}))
vi.mock('@/features/codex/hooks/useWorkspaceSwitch', () => ({ useWorkspaceSwitch: () => {} }))
vi.mock('@/features/codex/hooks/useCodexCardBrowser', () => ({
    useCodexCardBrowser: () => ({
        options: [
            { id: 'char-1', type: 'character', name: 'Lyra' },
            { id: 'char-2', type: 'character', name: 'Dorn' },
            { id: 'persona-1', type: 'character', name: 'Aria' },
            { id: 'other', type: 'character', name: 'Mira' },
        ],
        collections: [], loading: false, loadingMore: false, hasMore: false, error: null,
    }),
}))

const participantCardIds = new Set(['char-1', 'char-2', 'persona-1'])
const card = (cardId: string, name: string, enabled = true): CharacterChatCodexCard => ({
    id: `codex-${cardId}`, kind: 'character', cardId, enabled, precedence: 0,
    snapshot: { id: cardId, name, description: 'Frozen description.' },
})
const callbacks = () => ({
    onAddCards: vi.fn(async () => {}),
    onToggleCard: vi.fn(async () => {}),
    onRemoveCard: vi.fn(async () => {}),
})

describe('CharacterChatCodexPanel participant validation', () => {
    it('keeps an unavailable source in Codex and in the picker without mutating it', () => {
        sourceCheck.state = 'ready'
        sourceCheck.statuses.set('character:gone', { card_type: 'character', card_id: 'gone', available: false,
            latest_version_id: null, latest_version_number: null, has_draft: null })
        const saved = { ...card('gone', 'Lost card'), snapshot: { id: 'gone', name: 'Lost card', source_card_version_number: 3 } }
        const handlers = callbacks()
        render(<CharacterChatCodexPanel cards={[saved]} participantCardIds={participantCardIds} {...handlers} />)
        expect(screen.getByTestId('chat-codex-source-status')).toHaveTextContent('Using v3 · Source unavailable')
        expect(screen.getByRole('switch', { name: 'Disable Lost card' })).toBeEnabled()
        fireEvent.click(screen.getByRole('button', { name: 'Add cards' }))
        expect(screen.getByRole('button', { name: /^Lost card.*Source unavailable/ })).toBeDisabled()
        expect(screen.getByTestId('chat-codex-card')).toBeInTheDocument()
        expect(handlers.onToggleCard).not.toHaveBeenCalled()
        expect(handlers.onRemoveCard).not.toHaveBeenCalled()
        expect(saved.enabled).toBe(true)
    })

    it('shows the frozen version alongside a newer library head', () => {
        sourceCheck.state = 'ready'
        sourceCheck.statuses.set('character:other', { card_type: 'character', card_id: 'other', available: true,
            latest_version_id: 'v5', latest_version_number: 5, has_draft: true })
        render(<CharacterChatCodexPanel cards={[{ ...card('other', 'Old name'),
            snapshot: { name: 'Old name', source_card_version_number: 3, source_card_version_id: 'v3' } }]}
            participantCardIds={participantCardIds} {...callbacks()} />)
        expect(screen.getByTestId('chat-codex-source-status')).toHaveTextContent('Using v3 · Older version · Latest saved version v5 · Unpublished changes')
        fireEvent.click(screen.getByRole('button', { name: 'Add cards' }))
        expect(screen.getByRole('button', { name: /^Old name.*Using v3.*Older version.*Library name: Mira/ })).toBeDisabled()
    })

    it('prevents picking every participant and the active persona while allowing other cards', async () => {
        const handlers = callbacks()
        render(<CharacterChatCodexPanel cards={[]} participantCardIds={participantCardIds} {...handlers} />)
        fireEvent.click(screen.getByRole('button', { name: 'Add cards' }))
        for (const name of ['Lyra', 'Dorn', 'Aria']) {
            expect(screen.getByRole('button', { name: new RegExp(`${name}\\s*Already in chat context`) })).toBeDisabled()
        }
        fireEvent.click(screen.getByRole('button', { name: 'Mira' }))
        fireEvent.click(screen.getByTestId('codex-add-cards-submit'))
        await waitFor(() => expect(handlers.onAddCards).toHaveBeenCalledWith([{ kind: 'character', cardId: 'other' }]))
    })

    it('warns about existing enabled overlaps without changing data and keeps manual controls available', async () => {
        const handlers = callbacks()
        const cards = [card('char-1', 'Lyra'), card('persona-1', 'Aria')]
        const { rerender } = render(<CharacterChatCodexPanel cards={cards} participantCardIds={participantCardIds} {...handlers} />)
        expect(screen.getByTestId('chat-codex-participant-warning')).toHaveTextContent('Lyra, Aria')
        expect(handlers.onToggleCard).not.toHaveBeenCalled()
        expect(handlers.onRemoveCard).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole('switch', { name: 'Disable Lyra' }))
        await waitFor(() => expect(handlers.onToggleCard).toHaveBeenCalledWith(cards[0], false))

        rerender(<CharacterChatCodexPanel cards={[card('char-1', 'Lyra', false)]} participantCardIds={participantCardIds} {...handlers} />)
        expect(screen.queryByTestId('chat-codex-participant-warning')).not.toBeInTheDocument()
        expect(screen.getByRole('switch', { name: 'Enable Lyra' })).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Remove Lyra' })).toBeEnabled()
    })
})
