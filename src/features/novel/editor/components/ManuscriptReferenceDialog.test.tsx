import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { EditorCodexEntry } from '../types'
import { ManuscriptReferenceDialog } from './ManuscriptReferenceDialog'

const keeper: EditorCodexEntry = { id: 'keeper', label: 'Mira', kind: 'character', enabled: false, contextState: 'disabled', contextRevision: 4, description: 'The lighthouse keeper.', scope: 'scene', scopeLabel: 'The beacon', sourceId: 'keeper-source', sourceVersionNumber: 3 }
const physician: EditorCodexEntry = { ...keeper, id: 'physician', enabled: true, contextState: 'enabled', description: 'The court physician.', sourceId: 'physician-source', sourceVersionNumber: 7 }
const choice = (id: string) => ({ key: `codex:${id}`, id, label: 'Old Mira', kind: 'saved' as const })
describe('ManuscriptReferenceDialog', () => {
    it('requires an explicit choice for duplicate names and shows source/version/content before any context write', async () => {
        const setContext = vi.fn().mockResolvedValue(undefined)
        render(<ManuscriptReferenceDialog choices={[choice('keeper'), choice('physician')]} entries={[keeper, physician]} canChangeContext={() => true} onSetContext={setContext} onClose={vi.fn()} />)
        expect(screen.queryByRole('button', { name: 'Include in AI context' })).not.toBeInTheDocument()
        const group = screen.getByRole('group')
        expect(within(group).getByText(/Version 3/)).toBeInTheDocument()
        expect(within(group).getByText('Source: physician-source')).toBeInTheDocument()
        fireEvent.click(within(group).getByRole('button', { name: /lighthouse keeper/i }))
        expect(screen.getByText(/Manuscript label: Old Mira/)).toBeInTheDocument()
        expect(setContext).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole('button', { name: 'Include in AI context' }))
        await waitFor(() => expect(setContext).toHaveBeenCalledExactlyOnceWith(keeper, true))
    })
    it('does not rebind unavailable saved identities by their equal label', () => {
        render(<ManuscriptReferenceDialog choices={[choice('missing')]} entries={[keeper]} canChangeContext={() => true} onSetContext={vi.fn()} onClose={vi.fn()} />)
        expect(screen.getByText(/equally named source will not replace it/)).toBeInTheDocument()
        expect(screen.queryByText('The lighthouse keeper.')).not.toBeInTheDocument()
    })
    it('keeps removed, overridden and out-of-scope snapshots readable without context mutation controls', () => {
        const { rerender } = render(<ManuscriptReferenceDialog choices={[choice('keeper')]} entries={[{ ...keeper, removed: true, contextState: 'removed' }]} canChangeContext={() => true} onSetContext={vi.fn()} onClose={vi.fn()} />)
        expect(screen.getByText('The lighthouse keeper.')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /Include in AI/ })).not.toBeInTheDocument()
        for (const contextState of ['outside', 'shadowed'] as const) {
            rerender(<ManuscriptReferenceDialog choices={[choice('keeper')]} entries={[{ ...keeper, contextState }]} canChangeContext={() => true} onSetContext={vi.fn()} onClose={vi.fn()} />)
            expect(screen.queryByRole('button', { name: /Include in AI/ })).not.toBeInTheDocument()
        }
    })
    it('checks a changed reader/review guard again at click time', () => {
        let allowed = true
        const setContext = vi.fn()
        render(<ManuscriptReferenceDialog choices={[choice('keeper')]} entries={[keeper]} canChangeContext={() => allowed} onSetContext={setContext} onClose={vi.fn()} />)
        allowed = false
        fireEvent.click(screen.getByRole('button', { name: 'Include in AI context' }))
        expect(setContext).not.toHaveBeenCalled()
        expect(screen.getByRole('alert')).toHaveTextContent('Finish the current AI review')
    })
    it('offers no write actions in a reader', () => {
        render(<ManuscriptReferenceDialog choices={[choice('keeper')]} entries={[keeper]} canChangeContext={() => false} onSetContext={vi.fn()} onClose={vi.fn()} />)
        expect(screen.queryByRole('button', { name: /Include in AI/ })).not.toBeInTheDocument()
        expect(screen.getByText('The lighthouse keeper.')).toBeInTheDocument()
    })
})
