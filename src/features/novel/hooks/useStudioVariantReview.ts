import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import type { StoryGeneration, StoryOutline, StorySceneDocument, StoryVariantRecord } from '@/shared'
import { documentSignature } from '@/shared/storyDocument'
import { studioMatchesIndex } from '@/shared/storyStudioState'
import type { NovelEditorHandle } from '../editor/types'
import type { SceneDraftApi } from './useSceneDraft'
import type { AuthorVariantSource } from './useAuthorVariantSource'

interface Options {
    source: AuthorVariantSource | null; story: StoryOutline | null; scene: StorySceneDocument | null; selectedUnit: string | null
    draft: Pick<SceneDraftApi, 'sceneId' | 'document' | 'saveState' | 'recovery' | 'conflictServer' | 'suspended' | 'online' | 'getRevision'>
    editorRef: RefObject<NovelEditorHandle | null>; readOnly: boolean; blocked: boolean; loadError: boolean
    beforeReview: () => Promise<boolean>
    selectScene: (id: string, source?: StoryOutline, signal?: AbortSignal) => Promise<boolean>
    onStaged: (generation: StoryGeneration, title: string) => void
}
interface Pending { source: AuthorVariantSource; controller: AbortController; cancel: () => void; resolve: (value: boolean) => void
    checked?: Awaited<ReturnType<AuthorVariantSource['review']>> }
/** The same editor review/commit boundary accepts both original and authored JSON. */
export function useStudioVariantReview(options: Options) {
    const live = useRef(options), mounted = useRef(true), pending = useRef<Pending | null>(null)
    const [waiting, setWaiting] = useState<Pending | null>(null)
    const focus = useRef<{ source: AuthorVariantSource; token: object | null } | null>(null)
    useLayoutEffect(() => { live.current = options })
    const finish = useCallback((value: Pending, result: boolean) => {
        if (pending.current !== value) return
        pending.current = null; value.cancel()
        if (!result) value.controller.abort()
        if (mounted.current) setWaiting(null)
        value.resolve(result)
    }, [])
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (pending.current) finish(pending.current, false) } }, [finish])
    useEffect(() => () => { if (pending.current) finish(pending.current, false) }, [options.source?.key, options.story?.id, finish])
    const review = useCallback((record: StoryVariantRecord, signal: AbortSignal): Promise<boolean> => {
        const owner = live.current, source = owner.source
        if (pending.current || !source || !source.isCurrent() || signal.aborted || owner.readOnly || owner.blocked || owner.draft.online === false
            || record.storyId !== owner.story?.id) return Promise.resolve(false)
        let resolve!: (value: boolean) => void
        const promise = new Promise<boolean>(done => { resolve = done }), controller = new AbortController()
        const value: Pending = { source, controller, resolve, cancel: () => signal.removeEventListener('abort', cancel) }
        const cancel = () => finish(value, false)
        pending.current = value; signal.addEventListener('abort', cancel, { once: true })
        const current = () => pending.current === value && mounted.current && !controller.signal.aborted && source.isCurrent()
            && live.current.source?.key === source.key && live.current.story?.id === source.storyId && !live.current.readOnly && !live.current.blocked
        void (async () => {
            try {
                if (!await owner.beforeReview() || !current()) { finish(value, false); return }
                const origin = live.current, editor = origin.editorRef.current, token = editor?.getInstanceToken(), original = editor?.getDocument()
                const signature = original ? documentSignature(original) : null
                const checked = await source.review(structuredClone(record), controller.signal)
                const now = live.current, document = now.editorRef.current?.getDocument()
                if (!current() || now.editorRef.current?.getInstanceToken() !== token || now.scene?.id !== origin.scene?.id
                    || (document ? documentSignature(document) : null) !== signature || now.editorRef.current?.hasActiveSuggestion()) { finish(value, false); return }
                if (!await now.selectScene(checked.variant.operation.sceneId, checked.index, controller.signal) || !current()) { finish(value, false); return }
                value.checked = checked; setWaiting(value)
            } catch { finish(value, false) }
        })()
        return promise
    }, [finish])
    useLayoutEffect(() => {
        const value = waiting, checked = value?.checked, now = live.current
        if (!value || pending.current !== value || !checked) return
        const v = checked.variant, index = checked.index
        if (!value.source.isCurrent() || now.source?.key !== value.source.key || now.story?.id !== v.storyId || value.controller.signal.aborted
            || now.readOnly || now.blocked || now.loadError || now.selectedUnit !== v.operation.sceneId
            || now.story.metadataRevision !== index.metadataRevision || now.story.structureRevision !== index.structureRevision || now.story.contextRevision !== index.contextRevision
            || !studioMatchesIndex(now.story, index)) { finish(value, false); return }
        if (now.scene?.id !== v.operation.sceneId || now.draft.sceneId !== v.operation.sceneId) return
        const editor = now.editorRef.current
        if (!editor || now.scene.inheritance?.readOnly || now.draft.online === false || now.draft.recovery || now.draft.conflictServer || now.draft.suspended
            || !['idle', 'saved'].includes(now.draft.saveState) || editor.hasActiveSuggestion() || now.draft.getRevision() !== v.operation.expectedRevision
            || now.scene.contentHash !== v.operation.expectedContentHash || documentSignature(now.draft.document) !== checked.documentSignature
            || !editor.reviewGeneration({ generation: checked.detail.generation, operation: 'replace_scene', document: now.draft.document, variant: v })) { finish(value, false); return }
        focus.current = { source: value.source, token: editor.getInstanceToken() }
        now.onStaged(checked.detail.generation, checked.detail.chapterTitle + ' · ' + checked.detail.sceneTitle)
        finish(value, true)
    })
    useEffect(() => {
        const value = focus.current; focus.current = null
        if (value?.source.isCurrent() && live.current.editorRef.current?.getInstanceToken() === value.token) live.current.editorRef.current?.focus()
    })
    return review
}
