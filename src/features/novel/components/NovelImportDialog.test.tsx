import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { beforeEach, expect, it, vi } from 'vitest'
import { i18n } from '@/app/i18n'
import { ApiError } from '@/infrastructure/api'
import { importManifest } from '@/test/fixtures/storyImport'
import { NovelImportDialog } from './NovelImportDialog'

const api = { previewStoryImport: vi.fn(), importStory: vi.fn(), getStoryImportResult: vi.fn() }
vi.mock('@/app/hooks/useWorkspace', () => ({ useWorkspace: () => ({ api, capture: () => 'scope', isCurrent: () => true }) }))

const imported = vi.fn(), closed = vi.fn()
const STORY = '0a1b2c3d-0000-5000-8000-000000000001'
const show = () => render(<I18nextProvider i18n={i18n}><NovelImportDialog open onClose={closed} onImported={imported} /></I18nextProvider>)
const pick = (name = 'gull.md', body = '# Part One\n\n## Low tide\n\nMara.') => {
    const file = new File([body], name, { type: 'text/markdown' })
    fireEvent.change(screen.getByLabelText('Manuscript file'), { target: { files: [file] } })
    return file
}
const ack = (write: { requestId: string }) => ({ kind: 'novel_import', requestId: write.requestId, storyId: STORY, write })

beforeEach(async () => {
    vi.resetAllMocks()
    api.previewStoryImport.mockImplementation(async (_file, options) => importManifest(options))
    api.importStory.mockImplementation(async (_file, write) => ack(write))
    await i18n.changeLanguage('en')
})

it('previews the conversion, then creates the novel from exactly the reviewed preview and title', async () => {
    show()
    const file = pick()
    await screen.findByText('1 part, 2 chapters and 3 scenes · 1,200 words · Markdown')
    expect(api.previewStoryImport).toHaveBeenCalledWith(file, { chapterLevel: 'auto', splitScenes: true }, expect.anything())
    expect(screen.getByText('2 images or drawings left out')).toBeInTheDocument()
    expect(screen.getByText('1 footnote left out')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Novel title' })).toHaveValue('Gull Point')
    fireEvent.change(screen.getByRole('textbox', { name: 'Novel title' }), { target: { value: 'The Gull Point letters' } })
    fireEvent.click(screen.getByRole('switch', { name: 'Start a new scene at each scene break' }))
    await screen.findByText('1 part, 2 chapters and 2 scenes · 1,200 words · Markdown')
    expect(screen.getByRole('textbox', { name: 'Novel title' })).toHaveValue('The Gull Point letters')
    fireEvent.click(screen.getByRole('button', { name: 'Create novel' }))
    await waitFor(() => expect(imported).toHaveBeenCalledWith(STORY))
    const [sent, write] = api.importStory.mock.calls[0]
    expect(sent).toBe(file)
    expect(write).toMatchObject({ title: 'The Gull Point letters', sourceHash: 'a'.repeat(64), importVersion: 'c'.repeat(64), options: { chapterLevel: 'auto', splitScenes: false } })
})

it('shows the front and back matter the file holds, with each chapter\'s role', async () => {
    api.previewStoryImport.mockImplementation(async (_file, options) => importManifest(options, { parts: [], chapters: [
        { title: 'Dedication', part: null, role: 'dedication', scenes: [{ title: 'Scene 1', words: 5, excerpt: 'For Mara.' }] },
        { title: 'Low tide', part: null, role: null, scenes: [{ title: 'Scene 1', words: 700, excerpt: 'Mara read the letter.' }] },
        { title: 'After the storm', part: null, role: 'afterword', scenes: [{ title: 'Scene 1', words: 9, excerpt: 'The beach was new.' }] },
    ] }))
    show()
    pick()
    expect(await screen.findByText('Front matter: Dedication')).toBeInTheDocument()
    expect(screen.getByText('Back matter: Afterword')).toBeInTheDocument()
    expect(screen.getByText(/keeps its export section/)).toBeInTheDocument()
    expect(screen.getByText('· Front matter · Dedication', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('· Back matter · Afterword', { exact: false })).toBeInTheDocument()
})

it('explains files it cannot import, without uploading what the browser can already refuse', async () => {
    show()
    pick('novel.pdf')
    expect(await screen.findByText(/This kind of file is not supported/)).toBeInTheDocument()
    expect(api.previewStoryImport).not.toHaveBeenCalled()
    api.previewStoryImport.mockRejectedValueOnce(new ApiError(422, 'Encrypted', { code: 'STORY_IMPORT_ENCRYPTED' }))
    pick('locked.epub')
    expect(await screen.findByText(/The file is password-protected or uses DRM/)).toBeInTheDocument()
    expect(api.previewStoryImport).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Create novel' })).toBeDisabled()
})

it('recovers a lost response from its receipt and retries a failed import with the same request id', async () => {
    show()
    pick()
    await screen.findByText('1 part, 2 chapters and 3 scenes · 1,200 words · Markdown')
    api.importStory.mockRejectedValueOnce(new ApiError(503, 'Unavailable'))
    api.getStoryImportResult.mockResolvedValueOnce(null)
    fireEvent.click(screen.getByRole('button', { name: 'Create novel' }))
    expect(await screen.findByText(/The novel could not be created/)).toBeInTheDocument()
    api.importStory.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    api.getStoryImportResult.mockImplementationOnce(async (write) => ack(write))
    fireEvent.click(screen.getByRole('button', { name: 'Create novel' }))
    await waitFor(() => expect(imported).toHaveBeenCalledWith(STORY))
    expect(api.importStory.mock.calls[1][1].requestId).toBe(api.importStory.mock.calls[0][1].requestId)
})

it('previews again when the conversion changed before the import', async () => {
    show()
    pick()
    await screen.findByText('1 part, 2 chapters and 3 scenes · 1,200 words · Markdown')
    api.importStory.mockRejectedValueOnce(new ApiError(409, 'Changed', { code: 'STORY_IMPORT_VERSION_CHANGED' }))
    fireEvent.click(screen.getByRole('button', { name: 'Create novel' }))
    expect(await screen.findByText(/The conversion changed after its preview/)).toBeInTheDocument()
    await waitFor(() => expect(api.previewStoryImport).toHaveBeenCalledTimes(2))
    expect(api.getStoryImportResult).not.toHaveBeenCalled()
})
