import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { ApiError } from '@/infrastructure/api'
import { packageManifest } from '@/test/fixtures/storyPackage'
import type { StoryPackageOptions } from '@/shared/types/storyPackage.types'
import type { NovelPackageSource } from '../hooks/useNovelPackageSource'
import { NovelPackageExportDialog } from './NovelPackageExportDialog'

const downloads = vi.hoisted(() => vi.fn())
vi.mock('@/utils/download', () => ({ downloadBlob: downloads }))
beforeEach(() => downloads.mockReset())

function source(download: NovelPackageSource['download'] = async () => new Blob(['PK'])) {
    return { key: 'k', storyId: 'story-1', isCurrent: () => true, preview: vi.fn(async (options: StoryPackageOptions) => packageManifest(options)), download: vi.fn(download) }
}

it('summarizes what the package holds for the chosen extras and downloads that package', async () => {
    const value = source()
    render(<NovelPackageExportDialog open onClose={() => {}} source={value} />)
    expect(await screen.findByText('1 part, 2 chapters and 3 scenes · 1,200 words · 46.9 KB')).toBeInTheDocument()
    expect(value.preview).toHaveBeenLastCalledWith({ notes: true, planning: true, history: false }, expect.any(AbortSignal))
    expect(screen.getByText('2 Codex references · 3 comments · 1 bookmark · 2 tasks · 1 story fact · 1 stash item')).toBeInTheDocument()
    expect(screen.getByText(/The cover image is referred to, not included/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('switch', { name: /Scene history/ }))
    await screen.findByText('2 Codex references · 3 comments · 1 bookmark · 2 tasks · 1 story fact · 1 stash item · 9 saved revisions')
    fireEvent.click(screen.getByRole('switch', { name: /Comments and bookmarks/ }))
    await screen.findByText('2 Codex references · 2 tasks · 1 story fact · 1 stash item · 9 saved revisions')
    fireEvent.click(screen.getByRole('button', { name: 'Download package' }))
    await screen.findByText('Saved Gull-Point.mwnovel.')
    expect(value.download).toHaveBeenCalledWith(packageManifest({ notes: false, planning: true, history: true }))
    expect(downloads).toHaveBeenCalledWith(expect.any(Blob), 'Gull-Point.mwnovel')
})

it('summarizes again when the novel changed since the summary, and explains a package that is too large', async () => {
    const value = source(async () => { throw new ApiError(409, 'changed', { code: 'STORY_PACKAGE_SOURCE_CHANGED', retryable: false }) })
    render(<NovelPackageExportDialog open onClose={() => {}} source={value} />)
    await screen.findByText(/1,200 words/)
    fireEvent.click(screen.getByRole('button', { name: 'Download package' }))
    expect(await screen.findByText(/The novel changed since this summary/)).toBeInTheDocument()
    await waitFor(() => expect(value.preview).toHaveBeenCalledTimes(2))
    expect(downloads).not.toHaveBeenCalled()
    value.preview.mockRejectedValue(new ApiError(413, 'large', { code: 'STORY_PACKAGE_TOO_LARGE', retryable: false }))
    fireEvent.click(screen.getByRole('switch', { name: /Scene history/ }))
    expect(await screen.findByText(/larger than 64 MB/)).toBeInTheDocument()
})
