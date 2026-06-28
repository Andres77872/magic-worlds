import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ResumeSession } from './resumeModel'
import { ContinueCard } from './ContinueCard'

function session(overrides: Partial<ResumeSession>): ResumeSession {
    return {
        kind: 'adventure',
        id: 'a1',
        title: 'The Hollow Wood Vigil',
        snippet: 'The lantern gutters as the path bends between black pines.',
        meta: '4 turns · 2h ago',
        updatedAtMs: 0,
        source: { id: 'a1' } as ResumeSession['source'],
        ...overrides,
    }
}

afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    vi.useRealTimers()
})

describe('ContinueCard', () => {
    it('renders an adventure and fires onContinue from its resume button', () => {
        const onContinue = vi.fn()
        render(<ContinueCard session={session({})} onContinue={onContinue} />)

        expect(screen.getByText('The Hollow Wood Vigil')).toBeTruthy()
        expect(screen.getByText('4 turns · 2h ago')).toBeTruthy()

        fireEvent.click(screen.getByRole('button', { name: 'Continue the tale' }))
        expect(onContinue).toHaveBeenCalledTimes(1)
    })

    it('labels a 1:1 chat "Chat" and a group chat "Group chat"', () => {
        const { rerender } = render(<ContinueCard session={session({ kind: 'chat', title: 'Lyra' })} onContinue={vi.fn()} />)
        expect(screen.getByText('Chat')).toBeTruthy()
        expect(screen.getByRole('button', { name: 'Resume chat' })).toBeTruthy()

        rerender(
            <ContinueCard
                session={session({ kind: 'chat', isGroupChat: true, imageUrls: ['a.png', 'b.png'], title: 'Ada, Bo' })}
                onContinue={vi.fn()}
            />,
        )
        expect(screen.getByText('Group chat')).toBeTruthy()
    })

    it('exposes a delete action only when onDelete is provided', () => {
        const onDelete = vi.fn()
        const { rerender } = render(<ContinueCard session={session({})} onContinue={vi.fn()} />)
        expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()

        rerender(<ContinueCard session={session({})} onContinue={vi.fn()} onDelete={onDelete} />)
        fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
        expect(onDelete).toHaveBeenCalledTimes(1)
    })

    it('opens the delete menu from keyboard and touch long-press', async () => {
        const onDelete = vi.fn()
        const { rerender } = render(<ContinueCard session={session({})} onContinue={vi.fn()} onDelete={onDelete} />)
        const card = screen.getByTestId('continue-card')

        card.focus()
        fireEvent.keyDown(card, { key: 'ContextMenu' })
        expect(within(await screen.findByTestId('card-context-menu')).getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument()
        fireEvent.keyDown(document, { key: 'Escape' })
        await waitFor(() => expect(screen.queryByTestId('card-context-menu')).not.toBeInTheDocument())

        rerender(<ContinueCard session={session({ title: 'The Silver Fen' })} onContinue={vi.fn()} onDelete={onDelete} />)
        vi.useFakeTimers()
        fireEvent.pointerDown(screen.getByTestId('continue-card'), { pointerType: 'touch', clientX: 20, clientY: 30 })
        act(() => {
            vi.advanceTimersByTime(520)
        })

        expect(within(screen.getByTestId('card-context-menu')).getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument()
    })
})
