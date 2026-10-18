import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ApiError } from '@/infrastructure/api'
import { exportJob, exportJobFile, exportManifest } from '@/test/fixtures/storyExport'
import type { StoryExportJob } from '@/shared/types/storyExport.types'
import type { ManuscriptExportSource } from '../hooks/useManuscriptExportSource'
import { NovelExportJobs } from './NovelExportJobs'

const downloads = vi.hoisted(() => vi.fn())
vi.mock('@/utils/download', () => ({ downloadBlob: downloads }))
beforeEach(() => downloads.mockReset())
afterEach(() => vi.useRealTimers())

function source(list: () => Promise<StoryExportJob[]>, jobs: Partial<ManuscriptExportSource['jobs']> = {}) {
    return { key: 'k', storyId: 'story-1', isCurrent: () => true, preview: vi.fn(), download: vi.fn(), glossaryCandidates: vi.fn(),
        jobs: { list: vi.fn(list), start: vi.fn(), cancel: vi.fn(), retry: vi.fn(), download: vi.fn(), ...jobs } } as ManuscriptExportSource
}

it('builds the reviewed summary in the background and follows the job until its verified file downloads', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const running = exportJob({ status: 'running', stage: 'printing', sceneCount: 3, log: [{ at: '2026-10-18T12:00:00Z', code: 'queued' }, { at: '2026-10-18T12:00:01Z', code: 'read', values: { scenes: 3 } }] })
    const done = exportJob({ status: 'completed', stage: 'done', sceneCount: 3, file: exportJobFile })
    const list = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([running]).mockResolvedValue([done])
    const start = vi.fn(async () => exportJob())
    const value = source(list, { start, download: vi.fn(async () => new Blob(['PK'])) })
    const manifest = exportManifest()
    render(<NovelExportJobs source={value} manifest={manifest} onSourceChanged={() => {}} />)

    expect(await screen.findByText('No files built yet.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Build in background' }))
    await waitFor(() => expect(start).toHaveBeenCalledWith(manifest))
    expect(await screen.findByText('Waiting')).toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(1600) })
    expect(await screen.findByText('Printing the PDF')).toBeInTheDocument()
    expect(screen.getByText('Read 3 scenes', { exact: false })).toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(1600) })
    const row = (await screen.findByText('Gull-Point.docx')).closest('li') as HTMLElement
    expect(within(row).getByText('Ready')).toBeInTheDocument()
    fireEvent.click(within(row).getByRole('button', { name: 'Download' }))
    await waitFor(() => expect(downloads).toHaveBeenCalledWith(expect.any(Blob), 'Gull-Point.docx'))
    expect(await screen.findByText('Downloaded Gull-Point.docx. Its size and SHA-256 match the file the server built.')).toBeInTheDocument()
    // Every job finished: the list is not read again.
    const reads = list.mock.calls.length
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(list.mock.calls.length).toBe(reads)
})

it('explains a failed job, retries it, cancels a running one, and re-reads the summary when the novel changed', async () => {
    const failed = exportJob({ status: 'failed', errorCode: 'STORY_EXPORT_INTERRUPTED', log: [{ at: '2026-10-18T12:00:00Z', code: 'queued' }, { at: '2026-10-18T12:03:00Z', code: 'interrupted' }] })
    const retried = exportJob({ id: '1c6e8d2f-3a54-4b9f-8b62-7a1f3e0d9c21', retryOf: failed.id, attempt: 2, status: 'running', stage: 'reading' })
    const retry = vi.fn(async () => retried)
    const cancel = vi.fn(async () => ({ ...retried, status: 'canceled' as const }))
    const start = vi.fn(async () => { throw new ApiError(409, 'changed', { code: 'STORY_EXPORT_SOURCE_CHANGED' }) })
    const changed = vi.fn()
    const value = source(async () => [failed], { retry, cancel, start })
    render(<NovelExportJobs source={value} manifest={exportManifest()} onSourceChanged={changed} />)

    expect(await screen.findByText('The build stopped because the server restarted. Try again.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(retry).toHaveBeenCalledWith(failed))
    expect(await screen.findByText('Attempt 2')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(cancel).toHaveBeenCalledWith(retried))
    fireEvent.click(screen.getByRole('button', { name: 'Build in background' }))
    expect(await screen.findByText('The saved manuscript changed after this summary. Review the new summary, then build again.')).toBeInTheDocument()
    expect(changed).toHaveBeenCalledTimes(1)
})
