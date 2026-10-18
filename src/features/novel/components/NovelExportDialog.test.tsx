import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { ApiError } from '@/infrastructure/api'
import { exportManifest, exportRequest } from '@/test/fixtures/storyExport'
import type { StoryExportOptions } from '@/shared/types/storyExport.types'
import type { ManuscriptExportSource } from '../hooks/useManuscriptExportSource'
import { NovelExportDialog } from './NovelExportDialog'

const downloads = vi.hoisted(() => vi.fn())
vi.mock('@/utils/download', () => ({ downloadBlob: downloads }))
beforeEach(() => downloads.mockReset())

function source(download: ManuscriptExportSource['download']) {
    const files = { markdown: { filename: 'Gull-Point.md', contentType: 'text/markdown; charset=utf-8' }, epub: { filename: 'Gull-Point.epub', contentType: 'application/epub+zip' },
        pdf: { filename: 'Gull-Point.pdf', contentType: 'application/pdf' } }
    const preview = vi.fn(async (options: StoryExportOptions) => exportManifest(exportRequest(options), options.format in files ? files[options.format as keyof typeof files] : {}))
    const glossaryCandidates = vi.fn(async () => [{ refId: 'gull', kind: 'world', term: 'Gull Point', definition: 'A rocky cape.' },
        { refId: 'mara', kind: 'character', term: 'Mara', definition: 'The keeper’s daughter.' }])
    const jobs = { list: vi.fn(async () => []), start: vi.fn(), cancel: vi.fn(), retry: vi.fn(), download: vi.fn() }
    return { key: 'k', storyId: 'story-1', isCurrent: () => true, preview, download: vi.fn(download), glossaryCandidates, jobs }
}

it('summarizes what the file holds for the chosen format and downloads that file', async () => {
    const value = source(async () => new Blob(['PK']))
    render(<NovelExportDialog open onClose={() => {}} source={value} savedVersion="v1" />)
    expect(await screen.findByText('1 scene in 1 chapter', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('2 planning beats left out')).toBeInTheDocument()
    expect(screen.getByText('File name: Gull-Point.docx')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Markdown' }))
    await waitFor(() => expect(screen.getByText('File name: Gull-Point.md')).toBeInTheDocument())
    expect(value.preview).toHaveBeenLastCalledWith(expect.objectContaining({ format: 'markdown', titlePage: true }), expect.any(AbortSignal))
    // The page-break choice applies to Word only; an EPUB starts each chapter on its own page anyway.
    expect(screen.queryByText('Start parts and chapters on a new page')).toBeNull()
    // The contents page applies to Word and EPUB only.
    expect(screen.queryByText('Contents page')).toBeNull()
    fireEvent.click(screen.getByRole('radio', { name: 'EPUB' }))
    await waitFor(() => expect(screen.getByText('File name: Gull-Point.epub')).toBeInTheDocument())
    expect(screen.getByText(/table of contents of parts and chapters/)).toBeInTheDocument()
    expect(screen.queryByText('Start parts and chapters on a new page')).toBeNull()
    fireEvent.click(screen.getByRole('switch', { name: /Contents page/ }))
    await waitFor(() => expect(value.preview).toHaveBeenLastCalledWith(expect.objectContaining({ format: 'epub', contents: true }), expect.any(AbortSignal)))
    fireEvent.click(screen.getByRole('radio', { name: 'Markdown' }))
    await waitFor(() => expect(screen.getByText('File name: Gull-Point.md')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Download' }))
    await waitFor(() => expect(downloads).toHaveBeenCalledWith(expect.any(Blob), 'Gull-Point.md'))
    expect(screen.getByRole('status')).toHaveTextContent('Downloaded Gull-Point.md. It matches the summary.')
})

it('summarizes again instead of downloading when the saved manuscript changed', async () => {
    const value = source(async () => { throw new ApiError(409, 'changed', { code: 'STORY_EXPORT_SOURCE_CHANGED' }) })
    render(<NovelExportDialog open onClose={() => {}} source={value} savedVersion="v1" />)
    await screen.findByText('File name: Gull-Point.docx')
    fireEvent.click(screen.getByRole('button', { name: 'Download' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('The saved manuscript changed after this summary.')
    await waitFor(() => expect(value.preview).toHaveBeenCalledTimes(2))
    expect(downloads).not.toHaveBeenCalled()
})

it('names the front and back matter that the file places around the main text', async () => {
    const value = source(async () => new Blob(['PK']))
    const row = exportManifest().scenes[0]
    value.preview.mockImplementation(async (options: StoryExportOptions) => exportManifest(exportRequest(options), { scenes: [
        { ...row, sceneId: 'd1', chapterId: 'cd', role: 'dedication' }, { ...row, sceneId: 'f1', chapterId: 'cf', role: 'foreword' }, row,
        { ...row, sceneId: 'a1', chapterId: 'ca', role: 'acknowledgments' }, { ...row, sceneId: 'a2', chapterId: 'ca', role: 'acknowledgments' }] }))
    render(<NovelExportDialog open onClose={() => {}} source={value} savedVersion="v1" />)
    expect(await screen.findByText('Front matter: Dedication, Foreword')).toBeInTheDocument()
    expect(screen.getByText('Back matter: Acknowledgments')).toBeInTheDocument()
})

it('reads the Codex only when a glossary is wanted and exports exactly the chosen terms', async () => {
    const value = source(async () => new Blob(['PK']))
    render(<NovelExportDialog open onClose={() => {}} source={value} savedVersion="v1" />)
    await screen.findByText('File name: Gull-Point.docx')
    expect(value.glossaryCandidates).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('switch', { name: /Add a glossary from the Codex/ }))
    await screen.findByText('0 of 2 chosen')
    fireEvent.click(screen.getByRole('checkbox', { name: /Mara/ }))
    await waitFor(() => expect(value.preview).toHaveBeenLastCalledWith(expect.objectContaining({ glossary: ['mara'] }), expect.any(AbortSignal)))
    expect(await screen.findByText('Glossary: 1 term')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Choose all' }))
    await waitFor(() => expect(value.preview).toHaveBeenLastCalledWith(expect.objectContaining({ glossary: ['gull', 'mara'] }), expect.any(AbortSignal)))
    fireEvent.click(screen.getByRole('switch', { name: /Add a glossary from the Codex/ }))
    await waitFor(() => expect(value.preview).toHaveBeenLastCalledWith(expect.objectContaining({ glossary: [] }), expect.any(AbortSignal)))
    expect(value.glossaryCandidates).toHaveBeenCalledTimes(1)
})

it('lays out a PDF with the chosen page rules, keeps them while another format is chosen and sends them only with a PDF', async () => {
    const value = source(async () => new Blob(['%PDF-']))
    render(<NovelExportDialog open onClose={() => {}} source={value} savedVersion="v1" />)
    await screen.findByText('File name: Gull-Point.docx')
    expect(screen.queryByText('Page layout')).toBeNull()
    expect(value.preview).toHaveBeenLastCalledWith(expect.objectContaining({ format: 'docx', pdf: null }), expect.any(AbortSignal))
    fireEvent.click(screen.getByRole('radio', { name: 'PDF' }))
    await waitFor(() => expect(screen.getByText('File name: Gull-Point.pdf')).toBeInTheDocument())
    expect(value.preview).toHaveBeenLastCalledWith(expect.objectContaining({ format: 'pdf', pdf: { pageSize: 'trade', fontSize: 11, lineSpacing: 'relaxed',
        margins: 'normal', fontFamily: 'serif', pageNumbers: true, justify: true } }), expect.any(AbortSignal))
    // Page breaks and the contents page apply to a PDF too.
    expect(screen.getByRole('switch', { name: /Start parts and chapters on a new page/ })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: /Contents page/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('combobox', { name: 'Page size' }))
    fireEvent.click(screen.getByRole('option', { name: 'A4 (210 × 297 mm)' }))
    fireEvent.click(screen.getByRole('combobox', { name: 'Text size' }))
    fireEvent.click(screen.getByRole('option', { name: '13 pt' }))
    fireEvent.click(screen.getByRole('switch', { name: /Page numbers/ }))
    await waitFor(() => expect(value.preview).toHaveBeenLastCalledWith(expect.objectContaining({ format: 'pdf',
        pdf: expect.objectContaining({ pageSize: 'a4', fontSize: 13, pageNumbers: false }) }), expect.any(AbortSignal)))
    fireEvent.click(screen.getByRole('radio', { name: 'EPUB' }))
    await waitFor(() => expect(value.preview).toHaveBeenLastCalledWith(expect.objectContaining({ format: 'epub', pdf: null }), expect.any(AbortSignal)))
    expect(screen.queryByText('Page layout')).toBeNull()
    fireEvent.click(screen.getByRole('radio', { name: 'PDF' }))
    await waitFor(() => expect(value.preview).toHaveBeenLastCalledWith(expect.objectContaining({ format: 'pdf',
        pdf: expect.objectContaining({ pageSize: 'a4', fontSize: 13, pageNumbers: false }) }), expect.any(AbortSignal)))
    await waitFor(() => expect(screen.getByText('File name: Gull-Point.pdf')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Download' }))
    await waitFor(() => expect(downloads).toHaveBeenCalledWith(expect.any(Blob), 'Gull-Point.pdf'))
    expect(value.download).toHaveBeenCalledWith(expect.objectContaining({ request: expect.objectContaining({ format: 'pdf', pdf: expect.objectContaining({ pageSize: 'a4' }) }) }))
})

it('says when the server cannot print a PDF', async () => {
    const value = source(async () => new Blob(['%PDF-']))
    const ready = value.preview.getMockImplementation()!
    value.preview.mockImplementation(async (options: StoryExportOptions) => {
        if (options.format === 'pdf') throw new ApiError(503, 'unavailable', { code: 'STORY_EXPORT_PDF_UNAVAILABLE' })
        return ready(options)
    })
    render(<NovelExportDialog open onClose={() => {}} source={value} savedVersion="v1" />)
    await screen.findByText('File name: Gull-Point.docx')
    fireEvent.click(screen.getByRole('radio', { name: 'PDF' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('PDF printing is not available on the server right now.')
})

it('exports review notes or AI changes of the same scenes and brings the manuscript choices back afterwards', async () => {
    const value = source(async () => new Blob(['# notes']))
    const ready = value.preview.getMockImplementation()!
    value.preview.mockImplementation(async (options: StoryExportOptions) => options.document === 'manuscript' ? ready(options)
        : exportManifest(exportRequest(options), { filename: options.document === 'review_notes' ? 'Gull-Point-Review-notes.docx' : 'Gull-Point-AI-changes.docx',
            entries: options.document === 'review_notes' ? 2 : 0, notes: [] }))
    render(<NovelExportDialog open onClose={() => {}} source={value} savedVersion="v1" />)
    await screen.findByText('File name: Gull-Point.docx')
    fireEvent.click(screen.getByRole('switch', { name: /Contents page/ }))
    await waitFor(() => expect(value.preview).toHaveBeenLastCalledWith(expect.objectContaining({ contents: true }), expect.any(AbortSignal)))
    fireEvent.click(screen.getByRole('radio', { name: 'Review notes' }))
    await waitFor(() => expect(screen.getByText('File name: Gull-Point-Review-notes.docx')).toBeInTheDocument())
    // The manuscript's own choices go at their defaults; only scene inclusion and resolved notes apply.
    expect(value.preview).toHaveBeenLastCalledWith(expect.objectContaining({ document: 'review_notes', contents: false, resolvedNotes: false, glossary: [] }), expect.any(AbortSignal))
    expect(screen.queryByRole('switch', { name: /Contents page/ })).toBeNull()
    expect(screen.queryByRole('switch', { name: /Add a glossary/ })).toBeNull()
    expect(screen.getByText(/2 notes on 1 scene/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('switch', { name: /Include resolved notes/ }))
    await waitFor(() => expect(value.preview).toHaveBeenLastCalledWith(expect.objectContaining({ document: 'review_notes', resolvedNotes: true }), expect.any(AbortSignal)))
    fireEvent.click(screen.getByRole('radio', { name: 'AI changes' }))
    await waitFor(() => expect(value.preview).toHaveBeenLastCalledWith(expect.objectContaining({ document: 'ai_changes', resolvedNotes: false }), expect.any(AbortSignal)))
    expect(await screen.findByText(/No AI proposals were accepted into the exported scenes/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download' })).toBeDisabled()
    fireEvent.click(screen.getByRole('radio', { name: 'Manuscript' }))
    await waitFor(() => expect(value.preview).toHaveBeenLastCalledWith(expect.objectContaining({ document: 'manuscript', contents: true }), expect.any(AbortSignal)))
    expect(screen.getByRole('switch', { name: /Contents page/ })).toHaveAttribute('aria-checked', 'true')
})

it('exports the style sheet from the saved details, even for a novel with no scenes, without scene choices', async () => {
    const value = source(async () => new Blob(['# style']))
    value.preview.mockImplementation(async (options: StoryExportOptions) => exportManifest(exportRequest(options), {
        filename: options.document === 'style_sheet' ? 'Gull-Point-Style-sheet.docx' : 'Gull-Point.docx', entries: options.document === 'style_sheet' ? 4 : null,
        scenes: [], excluded: [{ sceneId: 's2', chapterId: 'c1', partId: null, title: 'Cut', chapterTitle: 'One', role: null, reason: 'excluded' }], notes: [] }))
    render(<NovelExportDialog open onClose={() => {}} source={value} savedVersion="v1" />)
    await screen.findByText(/No scene is included/)
    fireEvent.click(screen.getByRole('radio', { name: 'Style sheet' }))
    await waitFor(() => expect(screen.getByText('File name: Gull-Point-Style-sheet.docx')).toBeInTheDocument())
    expect(value.preview).toHaveBeenLastCalledWith(expect.objectContaining({ document: 'style_sheet', resolvedNotes: false, glossary: [] }), expect.any(AbortSignal))
    expect(screen.getByText(/Only the saved novel details are exported/)).toBeInTheDocument()
    expect(screen.getByText(/4 style entries/)).toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: /Include archived/ })).toBeNull()
    expect(screen.queryByText(/left out/i)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Download' }))
    await waitFor(() => expect(downloads).toHaveBeenCalledWith(expect.any(Blob), 'Gull-Point-Style-sheet.docx'))
})
