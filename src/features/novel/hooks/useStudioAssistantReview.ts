/** Move one checked saved candidate into the mounted editor's review lifecycle. */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import type { StoryOutline, StorySceneDocument, StoryGeneration } from '@/shared'
import type { NovelAssistantRecord } from '@/shared/types/storyAssistant.types'
import { documentSignature } from '@/shared/storyDocument'
import { isStudioSource } from '@/shared/storyStudioState'
import type { NovelEditorHandle } from '../editor/types'
import type { SceneDraftApi } from './useSceneDraft'
import type { NovelAssistantSource } from './useNovelAssistantSource'
import {ApiError} from '@/infrastructure/api'

interface Options {
    source: NovelAssistantSource | null
    story: StoryOutline | null
    scene: StorySceneDocument | null
    selectedUnit: string | null
    draft: Pick<SceneDraftApi, 'sceneId' | 'document' | 'saveState' | 'recovery' | 'conflictServer' | 'suspended' | 'online' | 'getRevision'>
    editorRef: RefObject<NovelEditorHandle | null>
    readOnly: boolean
    blocked: boolean
    loadError: boolean
    beforeReview: () => Promise<boolean>
    selectScene: (id: string, source?: StoryOutline, signal?: AbortSignal) => Promise<boolean>
    onStaged: (generation: StoryGeneration, title: string) => void
}
interface Pending {
    source: NovelAssistantSource
    record: NovelAssistantRecord
    controller: AbortController
    cancel: () => void
    resolve: (result: boolean) => void
    reject:(error:ApiError)=>void
    checked?: Awaited<ReturnType<NovelAssistantSource['reviewCandidate']>>
}

export function useStudioAssistantReview(options: Options) {
    const live = useRef(options), mounted = useRef(true), request = useRef<Pending | null>(null)
    const [waiting, setWaiting] = useState<Pending | null>(null)
    const focus = useRef<{ source: NovelAssistantSource; token: object | null } | null>(null)
    useLayoutEffect(() => { live.current = options })
    const finish = useCallback((pending: Pending, result: boolean,error?:ApiError) => {
        if (request.current !== pending) return
        request.current = null
        if (!result) pending.controller.abort()
        pending.cancel()
        if (mounted.current) setWaiting(null)
        if(error)pending.reject(error);else pending.resolve(result)
    }, [])
    useEffect(() => {
        mounted.current = true
        return () => { mounted.current = false; const pending = request.current; if (pending) { pending.controller.abort(); finish(pending, false) } }
    }, [finish])
    useEffect(() => () => {
        const pending = request.current
        if (pending) { pending.controller.abort(); finish(pending, false) }
    }, [options.source?.key, options.story?.id, finish])

    const review = useCallback((value: NovelAssistantRecord, signal: AbortSignal): Promise<boolean> => {
        const initial = live.current, source = initial.source
        if (request.current || !source || !source.isCurrent() || signal.aborted || initial.readOnly || initial.blocked
            || initial.draft.online === false || value.result.proposal?.storyId !== initial.story?.id) return Promise.resolve(false)
        const controller = new AbortController()
        let resolve!: (result: boolean) => void
        let reject!:(error:ApiError)=>void
        const promise = new Promise<boolean>((done,fail) => { resolve = done;reject=fail })
        const pending: Pending = { source, record: structuredClone(value), controller, resolve,reject, cancel: () => signal.removeEventListener('abort', cancel) }
        const cancel = () => { controller.abort(); finish(pending, false) }
        request.current = pending
        signal.addEventListener('abort', cancel, { once: true })
        const current = () => request.current === pending && mounted.current && !controller.signal.aborted && source.isCurrent()
            && live.current.source?.key === source.key && live.current.story?.id === source.storyId && !live.current.readOnly && !live.current.blocked
        void (async () => {
            try {
                if (!await initial.beforeReview() || !current()) { finish(pending, false); return }
                const origin = live.current, editor = origin.editorRef.current, document = editor?.getDocument()
                const token = editor?.getInstanceToken(), signature = document ? documentSignature(document) : null
                const checked = await source.reviewCandidate(pending.record, controller.signal)
                const now = live.current, manuscript = now.editorRef.current?.getDocument()
                if (!current() || now.editorRef.current?.getInstanceToken() !== token || now.scene?.id !== origin.scene?.id
                    || (manuscript ? documentSignature(manuscript) : null) !== signature || now.editorRef.current?.hasActiveSuggestion()) {
                    finish(pending, false); return
                }
                if (!await now.selectScene(pending.record.result.proposal!.sceneId, checked.index, controller.signal) || !current()) { finish(pending, false); return }
                pending.checked = checked
                setWaiting(pending)
            } catch(error) { finish(pending, false,current()&&error instanceof ApiError&&error.code==='STORY_ASSISTANT_SOURCE_CHANGED'?error:undefined) }
        })()
        return promise
    }, [finish])

    // Scene loading and the draft session settle in separate React commits.
    // Stage only after both describe the checked target and its saved revision.
    useLayoutEffect(() => {
        if (!waiting || request.current !== waiting || !waiting.checked) return
        const now = live.current, proposal = waiting.record.result.proposal!
        const novel = waiting.record.context.packet.novel
        if (!waiting.source.isCurrent() || now.source?.key !== waiting.source.key || now.story?.id !== proposal.storyId
            || waiting.controller.signal.aborted || now.readOnly || now.blocked || now.loadError || now.selectedUnit !== proposal.sceneId
            || now.story.metadataRevision !== novel.metadataRevision || now.story.structureRevision !== novel.structureRevision || now.story.contextRevision !== novel.contextRevision
            || isStudioSource(now.story) && now.story.sourceVersion !== waiting.record.context.sourceVersion) {
            finish(waiting, false); return
        }
        if (now.scene?.id !== proposal.sceneId || now.draft.sceneId !== proposal.sceneId) return
        const editor = now.editorRef.current
        if (!editor || now.scene.inheritance?.readOnly || now.draft.online === false || now.draft.recovery || now.draft.conflictServer
            || now.draft.suspended || !['idle', 'saved'].includes(now.draft.saveState) || editor.hasActiveSuggestion()
            || now.draft.getRevision() !== proposal.baseRevision || now.scene.contentHash !== proposal.baseContentHash) {
            finish(waiting, false); return
        }
        const { detail } = waiting.checked
        if (!editor.reviewGeneration({ generation: detail.generation, operation: proposal.operation, document: now.draft.document })) {
            finish(waiting, false); return
        }
        focus.current = { source: waiting.source, token: editor.getInstanceToken() }
        now.onStaged(detail.generation, detail.chapterTitle + ' · ' + detail.sceneTitle)
        finish(waiting, true)
    })
    useEffect(() => {
        const pending = focus.current
        if (!pending) return
        focus.current = null
        if (pending.source.isCurrent() && live.current.editorRef.current?.getInstanceToken() === pending.token) live.current.editorRef.current?.focus()
    })
    return review
}
