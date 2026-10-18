import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { beforeEach, expect, it, vi } from 'vitest'
import { i18n } from '@/app/i18n'
import { ApiError } from '@/infrastructure/api'
import fixture from '@/test/fixtures/storyOutlinePreview.json'
import { novel, storyChapter } from '@/test/fixtures/story'
import type { StoryOutline, StoryPart } from '@/shared'
import { NovelOutlineImportDialog } from './NovelOutlineImportDialog'

const api = { previewStoryOutline: vi.fn() }
vi.mock('@/app/hooks/useWorkspace', () => ({ useWorkspace: () => ({ api, capture: () => 'scope', isCurrent: () => true }) }))

const part = (id: string, title: string, order: number, patch: Partial<StoryPart> = {}) => ({ id, storyId: 'story-1', title, order, metadataRevision: 1, status: null,
    wordGoal: null, povCardId: null, locationCardId: null, details: {}, trashedAt: null, copiedFrom: null, ...patch }) as StoryPart
const story = (structureRevision = 4) => novel({ structureRevision, chapters: [storyChapter({ partId: 'part-fog' })],
    parts: [part('part-fog', 'Existing fog', 0), part('part-old', 'Archived part', 1, { status: 'archived' })] }) as unknown as StoryOutline
const show = (operate = vi.fn(), current = story(), initialText = '') => render(<I18nextProvider i18n={i18n}>
    <NovelOutlineImportDialog open onClose={vi.fn()} story={current} initialText={initialText} structure={{ operate, busy: false }} />
</I18nextProvider>)
const paste = (text: string) => fireEvent.change(screen.getByRole('textbox', { name: 'Outline' }), { target: { value: text } })

beforeEach(async () => {
    vi.resetAllMocks()
    api.previewStoryOutline.mockResolvedValue(structuredClone(fixture.preview))
    await i18n.changeLanguage('en')
})

it('previews the pasted outline, adds only the chosen chapters at the chosen part in one change, and undoes it in one step', async () => {
    const operate = vi.fn().mockResolvedValueOnce(story(5)).mockResolvedValueOnce(story(6))
    const view = show(operate)
    paste(fixture.text)
    expect(await screen.findByText('2 parts, 2 chapters and 3 scenes · 2 planned beats')).toBeInTheDocument()
    expect(api.previewStoryOutline).toHaveBeenCalledWith(fixture.text, null, expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(screen.getByText('1 paragraph before the first heading was left out.')).toBeInTheDocument()
    expect(screen.getByText('1 chapter had no scenes and gets one empty scene.')).toBeInTheDocument()
    expect(screen.getByText('New part: Part One: Fog')).toBeInTheDocument()
    expect(screen.getByText('The letter')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Chapter 2: The Key' }))
    expect(screen.getByText('1 part, 1 chapter and 2 scenes · 2 planned beats')).toBeInTheDocument()
    expect(screen.getByText('1 of 2 chapters selected')).toBeInTheDocument()
    // Only active, writable parts can take the chapters that have no outline part.
    fireEvent.click(screen.getByRole('combobox', { name: 'Chapters without a part go to' }))
    expect(screen.queryByRole('option', { name: 'Archived part' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('option', { name: 'Existing fog' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add 1 chapter' }))
    const plan = fixture.preview.outline
    await waitFor(() => expect(operate).toHaveBeenCalledWith({ op: 'add_outline', parentId: 'part-fog', outline: { parts: [plan.parts[0]], chapters: [{ ...plan.chapters[0], part: 0 }] } }))
    expect(await screen.findByText('Added 1 chapter and 2 scenes. The first new chapter is open.')).toBeInTheDocument()
    view.rerender(<I18nextProvider i18n={i18n}><NovelOutlineImportDialog open onClose={vi.fn()} story={story(5)} structure={{ operate, busy: false }} /></I18nextProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(operate).toHaveBeenLastCalledWith({ op: 'undo_structure', revision: 5, sourceStructureRevision: 5 }))
    expect(await screen.findByText('The outline was removed again.')).toBeInTheDocument()
})

it('changing the chapter level previews again, and Select all restores chapters left out', async () => {
    show(vi.fn(), story(), fixture.text)
    await screen.findByText('2 of 2 chapters selected')
    fireEvent.click(screen.getByRole('button', { name: 'Select none' }))
    expect(screen.getByText('0 of 2 chapters selected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add 0 chapters' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Select all' }))
    expect(screen.getByText('2 of 2 chapters selected')).toBeInTheDocument()
    api.previewStoryOutline.mockResolvedValueOnce({ ...structuredClone(fixture.preview), chapterLevel: 1 })
    fireEvent.click(screen.getByRole('combobox', { name: 'Chapters are' }))
    fireEvent.click(screen.getByRole('option', { name: 'Heading 1' }))
    await waitFor(() => expect(api.previewStoryOutline).toHaveBeenLastCalledWith(fixture.text, 1, expect.anything()))
})

it('explains an outline without chapters, retries a failed preview and reports a write that was not applied', async () => {
    api.previewStoryOutline.mockRejectedValueOnce(new ApiError(422, 'Empty', { code: 'STORY_OUTLINE_EMPTY' }))
    show(vi.fn().mockResolvedValue(null), story(), 'Only a paragraph.')
    expect(await screen.findByText('No chapters or scenes were found. Use headings, “Chapter” lines or list items.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
    api.previewStoryOutline.mockRejectedValueOnce(new ApiError(502, 'Down', { code: 'story_outline_contract' }))
    paste(fixture.text)
    const alert = await screen.findByText('The outline could not be read. Try again.')
    fireEvent.click(within(alert.closest('[role="alert"]') as HTMLElement).getByRole('button', { name: 'Try again' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Add 2 chapters' }))
    expect(await screen.findByText('The outline could not be added. Nothing was changed.')).toBeInTheDocument()
})

it('reads a chosen Markdown file into the outline text on this device', async () => {
    show()
    const file = new File(['# Chapter 1\n- A scene\n'], 'plan.md', { type: 'text/markdown' })
    fireEvent.change(screen.getByLabelText('Open a file…'), { target: { files: [file] } })
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Outline' })).toHaveValue('# Chapter 1\n- A scene\n'))
    await waitFor(() => expect(api.previewStoryOutline).toHaveBeenCalledWith('# Chapter 1\n- A scene\n', null, expect.anything()))
})
