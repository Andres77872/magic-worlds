import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AiCardRequestOptions } from '@/shared'
import { SavedCardGenerator } from './SavedCardGenerator'

describe('saved card generation in the creator gallery', () => {
    it.each(['character', 'world', 'item', 'adventure'] as const)('%s keeps previews read-only until the saved result arrives', async (cardType) => {
        let resolve!: (card: { id: string }) => void
        let options!: AiCardRequestOptions
        const generate = vi.fn((_description: string, next: AiCardRequestOptions) => {
            options = next
            return new Promise<{ id: string }>((done) => { resolve = done })
        })
        const onSaved = vi.fn()
        render(<SavedCardGenerator cardType={cardType} generate={generate} onSaved={onSaved} isAuthenticated onAuthRequired={vi.fn()} />)
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Create a candlelit realm' } })
        fireEvent.click(screen.getByRole('button', { name: new RegExp(`generate ${cardType}`, 'i') }))
        act(() => options.onEvent?.({ type: 'preview', path: ['name'], text: 'Moon Archive', request_id: options.requestId! }))
        expect(await screen.findByText('Moon Archive')).toBeInTheDocument()
        expect(onSaved).not.toHaveBeenCalled()
        await act(async () => resolve({ id: 'saved-card' }))
        expect(onSaved).toHaveBeenCalledExactlyOnceWith({ id: 'saved-card' })
    })

    it('does not apply or navigate to a late saved card after leaving the creator', async () => {
        let resolve!: (card: { id: string }) => void
        let signal: AbortSignal | undefined
        const generate = (_description: string, options: AiCardRequestOptions) => {
            signal = options.signal
            return new Promise<{ id: string }>((done) => { resolve = done })
        }
        const onSaved = vi.fn()
        const { unmount } = render(<SavedCardGenerator cardType="world" generate={generate} onSaved={onSaved} isAuthenticated onAuthRequired={vi.fn()} />)
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Create a candlelit realm' } })
        fireEvent.click(screen.getByRole('button', { name: /generate world/i }))
        unmount()
        expect(signal?.aborted).toBe(true)
        await act(async () => resolve({ id: 'saved-card' }))
        expect(onSaved).not.toHaveBeenCalled()
    })

    it('requires sign-in before starting generation', async () => {
        const generate = vi.fn(), onAuthRequired = vi.fn()
        render(<SavedCardGenerator cardType="world" generate={generate} onSaved={vi.fn()} isAuthenticated={false} onAuthRequired={onAuthRequired} />)
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Create a candlelit realm' } })
        fireEvent.click(screen.getByRole('button', { name: /generate world/i }))
        await waitFor(() => expect(onAuthRequired).toHaveBeenCalledOnce())
        expect(generate).not.toHaveBeenCalled()
    })
})
