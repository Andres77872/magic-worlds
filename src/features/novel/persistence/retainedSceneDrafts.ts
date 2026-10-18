import type { StoryManuscriptDocument } from '@/shared'
import { isStoryDocument } from '@/shared/storyDocument'
import { API_BASE_URL } from '@/infrastructure/api/baseUrl'
import { apiStorageOrigin, workspaceStorageKey } from '@/shared/workspaceStorage'
import { generateUUID } from '@/utils/uuid'
import {isGenerationApplicationRejection,type GenerationApplicationRejection} from './generationApplication'

export interface RetainedSceneDraft {
    schema: 1
    title: string
    document: StoryManuscriptDocument
    baseRevision: number
    baseMetadataRevision: number
    retainedAt: number
    reason: 'reconciliation'
    storageKey: string
    applicationRejection?:GenerationApplicationRejection
}
export type RetainedSceneInput = Pick<RetainedSceneDraft, 'title' | 'document' | 'baseRevision' | 'baseMetadataRevision'|'applicationRejection'>

export function retainedSceneDraftPrefix(userHash: string | null | undefined, workspaceId: string | null, storyId: string, sceneId: string): string | null {
    return userHash && workspaceId ? workspaceStorageKey(`magic-worlds:novel-alternative:v1:${encodeURIComponent(storyId)}:${encodeURIComponent(sceneId)}`, {
        apiOrigin: apiStorageOrigin(API_BASE_URL), userHash, workspaceId,
    }) + '::copy:' : null
}

function valid(value: unknown): value is Omit<RetainedSceneDraft, 'storageKey'> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const record = value as Record<string, unknown>
    return Object.keys(record).length === ('applicationRejection'in record?8:7) && record.schema === 1 && record.reason === 'reconciliation'
        &&(!('applicationRejection'in record)||isGenerationApplicationRejection(record.applicationRejection))
        && typeof record.title === 'string' && record.title.length <= 510 && isStoryDocument(record.document)
        && Number.isSafeInteger(record.baseRevision) && Number(record.baseRevision) >= 1
        && Number.isSafeInteger(record.baseMetadataRevision) && Number(record.baseMetadataRevision) >= 1
        && typeof record.retainedAt === 'number' && Number.isFinite(record.retainedAt) && record.retainedAt > 0
}

/** Keep a separate immutable device version before applying a reviewed choice. */
export function retainSceneDraft(prefix: string | null, draft: RetainedSceneInput): RetainedSceneDraft | null {
    if (!prefix) return null
    const value = { schema: 1, ...draft, retainedAt: Date.now(), reason: 'reconciliation' }
    if (!valid(value)) return null
    try {
        const raw = JSON.stringify(value)
        if (raw.length > 4_100_000) return null
        const storageKey = prefix + generateUUID()
        if (localStorage.getItem(storageKey) !== null) return null
        localStorage.setItem(storageKey, raw)
        // A quota fault, browser policy, or concurrent replacement cannot be
        // reported as a retained copy. Existing drafts are never evicted.
        if (localStorage.getItem(storageKey) !== raw) return null
        return { ...structuredClone(value), storageKey } as RetainedSceneDraft
    } catch { return null }
}

export function readRetainedSceneDrafts(prefix: string | null): { items: RetainedSceneDraft[]; unavailable: boolean } {
    if (!prefix) return { items: [], unavailable: false }
    const items: RetainedSceneDraft[] = []
    try {
        for (let index = 0; index < localStorage.length; index += 1) {
            const storageKey = localStorage.key(index)
            if (!storageKey?.startsWith(prefix)) continue
            const raw = localStorage.getItem(storageKey)
            if (!raw) continue
            try {
                const value: unknown = JSON.parse(raw)
                if (valid(value)) items.push({ ...value, storageKey })
            } catch { /* Preserve an unreadable record; another copy can still open. */ }
        }
        return { items: items.sort((a, b) => b.retainedAt - a.retainedAt || a.storageKey.localeCompare(b.storageKey)), unavailable: false }
    } catch { return { items, unavailable: true } }
}
