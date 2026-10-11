import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { ApiError } from '@/infrastructure/api'
import { AiGeneratePanel } from './AiGeneratePanel'

async function generateTwice(first: unknown, between: () => Promise<void> = async () => {}) {
    const onGenerate = vi.fn().mockRejectedValueOnce(first).mockResolvedValueOnce(undefined)
    render(<AiGeneratePanel noun="world" onGenerate={onGenerate} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Create a glass desert' } })
    const button = screen.getByRole('button', { name: /generate world/i })
    fireEvent.click(button)
    await waitFor(() => expect(button).not.toBeDisabled())
    await between()
    fireEvent.click(button)
    await waitFor(() => expect(onGenerate).toHaveBeenCalledTimes(2))
    return onGenerate.mock.calls.map((call) => call[1].requestId as string)
}

it('keeps the request ID while the outcome is unknown and explains how to recover it', async () => {
    const [first, second] = await generateTwice(new ApiError(409, 'LLM_EXECUTION_IN_PROGRESS', { code: 'LLM_EXECUTION_IN_PROGRESS', requestId: 'support-1' }), async () => {
        expect(await screen.findByText(/This request is still running\. .*support-1/)).toBeInTheDocument()
    })
    expect(second).toBe(first)
})

it('starts a new request once a changed intent spends the old one', async () => {
    const [first, second] = await generateTwice(new ApiError(409, 'LLM_EXECUTION_INTENT_CHANGED', { code: 'LLM_EXECUTION_INTENT_CHANGED' }), async () => {
        expect(await screen.findByText(/The profile or the input changed since this request started/)).toBeInTheDocument()
    })
    expect(second).not.toBe(first)
})
