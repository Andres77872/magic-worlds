import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AI_CARD_DESCRIPTION_MAX_CHARS } from '@/shared'
import { AiGeneratePanel } from './AiGeneratePanel'

describe('AiGeneratePanel', () => {
    it('blocks blank, too-short, and over-limit descriptions with visible guidance', () => {
        const onGenerate = vi.fn()
        render(<AiGeneratePanel noun="character" onGenerate={onGenerate} />)
        const textarea = screen.getByRole('textbox')
        const button = screen.getByRole('button', { name: /generate character/i })

        expect(button).toBeDisabled()
        expect(screen.getByText(/write at least 5 characters/i)).toBeInTheDocument()

        fireEvent.change(textarea, { target: { value: 'abcd' } })
        expect(button).toBeDisabled()
        expect(screen.getByText(/at least 5 characters/i)).toBeInTheDocument()

        fireEvent.change(textarea, { target: { value: 'x'.repeat(AI_CARD_DESCRIPTION_MAX_CHARS + 1) } })
        expect(button).toBeDisabled()
        expect(screen.getByText(/keep it under 4000 characters/i)).toBeInTheDocument()

        fireEvent.click(button)
        expect(onGenerate).not.toHaveBeenCalled()
    })

    it('submits the trimmed description with request lifecycle options', async () => {
        const onGenerate = vi.fn().mockResolvedValue(undefined)
        render(<AiGeneratePanel noun="world" onGenerate={onGenerate} />)

        fireEvent.change(screen.getByRole('textbox'), { target: { value: '  Create a glass desert  ' } })
        fireEvent.click(screen.getByRole('button', { name: /generate world/i }))

        await waitFor(() => expect(onGenerate).toHaveBeenCalledTimes(1))
        const [description, options] = onGenerate.mock.calls[0]
        expect(description).toBe('Create a glass desert')
        expect(options.signal).toBeInstanceOf(AbortSignal)
        expect(options.requestId).toMatch(/^mw-ai-card-req-/)
        expect(options.idempotencyKey).toMatch(/^mw-ai-card-idem-/)
        expect(options.timeoutMs).toBe(90_000)
    })

    it('renders category-specific structured error copy with support id', async () => {
        const onGenerate = vi.fn().mockRejectedValue({
            category: 'quota_exceeded',
            message: 'Daily AI generation limit reached.',
            requestId: 'req-quota',
            retryAfterSeconds: 3600,
        })
        render(<AiGeneratePanel noun="character" onGenerate={onGenerate} />)

        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Generate a moon scout' } })
        fireEvent.click(screen.getByRole('button', { name: /generate character/i }))

        expect(await screen.findByText(/today's ai generation limit/i)).toBeInTheDocument()
        expect(screen.getByText(/support id: req-quota/i)).toBeInTheDocument()
    })

    it('cancel aborts local waiting and does not claim backend cancellation', async () => {
        let capturedSignal: AbortSignal | undefined
        const onGenerate = vi.fn((_description, options) => {
            capturedSignal = options.signal
            return new Promise((_resolve, reject) => {
                options.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
            })
        })
        render(<AiGeneratePanel noun="adventure" onGenerate={onGenerate} />)

        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Generate a volcano heist' } })
        fireEvent.click(screen.getByRole('button', { name: /generate adventure/i }))
        fireEvent.click(await screen.findByRole('button', { name: /cancel/i }))

        await waitFor(() => expect(capturedSignal?.aborted).toBe(true))
        expect(await screen.findByText(/backend may still finish and save the adventure/i)).toBeInTheDocument()
    })

    it('reuses the idempotency key for an unchanged retry after timeout', async () => {
        const onGenerate = vi
            .fn()
            .mockRejectedValueOnce({ category: 'timeout', code: 'ai_card_client_timeout' })
            .mockResolvedValueOnce(undefined)

        render(<AiGeneratePanel noun="character" onGenerate={onGenerate} />)
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Generate a moon scout' } })
        fireEvent.click(screen.getByRole('button', { name: /generate character/i }))
        await screen.findByText(/local waiting timed out/i)

        fireEvent.click(screen.getByRole('button', { name: /generate character/i }))
        await waitFor(() => expect(onGenerate).toHaveBeenCalledTimes(2))

        expect(onGenerate.mock.calls[1][1].idempotencyKey).toBe(onGenerate.mock.calls[0][1].idempotencyKey)
    })
})
