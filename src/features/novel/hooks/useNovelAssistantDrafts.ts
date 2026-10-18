import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { useAuth } from '@/app/hooks'
import { novelMutationKey, retireNovelMutation, writeNovelMutation, type NovelJournalRecord } from '@/shared/novelMutationJournal'
import { canonicalJson } from '@/utils/json'
import { ASSISTANT_DRAFT_DOMAIN, isNovelAssistantDraft, listAssistantDrafts, canRetireAssistantDraft, type NovelAssistantDraft } from '../persistence/assistantDraftJournal'
import type { StoryWorkspace } from './useStoryWorkspace'

const EVENT = 'novel-assistant-draft:changed'
export type RetainedAssistantDraft = NovelJournalRecord<NovelAssistantDraft> & { storageFailed?: boolean }
const byNewest = (a: RetainedAssistantDraft, b: RetainedAssistantDraft) => (b.writtenAt ?? 0) - (a.writtenAt ?? 0)
function deviceRows(userHash: string | null | undefined, workspaceId: string | null | undefined, storyId: string) {
    const rows = new Map<string, RetainedAssistantDraft>()
    for (const row of listAssistantDrafts({ userHash, workspaceId })) if (row.write.storyId === storyId && row.storageKey) rows.set(row.storageKey, row)
    return rows
}

/** Each draft/writer has its own key. Recovery copies never silently retire another writer. */
export function useNovelAssistantDrafts(storyId: string, workspace: StoryWorkspace) {
    const { userHash } = useAuth()
    const scope = JSON.stringify([userHash, workspace.workspaceId, storyId])
    const memory = useRef(new Map<string, Map<string, RetainedAssistantDraft>>())
    const live = useRef({ scope, workspace })
    useLayoutEffect(() => { live.current = { scope, workspace }; return () => { live.current = { scope: '', workspace } } }, [scope, workspace])
    const keyFor = useCallback((draft: NovelAssistantDraft) => novelMutationKey(ASSISTANT_DRAFT_DOMAIN, { userHash, workspaceId: workspace.workspaceId, storyId }, draft.id), [storyId, userHash, workspace.workspaceId])
    const gather = useCallback(() => {
        const rows = deviceRows(userHash, workspace.workspaceId, storyId)
        for (const [key, row] of memory.current.get(scope) ?? []) rows.set(key, row)
        return [...rows.values()].sort(byNewest)
    }, [scope, storyId, userHash, workspace.workspaceId])
    // Read the device rows on the first render, so callers never mistake "not read yet" for "none".
    const [state, setState] = useState<{ scope: string; rows: RetainedAssistantDraft[] }>(() =>
        ({ scope, rows: [...deviceRows(userHash, workspace.workspaceId, storyId).values()].sort(byNewest) }))
    useLayoutEffect(() => {
        const refresh = () => setState({ scope, rows: gather() })
        refresh()
        window.addEventListener('storage', refresh)
        window.addEventListener(EVENT, refresh)
        return () => { window.removeEventListener('storage', refresh); window.removeEventListener(EVENT, refresh) }
    }, [scope, gather])
    const changed = () => window.dispatchEvent(new Event(EVENT))
    return {
        items: state.scope === scope ? state.rows : [],
        owns: (record: RetainedAssistantDraft) => record.storageKey === keyFor(record.write),
        save: (draft: NovelAssistantDraft): RetainedAssistantDraft | null => {
            if (live.current.scope !== scope || !workspace.isCurrent() || workspace.deviceOnly || draft.storyId !== storyId || !isNovelAssistantDraft(draft)) return null
            const write = structuredClone(draft), key = keyFor(write)
            const saved = writeNovelMutation(key, write)
            const record: RetainedAssistantDraft = { schema: 1, write, storageKey: key ?? undefined, writtenAt: Date.now(), storageFailed: !saved }
            let rows = memory.current.get(scope)
            if (!rows) { rows = new Map(); memory.current.set(scope, rows) }
            rows.set(key ?? write.id, record)
            changed()
            return record
        },
        remove: (record: RetainedAssistantDraft, outcome?: NovelAssistantDraft['outcome']) => {
            if (live.current.scope !== scope || !workspace.isCurrent() || record.write.storyId !== storyId) return
            if (!canRetireAssistantDraft(record.write, outcome)) return
            const expected = keyFor(record.write)?.split('::writer:')[0]
            if (record.storageKey && record.storageKey.split('::writer:')[0] !== expected) return
            retireNovelMutation(record, null)
            const rows = memory.current.get(scope), key = record.storageKey ?? record.write.id, current = rows?.get(key)
            if (current && canonicalJson(current.write) === canonicalJson(record.write)) rows?.delete(key)
            changed()
        },
    }
}
