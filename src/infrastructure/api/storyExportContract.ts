import { isRecord } from '@/shared/novelMutationJournal'
import { isSnapshotHash } from '@/shared/storySnapshotOperation'
import { isStoryExportRole } from '@/shared/storyUnitDetails'
import type { StoryExportJob, StoryExportManifest, StoryExportPdfLayout, StoryExportRequest } from '@/shared/types/storyExport.types'
import { canonicalJson } from '@/utils/json'

const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every((key) => key in v)
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64 && v === v.trim()
const count = (v: unknown, min = 0): v is number => Number.isSafeInteger(v) && Number(v) >= min
const OPTIONS = ['includeArchived', 'titlePage', 'partTitles', 'chapterTitles', 'sceneTitles', 'chapterBreaks', 'contents'] as const
const FORMATS = { markdown: ['text/markdown; charset=utf-8', '.md'], text: ['text/plain; charset=utf-8', '.txt'], docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.docx'],
    epub: ['application/epub+zip', '.epub'], pdf: ['application/pdf', '.pdf'] }
const LAYOUT = { pageSize: ['letter', 'a4', 'a5', 'trade', 'digest'], lineSpacing: ['single', 'relaxed', 'double'], margins: ['narrow', 'normal', 'wide'], fontFamily: ['serif', 'sans'] } as const
const LAYOUT_KEYS = ['pageSize', 'fontSize', 'lineSpacing', 'margins', 'fontFamily', 'pageNumbers', 'justify'] as const

export function isStoryExportPdfLayout(v: unknown): v is StoryExportPdfLayout {
    return isRecord(v) && exact(v, [...LAYOUT_KEYS]) && (Object.keys(LAYOUT) as Array<keyof typeof LAYOUT>).every((key) => (LAYOUT[key] as readonly string[]).includes(String(v[key])))
        && Number.isSafeInteger(v.fontSize) && Number(v.fontSize) >= 9 && Number(v.fontSize) <= 16 && typeof v.pageNumbers === 'boolean' && typeof v.justify === 'boolean'
}
const DOCUMENTS = ['manuscript', 'review_notes', 'ai_changes', 'style_sheet']
/** The manuscript choices a companion file keeps at their defaults. */
const MANUSCRIPT_DEFAULTS = { titlePage: true, partTitles: true, chapterTitles: true, sceneTitles: false, chapterBreaks: true, contents: false } as const
const NOTES = ['beats_omitted', 'highlights_omitted', 'mentions_as_text', 'headings_shifted', 'empty_scenes', 'contents_omitted']

export function isStoryExportRequest(v: unknown): v is StoryExportRequest {
    return isRecord(v) && exact(v, ['sourceVersion', 'format', ...OPTIONS, 'glossary', 'pdf', 'document', 'resolvedNotes']) && isSnapshotHash(v.sourceVersion)
        // A PDF carries its page layout, and only a PDF does.
        && (v.format === 'pdf' ? isStoryExportPdfLayout(v.pdf) : v.pdf === null)
        && DOCUMENTS.includes(String(v.document)) && typeof v.resolvedNotes === 'boolean' && (!v.resolvedNotes || v.document === 'review_notes')
        && (v.document === 'manuscript' || (Object.keys(MANUSCRIPT_DEFAULTS) as Array<keyof typeof MANUSCRIPT_DEFAULTS>).every((key) => v[key] === MANUSCRIPT_DEFAULTS[key])
            && Array.isArray(v.glossary) && v.glossary.length === 0)
        && Object.prototype.hasOwnProperty.call(FORMATS, String(v.format)) && OPTIONS.every((key) => typeof v[key] === 'boolean')
        && Array.isArray(v.glossary) && v.glossary.length <= 200 && v.glossary.every(id) && new Set(v.glossary).size === v.glossary.length
}

function scene(v: unknown, extra: string[]): v is Record<string, unknown> {
    return isRecord(v) && exact(v, ['sceneId', 'chapterId', 'partId', 'title', 'chapterTitle', 'role', ...extra]) && id(v.sceneId) && id(v.chapterId)
        && (v.partId === null || id(v.partId)) && typeof v.title === 'string' && typeof v.chapterTitle === 'string' && (v.role === null || isStoryExportRole(v.role))
}

/** The manifest must describe exactly the requested file: same choices, matching type and name, and every scene once. */
export function verifyStoryExportManifest(v: unknown, storyId: string, request: StoryExportRequest): v is StoryExportManifest {
    if (!isStoryExportRequest(request) || !isRecord(v) || !exact(v, ['schemaVersion', 'projection', 'storyId', 'sourceVersion', 'request', 'title', 'filename', 'contentType',
        'sha256', 'bytes', 'wordCount', 'scenes', 'excluded', 'notes', 'glossary', 'entries'])) return false
    // A companion file counts its notes or AI changes; the manuscript has none.
    if (request.document === 'manuscript' ? v.entries !== null : !count(v.entries)) return false
    const [type, extension] = FORMATS[request.format]
    if (v.schemaVersion !== 1 || v.projection !== 'manuscript_export' || v.storyId !== storyId || v.sourceVersion !== request.sourceVersion
        || canonicalJson(v.request) !== canonicalJson(request) || typeof v.title !== 'string' || typeof v.filename !== 'string' || !v.filename.endsWith(extension)
        || v.contentType !== type || !isSnapshotHash(v.sha256) || !count(v.bytes, 1) || !(v.wordCount === null || count(v.wordCount))
        || !Array.isArray(v.scenes) || !Array.isArray(v.excluded) || !Array.isArray(v.notes) || !Array.isArray(v.glossary)) return false
    // Exactly the chosen glossary entries, each once with its term.
    const chosen = new Set(request.glossary)
    if (v.glossary.length !== chosen.size || !v.glossary.every((row) => isRecord(row) && exact(row, ['refId', 'term']) && chosen.has(String(row.refId))
        && typeof row.term === 'string' && row.term.length > 0) || new Set(v.glossary.map((row) => (row as { refId: string }).refId)).size !== chosen.size) return false
    if (!v.scenes.every((row) => scene(row, ['revision', 'contentHash']) && count(row.revision, 1) && isSnapshotHash(row.contentHash))
        || !v.excluded.every((row) => scene(row, ['reason']) && ['trashed', 'merged', 'archived', 'excluded'].includes(String(row.reason)))) return false
    const ids = [...v.scenes, ...v.excluded].map((row) => (row as { sceneId: string }).sceneId)
    return new Set(ids).size === ids.length
        && v.notes.every((row) => isRecord(row) && exact(row, ['code', 'count']) && NOTES.includes(String(row.code)) && count(row.count, 1))
        && new Set(v.notes.map((row) => (row as { code: string }).code)).size === v.notes.length
}

/** The query string of the download that the preview described. */
export function storyExportQuery(request: StoryExportRequest): string {
    const query = new URLSearchParams({ sourceVersion: request.sourceVersion, format: request.format })
    for (const key of OPTIONS) query.set(key, String(request[key]))
    for (const ref of request.glossary) query.append('glossary', ref)
    if (request.pdf) for (const key of LAYOUT_KEYS) query.set('pdf.' + key, String(request.pdf[key]))
    if (request.document !== 'manuscript') query.set('document', request.document)
    if (request.resolvedNotes) query.set('resolvedNotes', 'true')
    return query.toString()
}

export async function sha256Hex(blob: Blob): Promise<string> {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
    return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('')
}

const JOB_KEYS = ['id', 'storyId', 'requestId', 'retryOf', 'attempt', 'sourceVersion', 'request', 'status', 'stage', 'sceneCount', 'log', 'errorCode', 'file',
    'createdAt', 'startedAt', 'finishedAt']
const JOB_STATUSES = ['queued', 'running', 'completed', 'failed', 'canceled']
const JOB_STAGES = ['queued', 'reading', 'building', 'printing', 'storing', 'done']
const LOG_CODES = ['queued', 'retry', 'started', 'read', 'printing', 'built', 'completed', 'failed', 'canceled', 'interrupted', 'file_removed']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const instant = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(v)
const scalar = (v: unknown) => v === null || typeof v === 'string' || Number.isFinite(v)

function jobFile(v: unknown, request: StoryExportRequest): boolean {
    if (!isRecord(v) || !exact(v, ['filename', 'contentType', 'bytes', 'sha256', 'wordCount', 'removed'])) return false
    const [type, extension] = FORMATS[request.format]
    return typeof v.filename === 'string' && v.filename.endsWith(extension) && v.contentType === type && count(v.bytes, 1) && isSnapshotHash(v.sha256)
        && (v.wordCount === null || count(v.wordCount)) && typeof v.removed === 'boolean'
}

/** A job of this novel whose state is consistent: a file only once completed, a reason only when failed, a retry after attempt 1. */
export function verifyStoryExportJob(v: unknown, storyId: string): v is StoryExportJob {
    if (!isRecord(v) || !exact(v, JOB_KEYS) || typeof v.id !== 'string' || !UUID.test(v.id) || v.storyId !== storyId || !id(v.requestId)
        || !isStoryExportRequest(v.request) || v.sourceVersion !== v.request.sourceVersion || !JOB_STATUSES.includes(String(v.status))
        || !JOB_STAGES.includes(String(v.stage)) || !count(v.attempt, 1) || (v.attempt === 1) !== (v.retryOf === null)
        || !(v.retryOf === null || typeof v.retryOf === 'string' && UUID.test(v.retryOf)) || !(v.sceneCount === null || count(v.sceneCount))) return false
    if ((v.status === 'completed') !== (v.stage === 'done') || (v.status === 'completed') !== (v.file !== null) || (v.file !== null && !jobFile(v.file, v.request))) return false
    if ((v.status === 'failed') !== (v.errorCode !== null) || !(v.errorCode === null || id(v.errorCode))) return false
    if (!instant(v.createdAt) || !(v.startedAt === null || instant(v.startedAt)) || !(v.finishedAt === null || instant(v.finishedAt))) return false
    return Array.isArray(v.log) && v.log.length > 0 && v.log.every((row) => isRecord(row) && instant(row.at) && LOG_CODES.includes(String(row.code))
        && (exact(row, ['at', 'code']) || exact(row, ['at', 'code', 'values']) && isRecord(row.values) && Object.values(row.values).every(scalar)))
}
