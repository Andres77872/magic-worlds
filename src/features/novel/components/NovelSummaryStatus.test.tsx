import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import fixture from '@/test/fixtures/storyAssistantContextChapterSummaries.json'
import type { StoryOutline } from '@/shared'
import type { NovelAssistantRecord } from '@/shared/types/storyAssistant.types'
import { NovelSummaryStatus } from './NovelSummaryStatus'
import { NovelAssistantSaveAll } from './NovelAssistantSaveAll'

const wire = fixture as unknown as { index: StoryOutline; record: NovelAssistantRecord }
const story = (edit: (value: StoryOutline) => void = () => {}) => { const value = structuredClone(wire.index); edit(value); return value }
const row = (name: string) => screen.getAllByRole('listitem').find((item) => within(item).queryByText(name, { selector: 'h4,button' })) as HTMLElement
const writer = () => ({ save: vi.fn().mockResolvedValue('saved'), saveChapter: vi.fn().mockResolvedValue('saved'), saveBook: vi.fn().mockResolvedValue('saved') })

it('shows every summary’s state against today’s scenes and filters to those that need attention', () => {
    // Scene 1's later revision leaves the Prologue's and the book's summaries behind.
    render(<NovelSummaryStatus story={story((value) => { value.chapters[0].scenes[1].revision = 2 })} readOnly={false} onOpenScene={vi.fn()} />)
    const counts = screen.getByRole('group', { name: 'Summary counts' })
    expect(within(counts).getByText('1 current')).toBeInTheDocument()
    expect(within(counts).getByText('2 changed since written')).toBeInTheDocument()
    expect(within(counts).getByText('4 without a summary')).toBeInTheDocument()
    expect(within(row('Prologue')).getByText('Scenes changed since')).toBeInTheDocument()
    expect(within(row('Prologue')).getByText('Covers 2 scenes')).toBeInTheDocument()
    expect(within(row('Scene 0')).getByText('Current')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Only summaries that need attention' }))
    expect(screen.queryByRole('button', { name: 'Open Prologue · Scene 0 in Write' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Prologue · Scene 1 in Write' })).toBeInTheDocument()
})

it('re-ties a stale summary only after the author confirms it still holds', async () => {
    const value = story((outline) => { outline.chapters[0].scenes[1].revision = 2 }), write = writer()
    render(<NovelSummaryStatus story={value} readOnly={false} writer={write} onOpenScene={vi.fn()} />)
    const prologue = row('Prologue')
    fireEvent.click(within(prologue).getByRole('button', { name: 'Still accurate' }))
    expect(write.saveChapter).not.toHaveBeenCalled()
    expect(within(prologue).getByText(/ties the saved text, unchanged/)).toBeInTheDocument()
    fireEvent.click(within(prologue).getByRole('button', { name: 'Confirm: still accurate' }))
    await waitFor(() => expect(write.saveChapter).toHaveBeenCalledWith('chapter-0', value.chapters[0].details.summary, ['scene-0@1', 'scene-1@2']))
    expect(await within(prologue).findByText('Confirmed. The summary is current again.')).toBeInTheDocument()
    fireEvent.click(within(row(value.title)).getByRole('button', { name: 'Still accurate' }))
    write.saveBook.mockResolvedValueOnce('changed')
    fireEvent.click(within(row(value.title)).getByRole('button', { name: 'Confirm: still accurate' }))
    await waitFor(() => expect(write.saveBook).toHaveBeenCalledWith(value.details.summary, ['scene-0@1', 'scene-1@2', 'scene-2@1', 'scene-3@1']))
    expect(await screen.findByText(/The scenes changed again meanwhile/)).toBeInTheDocument()
    // A current or missing summary has nothing to confirm.
    expect(within(row('Scene 0')).queryByRole('button', { name: 'Still accurate' })).not.toBeInTheDocument()
    expect(within(row('Chapter One')).queryByRole('button', { name: 'Still accurate' })).not.toBeInTheDocument()
})

it('refreshes chosen scenes and chapters in one request of at most 20 scenes, and the book when it fits', () => {
    const open = vi.fn()
    const view = render(<NovelSummaryStatus story={story()} readOnly={false} refresh={{ open, available: true }} onOpenScene={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Refresh 0 scenes…' })).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Choose Chapter One for a refresh' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Choose Prologue · Scene 0 for a refresh' }))
    expect(screen.getByText('3 scenes chosen.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh 3 scenes…' }))
    expect(open).toHaveBeenLastCalledWith(['scene-0', 'scene-2', 'scene-3'], false)
    fireEvent.click(screen.getByRole('button', { name: 'Refresh the whole book…' }))
    expect(open).toHaveBeenLastCalledWith(['scene-0', 'scene-1', 'scene-2', 'scene-3'], true)
    // A chapter of 21 scenes is more than one request reads, and so is the book.
    const long = story((value) => {
        const [template] = value.chapters[1].scenes
        value.chapters[1].scenes = Array.from({ length: 21 }, (_, n) => ({ ...structuredClone(template), id: `long-${n}`, title: `Long ${n}`, order: n }))
    })
    view.unmount()
    render(<NovelSummaryStatus story={long} readOnly={false} refresh={{ open, available: true }} onOpenScene={vi.fn()} />)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Choose Chapter One for a refresh' }))
    expect(screen.getByText('Choose at most 20 scenes for one request.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Refresh \d+ scenes…$/ })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Refresh the whole book…' })).not.toBeInTheDocument()
    expect(screen.getByText(/The book covers 23 scenes; one request reads at most 20/)).toBeInTheDocument()
    // Past 20 scenes the book is built from summaries; Chapter One's 21 scenes have none, so 20 stay uncovered whichever scene is read.
    expect(screen.getByRole('button', { name: 'Refresh the book from its summaries…' })).toBeDisabled()
    expect(screen.getByText('20 scenes are not covered by a current part, chapter or scene summary yet. Refresh or confirm those summaries first.')).toBeInTheDocument()
})

it('builds a long book’s summary from current summaries, reading the one scene they do not cover', () => {
    const open = vi.fn()
    const long = story((value) => {
        const [template] = value.chapters[1].scenes
        value.chapters[1].scenes = Array.from({ length: 21 }, (_, n) => ({ ...structuredClone(template), id: `long-${n}`, title: `Long ${n}`, order: n }))
        value.chapters[1].details = { summary: 'The long road.', summaryBasis: value.chapters[1].scenes.map((scene) => `${scene.id}@${scene.revision}`) }
    })
    render(<NovelSummaryStatus story={long} readOnly={false} refresh={{ open, available: true }} onOpenScene={vi.fn()} />)
    // The Prologue's summary is not sent once one of its scenes is read; scene-0's own summary covers it, so scene-1 is read.
    fireEvent.click(screen.getByRole('button', { name: 'Refresh the book from its summaries…' }))
    expect(open).toHaveBeenLastCalledWith(['scene-1'], true, true)
})

it('offers no choice, confirmation or refresh on a read-only novel', () => {
    render(<NovelSummaryStatus story={story((value) => { value.chapters[0].scenes[1].revision = 2 })} readOnly writer={writer()} refresh={{ open: vi.fn(), available: true }} onOpenScene={vi.fn()} />)
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Still accurate|Refresh/ })).not.toBeInTheDocument()
})

it('saves every ready summary of a reply in one step and says which were not saved', async () => {
    const write = writer(); write.saveBook.mockResolvedValue('changed')
    render(<NovelAssistantSaveAll record={wire.record} story={story()} writer={write} readOnly={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Save all 3 ready summaries' }))
    await waitFor(() => expect(write.saveBook).toHaveBeenCalledWith(wire.record.result.bookSummary!.text, wire.record.result.bookSummary!.basis))
    expect(write.saveChapter.mock.calls.map((call) => call[0])).toEqual(['chapter-0', 'chapter-1'])
    expect(await screen.findByText(/Saved 2 summaries\. 1 was not saved/)).toBeInTheDocument()
})

it('offers no save-all for a single ready summary, a read-only novel or a reply whose scenes changed', () => {
    const view = render(<NovelAssistantSaveAll record={wire.record} story={story()} writer={writer()} readOnly />)
    expect(view.container).toBeEmptyDOMElement()
    view.rerender(<NovelAssistantSaveAll record={wire.record} story={story((value) => { value.chapters[1].scenes[0].revision = 2 })} writer={writer()} readOnly={false} />)
    // Only the Prologue is still ready: its own button is enough.
    expect(view.container).toBeEmptyDOMElement()
})
