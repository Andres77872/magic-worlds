import { setTestFeatureFlags, setAllTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { novel,storyScene } from '@/test/fixtures/story'
import { act, renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const addStoryCardRefs = vi.fn().mockResolvedValue(undefined)
const updateStoryCardRef = vi.fn().mockResolvedValue(undefined)
const deleteStoryCardRef = vi.fn().mockResolvedValue(undefined)
const restoreStoryCardRef=vi.fn().mockResolvedValue(undefined)

const changeStoryCodex=vi.fn(async(storyId,write)=>{
    const operation=write.operation
    if(operation.op==='add')await addStoryCardRefs(storyId,operation.refs)
    if(operation.op==='update')await updateStoryCardRef(storyId,operation.id,operation.patch)
    if(operation.op==='remove')await deleteStoryCardRef(storyId,operation.id)
    if(operation.op==='restore')await restoreStoryCardRef(storyId,operation.id)
    return {contextRevision:write.expectedContextRevision+1,refs:[]}
})
const refreshStory=vi.fn().mockResolvedValue(undefined)
vi.mock('@/app/hooks', () => ({
    useData: () => ({changeStoryCodex,refreshStory}),
    useAuth:()=>({userHash:'codex-author',isAuthenticated:true,openLoginModal:vi.fn()}),
}))

import type { Lorebook, Story, StoryCardRef, StoryCardSnapshot } from '@/shared'
import {
    OTHER_WORKSPACE_ID,
    TEST_WORKSPACE_ID,
    WorkspaceTestProvider,
    createWorkspaceTestState,
    testWorkspace,
} from '@/shared/hooks/testing/workspaceTestUtils'
import { useCodex } from './useCodex'

let workspaceCurrent = true
const WORKSPACE = { workspaceId: 'ws-1', isCurrent: () => workspaceCurrent, detachedApi: () => null }

function snapshot(overrides: Partial<StoryCardSnapshot> = {}): StoryCardSnapshot {
    return {
        id: 'card-x',
        name: 'Aria',
        description: 'A card.',
        story_card_kind: 'character',
        ...overrides,
    }
}

function ref(overrides: Partial<StoryCardRef>): StoryCardRef {
    return {
        id: 'ref-x',
        storyId: 's1',
        chapterId: null, sceneId: null, removedAt: null,
        kind: 'character',
        cardId: 'card-x',
        source: 'manual',
        enabled: true,
        precedence: 0,
        snapshot: snapshot(),
        ...overrides,
    }
}

function story(refs: StoryCardRef[]): Story {
    return {
        ...novel({chapters:[]}),
        id: 's1',
        title: 'Glass War',
        description: null,
        source: { kind: 'blank', id: null, title: null },
        chapters: [],
        activeCardRefs: refs,
        activeContext: {
            includeSelectedCards: true,
            includeLorebooks: true,
            includeRecentChapters: 2,
            tokenBudget: 6000,
            styleSource: 'current_scene',
            customStyleInstruction: null,
        },
    }
}

const LOREBOOK = {
    id: 'lb-1',
    name: 'Twin Courts',
    description: null,
    tags: [],
    enabled: true,
    settings: { scanDepth: 8, tokenBudget: 1200, recursiveScanning: false, matchWholeWords: true, caseSensitive: false },
    entries: [
        {
            id: 'entry-1',
            lorebookId: 'lb-1',
            title: 'The Glass Pact',
            entryType: 'rule',
            content: 'An oath sworn on shattered mirrors.',
            keys: ['pact'],
            secondaryKeys: [],
            selectiveLogic: 'any',
            enabled: true,
            constant: false,
            caseSensitive: false,
            matchWholeWords: true,
            regex: false,
            isSecret: false,
            insertionOrder: 0,
            priority: 0,
            insertionPosition: 'before_context',
        },
        {
            id: 'entry-2',
            lorebookId: 'lb-1',
            title: 'The Mirror Court',
            entryType: 'place',
            content: 'A palace of reflective halls.',
            keys: ['court'],
            secondaryKeys: [],
            selectiveLogic: 'any',
            enabled: false,
            constant: false,
            caseSensitive: false,
            matchWholeWords: true,
            regex: false,
            isSecret: false,
            insertionOrder: 1,
            priority: 0,
            insertionPosition: 'before_context',
        },
    ],
    attachments: [],
} as Lorebook

describe('useCodex', () => {
    it('projects alias/source/version details and exact removed and overridden context identities', () => {
        const root = ref({ id: 'root-pin', snapshot: snapshot({ alias: 'Beacon', source_card_id: 'original-card', source_card_version_id: 'version-three', source_card_version_number: 3 }) })
        const local = ref({ id: 'local-pin', sceneId: 'scene-1', enabled: false })
        const removed = ref({ id: 'retired-pin', cardId: 'retired-card', removedAt: '2026-10-16T12:00:00Z' })
        const { result } = renderHook(() => useCodex({ story: story([root, local, removed]), scene: storyScene({ id: 'scene-1' }), workspace: WORKSPACE }))
        expect(result.current.referenceEntries.find((entry) => entry.id === 'root-pin')).toMatchObject({ aliases: ['Beacon'], sourceId: 'original-card', sourceVersionNumber: 3, sourceVersionId: 'version-three', contextState: 'shadowed' })
        expect(result.current.referenceEntries.find((entry) => entry.id === 'local-pin')).toMatchObject({ contextState: 'disabled', scope: 'scene' })
        expect(result.current.referenceEntries.find((entry) => entry.id === 'retired-pin')).toMatchObject({ contextState: 'removed', removed: true })
        expect(result.current.mentionEntries.map((entry) => entry.id)).toEqual(['local-pin'])
    })
    afterEach(() => vi.unstubAllEnvs())
    beforeEach(() => {
        vi.clearAllMocks();localStorage.clear()
        setAllTestFeatureFlags(true)
        workspaceCurrent = true
    })

    it('hides persisted disabled references without changing data or their precedence', async () => {
        setTestFeatureFlags({ lorebooks: false })
        setTestFeatureFlags({ adventures: false })
        const refs = [
            ref({ id: 'visible', precedence: 0 }),
            ref({ id: 'hidden-adventure', kind: 'adventure_template', precedence: 8 }),
            ref({ id: 'hidden-lore', kind: 'lorebook_entry', precedence: 12 }),
        ]
        const original = structuredClone(refs)
        const { result } = renderHook(() => useCodex({ story: story(refs), workspace: WORKSPACE }))
        expect(result.current.entries.map(entry => entry.id)).toEqual(['visible'])
        expect(result.current.mentionEntries.map(entry => entry.id)).toEqual(['visible'])
        expect(result.current.detectionNames.map(entry => entry.id)).toEqual(['visible'])
        expect(result.current.loreEntries).toEqual([])
        const hidden = { id: refs[1].id, kind: refs[1].kind, label: 'Hidden', description: '', enabled: true, ref: refs[1] }
        await act(async () => {
            await result.current.toggleEntry(hidden)
            await result.current.saveSnapshot(hidden, { label: 'Changed', description: '' })
            await result.current.removeEntry(hidden)
            await result.current.addCards([{ kind: 'adventure_template', cardId: 'new-hidden' }])
            await result.current.cloneLorebookEntries(LOREBOOK, ['entry-1'])
        })
        expect(updateStoryCardRef).not.toHaveBeenCalled()
        expect(deleteStoryCardRef).not.toHaveBeenCalled()
        expect(addStoryCardRefs).not.toHaveBeenCalled()
        await act(async () => { await result.current.addCards([{ kind: 'world', cardId: 'new-world' }]) })
        expect(addStoryCardRefs.mock.calls[0][1][0].precedence).toBe(13)
        expect(refs).toEqual(original)
    })

    it('derives entries from story-level refs only, sorted by precedence', () => {
        const refs = [
            ref({ id: 'a', precedence: 2 }),
            ref({ id: 'chapter-scoped', chapterId: 'ch1', snapshot: snapshot({ name: 'Hidden' }) }),
            ref({
                id: 'b',
                precedence: 1,
                kind: 'world',
                cardId: 'world-1',
                snapshot: snapshot({ id: 'world-1', name: 'Eldoria', description: 'A kingdom', story_card_kind: 'world' }),
            }),
        ]
        const { result } = renderHook(() => useCodex({ story: story(refs), workspace: WORKSPACE }))

        expect(result.current.entries.map((entry) => entry.id)).toEqual(['b', 'a'])
        expect(result.current.entries[0]).toMatchObject({ label: 'Eldoria', description: 'A kingdom', kind: 'world' })
        expect(result.current.groups.map((group) => group.labelKey)).toEqual([
            'novelEditor.codexKind.characters',
            'novelEditor.codexKind.worlds',
        ])
        expect(result.current.existingCardKeys.has('character:card-x')).toBe(true)
    })

    it('addCards posts one batch with continuing precedence and no snapshots', async () => {
        const refs = [ref({ id: 'a', precedence: 4 })]
        const { result } = renderHook(() => useCodex({ story: story(refs), workspace: WORKSPACE }))

        await result.current.addCards([
            { kind: 'world', cardId: 'w1' },
            { kind: 'item', cardId: 'i1' },
        ])

        expect(addStoryCardRefs).toHaveBeenCalledTimes(1)
        expect(addStoryCardRefs).toHaveBeenCalledWith('s1', [
            { kind: 'world', cardId: 'w1', source: 'manual', enabled: true, precedence: 5, chapterId: null,sceneId:null },
            { kind: 'item', cardId: 'i1', source: 'manual', enabled: true, precedence: 6, chapterId: null,sceneId:null },
        ])
    })

    it('cloneLorebookEntries builds one self-contained snapshot per entry', async () => {
        const { result } = renderHook(() => useCodex({ story: story([]), workspace: WORKSPACE }))

        await result.current.cloneLorebookEntries(LOREBOOK, ['entry-1', 'entry-2'])

        expect(addStoryCardRefs).toHaveBeenCalledTimes(1)
        const [, payloads] = addStoryCardRefs.mock.calls[0]
        expect(payloads).toHaveLength(2)
        expect(payloads[0]).toMatchObject({
            kind: 'lorebook_entry',
            cardId: 'entry-1',
            source: 'manual',
            enabled: true,
            precedence: 0,
            chapterId: null, sceneId: null,
        })
        expect(payloads[0].snapshot).toMatchObject({
            id: 'entry-1',
            name: 'The Glass Pact',
            description: 'An oath sworn on shattered mirrors.',
            source_lorebook_id: 'lb-1',
            story_card_kind: 'lorebook_entry',
        })
        // Disabled source entries clone as disabled codex entries.
        expect(payloads[1]).toMatchObject({ cardId: 'entry-2', enabled: false, precedence: 1 })
    })

    it('exposes already-cloned entry ids for the picker', () => {
        const refs = [ref({
            id: 'a',
            kind: 'lorebook_entry',
            cardId: 'entry-1',
            snapshot: snapshot({
                id: 'entry-1',
                name: 'Pact',
                story_card_kind: 'lorebook_entry',
                source_lorebook_id: 'lb-1',
            }),
        })]
        const { result } = renderHook(() => useCodex({ story: story(refs), workspace: WORKSPACE }))

        expect(result.current.existingEntryIds).toEqual(new Set(['entry-1']))
    })

    it('toggleEntry flips enabled via a card-ref PUT', async () => {
        const refs = [ref({ id: 'a', enabled: true })]
        const { result } = renderHook(() => useCodex({ story: story(refs), workspace: WORKSPACE }))

        await result.current.toggleEntry(result.current.entries[0])

        expect(updateStoryCardRef).toHaveBeenCalledWith('s1', 'a', { enabled: false })
    })

    it('saveSnapshot merges into the existing snapshot, preserving card fields', async () => {
        const refs = [ref({ id: 'a', snapshot: snapshot({ race: 'elf' }) })]
        const { result } = renderHook(() => useCodex({ story: story(refs), workspace: WORKSPACE }))

        await result.current.saveSnapshot(result.current.entries[0], { label: 'Aria the Red', description: 'A ranger of the gate.' })

        expect(updateStoryCardRef).toHaveBeenCalledWith('s1', 'a', {
            snapshot: {
                id: 'card-x',
                name: 'Aria the Red',
                description: 'A ranger of the gate.',
                race: 'elf',
                story_card_kind: 'character',
            },
        })
    })

    it('saveSnapshot keeps lorebook entries in the strict snapshot schema', async () => {
        const refs = [ref({
            id: 'a',
            kind: 'lorebook_entry',
            cardId: 'entry-1',
            snapshot: snapshot({
                id: 'entry-1',
                name: 'Pact',
                description: 'old',
                source_lorebook_id: 'lb-1',
                story_card_kind: 'lorebook_entry',
            }),
        })]
        const { result } = renderHook(() => useCodex({ story: story(refs), workspace: WORKSPACE }))

        await result.current.saveSnapshot(result.current.entries[0], { label: 'Pact', description: 'new text' })

        const [, , payload] = updateStoryCardRef.mock.calls[0]
        expect(payload.snapshot).toEqual({
            id: 'entry-1',
            name: 'Pact',
            description: 'new text',
            source_lorebook_id: 'lb-1',
            story_card_kind: 'lorebook_entry',
        })
    })

    it('removeEntry deletes the card ref', async () => {
        const refs = [ref({ id: 'a' })]
        const { result } = renderHook(() => useCodex({ story: story(refs), workspace: WORKSPACE }))

        await result.current.removeEntry(result.current.entries[0])

        expect(deleteStoryCardRef).toHaveBeenCalledWith('s1', 'a')
    })

    it('detects effective entity names even when excluded, without enabling context', () => {
        const refs = [
            ref({ id: 'a', kind: 'character' }),
            ref({
                id: 'b',
                kind: 'world',
                cardId: 'world-1',
                enabled: false,
                precedence: 1,
                snapshot: snapshot({ id: 'world-1', name: 'Eldoria', story_card_kind: 'world' }),
            }),
            ref({
                id: 'c',
                kind: 'lorebook_entry',
                cardId: 'e1',
                precedence: 2,
                snapshot: snapshot({
                    id: 'e1',
                    name: 'Pact',
                    story_card_kind: 'lorebook_entry',
                    source_lorebook_id: 'lb-1',
                }),
            }),
        ]
        const { result } = renderHook(() => useCodex({ story: story(refs), workspace: WORKSPACE }))

        expect(result.current.detectionNames).toEqual([{ id: 'a', label: 'Aria', kind: 'character' }, { id: 'b', label: 'Eldoria', kind: 'world' }])
        expect(result.current.referenceEntries.find(entry=>entry.id==='b')?.contextState).toBe('disabled')
    })

    it('loreEntries reconstructs session lore from cloned snapshots with chat-matching defaults', () => {
        const refs = [
            ref({
                id: 'l',
                kind: 'lorebook_entry',
                cardId: 'entry-1',
                enabled: false,
                snapshot: snapshot({
                    id: 'entry-1',
                    name: 'The Glass Pact',
                    description: 'An oath sworn on shattered mirrors.',
                    source_lorebook_id: 'lb-1',
                    story_card_kind: 'lorebook_entry',
                }),
            }),
            ref({ id: 'c', kind: 'character', precedence: 1 }),
        ]
        const { result } = renderHook(() => useCodex({ story: story(refs), workspace: WORKSPACE }))

        expect(result.current.loreEntries).toHaveLength(1)
        const session = result.current.loreEntries[0]
        expect(session.lorebookName).toBe('lb-1')
        // Stored snapshots retain the entry name but not the full trigger list,
        // so the name is the local highlighting fallback.
        expect(session.entry).toMatchObject({ keys: ['The Glass Pact'], enabled: false, matchWholeWords: true, caseSensitive: false, regex: false })
    })

    it('starts no codex op once the story workspace is no longer the committed one', async () => {
        const refs = [ref({ id: 'a', enabled: true })]
        const { result } = renderHook(() => useCodex({ story: story(refs), workspace: WORKSPACE }))
        workspaceCurrent = false

        await act(async () => {
            await result.current.addCards([{ kind: 'world', cardId: 'w1' }])
            await result.current.toggleEntry(result.current.entries[0])
            await result.current.removeEntry(result.current.entries[0])
        })

        expect(addStoryCardRefs).not.toHaveBeenCalled()
        expect(updateStoryCardRef).not.toHaveBeenCalled()
        expect(deleteStoryCardRef).not.toHaveBeenCalled()
        expect(result.current.busy).toBe(false)
    })
})

describe('useCodex in an archived workspace', () => {
    const state = createWorkspaceTestState({
        workspaces: [
            testWorkspace(TEST_WORKSPACE_ID, 'Main library'),
            testWorkspace(OTHER_WORKSPACE_ID, 'Novel A', { archived_at: '2026-10-10T00:00:00Z' }),
        ],
    })
    const wrapper = ({ children }: { children: ReactNode }) => createElement(WorkspaceTestProvider, { state, children })
    const ARCHIVED_STORY = { workspaceId: OTHER_WORKSPACE_ID, isCurrent: () => true, detachedApi: () => null }

    beforeEach(() => {vi.clearAllMocks();localStorage.clear()})

    it('keeps the entries readable and mentionable but sends no op', async () => {
        const refs = [ref({ id: 'a', enabled: true })]
        const { result } = renderHook(() => useCodex({ story: story(refs), workspace: ARCHIVED_STORY }), { wrapper })

        expect(result.current.readOnly).toBe(true)
        expect(result.current.mentionEntries).toMatchObject([{ id: 'a', label: 'Aria', kind: 'character', enabled: true }])
        await act(async () => {
            await result.current.addCards([{ kind: 'world', cardId: 'w1' }])
            await result.current.toggleEntry(result.current.entries[0])
            await result.current.saveSnapshot(result.current.entries[0], { label: 'Aria the Red', description: '' })
            await result.current.removeEntry(result.current.entries[0])
        })

        expect(addStoryCardRefs).not.toHaveBeenCalled()
        expect(updateStoryCardRef).not.toHaveBeenCalled()
        expect(deleteStoryCardRef).not.toHaveBeenCalled()
        expect(result.current.busy).toBe(false)
    })
})

describe('scoped and historical Codex references',()=>{
    beforeEach(()=>{vi.clearAllMocks();localStorage.clear();workspaceCurrent=true})
    it('uses a disabled scene pin to override inherited context while retaining both readable identities',()=>{
        const root=ref({id:'root',cardId:'card-x'})
        const local=ref({id:'local',cardId:'card-x',sceneId:'scene-1',enabled:false})
        const {result}=renderHook(()=>useCodex({story:story([root,local]),scene:storyScene(),workspace:WORKSPACE,scope:'scene'}))
        expect(result.current.mentionEntries).toMatchObject([{id:'local',label:'Aria',kind:'character',enabled:false}])
        expect(result.current.detectionNames).toEqual([{id:'local',label:'Aria',kind:'character'}])
        expect(result.current.groups[0].entries.map((entry)=>entry.id)).toEqual(['local'])
        expect(result.current.resolveEntry('root')?.id).toBe('root')
    })
    it('excludes removed context, retains its snapshot for links, and restores the same identity',async()=>{
        const removed=ref({id:'removed',removedAt:'2026-10-16T00:00:00',enabled:false})
        const {result}=renderHook(()=>useCodex({story:story([removed]),workspace:WORKSPACE}))
        expect(result.current.entries).toEqual([])
        expect(result.current.mentionEntries).toMatchObject([])
        expect(result.current.resolveEntry('removed')?.label).toBe('Aria')
        expect(result.current.removedEntries).toHaveLength(1)
        await act(async()=>{await result.current.restoreEntry(result.current.removedEntries[0])})
        expect(restoreStoryCardRef).toHaveBeenCalledWith('s1','removed')
    })
})
