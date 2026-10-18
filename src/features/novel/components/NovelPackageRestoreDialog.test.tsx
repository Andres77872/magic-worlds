import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { beforeEach, expect, it, vi } from 'vitest'
import { i18n } from '@/app/i18n'
import { ApiError } from '@/infrastructure/api'
import { importManifest } from '@/test/fixtures/storyImport'
import { packagePreview } from '@/test/fixtures/storyPackage'
import { NovelImportDialog } from './NovelImportDialog'

const api = { previewStoryImport: vi.fn(), importStory: vi.fn(), getStoryImportResult: vi.fn(), previewStoryPackageRestore: vi.fn(), restoreStoryPackage: vi.fn(),
    getStoryPackageRestoreResult: vi.fn() }
vi.mock('@/app/hooks/useWorkspace', () => ({ useWorkspace: () => ({ api, capture: () => 'scope', isCurrent: () => true }) }))

const imported = vi.fn()
const STORY = '0a1b2c3d-0000-5000-8000-000000000001'
const show = () => render(<I18nextProvider i18n={i18n}><NovelImportDialog open onClose={() => {}} onImported={imported} /></I18nextProvider>)
const pick = (label: string, name: string, body = 'PK') => {
    const file = new File([body], name)
    fireEvent.change(screen.getByLabelText(label), { target: { files: [file] } })
    return file
}

beforeEach(async () => {
    vi.resetAllMocks()
    api.previewStoryPackageRestore.mockImplementation(async (file: File) => packagePreview({ size: file.size, sha256: 'e'.repeat(64) }))
    api.restoreStoryPackage.mockImplementation(async (_file, write) => ({ kind: 'novel_package_import', requestId: write.requestId, storyId: STORY, write }))
    api.previewStoryImport.mockImplementation(async (_file, options) => importManifest(options))
    await i18n.changeLanguage('en')
})

it('restores a chosen project package as a new novel with exactly the reviewed choices', async () => {
    show()
    const file = pick('Manuscript file', 'Gull-Point.mwnovel')
    expect(await screen.findByText('1 part, 2 chapters and 3 scenes · 1,200 words')).toBeInTheDocument()
    expect(api.previewStoryPackageRestore).toHaveBeenCalledWith(file, expect.anything())
    expect(api.previewStoryImport).not.toHaveBeenCalled()
    expect(screen.getByText('Backup of “Gull Point”')).toBeInTheDocument()
    expect(screen.getByText('2 Codex references — Codex: Mara, Gull Point')).toBeInTheDocument()
    expect(screen.getByText('The cover image is in this workspace and is kept.')).toBeInTheDocument()
    expect(screen.getByText('3 comments · 1 bookmark')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Novel title' })).toHaveValue('Gull Point')
    fireEvent.change(screen.getByRole('textbox', { name: 'Novel title' }), { target: { value: 'Gull Point (restored)' } })
    fireEvent.click(screen.getByRole('switch', { name: /Scene history/ }))
    expect(screen.getByText(/each scene starts a new history/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Restore novel' }))
    await waitFor(() => expect(imported).toHaveBeenCalledWith(STORY))
    const [sent, write] = api.restoreStoryPackage.mock.calls[0]
    expect(sent).toBe(file)
    expect(write).toMatchObject({ title: 'Gull Point (restored)', packageHash: 'e'.repeat(64), options: { notes: true, planning: true, history: false } })
})

it('offers only what the package holds, explains a missing cover and refusals, and goes back for a manuscript', async () => {
    api.previewStoryPackageRestore.mockImplementation(async (file: File) => packagePreview({ size: file.size, sha256: 'e'.repeat(64) }, {
        includes: { notes: true, planning: false, history: false }, media: [{ role: 'cover', assetId: 'image-one', alt: null, included: false, available: false }] }))
    show()
    pick('Manuscript file', 'Gull-Point.mwnovel')
    expect(await screen.findByText(/restored without it/)).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: /Planning/ })).toBeDisabled()
    expect(screen.getAllByText('Not in this package')).toHaveLength(2)
    api.previewStoryPackageRestore.mockRejectedValue(new ApiError(422, 'corrupt', { code: 'STORY_PACKAGE_CORRUPT', retryable: false }))
    pick('Project package', 'Other.mwnovel')
    expect(await screen.findByText(/This package is damaged/)).toBeInTheDocument()
    pick('Project package', 'gull.md', '# Low tide\n\nMara.')
    await screen.findByText('1 part, 2 chapters and 3 scenes · 1,200 words · Markdown')
    expect(api.previewStoryImport).toHaveBeenCalled()
})
