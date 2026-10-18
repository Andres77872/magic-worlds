import type { StoryExportJob, StoryExportManifest, StoryExportRequest } from '@/shared/types/storyExport.types'

/** Fictional export choices and their manifest. */
export const exportRequest = (patch: Partial<StoryExportRequest> = {}): StoryExportRequest => ({ sourceVersion: 'a'.repeat(64), format: 'docx', includeArchived: false,
    titlePage: true, partTitles: true, chapterTitles: true, sceneTitles: false, chapterBreaks: true, contents: false, glossary: [], pdf: null, document: 'manuscript', resolvedNotes: false, ...patch })
export const exportManifest = (request = exportRequest(), patch: Partial<StoryExportManifest> = {}): StoryExportManifest => ({
    schemaVersion: 1, projection: 'manuscript_export', storyId: 'story-1', sourceVersion: request.sourceVersion, request, title: 'Gull Point', filename: 'Gull-Point.docx',
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', sha256: 'b'.repeat(64), bytes: 2048, wordCount: 1200,
    scenes: [{ sceneId: 's1', chapterId: 'c1', partId: null, title: 'Arrival', chapterTitle: 'One', role: null, revision: 3, contentHash: 'c'.repeat(64) }],
    excluded: [{ sceneId: 's2', chapterId: 'c1', partId: null, title: 'Cut', chapterTitle: 'One', role: null, reason: 'excluded' }],
    notes: [{ code: 'beats_omitted', count: 2 }], glossary: request.glossary.map((refId) => ({ refId, term: 'Term ' + refId })),
    entries: request.document === 'manuscript' ? null : 0, ...patch })
/** A fictional export job of that request; completed jobs carry the manifest's file. */
export const exportJob = (patch: Partial<StoryExportJob> = {}, request = exportRequest()): StoryExportJob => ({
    id: '0b5d7c1e-2f43-4a8e-9a51-6f0e2d9c8b10', storyId: 'story-1', requestId: 'export-1', retryOf: null, attempt: 1, sourceVersion: request.sourceVersion, request,
    status: 'queued', stage: 'queued', sceneCount: null, log: [{ at: '2026-10-18T12:00:00Z', code: 'queued' }], errorCode: null, file: null,
    createdAt: '2026-10-18T12:00:00Z', startedAt: null, finishedAt: null, ...patch })
export const exportJobFile = { filename: 'Gull-Point.docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', bytes: 2,
    sha256: 'b'.repeat(64), wordCount: 1200, removed: false }
