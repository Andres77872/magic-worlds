import { describe, expect, it, vi } from 'vitest'
import { renderActionRow, type AiActionRowModel } from './aiActionRow'

function model(overrides: Partial<AiActionRowModel> = {}): AiActionRowModel {
    return {
        state: 'reviewing',
        meta: '+121 words',
        prompt: 'Beat: “she follows him to the saltworks”',
        labels: {
            actions: 'Generated text actions',
            accept: 'Accept',
            decline: 'Decline',
            regenerate: 'Regenerate',
            cancel: 'Cancel',
            generating: 'Generating…',
            acceptKey: 'Tab',
            declineKey: 'Esc',
            regenerateKey: 'Ctrl+↵',
        },
        canRegenerate: true,
        onAccept: vi.fn(),
        onDecline: vi.fn(),
        onRegenerate: vi.fn(),
        onCancel: vi.fn(),
        ...overrides,
    }
}

describe('renderActionRow', () => {
    it('shows the prompt when the row is the only place it appears', () => {
        const row = renderActionRow(() => model())

        const prompt = row.querySelector('[data-testid="ai-action-prompt"]')
        expect(prompt?.textContent).toBe('Beat: “she follows him to the saltworks”')
        // It truncates on one line, so the full instruction stays on hover.
        expect(prompt?.getAttribute('title')).toBe('Beat: “she follows him to the saltworks”')
    })

    it('shows the prompt while the request is still in flight', () => {
        const row = renderActionRow(() => model({ state: 'generating', meta: '' }))

        expect(row.querySelector('[data-testid="ai-action-prompt"]')?.textContent).toContain('she follows him')
        expect(row.querySelector('[data-testid="ai-action-cancel"]')).not.toBeNull()
        // Same shape in both states, so the box does not jump when prose lands.
        expect(row.querySelector('.ai-action-controls')).not.toBeNull()
    })

    it('omits the line entirely for a command that had no prompt', () => {
        const row = renderActionRow(() => model({ prompt: '' }))

        expect(row.querySelector('[data-testid="ai-action-prompt"]')).toBeNull()
    })

    it('reads handlers at click time, so a rebuilt model is never stale', () => {
        const first = model()
        const second = model()
        let current = first
        const row = renderActionRow(() => current)

        current = second
        row.querySelector<HTMLButtonElement>('[data-testid="ai-action-accept"]')?.click()

        expect(first.onAccept).not.toHaveBeenCalled()
        expect(second.onAccept).toHaveBeenCalledTimes(1)
    })

    it('hides Regenerate when there is no request to replay', () => {
        const row = renderActionRow(() => model({ canRegenerate: false }))

        expect(row.querySelector('[data-testid="ai-action-regenerate"]')).toBeNull()
        expect(row.querySelector('[data-testid="ai-action-accept"]')).not.toBeNull()
    })
})
