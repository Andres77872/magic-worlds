import { expect, it } from 'vitest'
import { exportJob, exportJobFile, exportRequest } from '@/test/fixtures/storyExport'
import { verifyStoryExportJob } from './storyExportContract'

it('accepts a job of this novel only while its status, stage, file, reason and retry agree', () => {
    const done = exportJob({ status: 'completed', stage: 'done', file: exportJobFile, log: [{ at: '2026-10-18T12:00:00Z', code: 'completed', values: { bytes: 2, sha256: 'b'.repeat(64) } }] })
    expect(verifyStoryExportJob(exportJob(), 'story-1')).toBe(true)
    expect(verifyStoryExportJob(done, 'story-1')).toBe(true)
    expect(verifyStoryExportJob(exportJob({ status: 'failed', errorCode: 'STORY_EXPORT_INTERRUPTED' }), 'story-1')).toBe(true)
    expect(verifyStoryExportJob(exportJob({ retryOf: '1c6e8d2f-3a54-4b9f-8b62-7a1f3e0d9c21', attempt: 2 }), 'story-1')).toBe(true)

    expect(verifyStoryExportJob(exportJob(), 'story-2')).toBe(false)
    expect(verifyStoryExportJob({ ...done, file: null }, 'story-1')).toBe(false)
    expect(verifyStoryExportJob({ ...done, stage: 'storing' }, 'story-1')).toBe(false)
    expect(verifyStoryExportJob(exportJob({ file: exportJobFile }), 'story-1')).toBe(false)
    expect(verifyStoryExportJob({ ...done, file: { ...exportJobFile, filename: 'Gull-Point.pdf' } }, 'story-1')).toBe(false)
    expect(verifyStoryExportJob(exportJob({ status: 'failed' }), 'story-1')).toBe(false)
    expect(verifyStoryExportJob(exportJob({ attempt: 2 }), 'story-1')).toBe(false)
    expect(verifyStoryExportJob(exportJob({ sourceVersion: 'c'.repeat(64) }), 'story-1')).toBe(false)
    expect(verifyStoryExportJob(exportJob({}, exportRequest({ format: 'pdf' })), 'story-1')).toBe(false)
    expect(verifyStoryExportJob(exportJob({ log: [] }), 'story-1')).toBe(false)
    expect(verifyStoryExportJob(exportJob({ log: [{ at: 'noon', code: 'queued' }] }), 'story-1')).toBe(false)
    expect(verifyStoryExportJob({ ...exportJob(), manifest: null }, 'story-1')).toBe(false)
})
