import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CardAssistantMessage } from '@/shared/types/aiCard.types'
import { AssistantMessage, type VisibleAssistantTurn } from './AssistantMessage'

const originalClipboard = navigator.clipboard

function message(overrides: Partial<CardAssistantMessage>): CardAssistantMessage {
    return {
        message_id: 1,
        conversation_id: 1,
        sequence_no: 1,
        role: 'assistant',
        status: 'completed',
        content: '',
        created_at: '2026-06-10T18:42:00Z',
        ...overrides,
    }
}

function turn(overrides: Partial<VisibleAssistantTurn>): VisibleAssistantTurn {
    return {
        message: message({}),
        appliedChanges: [],
        isStreaming: false,
        isInterrupted: false,
        ...overrides,
    }
}

afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: originalClipboard,
    })
})

describe('AssistantMessage copy action', () => {
    it('copies the raw assistant markdown content', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined)
        const rawContent = `I renamed it to **Glass**.

- Keep the trigger.`
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText },
        })

        render(<AssistantMessage turn={turn({ message: message({ role: 'assistant', content: rawContent }) })} />)

        fireEvent.click(screen.getByRole('button', { name: 'Copy message' }))

        await waitFor(() => expect(writeText).toHaveBeenCalledWith(rawContent))
        expect(screen.getByRole('button', { name: 'Message copied' })).toBeInTheDocument()
    })

    it('copies user bubble content exactly as stored', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined)
        const rawContent = 'Make the greeting stranger.'
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText },
        })

        render(<AssistantMessage turn={turn({ message: message({ role: 'user', content: rawContent }) })} />)

        fireEvent.click(screen.getByRole('button', { name: 'Copy message' }))

        await waitFor(() => expect(writeText).toHaveBeenCalledWith(rawContent))
    })

    it('does not show copy while the assistant reply is streaming', () => {
        render(<AssistantMessage turn={turn({ message: message({ content: 'Working' }), isStreaming: true })} />)

        expect(screen.queryByRole('button', { name: 'Copy message' })).not.toBeInTheDocument()
    })
})
