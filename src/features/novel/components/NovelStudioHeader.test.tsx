import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Story } from '@/shared'
import { NovelStudioHeader } from './NovelStudioHeader'

const story: Story = {
    id: 's1',
    title: 'The Hollow Crown',
    description: 'A story.',
    source: { kind: 'blank', id: null, title: null },
    chapters: [],
    activeCardRefs: [],
    activeContext: {
        includeSelectedCards: true,
        includeLorebooks: true,
        includeRecentChapters: 1,
        tokenBudget: 1000,
        styleSource: 'current_chapter',
        customStyleInstruction: null,
    },
}

function handlers() {
    return {
        onToggleFocusMode: vi.fn(),
        onToggleCodex: vi.fn(),
        onToggleTypewriter: vi.fn(),
        onOpenHistory: vi.fn(),
        onOpenFind: vi.fn(),
        onBack: vi.fn(),
        onSaveMeta: vi.fn(),
    }
}

function renderHeader(overrides: { focusMode?: boolean; typewriter?: boolean } = {}) {
    const spies = handlers()
    render(
        <NovelStudioHeader
            story={story}
            chapterTitle="Chapter 1"
            focusMode={overrides.focusMode ?? false}
            codexOpen={false}
            typewriter={overrides.typewriter ?? false}
            {...spies}
        />,
    )
    return spies
}

describe('NovelStudioHeader chrome', () => {
    it('carries no save affordance and no counters — those live on the status strip', () => {
        renderHeader()

        expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
        expect(screen.queryByRole('button', { name: 'Retry save' })).toBeNull()
        expect(screen.queryByTestId('novel-save-state')).toBeNull()
        expect(screen.queryByText(/100/)).toBeNull()
    })

    it('keeps the title and the removed description out of the tab order until asked', () => {
        renderHeader()

        // At rest nothing in the header is a live input: the title is a button
        // and the novel description no longer lives here at all.
        expect(screen.queryByRole('textbox')).toBeNull()
        expect(screen.getByRole('button', { name: 'Novel title' })).toHaveTextContent('The Hollow Crown')
        expect(screen.getByTestId('novel-header-chapter')).toHaveTextContent('Chapter 1')
    })

    it('goes back', () => {
        const spies = renderHeader()

        fireEvent.click(screen.getByRole('button', { name: 'Back to stories' }))

        expect(spies.onBack).toHaveBeenCalledTimes(1)
    })
})

describe('NovelStudioHeader title editing', () => {
    it('commits the edited title on Enter', () => {
        const spies = renderHeader()

        fireEvent.click(screen.getByRole('button', { name: 'Novel title' }))
        const input = screen.getByRole('textbox', { name: 'Novel title' })
        fireEvent.change(input, { target: { value: 'The Drowned Court' } })
        fireEvent.keyDown(input, { key: 'Enter' })

        expect(spies.onSaveMeta).toHaveBeenCalledWith({ title: 'The Drowned Court' })
    })

    it('reverts on Escape without saving', () => {
        const spies = renderHeader()

        fireEvent.click(screen.getByRole('button', { name: 'Novel title' }))
        const input = screen.getByRole('textbox', { name: 'Novel title' })
        fireEvent.change(input, { target: { value: 'Discarded' } })
        fireEvent.keyDown(input, { key: 'Escape' })

        expect(spies.onSaveMeta).not.toHaveBeenCalled()
        expect(screen.getByRole('button', { name: 'Novel title' })).toHaveTextContent('The Hollow Crown')
    })

    it('does not save a title that did not change', () => {
        const spies = renderHeader()

        fireEvent.click(screen.getByRole('button', { name: 'Novel title' }))
        fireEvent.blur(screen.getByRole('textbox', { name: 'Novel title' }))

        expect(spies.onSaveMeta).not.toHaveBeenCalled()
    })
})

describe('NovelStudioHeader overflow menu', () => {
    it('hides the rarely-used actions until More is opened', () => {
        const spies = renderHeader()

        expect(screen.queryByRole('menu')).toBeNull()

        fireEvent.click(screen.getByTestId('novel-header-more'))
        fireEvent.click(screen.getByRole('menuitem', { name: /Generation history/ }))

        expect(spies.onOpenHistory).toHaveBeenCalledTimes(1)
        expect(screen.queryByRole('menu')).toBeNull()
    })

    it('reports the typewriter state and toggles it', () => {
        const spies = renderHeader({ typewriter: false })

        fireEvent.click(screen.getByTestId('novel-header-more'))
        const row = screen.getByRole('menuitemcheckbox', { name: /Typewriter scrolling/ })

        expect(row).toHaveAttribute('aria-checked', 'false')
        expect(row).toHaveTextContent('Off')

        fireEvent.click(row)

        expect(spies.onToggleTypewriter).toHaveBeenCalledTimes(1)
    })

    it('opens find and replace from the menu', () => {
        const spies = renderHeader()

        fireEvent.click(screen.getByTestId('novel-header-more'))
        fireEvent.click(screen.getByRole('menuitem', { name: /Find and replace/ }))

        expect(spies.onOpenFind).toHaveBeenCalledTimes(1)
    })

    it('closes on Escape', () => {
        renderHeader()

        fireEvent.click(screen.getByTestId('novel-header-more'))
        expect(screen.getByRole('menu')).toBeInTheDocument()

        fireEvent.keyDown(document, { key: 'Escape' })

        expect(screen.queryByRole('menu')).toBeNull()
    })
})

describe('NovelStudioHeader focus mode', () => {
    it('drops the codex toggle while the panels are hidden', () => {
        renderHeader({ focusMode: true })

        expect(screen.queryByRole('button', { name: 'Codex panel' })).toBeNull()
        expect(screen.getByRole('button', { name: 'Focus mode' })).toHaveAttribute('aria-pressed', 'true')
    })
})
