import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import fixture from '@/test/fixtures/storyAssistantContextChapterSummaries.json'
import type { StoryOutline } from '@/shared'
import type { NovelAssistantRecord } from '@/shared/types/storyAssistant.types'
import { NovelAssistantWideSummaries } from './NovelAssistantWideSummaries'

const wire = fixture as unknown as { index: StoryOutline; record: NovelAssistantRecord }
const story = (edit: (value: StoryOutline) => void = () => {}) => { const value = structuredClone(wire.index); edit(value); return value }
const record = (edit: (value: NovelAssistantRecord['result']) => void = () => {}) => { const value = structuredClone(wire.record); edit(value.result); return value }
const [prologue, chapterOne] = wire.record.result.chapterSummaries!
const card = (name: string) => screen.getByRole('heading', { name }).closest('li') as HTMLElement

it('saves a chapter or book summary with the scene revisions it read and reports what was not saved', async () => {
    const saveChapter = vi.fn().mockResolvedValue('saved'), saveBook = vi.fn().mockResolvedValue('changed')
    const writer = { save: vi.fn(), saveChapter, saveBook }
    const view = render(<NovelAssistantWideSummaries record={record()} story={story()} writer={writer} readOnly={false} />)
    expect(screen.getByRole('region', { name: 'Chapter summaries' })).toBeInTheDocument()
    expect(within(card('Prologue')).getByText('Covers 2 scenes')).toBeInTheDocument()
    expect(within(card('Prologue')).getByText('Saving replaces the summary the chapter has now.')).toBeInTheDocument()
    expect(within(card('Chapter One')).queryByText(/Saving replaces/)).not.toBeInTheDocument()
    const book = card(wire.index.title)
    expect(within(book).getByText('Covers 4 scenes')).toBeInTheDocument()
    expect(within(book).getByText('Saving replaces the novel’s current summary.')).toBeInTheDocument()
    fireEvent.click(within(card('Prologue')).getByRole('button', { name: 'Save as chapter summary' }))
    await waitFor(() => expect(saveChapter).toHaveBeenCalledWith('chapter-0', prologue.text, prologue.basis))
    expect(await screen.findByText('Saved. This is now the summary of “Prologue”.')).toBeInTheDocument()
    fireEvent.click(within(book).getByRole('button', { name: 'Save as book summary' }))
    await waitFor(() => expect(saveBook).toHaveBeenCalledWith(wire.record.result.bookSummary!.text, wire.record.result.bookSummary!.basis))
    expect(await screen.findByText('The novel changed after this reply, so the summary was not saved.')).toBeInTheDocument()
    // A later scene revision in Chapter One makes its summary and the book's stale; the Prologue's is now saved.
    view.rerender(<NovelAssistantWideSummaries record={record()} story={story(value => {
        value.chapters[0].details = { ...value.chapters[0].details, summary: prologue.text, summaryBasis: prologue.basis }
        value.chapters[1].scenes[1].revision += 1
    })} writer={writer} readOnly={false} />)
    expect(within(card('Prologue')).getByText('Saved as the chapter summary')).toBeInTheDocument()
    expect(within(card('Chapter One')).getByText('Chapter changed since this reply')).toBeInTheDocument()
    expect(within(card(wire.index.title)).getByText('Novel changed since this reply')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Save as/ })).not.toBeInTheDocument()
})

it('offers no save for a partly read chapter, an archived chapter, a read-only novel or a reply without them', () => {
    const writer = { save: vi.fn(), saveChapter: vi.fn(), saveBook: vi.fn() }
    const view = render(<NovelAssistantWideSummaries record={record(result => { result.chapterSummaries![1].complete = false })}
        story={story(value => { value.chapters[0].status = 'archived' })} writer={writer} readOnly={false} />)
    expect(within(card('Prologue')).getByText('Not possible now')).toBeInTheDocument()
    expect(within(card('Chapter One')).getByText('From part of the chapter')).toBeInTheDocument()
    expect(within(card('Chapter One')).getByText(/did not cover every scene of this chapter/)).toBeInTheDocument()
    // Archiving the Prologue also changes what the book's summary covers.
    expect(within(card(wire.index.title)).getByText('Novel changed since this reply')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Save as/ })).not.toBeInTheDocument()
    view.rerender(<NovelAssistantWideSummaries record={record()} story={story()} writer={writer} readOnly />)
    expect(screen.queryByRole('button', { name: /Save as/ })).not.toBeInTheDocument()
    view.rerender(<NovelAssistantWideSummaries record={record(result => { delete result.chapterSummaries; delete result.bookSummary })} story={story()} writer={writer} readOnly={false} />)
    expect(view.container).toBeEmptyDOMElement()
    expect(chapterOne.chapterId).toBe('chapter-1')
})
