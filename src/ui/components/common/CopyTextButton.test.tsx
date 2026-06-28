import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CopyTextButton } from './CopyTextButton'

const originalClipboard = navigator.clipboard

afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: originalClipboard,
    })
})

describe('CopyTextButton', () => {
    it('copies the exact text and shows local copied feedback', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined)
        const rawText = `The card says **Glass**.

- Keep the markdown.`
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText },
        })

        render(<CopyTextButton text={rawText} />)

        fireEvent.click(screen.getByRole('button', { name: 'Copy message' }))

        await waitFor(() => expect(writeText).toHaveBeenCalledWith(rawText))
        expect(writeText).toHaveBeenCalledTimes(1)
        expect(screen.getByRole('button', { name: 'Message copied' })).toBeInTheDocument()
    })

    it('does not copy empty text', () => {
        const writeText = vi.fn().mockResolvedValue(undefined)
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText },
        })

        render(<CopyTextButton text="" />)

        const button = screen.getByRole('button', { name: 'Copy message' })
        expect(button).toBeDisabled()
        fireEvent.click(button)
        expect(writeText).not.toHaveBeenCalled()
    })
})
