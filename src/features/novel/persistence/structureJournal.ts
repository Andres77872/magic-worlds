import type { StoryStructureWrite } from '@/shared'
import { isNovelRequestId, isNovelRevision, isRecord, novelMutationKey, readNovelMutation, retireNovelMutation, type NovelJournalRecord } from '@/shared/novelMutationJournal'

export const structureJournalKey = (userHash: string | null | undefined, workspaceId: string | null, storyId: string | null): string | null =>
    novelMutationKey('structure', { userHash, workspaceId, storyId })
export type PendingStructure = NovelJournalRecord<StoryStructureWrite>
function accepts(value: unknown): value is StoryStructureWrite {
    return isRecord(value) && isNovelRequestId(value.requestId) && isNovelRevision(value.expectedStructureRevision)
        && isRecord(value.operation) && typeof value.operation.op === 'string'
}
export const readStructureJournal = (key: string | null): PendingStructure | null => readNovelMutation(key, accepts)
export const retireStructureJournal = (record: PendingStructure | null, key: string | null): void => retireNovelMutation(record, key)
