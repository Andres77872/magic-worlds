import { novel } from '@/test/fixtures/story'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Story } from '@/shared'
import { NovelStudioHeader } from './NovelStudioHeader'

const story: Story = {
    ...novel({chapters:[]}),
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
        styleSource: 'current_scene',
        customStyleInstruction: null,
    },
}

function handlers() {
    return {
        onToggleFocusMode: vi.fn(),
        onToggleCodex: vi.fn(),
        onToggleTypewriter: vi.fn(),
        onOpenHistory: vi.fn(),
        onOpenSnapshots:vi.fn(),
        onOpenFind: vi.fn(),
        onBack: vi.fn(),
        onEditDetails: vi.fn(),
    }
}

it('keeps reading preferences available in an archived novel and returns focus to the menu trigger', () => {
    const open = vi.fn()
    render(<NovelStudioHeader story={story} chapterTitle="Opening" focusMode={false} codexOpen={false} typewriter={false} {...handlers()} readOnly onOpenReading={open} />)
    fireEvent.click(screen.getByTestId('novel-header-more'))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Reading preferences' }))
    expect(open).toHaveBeenCalledOnce()
    expect(screen.getByTestId('novel-header-more')).toHaveFocus()
    expect(screen.queryByTestId('novel-header-menu')).not.toBeInTheDocument()
})

it('keeps personal notes available for archived reading and returns focus from its menu action',()=>{
    const open=vi.fn()
    render(<NovelStudioHeader story={story} chapterTitle="Opening" focusMode={false} codexOpen={false} typewriter={false} {...handlers()} readOnly onOpenAnnotations={open}/>)
    fireEvent.click(screen.getByTestId('novel-header-more'))
    fireEvent.click(screen.getByRole('menuitem',{name:'Personal notes'}))
    expect(open).toHaveBeenCalledOnce()
    expect(screen.queryByTestId('novel-header-menu')).not.toBeInTheDocument()
})

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

describe('NovelStudioHeader details',()=>{
    it('opens the recoverable details form from the title',()=>{
        const spies=renderHeader()
        const title=screen.getByRole('button',{name:'Novel title'})
        expect(title).toHaveAttribute('aria-haspopup','dialog')
        fireEvent.click(title)
        expect(spies.onEditDetails).toHaveBeenCalledTimes(1)
        expect(screen.queryByRole('textbox')).toBeNull()
    })
})

describe('NovelStudioHeader overflow menu', () => {
    it('opens named manuscript snapshots from the same accessible overflow menu',()=>{
        const spies=renderHeader()
        fireEvent.click(screen.getByTestId('novel-header-more'))
        fireEvent.click(screen.getByRole('menuitem',{name:'Manuscript snapshots'}))
        expect(spies.onOpenSnapshots).toHaveBeenCalledOnce()
        expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })
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

it('keeps the writing assistant available for archived reading and restores menu focus',()=>{
    const open=vi.fn()
    render(<NovelStudioHeader story={story} chapterTitle="Opening" focusMode={false} codexOpen={false} typewriter={false} {...handlers()} readOnly onOpenAssistantContext={open}/>)
    fireEvent.click(screen.getByTestId('novel-header-more'))
    fireEvent.click(screen.getByRole('menuitem',{name:'Writing assistant'}))
    expect(open).toHaveBeenCalledOnce();expect(screen.getByTestId('novel-header-more')).toHaveFocus()
})

it('switches Write, Plan and Review from the header, counts open tasks and keeps the switch out of focus mode', () => {
    const change = vi.fn()
    const view = render(<NovelStudioHeader story={story} chapterTitle="Opening" focusMode={false} codexOpen={false} typewriter={false} {...handlers()}
        surface="plan" onSurfaceChange={change} review reviewCount={3} />)
    const group = screen.getByRole('radiogroup', { name: 'Studio view' })
    expect(group).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Plan' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Review, 3 open tasks' })).toHaveAttribute('tabindex', '-1')
    // The Codex inspector belongs to Write.
    expect(screen.queryByRole('button', { name: 'Codex panel' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Write' }))
    expect(change).toHaveBeenLastCalledWith('write')
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Plan' }), { key: 'ArrowRight' })
    expect(change).toHaveBeenLastCalledWith('review')
    // Planning views and Review left the More menu for the switch.
    fireEvent.click(screen.getByTestId('novel-header-more'))
    expect(screen.queryByRole('menuitem', { name: 'Planning views' })).not.toBeInTheDocument()
    view.rerender(<NovelStudioHeader story={story} chapterTitle="Opening" focusMode codexOpen={false} typewriter={false} {...handlers()}
        surface="write" onSurfaceChange={change} review reviewCount={3} />)
    expect(screen.queryByRole('radiogroup', { name: 'Studio view' })).not.toBeInTheDocument()
})

it('offers Review only when revision tasks are available', () => {
    render(<NovelStudioHeader story={story} chapterTitle="Opening" focusMode={false} codexOpen={false} typewriter={false} {...handlers()}
        surface="write" onSurfaceChange={vi.fn()} />)
    expect(screen.getAllByRole('radio').map((radio) => radio.getAttribute('aria-label'))).toEqual(['Write', 'Plan'])
    expect(screen.getByRole('button', { name: 'Codex panel' })).toBeInTheDocument()
})
