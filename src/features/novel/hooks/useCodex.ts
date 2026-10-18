import { useFeatureFlags } from '@/shared/hooks/useFeatureFlags'
/**
 * useCodex — the novel's isolated collection of cloned snapshots, derived
 * from story-level card refs (chapterId null). Cards are cloned server-side
 * on add; lorebook entries are cloned client-side (the backend cannot resolve
 * entry ids). Edits touch only the novel's copy, never the source card.
 *
 * Workspace R1: ops start only while the story's workspace is the committed
 * one; the story refetch they trigger is DataProvider's (owner-guarded) state.
 * While that workspace is archived the codex is read-only (`readOnly`): the
 * entries stay readable and mentionable, and no op is ever sent.
 */

import { useCallback, useMemo } from 'react'
import { isContentTypeFeatureEnabled } from '@/shared/featureFlags'
import type { SessionLoreEntry } from '@/features/lorebook/loreTriggers'
import type { Lorebook, StoryOutline, StorySceneDocument, StoryCardKind, StoryCardRef, StoryCardSnapshot, StoryCodexLibraryField, StoryCodexReferenceInput, StoryCodexOperation, StoryCodexWrite } from '@/shared'
import { useWorkspaceReadOnly } from '@/shared/hooks/useWorkspaceReadOnly'
import {
    KIND_META,
    clonedEntryIds,
    lorebookEntryFromSnapshot,
    lorebookEntrySnapshot,
    snapshotDescription,
    snapshotLabel,
} from '../utils/codexUtils'
import type { StoryWorkspace } from './useStoryWorkspace'
import { useCodexMutation } from './useCodexMutation'
import type { EditorCodexEntry } from '../editor/types'

/** Kinds whose names can be inspected inline in the manuscript (ember). */
const DETECTABLE_NAME_KINDS = new Set<StoryCardKind>(['character', 'world', 'item', 'adventure_template'])

/** A codex entity name surfaced for inline detection. */
export interface CodexDetectionName {
    id: string
    label: string
    kind: StoryCardKind
}

export interface CodexEntry {
    /** The card-ref id (the codex row identity). */
    id: string
    kind: StoryCardKind
    label: string
    description: string
    enabled: boolean
    ref: StoryCardRef
    contextRevision?:number
}

export type CodexMentionEntry = EditorCodexEntry

export interface CodexApi {
    /** The open novel and its Codex revision, for reads that follow Codex changes. */
    storyId: string | null
    contextRevision?: number
    entries: CodexEntry[]
    groups: Array<{ kind: StoryCardKind; labelKey: string; entries: CodexEntry[] }>
    /** `${kind}:${cardId}` keys already in the codex (picker "In codex" badges). */
    existingCardKeys: Set<string>
    /** Lorebook entry ids already cloned (picker "In codex" badges). */
    existingEntryIds: Set<string>
    addCards: (cards: Array<{ kind: StoryCardKind; cardId: string }>) => Promise<void>
    cloneLorebookEntries: (lorebook: Lorebook, entryIds: string[]) => Promise<void>
    toggleEntry: (entry: CodexEntry) => Promise<void>
    saveSnapshot: (entry: CodexEntry, patch: { label: string; description: string }) => Promise<void>
    removeEntry: (entry: CodexEntry) => Promise<void>
    /** Take reviewed details from the library version `sourceVersionId`; the rest keep the novel's values. */
    refreshEntry: (entry: CodexEntry, sourceVersionId: string, take: StoryCodexLibraryField[]) => Promise<void>
    /** Feed for the editor's @mention autocomplete. */
    mentionEntries: CodexMentionEntry[]
    referenceEntries: EditorCodexEntry[]
    /** Effective entity names/aliases, including context-excluded sources (ember). */
    detectionNames: CodexDetectionName[]
    /** Cloned lorebook entries as session lore, for inline trigger detection (arcane). */
    loreEntries: SessionLoreEntry[]
    removedEntries:CodexEntry[]
    restoreEntry:(entry:CodexEntry)=>Promise<void>
    resolveEntry:(id:string)=>CodexEntry|undefined
    busy: boolean
    pending:StoryCodexWrite|null
    retry:()=>Promise<void>
    error:string|null
    storageFailed:boolean
    canRetry:boolean
    /** The story's workspace is archived: every op above is a no-op until it is restored. */
    readOnly: boolean
}

interface CodexOptions {
    story: StoryOutline | null
    scene?:StorySceneDocument|null
    scope?:'novel'|'chapter'|'scene'
    chapterId?:string|null
    chapterReadOnly?:boolean
    /** The open story's workspace (captured when the story was opened). */
    workspace: StoryWorkspace
}

export function useCodex({ story, workspace, scene, scope='novel',chapterId:parentChapterId,chapterReadOnly }: CodexOptions): CodexApi {
    const featureFlagGeneration = useFeatureFlags().generation
    const storyId = story?.id ?? null
    const chapterId=parentChapterId??scene?.chapterId
    const workspaceReadOnly=useWorkspaceReadOnly(workspace.workspaceId)
    const readOnly=workspaceReadOnly||story?.status==='archived'||Boolean(story?.trashedAt)||(scope==='scene'&&(!scene||Boolean(scene.inheritance?.readOnly)))||(scope==='chapter'&&(!chapterId||Boolean(chapterReadOnly)))

    const mutation=useCodexMutation(story,workspace,readOnly,workspaceReadOnly)
    const perform=mutation.perform
    const track=useCallback(async(operation:StoryCodexOperation,expectedContextRevision?:number)=>{
        if(readOnly||!workspace.isCurrent())return
        await perform(operation,expectedContextRevision)
    },[readOnly, workspace, perform])

    // Keep every stored ref for precedence; availability only projects what
    // this build can display or act on. Never rewrite hidden snapshots.
    const storedRefs = useMemo(
        () =>
            (story?.activeCardRefs ?? [])
                .filter((ref) => !ref.removedAt&&((!ref.chapterId&&!ref.sceneId)||ref.chapterId===chapterId||ref.sceneId===scene?.id))
                .sort((a, b) => a.precedence - b.precedence),
        [chapterId, scene?.id, story?.activeCardRefs],
    )

    const refs = useMemo(() => storedRefs.filter((ref) => isContentTypeFeatureEnabled(ref.kind)), [storedRefs, featureFlagGeneration])

    const allEntries=useMemo<CodexEntry[]>(()=> (story?.activeCardRefs??[]).filter((ref)=>isContentTypeFeatureEnabled(ref.kind)).map((ref)=>({id:ref.id,kind:ref.kind,label:snapshotLabel(ref),description:snapshotDescription(ref),enabled:ref.enabled,ref,contextRevision:story?.contextRevision})),[story?.activeCardRefs,story?.contextRevision, featureFlagGeneration])
    const entries=useMemo(()=>allEntries.filter((entry)=>refs.some((ref)=>ref.id===entry.id)).sort((a,b)=>a.ref.precedence-b.ref.precedence),[allEntries, refs])
    const effectiveEntries=useMemo(()=>{
        const seen=new Set<string>()
        return [...entries].sort((a,b)=>(b.ref.sceneId?2:b.ref.chapterId?1:0)-(a.ref.sceneId?2:a.ref.chapterId?1:0)||a.ref.precedence-b.ref.precedence||a.id.localeCompare(b.id)).filter((entry)=>{
            const key=entry.kind+':'+entry.ref.cardId
            if(seen.has(key))return false
            seen.add(key);return true
        })
    },[entries])
    const removedEntries=allEntries.filter((entry)=>entry.ref.removedAt&&(scope==='scene'?entry.ref.sceneId===scene?.id:scope==='chapter'?entry.ref.chapterId===chapterId:!entry.ref.chapterId&&!entry.ref.sceneId))
    const resolveEntry=useCallback((id:string)=>allEntries.find((entry)=>entry.id===id),[allEntries])
    const restoreEntry=useCallback(async(entry:CodexEntry)=>{if(storyId)await track({op:'restore',id:entry.id},entry.contextRevision)},[storyId, track])

    const scopedRefs=useMemo(()=>refs.filter((ref)=>scope==='scene'?ref.sceneId===scene?.id:scope==='chapter'?ref.chapterId===chapterId:!ref.chapterId&&!ref.sceneId),[refs, scope, scene?.id, chapterId])
    const groups = useMemo(
        () =>
            KIND_META.map((meta) => ({
                kind: meta.kind,
                labelKey: meta.pluralKey,
                entries: entries.filter((entry) => entry.kind === meta.kind&&scopedRefs.some((ref)=>ref.id===entry.id)),
            })).filter((group) => group.entries.length > 0),
        [entries, scopedRefs],
    )

    const existingCardKeys = useMemo(() => new Set(scopedRefs.map((ref) => `${ref.kind}:${ref.cardId}`)), [scopedRefs])
    const existingEntryIds = useMemo(() => clonedEntryIds(scopedRefs), [scopedRefs])

    const nextPrecedence = useCallback(
        () => storedRefs.filter((ref)=>scope==='scene'?ref.sceneId===scene?.id:scope==='chapter'?ref.chapterId===chapterId:!ref.chapterId&&!ref.sceneId).reduce((max, ref) => Math.max(max, ref.precedence + 1), 0),
        [storedRefs, scope, scene?.id, chapterId],
    )

    const addCards = useCallback(
        async (cards: Array<{ kind: StoryCardKind; cardId: string }>) => {
            if (!storyId || cards.length === 0) return
            if (cards.some((card) => !isContentTypeFeatureEnabled(card.kind))) return
            let precedence = nextPrecedence()
            // No snapshot here: the backend clones the card itself on POST.
            const payloads:StoryCodexReferenceInput[] = cards.map((card) => ({
                kind: card.kind,
                cardId: card.cardId,
                source: 'manual',
                enabled: true,
                precedence: precedence++,
                chapterId: scope==='chapter'?chapterId??null:null,
                sceneId: scope==='scene'?scene?.id??null:null,
            }))
            await track({op:'add',refs:payloads})
        },
        [nextPrecedence, storyId, track,scope,scene?.id,chapterId, featureFlagGeneration],
    )

    const cloneLorebookEntries = useCallback(
        async (lorebook: Lorebook, entryIds: string[]) => {
            if (!storyId || entryIds.length === 0) return
            if (!isContentTypeFeatureEnabled('lorebook_entry')) return
            let precedence = nextPrecedence()
            const selected = lorebook.entries.filter((entry) => entryIds.includes(entry.id))
            const payloads:StoryCodexReferenceInput[] = selected.map((entry) => ({
                kind: 'lorebook_entry',
                cardId: entry.id,
                source: 'manual',
                enabled: entry.enabled,
                precedence: precedence++,
                chapterId: scope==='chapter'?chapterId??null:null,
                sceneId: scope==='scene'?scene?.id??null:null,
                snapshot: lorebookEntrySnapshot(lorebook, entry),
            }))
            await track({op:'add',refs:payloads})
        },
        [nextPrecedence, storyId, track,scope,scene?.id,chapterId, featureFlagGeneration],
    )

    const toggleEntry = useCallback(
        async (entry: CodexEntry) => {
            if (!storyId || !isContentTypeFeatureEnabled(entry.kind)) return
            await track({op:'update',id:entry.id,patch:{enabled:!entry.enabled}},entry.contextRevision)
        },
        [storyId, track, featureFlagGeneration],
    )

    const saveSnapshot = useCallback(
        async (entry: CodexEntry, patch: { label: string; description: string }) => {
            if (!storyId || !isContentTypeFeatureEnabled(entry.kind)) return
            // Merge, never replace: card snapshots keep stored race/category/source pins.
            const snapshot: StoryCardSnapshot = {
                ...entry.ref.snapshot,
                name: patch.label,
                description: patch.description,
            }
            await track({op:'update',id:entry.id,patch:{snapshot}},entry.contextRevision)
        },
        [storyId, track, featureFlagGeneration],
    )

    const removeEntry = useCallback(
        async (entry: CodexEntry) => {
            if (!storyId || !isContentTypeFeatureEnabled(entry.kind)) return
            await track({op:'remove',id:entry.id},entry.contextRevision)
        },
        [storyId, track, featureFlagGeneration],
    )

    const refreshEntry = useCallback(
        async (entry: CodexEntry, sourceVersionId: string, take: StoryCodexLibraryField[]) => {
            if (!storyId || !isContentTypeFeatureEnabled(entry.kind)) return
            await track({ op: 'refresh', id: entry.id, sourceVersionId, take }, entry.contextRevision)
        },
        [storyId, track, featureFlagGeneration],
    )

    const referenceEntries = useMemo<EditorCodexEntry[]>(() => {
        const chapters = new Map(story?.chapters.map((unit) => [unit.id, unit]) ?? [])
        const scenes = new Map(story?.chapters.flatMap((unit) => unit.scenes.map((unitScene) => [unitScene.id, unitScene] as const)) ?? [])
        const inScopeIds = new Set(entries.map((entry) => entry.id)), effectiveIds = new Set(effectiveEntries.map((entry) => entry.id))
        return allEntries.map((entry) => {
        const unitScene = scenes.get(entry.ref.sceneId ?? '')
        const chapter = chapters.get(entry.ref.chapterId ?? unitScene?.chapterId ?? '')
        const inScope = inScopeIds.has(entry.id)
        const effective = effectiveIds.has(entry.id)
        return { id: entry.id, label: entry.label, kind: entry.kind, enabled: entry.enabled,
            description: entry.description, aliases: entry.ref.snapshot.alias ? [entry.ref.snapshot.alias] : [],
            scope: entry.ref.sceneId ? 'scene' : entry.ref.chapterId ? 'chapter' : 'novel',
            scopeLabel: entry.ref.sceneId ? unitScene?.title : entry.ref.chapterId ? chapter?.title : story?.title,
            sourceId: entry.ref.snapshot.source_card_id ?? entry.ref.snapshot.source_lorebook_id ?? entry.ref.cardId,
            sourceVersionId: entry.ref.snapshot.source_card_version_id,
            sourceVersionNumber: entry.ref.snapshot.source_card_version_number,
            removed: Boolean(entry.ref.removedAt), contextRevision: entry.contextRevision,
            contextState: entry.ref.removedAt ? 'removed' : !inScope ? 'outside' : !effective ? 'shadowed' : entry.enabled ? 'enabled' : 'disabled',
        }
    }) }, [allEntries, entries, effectiveEntries, story?.chapters, story?.title])
    const mentionEntries = useMemo<CodexMentionEntry[]>(
        () => { const byId = new Map(referenceEntries.map((entry) => [entry.id, entry])); return effectiveEntries.map((entry) => byId.get(entry.id)!) },
        [effectiveEntries, referenceEntries],
    )

    const detectionNames = useMemo<CodexDetectionName[]>(
        () =>
            effectiveEntries
                .filter((entry) => DETECTABLE_NAME_KINDS.has(entry.kind) && entry.label.trim().length > 0)
                .flatMap((entry) => [...new Set([entry.label, entry.ref.snapshot.alias].filter((label): label is string => Boolean(label?.trim())))].map((label) => ({ id: entry.id, label, kind: entry.kind }))),
        [effectiveEntries],
    )

    // Reconstruct cloned lorebook entries into session lore. snapshotToLoreEntry
    // forces enabled:true, so re-apply the codex ref's own enabled flag — a
    // disabled codex row must not light up its triggers in the prose.
    const loreEntries = useMemo<SessionLoreEntry[]>(
        () =>
            effectiveEntries.map((entry)=>entry.ref)
                .filter((ref) => ref.kind === 'lorebook_entry')
                .map((ref) => {
                    const entry = {
                        ...lorebookEntryFromSnapshot(ref.snapshot, ref.cardId),
                        enabled: ref.enabled,
                    }
                    return {
                        entry,
                        lorebookId: entry.lorebookId,
                        lorebookName: ref.snapshot.source_lorebook_id ?? '',
                    }
                }),
        [effectiveEntries],
    )

    return {
        storyId,
        contextRevision: story?.contextRevision,
        entries,
        removedEntries,restoreEntry,resolveEntry,
        groups,
        existingCardKeys,
        existingEntryIds,
        addCards,
        cloneLorebookEntries,
        toggleEntry,
        saveSnapshot,
        removeEntry,
        refreshEntry,
        mentionEntries,
        referenceEntries,
        detectionNames,
        loreEntries,
        busy: mutation.busy,
        pending:mutation.pending,retry:mutation.retry,error:mutation.error,storageFailed:mutation.storageFailed,canRetry:mutation.canRetry,
        readOnly,
    }
}
