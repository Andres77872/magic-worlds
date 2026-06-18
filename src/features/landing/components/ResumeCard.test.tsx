import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ResumeSession } from './resumeModel'
import { ResumeCard } from './ResumeCard'

function session(overrides: Partial<ResumeSession>): ResumeSession {
    return {
        kind: 'chat',
        id: 'c1',
        title: 'Lyra Dawnwhisper',
        snippet: 'A message waits under the lamplight.',
        meta: '2 messages · 1h ago',
        updatedAtMs: 0,
        source: { id: 'c1' } as ResumeSession['source'],
        ...overrides,
    }
}

describe('ResumeCard', () => {
    it('opens the context menu without firing resume', async () => {
        const onContinue = vi.fn()
        const onDelete = vi.fn()

        render(<ResumeCard session={session({})} onContinue={onContinue} onDelete={onDelete} />)

        fireEvent.contextMenu(screen.getByTestId('resume-card'), { clientX: 80, clientY: 96 })

        const menu = await screen.findByTestId('card-context-menu')
        fireEvent.click(within(menu).getByRole('menuitem', { name: 'Delete' }))

        expect(onDelete).toHaveBeenCalledTimes(1)
        expect(onContinue).not.toHaveBeenCalled()
    })

    it('opens from the keyboard and restores focus on Escape', async () => {
        render(<ResumeCard session={session({})} onContinue={vi.fn()} />)
        const card = screen.getByTestId('resume-card')

        card.focus()
        fireEvent.keyDown(card, { key: 'ContextMenu' })
        expect(await screen.findByTestId('card-context-menu')).toBeInTheDocument()

        fireEvent.keyDown(document, { key: 'Escape' })

        await waitFor(() => expect(screen.queryByTestId('card-context-menu')).not.toBeInTheDocument())
        expect(document.activeElement).toBe(card)
    })
})
