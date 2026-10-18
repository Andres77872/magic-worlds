import { isRecord } from '@/shared/novelMutationJournal'
import { isSnapshotHash } from '@/shared/storySnapshotOperation'
import { STORY_BACK_MATTER, STORY_FRONT_MATTER } from '@/shared/storyUnitDetails'
import type { StoryImportAcknowledgement, StoryImportFormat, StoryImportManifest, StoryImportOptions, StoryImportRecord, StoryImportWrite } from '@/shared/types/storyImport.types'
import { canonicalJson } from '@/utils/json'

const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every((key) => key in v)
const count = (v: unknown, min = 0): v is number => Number.isSafeInteger(v) && Number(v) >= min
// Lengths count characters (code points), as the server does.
const text = (v: unknown, max = 255): v is string => typeof v === 'string' && [...v].length <= max
const title = (v: unknown): v is string => text(v) && v.length > 0 && v === v.trim()
const language = (v: unknown) => v === null || typeof v === 'string' && /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,3}$/.test(v)
const LEVELS = ['auto', 1, 2, 3, 4, 5, 6] as const
const LOSSES = ['lines_joined', 'links_dropped', 'images_dropped', 'footnotes_dropped', 'html_as_text', 'code_as_text', 'tables_as_text', 'comments_dropped',
    'contents_skipped', 'tracked_insertions_kept', 'tracked_deletions_dropped', 'embedded_documents_dropped', 'titles_shortened', 'ruby_dropped']
export const STORY_IMPORT_MAX_BYTES = 10 * 1024 * 1024
/** File extensions the import reads, and the format each one is. */
export const STORY_IMPORT_EXTENSIONS: Record<string, StoryImportFormat> = { '.md': 'markdown', '.markdown': 'markdown', '.txt': 'text', '.text': 'text', '.docx': 'docx',
    '.epub': 'epub', '.odt': 'odt', '.rtf': 'rtf' }
export const STORY_IMPORT_ACCEPT = Object.keys(STORY_IMPORT_EXTENSIONS).join(',')

export function storyImportFormat(name: string): StoryImportFormat | null {
    const dot = name.lastIndexOf('.')
    return dot < 0 ? null : STORY_IMPORT_EXTENSIONS[name.slice(dot).toLowerCase()] ?? null
}

export function isStoryImportOptions(v: unknown): v is StoryImportOptions {
    return isRecord(v) && exact(v, ['chapterLevel', 'splitScenes']) && LEVELS.includes(v.chapterLevel as never) && typeof v.splitScenes === 'boolean'
}

export function isStoryImportWrite(v: unknown): v is StoryImportWrite {
    return isRecord(v) && exact(v, ['requestId', 'title', 'sourceHash', 'importVersion', 'options']) && typeof v.requestId === 'string'
        && /^[A-Za-z0-9._:-]{1,128}$/.test(v.requestId) && title(v.title) && isSnapshotHash(v.sourceHash) && isSnapshotHash(v.importVersion) && isStoryImportOptions(v.options)
}

function losses(v: unknown) {
    return Array.isArray(v) && v.every((row) => isRecord(row) && exact(row, ['code', 'count']) && LOSSES.includes(String(row.code)) && count(row.count, 1))
        && new Set(v.map((row) => (row as { code: string }).code)).size === v.length
}

const FORMATS: readonly unknown[] = ['markdown', 'text', 'docx', 'epub', 'odt', 'rtf']
const format = (v: unknown) => FORMATS.includes(v)
const level = (v: unknown) => v === null || count(v, 1) && Number(v) <= 6
const ROLES: readonly unknown[] = [...STORY_FRONT_MATTER, ...STORY_BACK_MATTER]

/** The preview must describe this very file (its size and SHA-256), with the chosen options, as a valid outline. */
export function verifyStoryImportManifest(v: unknown, file: { size: number; sha256: string }, options: StoryImportOptions): v is StoryImportManifest {
    if (!isRecord(v) || !exact(v, ['schemaVersion', 'projection', 'format', 'filename', 'bytes', 'sourceHash', 'importVersion', 'options', 'chapterLevel', 'title',
        'language', 'wordCount', 'parts', 'chapters', 'losses'])) return false
    if (v.schemaVersion !== 1 || v.projection !== 'manuscript_import' || !format(v.format) || !text(v.filename) || v.bytes !== file.size || v.sourceHash !== file.sha256
        || !isSnapshotHash(v.importVersion) || canonicalJson(v.options) !== canonicalJson(options) || !level(v.chapterLevel) || !title(v.title) || !language(v.language)
        || !(v.wordCount === null || count(v.wordCount)) || !Array.isArray(v.parts) || !Array.isArray(v.chapters) || !losses(v.losses)) return false
    const parts = v.parts.length
    return v.parts.every((row) => isRecord(row) && exact(row, ['title', 'chapters']) && title(row.title) && count(row.chapters))
        && v.chapters.length > 0 && v.chapters.every((row) => isRecord(row) && exact(row, ['title', 'part', 'role', 'scenes']) && title(row.title)
            && (row.part === null || count(row.part) && Number(row.part) < parts) && (row.role === null || ROLES.includes(row.role) && row.part === null)
            && Array.isArray(row.scenes) && row.scenes.length > 0
            && row.scenes.every((scene) => isRecord(scene) && exact(scene, ['title', 'words', 'excerpt']) && title(scene.title)
                && (scene.words === null || count(scene.words)) && text(scene.excerpt, 160)))
}

export function verifyStoryImportAcknowledgement(v: unknown, write: StoryImportWrite): v is StoryImportAcknowledgement {
    return isRecord(v) && exact(v, ['kind', 'requestId', 'storyId', 'write']) && v.kind === 'novel_import' && v.requestId === write.requestId
        && typeof v.storyId === 'string' && /^[0-9a-f-]{36}$/.test(v.storyId) && canonicalJson(v.write) === canonicalJson(write)
}

export function verifyStoryImportRecord(v: unknown, storyId: string): v is StoryImportRecord {
    return isRecord(v) && exact(v, ['storyId', 'importedAt', 'format', 'filename', 'bytes', 'sourceHash', 'importVersion', 'options', 'chapterLevel', 'title',
        'language', 'wordCount', 'losses', 'parts', 'chapters', 'scenes']) && v.storyId === storyId && typeof v.importedAt === 'string'
        && !Number.isNaN(Date.parse(v.importedAt)) && format(v.format) && text(v.filename) && count(v.bytes, 1) && isSnapshotHash(v.sourceHash)
        && isSnapshotHash(v.importVersion) && isStoryImportOptions(v.options) && level(v.chapterLevel) && title(v.title) && language(v.language)
        && (v.wordCount === null || count(v.wordCount)) && losses(v.losses) && count(v.parts) && count(v.chapters, 1) && count(v.scenes, 1)
}
