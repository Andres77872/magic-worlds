import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import fixture from '@/test/fixtures/storyAssistantContextPartSummaries.json'
import type { StoryOutline } from '@/shared'
import type { NovelAssistantRecord } from '@/shared/types/storyAssistant.types'
import { bookFromSummaries, summaryRows } from '../utils/summaryStatus'
import { NovelAssistantSaveAll } from './NovelAssistantSaveAll'
import { NovelAssistantWideSummaries } from './NovelAssistantWideSummaries'
import { NovelSummaryStatus } from './NovelSummaryStatus'

// Compiled by the BFF: Part One (Prologue, The Gate) has a current summary; Part Two holds Chapter One (scene-2, scene-3).
const wire = fixture as unknown as { index: StoryOutline; record: NovelAssistantRecord }
const story = (edit: (value: StoryOutline) => void = () => {}) => { const value = structuredClone(wire.index); edit(value); return value }
const writer = () => ({ save: vi.fn().mockResolvedValue('saved'), saveChapter: vi.fn().mockResolvedValue('saved'), savePart: vi.fn().mockResolvedValue('saved'), saveBook: vi.fn().mockResolvedValue('saved') })
const card = (name: string) => screen.getByRole('heading', { name, level: 4 }).closest('li') as HTMLElement

it('saves a reply’s part summary with the scenes it covered, and Save all saves parts after chapters', async () => {
    const write = writer()
    render(<NovelAssistantWideSummaries record={wire.record} story={story()} writer={write} readOnly={false} />)
    const part = within(screen.getByRole('region', { name: 'Part summaries' }))
    expect(part.getByText('Ready')).toBeInTheDocument()
    expect(part.getByText('Covers 2 scenes')).toBeInTheDocument()
    fireEvent.click(part.getByRole('button', { name: 'Save as part summary' }))
    const row = wire.record.result.partSummaries![0]
    await waitFor(() => expect(write.savePart).toHaveBeenCalledWith('part-2', row.text, row.basis))
    expect(await part.findByText('Saved. This is now the summary of “Part Two”.')).toBeInTheDocument()
    // The book summary, built from Part One's summary, covers every scene and can be saved too.
    expect(within(card(wire.index.title)).getByText('Ready')).toBeInTheDocument()
    const all = writer(), order: string[] = []
    for (const key of ['saveChapter', 'savePart', 'saveBook'] as const) all[key].mockImplementation(async () => { order.push(key); return 'saved' })
    render(<NovelAssistantSaveAll record={wire.record} story={story()} writer={all} readOnly={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Save all 3 ready summaries' }))
    await waitFor(() => expect(order).toEqual(['saveChapter', 'savePart', 'saveBook']))
})

it('marks a part summary changed when one of its scenes changes, and read-only when the part is archived', () => {
    render(<NovelAssistantWideSummaries record={wire.record} story={story((value) => { value.chapters[2].scenes[1].revision = 2 })} writer={writer()} readOnly={false} />)
    expect(within(screen.getByRole('region', { name: 'Part summaries' })).getByText('Part changed since this reply')).toBeInTheDocument()
    expect(within(card(wire.index.title)).getByText('Novel changed since this reply')).toBeInTheDocument()
})

it('lists parts with their chapters and scenes, confirms a stale part, and refreshes a part with all its scenes', async () => {
    const write = writer(), open = vi.fn()
    // Editing The Gate's scene leaves Part One's summary behind.
    const value = story((value) => { value.chapters[1].scenes[0].revision = 2 })
    expect(summaryRows(value).map((row) => row.key)).toEqual(['book', 'part:part-1', 'chapter:chapter-0', 'scene:scene-0', 'chapter:chapter-a', 'scene:scene-1',
        'part:part-2', 'chapter:chapter-1', 'scene:scene-2', 'scene:scene-3'])
    render(<NovelSummaryStatus story={value} readOnly={false} writer={write} refresh={{ open, available: true }} onOpenScene={vi.fn()} />)
    const part = card('Part One')
    expect(within(part).getByText('Scenes changed since')).toBeInTheDocument()
    fireEvent.click(within(part).getByRole('button', { name: 'Still accurate' }))
    fireEvent.click(within(part).getByRole('button', { name: 'Confirm: still accurate' }))
    await waitFor(() => expect(write.savePart).toHaveBeenCalledWith('part-1', 'About part-1.', ['scene-0@1', 'scene-1@2']))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Choose Part Two for a refresh' }))
    expect(screen.getByText('2 scenes chosen.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh 2 scenes…' }))
    expect(open).toHaveBeenLastCalledWith(['scene-2', 'scene-3'], false)
})

it('plans a book summary from current part, chapter and scene summaries exactly as the compiler would send them', () => {
    // Part One's summary covers its scenes; scene-3's covers the rest of the anchor's chapter, so scene-2 is read.
    expect(bookFromSummaries(story())).toEqual({ anchorSceneId: 'scene-2', uncovered: 0 })
    // A stale Part One leaves the Prologue to its chapter summary and The Gate's scene uncovered.
    expect(bookFromSummaries(story((value) => { value.chapters[1].scenes[0].revision = 2 }))).toEqual({ anchorSceneId: null, uncovered: 1 })
    // Over the 4,000-character limit a summary is not sent, so it covers nothing.
    expect(bookFromSummaries(story((value) => { value.parts[0].details.summary = 'x'.repeat(4001) }))).toEqual({ anchorSceneId: null, uncovered: 1 })
})
