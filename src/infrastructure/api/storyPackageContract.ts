import { isRecord } from '@/shared/novelMutationJournal'
import { isSnapshotHash } from '@/shared/storySnapshotOperation'
import type { StoryPackageAcknowledgement, StoryPackageManifest, StoryPackageOptions, StoryPackagePreview, StoryPackageWrite } from '@/shared/types/storyPackage.types'
import { canonicalJson } from '@/utils/json'

const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every((key) => key in v)
const count = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0
// Lengths count characters (code points), as the server does.
const text = (v: unknown, max = 255): v is string => typeof v === 'string' && [...v].length <= max
const title = (v: unknown): v is string => text(v) && v.length > 0 && v === v.trim()
const identity = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9._:-]{1,64}$/.test(v)
const COUNTS = ['parts', 'chapters', 'scenes', 'words', 'references', 'comments', 'bookmarks', 'tasks', 'facts', 'stash', 'revisions']

export const STORY_PACKAGE_EXTENSION = '.mwnovel'
export const STORY_PACKAGE_MAX_BYTES = 64 * 1024 * 1024
export const STORY_PACKAGE_TYPE = 'application/vnd.magic-worlds.novel+zip'

export const isStoryPackageFile = (name: string) => name.toLowerCase().endsWith(STORY_PACKAGE_EXTENSION)

export function isStoryPackageOptions(v: unknown): v is StoryPackageOptions {
    return isRecord(v) && exact(v, ['notes', 'planning', 'history']) && typeof v.notes === 'boolean' && typeof v.planning === 'boolean' && typeof v.history === 'boolean'
}

export function storyPackageQuery(manifest: StoryPackageManifest): string {
    const { notes, planning, history } = manifest.options
    return new URLSearchParams({ sourceVersion: manifest.sourceVersion, notes: String(notes), planning: String(planning), history: String(history) }).toString()
}

function counts(v: unknown) {
    return isRecord(v) && exact(v, COUNTS) && COUNTS.every((key) => key === 'words' ? v.words === null || count(v.words) : count(v[key]))
}

function media(v: unknown, restore: boolean) {
    return Array.isArray(v) && v.length <= 1 && v.every((row) => isRecord(row) && exact(row, ['role', 'assetId', 'alt', 'included', ...(restore ? ['available'] : [])])
        && row.role === 'cover' && typeof row.assetId === 'string' && row.assetId.length > 0 && (row.alt === null || text(row.alt, 2000)) && row.included === false
        && (!restore || typeof row.available === 'boolean'))
}

/** The summary must describe this novel with these very choices. */
export function verifyStoryPackageManifest(v: unknown, storyId: string, options: StoryPackageOptions): v is StoryPackageManifest {
    return isRecord(v) && exact(v, ['schemaVersion', 'projection', 'storyId', 'title', 'sourceVersion', 'options', 'filename', 'contentType', 'bytes', 'sha256', 'counts', 'media'])
        && v.schemaVersion === 1 && v.projection === 'novel_package' && v.storyId === storyId && title(v.title) && isSnapshotHash(v.sourceVersion)
        && canonicalJson(v.options) === canonicalJson(options) && text(v.filename) && String(v.filename).endsWith(STORY_PACKAGE_EXTENSION)
        && v.contentType === STORY_PACKAGE_TYPE && count(v.bytes) && Number(v.bytes) > 0 && Number(v.bytes) <= STORY_PACKAGE_MAX_BYTES && isSnapshotHash(v.sha256)
        && counts(v.counts) && Number((v.counts as Record<string, unknown>).chapters) > 0 && media(v.media, false)
        && (options.notes || (v.counts as Record<string, number>).comments + (v.counts as Record<string, number>).bookmarks === 0)
        && (options.planning || (v.counts as Record<string, number>).tasks + (v.counts as Record<string, number>).facts + (v.counts as Record<string, number>).stash === 0)
        && (options.history || (v.counts as Record<string, number>).revisions === 0)
}

/** The restore preview must describe this very file (its size and SHA-256). */
export function verifyStoryPackagePreview(v: unknown, file: { size: number; sha256: string }): v is StoryPackagePreview {
    if (!isRecord(v) || !exact(v, ['schemaVersion', 'projection', 'filename', 'bytes', 'packageHash', 'formatVersion', 'source', 'title', 'includes', 'counts',
        'references', 'media'])) return false
    const source = v.source
    return v.schemaVersion === 1 && v.projection === 'novel_package' && text(v.filename) && v.bytes === file.size && v.packageHash === file.sha256 && v.formatVersion === 1
        && isRecord(source) && exact(source, ['storyId', 'title', 'sourceVersion']) && identity(source.storyId) && title(source.title) && isSnapshotHash(source.sourceVersion)
        && title(v.title) && isStoryPackageOptions(v.includes) && counts(v.counts) && Number((v.counts as Record<string, unknown>).chapters) > 0
        && Array.isArray(v.references) && v.references.length === (v.counts as Record<string, number>).references
        && v.references.every((row) => isRecord(row) && exact(row, ['id', 'kind', 'cardId', 'name', 'removed']) && identity(row.id) && typeof row.kind === 'string'
            && typeof row.cardId === 'string' && (row.name === null || text(row.name)) && typeof row.removed === 'boolean')
        && media(v.media, true)
}

export function isStoryPackageWrite(v: unknown): v is StoryPackageWrite {
    return isRecord(v) && exact(v, ['requestId', 'title', 'packageHash', 'options']) && typeof v.requestId === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(v.requestId)
        && title(v.title) && isSnapshotHash(v.packageHash) && isStoryPackageOptions(v.options)
}

export function verifyStoryPackageAcknowledgement(v: unknown, write: StoryPackageWrite): v is StoryPackageAcknowledgement {
    return isRecord(v) && exact(v, ['kind', 'requestId', 'storyId', 'write']) && v.kind === 'novel_package_import' && v.requestId === write.requestId
        && typeof v.storyId === 'string' && /^[0-9a-f-]{36}$/.test(v.storyId) && canonicalJson(v.write) === canonicalJson(write)
}
