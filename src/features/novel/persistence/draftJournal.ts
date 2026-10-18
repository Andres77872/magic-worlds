import { generateUUID } from '@/utils/uuid'
import { documentSignature, isStoryDocument } from '@/shared/storyDocument'
import { API_BASE_URL } from '@/infrastructure/api/baseUrl'
import { apiStorageOrigin, workspaceStorageKey } from '@/shared/workspaceStorage'
import type { StorySceneWrite, StoryManuscriptDocument } from '@/shared'
import type { StoryAnchorEdit } from '@/shared'
import { isStoryAnchorEdits } from '@/shared/storyAnchorEdits'
import { isNovelRequestId, isNovelRevision, isRecord } from '@/shared/novelMutationJournal'
import {isGenerationApplicationRejection,type GenerationApplicationRejection} from './generationApplication'
import type { StoryVariantReference } from '@/shared/types/storyVariant.types'
import { isStoryVariantReference } from '@/infrastructure/api/storyVariantContract'

export interface DraftCheckpoint {
    schema: 2
    writtenAt?: number
    storageKey?: string
    title: string
    document: StoryManuscriptDocument
    baseRevision: number
    baseMetadataRevision: number
    sequence: number
    pending: { write: StorySceneWrite; generationId?: string; variant?: StoryVariantReference } | null
    applicationRejection?:GenerationApplicationRejection
    anchorEdits?:StoryAnchorEdit[]|null
    /** The prose is readable, but the original request must not be replayed. */
    pendingInvalid?: boolean
}
const writerId = generateUUID()
export function draftJournalKey(userHash: string | null | undefined, workspaceId: string | null, storyId: string, chapterId: string, clientId: string = writerId): string | null {
    return userHash && workspaceId ? workspaceStorageKey(`magic-worlds:novel-draft:v2:${encodeURIComponent(storyId)}:${encodeURIComponent(chapterId)}`, {
        apiOrigin: apiStorageOrigin(API_BASE_URL), userHash, workspaceId,
    }) + `::writer:${encodeURIComponent(clientId)}` : null
}
function validPending(value: unknown, baseRevision: number, baseMetadataRevision: number): boolean {
    if (value === null) return true
    if (!isRecord(value) || Object.keys(value).some((key) => !['write', 'generationId', 'variant'].includes(key)) || !isRecord(value.write)) return false
    const write = value.write
    if (Object.keys(write).some((key) => !['requestId', 'document', 'expectedRevision', 'title', 'expectedMetadataRevision', 'anchorEdits'].includes(key)) || !isNovelRequestId(write.requestId)) return false
    const prose = write.document !== undefined, title = write.title !== undefined
    if (!prose && !title || prose && (!isStoryDocument(write.document) || write.expectedRevision !== baseRevision)
        || !prose && (write.expectedRevision !== undefined || write.anchorEdits !== undefined)) return false
    if (title ? typeof write.title !== 'string' || !write.title.trim() || write.title !== write.title.trim() || [...write.title].length > 255 || write.expectedMetadataRevision !== baseMetadataRevision : write.expectedMetadataRevision !== undefined) return false
    if (write.anchorEdits !== undefined && !isStoryAnchorEdits(write.anchorEdits)) return false
    return (value.generationId === undefined || prose && !title && typeof value.generationId === 'string' && /^[A-Za-z0-9._:-]{1,64}$/.test(value.generationId))
        && (!('variant' in value) || typeof value.generationId === 'string' && isStoryVariantReference(value.variant)
            && value.variant.id !== value.generationId && ![value.variant.id, value.generationId].includes(write.requestId as string))
}
function parseCheckpoint(raw: string | null, storageKey: string): DraftCheckpoint | null {
    if (!raw || raw.length > 4_100_000) return null
    try {
        const value = JSON.parse(raw) as DraftCheckpoint
        if (value.schema !== 2 || typeof value.title !== 'string' || !isStoryDocument(value.document)
            || !isNovelRevision(value.baseRevision) || !isNovelRevision(value.baseMetadataRevision)
            || !Number.isSafeInteger(value.sequence) || value.sequence < 0) return null
        const rejectionSupported=value.applicationRejection===undefined||isGenerationApplicationRejection(value.applicationRejection)
            &&value.applicationRejection.write.expectedRevision===value.baseRevision
        const supported = validPending(value.pending, value.baseRevision, value.baseMetadataRevision)
            &&rejectionSupported&&!(value.pending&&value.applicationRejection)
        return { ...value, pending: supported ? value.pending : null, pendingInvalid: supported ? undefined : true,
            applicationRejection:rejectionSupported?value.applicationRejection:undefined,
            ...(value.anchorEdits !== undefined && value.anchorEdits !== null && !isStoryAnchorEdits(value.anchorEdits) ? { anchorEdits: null } : {}), storageKey }
    } catch { return null }
}
export function readCheckpoint(key: string | null): DraftCheckpoint | null {
    if (!key) return null
    try {
        const own = parseCheckpoint(localStorage.getItem(key), key)
        if (own) return own
        const prefix = key.slice(0, key.lastIndexOf('::writer:')) + '::writer:'
        let newest: DraftCheckpoint | null = null
        for (let index = 0; index < localStorage.length; index += 1) {
            const candidate = localStorage.key(index)
            if (!candidate?.startsWith(prefix) || candidate === key) continue
            const saved = parseCheckpoint(localStorage.getItem(candidate), candidate)
            if (saved && (!newest || (saved.writtenAt ?? 0) > (newest.writtenAt ?? 0))) newest = saved
        }
        return newest
    } catch { return null }
}
export function writeCheckpoint(key: string | null, checkpoint: DraftCheckpoint | null): boolean {
    if (!key) return false
    try {
        if (!checkpoint) window.localStorage.removeItem(key)
        else {
            const raw = JSON.stringify({ ...checkpoint, storageKey: undefined, writtenAt: Date.now() })
            if (raw.length > 4_100_000) return false
            window.localStorage.setItem(key, raw)
            if (window.localStorage.getItem(key) !== raw) return false
        }
        return true
    } catch { return false }
}

/** Retire only an unchanged recovery record after an explicit durable choice. */
export function retireRecovery(checkpoint: DraftCheckpoint | null): void {
    if (!checkpoint?.storageKey) return
    try {
        const current = window.localStorage.getItem(checkpoint.storageKey)
        if (!current) return
        const value = JSON.parse(current) as DraftCheckpoint
        if (value.schema === checkpoint.schema && value.baseRevision === checkpoint.baseRevision && value.baseMetadataRevision === checkpoint.baseMetadataRevision
            && value.sequence === checkpoint.sequence && documentSignature(value.document) === documentSignature(checkpoint.document) && value.title === checkpoint.title
            && JSON.stringify(value.pending) === JSON.stringify(checkpoint.pending)&&JSON.stringify(value.anchorEdits)===JSON.stringify(checkpoint.anchorEdits)
            &&JSON.stringify(value.applicationRejection)===JSON.stringify(checkpoint.applicationRejection)) window.localStorage.removeItem(checkpoint.storageKey)
    } catch { /* the current draft remains recoverable */ }
}
