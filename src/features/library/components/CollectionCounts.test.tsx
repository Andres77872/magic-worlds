import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Collection } from '@/shared/types'
import { CollectionFolder } from './CollectionFolder'
import { CollectionPickerDialog } from './CollectionPickerDialog'

const collection: Collection = {
    id: 'collection', workspace_id: 'workspace', name: 'Saved references', description: null, position: 0,
    card_count: 9, row_version: 1, created_at: '2026-10-15T00:00:00Z', updated_at: '2026-10-15T00:00:00Z',
}
afterEach(() => vi.unstubAllEnvs())

describe('collection aggregate counts', () => {
    it('keeps a collection usable without exposing a raw count of hidden card kinds', async () => {
        vi.stubEnv('VITE_FEATURE_ADVENTURES_ENABLED', 'false')
        const onOpen = vi.fn()
        const original = structuredClone(collection)
        const folder = render(<CollectionFolder collection={collection} onOpen={onOpen} />)
        expect(screen.queryByText(/9 cards/)).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: /Saved references/ }))
        expect(onOpen).toHaveBeenCalledOnce()
        folder.unmount()
        const onConfirm = vi.fn(async () => null)
        render(<CollectionPickerDialog open collections={[collection]} cardCount={1} onClose={vi.fn()} onCreateCollection={vi.fn()} onConfirm={onConfirm} />)
        expect(screen.queryByText('9 cards')).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: /Saved references/ }))
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Add' })) })
        expect(onConfirm).toHaveBeenCalledWith(['collection'])
        expect(collection).toEqual(original)
    })

    it('shows the raw aggregate when every card kind is available', () => {
        vi.stubEnv('VITE_FEATURE_ADVENTURES_ENABLED', 'true')
        render(<CollectionFolder collection={collection} onOpen={vi.fn()} />)
        expect(screen.getByText(/9 cards/)).toBeInTheDocument()
    })
})
