import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/app/hooks'
import { ApiError } from '@/infrastructure/api'
import { useAssistant } from '@/features/creation/common/components/assistant/useAssistant'
import { isAssistantContextRequest } from '@/infrastructure/api/storyAssistantContextContract'
import { studioReviewVersion } from '@/shared/storyStudioState'
import type { StoryOutline } from '@/shared/types/storyStudio.types'
import type { StoryAnnotationSelection } from '@/shared/types/storyAnnotation.types'
import type {StoryGeneration} from '@/shared'
import type {StoryVariantRecord} from '@/shared/types/storyVariant.types'
import type {NovelGenerationRefinement} from './novelRefinementTarget'
import type { NovelAssistantTurnPreview,NovelAssistantRecord,StoryAssistantPreset } from '@/shared/types/storyAssistant.types'
import { verifyNovelAssistantRecord } from '@/infrastructure/api/novelAssistantContract'
import { refinementSourceReference,verifyNovelRefinementSource } from '@/infrastructure/api/variantRefinementContract'
import { canonicalJson } from '@/utils/json'
import { isNovelAssistantTerminal, novelAssistantControlSettled } from '@/infrastructure/api/novelAssistantControlContract'
import { makeRequestId } from '@/utils/uuid'
import { novelAssistantAdapter } from '../assistantAdapter'
import { activeAssistantPreset, assistantSourceOptions, canRetireAssistantDraft, newAssistantDraft, withoutAction, type NovelAssistantDraft, type NovelAssistantPendingTurn } from '../persistence/assistantDraftJournal'
import { presetReference, presetSnapshot, renderPreset } from '@/infrastructure/api/storyAssistantPresetContract'
import { useNovelAssistantDrafts, type RetainedAssistantDraft } from './useNovelAssistantDrafts'
import { summaryRefreshSettings } from '../utils/summaryStatus'
import type { NovelAssistantSource } from './useNovelAssistantSource'
import type { StoryWorkspace } from './useStoryWorkspace'

interface Options {
    open: boolean; source: NovelAssistantSource; workspace: StoryWorkspace; story: StoryOutline
    anchorSceneId: string; selection: StoryAnnotationSelection | null; readOnly: boolean; onAuthRequired: () => void
}
/** Primed source settings alone are not author content. */
const authored = (draft: NovelAssistantDraft) => Boolean(draft.message || draft.title || draft.conversationId || draft.pending || draft.creation || draft.refinement)
const signature = (draft: NovelAssistantDraft) => { const preset = activeAssistantPreset(draft); return canonicalJson([assistantSourceOptions(draft.settings, draft.message), draft.selection,draft.refinement??null,preset?presetReference(preset):null]) }
/** Refusals the author can fix (Source choices, or using a changed preset again); other failures keep the generic notice. */
const BUDGET_NOTICES: Record<string, string> = { STORY_CONTEXT_OUTPUT_RESERVE_TOO_SMALL: 'reserveTooSmall', STORY_CONTEXT_BUDGET_EXCEEDED: 'budgetExceeded',
    STORY_ASSISTANT_PRESET_CHANGED: 'presetChanged', STORY_ASSISTANT_PRESET_MISMATCH: 'presetChanged' }

/** Draft ownership, provider-free preparation, and the shared conversation/stream lifecycle. */
export function useNovelAssistant({ open, source, workspace, story, anchorSceneId, selection, readOnly, onAuthRequired }: Options) {
    const { t } = useTranslation(), { isAuthenticated } = useAuth()
    const journals = useNovelAssistantDrafts(source.storyId, workspace)
    const [record, setRecord] = useState<RetainedAssistantDraft>(() => ({ schema: 1, write: newAssistantDraft(source.storyId, anchorSceneId, selection) }))
    const [review, setReview] = useState<{ value: NovelAssistantTurnPreview; draftId: string; signature: string; knownVersion: string } | null>(null)
    // The review whose prompt was sent: from then on it describes that turn, not something to prepare again.
    const [sentReview, setSentReview] = useState<NovelAssistantTurnPreview | null>(null)
    const [workController, setWorkController] = useState<AbortController | null>(null), [notice, setNotice] = useState<string | null>(null)
    const [controlKind, setControlKind] = useState<'stop' | 'check' | null>(null)
    const controlRun = useRef<AbortController | null>(null)
    const working = Boolean(workController && !workController.signal.aborted)
    const [prepared, setPrepared] = useState(false)
    const draftRef = useRef(record), live = useRef(true), ticket = useRef(0), abort = useRef<AbortController | null>(null)
    const writingAllowed=useRef(!readOnly)
    useLayoutEffect(() => { draftRef.current = record }, [record])
    // The serial intentionally advances on retirement; it is not a DOM ref snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useLayoutEffect(() => { live.current = true; return () => { live.current = false; ticket.current++; abort.current?.abort() } }, [source])
    const current = () => live.current && source.isCurrent() && workspace.isCurrent()
    const assistant = useAssistant({ adapter: novelAssistantAdapter, binding: { storyId: source.storyId, title: story.title, preview: review?.value ?? null },
        workspaceId: workspace.workspaceId, isAuthenticated, onAuthRequired, resumeNewest: false })
    const { openPanel, closePanel } = assistant
    useEffect(() => { if (open && !assistant.open) openPanel(); else if (!open && assistant.open) closePanel() }, [open, assistant.open, openPanel, closePanel])
    useEffect(() => { if (!open) { ticket.current++; abort.current?.abort() } }, [open])
    const save = (change: Partial<NovelAssistantDraft> | NovelAssistantDraft) => {
        if (!current()) return null
        const next = { ...draftRef.current.write, ...structuredClone(change), sequence: draftRef.current.write.sequence + 1 }
        const saved = journals.save(next)
        if (!saved) return null
        draftRef.current = saved
        setRecord(saved)
        return saved
    }
    function preserve() {
        if(!current())return false
        const value=draftRef.current.write
        if(value.sequence===0&&!value.message&&!value.title&&!value.pending&&!value.creation&&!value.refinement&&!value.conversationId)return true
        const saved=journals.save(value)
        if(saved){draftRef.current=saved;setRecord(saved)}
        return Boolean(saved&&!saved.storageFailed)
    }
    const preserveRef=useRef(preserve)
    useLayoutEffect(()=>{preserveRef.current=preserve})
    useEffect(()=>{
        const unload=(event:BeforeUnloadEvent)=>{if(!preserveRef.current()){event.preventDefault();event.returnValue=''}}
        window.addEventListener('beforeunload',unload)
        return()=>window.removeEventListener('beforeunload',unload)
    },[])
    const draft = record.write, form = signature(draft), knownVersion = studioReviewVersion(story)
    const conversation = assistant.activeConversation
    useLayoutEffect(()=>{writingAllowed.current=!readOnly&&!conversation?.active_request_id},[readOnly,conversation?.active_request_id])
    const reviewCurrent = Boolean(review && prepared && !record.storageFailed && !draft.pending && review.draftId === draft.id && review.signature === form
        && review.knownVersion === knownVersion && review.value.conversationId === conversation?.conversation_id
        && review.value.conversationVersion === conversation?.conversation_version && !conversation?.active_request_id && source.isCurrent() && workspace.isCurrent())
    const busy = working || assistant.status === 'streaming' || assistant.status === 'switching'
    const valid = isAssistantContextRequest({ ...assistantSourceOptions(draft.settings, draft.message), sourceVersion: '0'.repeat(64) })
        &&(!draft.refinement||draft.settings.task==='suggest'&&draft.settings.anchorSceneId===draft.refinement.parent.sceneId
            &&!(!('variant'in draft.refinement)&&draft.refinement.parent.command==='continue'&&draft.settings.scope==='selection'))
    async function prepare() {
        if (!current() || busy || readOnly || draftRef.current.write.pending) return
        if(draftRef.current.storageFailed&&!preserve()){setNotice(t('novelEditor.assistant.storageFailed'));return}
        if(!valid){if(draftRef.current.write.refinement)setNotice(t('novelEditor.assistant.refineHelp'));return}
        const captured = structuredClone(draftRef.current.write)
        if (!captured.conversationId && !(captured.creation?.title ?? captured.title).trim()) { setNotice(t('novelEditor.assistant.titleRequired')); return }
        const owner = ++ticket.current, controller = new AbortController()
        abort.current?.abort(); abort.current = controller
        setWorkController(controller); setNotice(null); setPrepared(false)
        const owned = () => owner === ticket.current && current() && !controller.signal.aborted && draftRef.current.write.id === captured.id
        try {
            let id = captured.conversationId
            if (!id) {
                const creation = captured.creation ?? { requestId: makeRequestId('novel-chat'), title: captured.title.trim() }
                const retained=save({creation})
                if (!retained||retained.storageFailed) return
                const created = await assistant.prepareConversation(creation.title, creation.requestId)
                if (!owned() || !created) return
                if (created.kind !== 'novel' || created.story_id !== source.storyId) throw new Error('Conversation scope changed')
                id = created.conversation_id
                const retainedConversation=save({conversationId:id,title:created.title??creation.title})
                if(!retainedConversation||retainedConversation.storageFailed)return
            } else if (assistant.activeConversation?.conversation_id !== id) {
                await assistant.selectConversation(id)
                if (!owned()) return
            }
            const value = await source.preview(id, assistantSourceOptions(captured.settings, captured.message), captured.selection, controller.signal,captured.refinement??null,activeAssistantPreset(captured))
            if (!owned()) return
            await assistant.reloadConversation({ currentHead: true })
            if (!owned()) return
            setReview({ value, draftId: captured.id, signature: signature(captured), knownVersion })
            setPrepared(true)
        } catch (failure) { if (owned()) setNotice(t('novelEditor.assistant.' + (failure instanceof ApiError && failure.code && BUDGET_NOTICES[failure.code] || 'reviewFailed'))) }
        finally { if (owned()) setWorkController(null) }
    }
    function complete(pending: NovelAssistantPendingTurn, completedExecutionId?: string) {
        const latest = draftRef.current.write
        if (!current() || latest.pending?.requestId !== pending.requestId || latest.pending.conversationId !== pending.conversationId) return
        if (latest.pending.terminal || latest.pending.stopRequested && !completedExecutionId) return
        save({ pending: null,
            ...(completedExecutionId ? { outcome: { conversationId: pending.conversationId, result: {
                status: 'completed' as const, request_id: pending.requestId, execution_id: completedExecutionId } } } : {}),
            ...(!latest.pending.stopRequested && latest.sequence === pending.draftSequence && latest.message.trim() === pending.body.message
                ? { message: '',...(latest.refinement?{refinement:null}:{}),...(latest.preset?{preset:null}:{}) } : {}) })
        setPrepared(false)
    }
    useEffect(() => {
        const pending = draftRef.current.write.pending
        if (pending && assistant.turns.some(turn => turn.message.role === 'assistant' && turn.message.status === 'completed'
            && turn.message.conversation_id === pending.conversationId && turn.message.metadata?.request_id === pending.requestId)) complete(pending)
    })
    async function sendReviewed() {
        if (!reviewCurrent || !review || readOnly || busy || !current()) return
        const pending: NovelAssistantPendingTurn = { requestId: makeRequestId('novel-turn'), draftSequence: draftRef.current.write.sequence + 1, conversationId: review.value.conversationId,
            body: { kind: 'novel', message: review.value.context.request.message, source: structuredClone(review.value.context.request),
                ...(review.value.refinement?{refinement:refinementSourceReference(review.value.refinement)}:{}),
                ...(review.value.preset?{preset:presetReference(review.value.preset)}:{}),
                expected_packet_hash: review.value.context.packetHash, expected_conversation_version: review.value.conversationVersion, expected_prompt_hash: review.value.promptHash },
            llm: { selection: structuredClone(draftRef.current.write.selection), expected_revision_id: review.value.profile.revision_id } }
        const retained=save({pending,outcome:null})
        if (!retained||retained.storageFailed) return
        setSentReview(review.value)
        await assistant.send(pending.body.message, { requestId: pending.requestId, llm: pending.llm })
    }
    async function controlPending(requestStop: boolean) {
        let pending = draftRef.current.write.pending
        if (!pending || !current() || draftRef.current.write.storyId !== source.storyId || controlRun.current && !controlRun.current.signal.aborted
            || (requestStop ? working || assistant.status === 'switching' : busy)) return
        const draftId = draftRef.current.write.id
        if (requestStop) {
            const saved = save({ pending: { ...pending, stopRequested: true } })
            setPrepared(false)
            if (!saved || saved.storageFailed) { setNotice(t('novelEditor.assistant.stopStorageFailed')); return }
            pending = saved.write.pending!
        }
        const sendStop = Boolean(pending.stopRequested || pending.terminal)
        if (sendStop && !preserve()) { setNotice(t('novelEditor.assistant.stopStorageFailed')); return }
        if (requestStop) assistant.stop()
        const owner = ++ticket.current, controller = new AbortController()
        controlRun.current = controller
        abort.current?.abort(); abort.current = controller; setWorkController(controller); setNotice(null)
        setControlKind(sendStop ? 'stop' : 'check')
        const operationCurrent = () => current() && owner === ticket.current && !controller.signal.aborted && draftRef.current.write.id === draftId
        const pendingCurrent = () => operationCurrent() && draftRef.current.write.pending?.requestId === pending.requestId
            && draftRef.current.write.pending.conversationId === pending.conversationId
        try {
            const result = await (sendStop ? source.stopTurn : source.turnState)(pending.conversationId, pending.requestId, controller.signal)
            if (!pendingCurrent()) return
            if (result.request_id !== pending.requestId) throw new Error('Assistant request identity changed')
            if (result.status === 'completed') {
                complete(pending, pending.stopRequested ? result.turn.llm_execution.execution_id : undefined)
                retireCopies(pending.requestId, { conversationId: pending.conversationId, result: { status: 'completed', request_id: pending.requestId,
                    execution_id: result.turn.llm_execution.execution_id } })
                setNotice(pending.stopRequested ? null : t('novelEditor.assistant.recovered'))
            } else if (isNovelAssistantTerminal(result)) {
                const retained = structuredClone(result)
                if (novelAssistantControlSettled(retained)) {
                    const outcome = { conversationId: pending.conversationId, result: retained }
                    if (save({ pending: null, outcome })) retireCopies(pending.requestId, outcome)
                } else save({ pending: { ...draftRef.current.write.pending!, terminal: retained,
                    ...(retained.control.stop_requested ? { stopRequested: true } : {}) } })
                setPrepared(false)
            } else { setNotice(t(sendStop ? 'novelEditor.assistant.stopUnconfirmed' : 'novelEditor.assistant.noResult')); return }
            // Load the live conversation head, rather than replacing newer history with a frozen old turn.
            await assistant.selectConversation(pending.conversationId)
            if (!operationCurrent()) return
            await assistant.reloadConversation({ currentHead: true })
        } catch { if (operationCurrent() && !sendStop) setNotice(t('novelEditor.assistant.noResult')) }
        finally {
            if (controlRun.current === controller) controlRun.current = null
            if (operationCurrent()) { setWorkController(null); setControlKind(null) }
        }
    }
    const checkResult = () => controlPending(false)
    const stop = () => controlPending(true)
    // Once this draft proves a request settled, older device copies that still hold it have nothing left to recover.
    function retireCopies(requestId: string, outcome: NonNullable<NovelAssistantDraft['outcome']>) {
        for (const item of journals.items)
            if (item.storageKey !== draftRef.current.storageKey && item.write.pending?.requestId === requestId) journals.remove(item, outcome)
    }
    /** Check or stop a conversation's active request by its own identity, without the device draft that sent it. */
    async function controlActive(requestStop: boolean) {
        const active = assistant.activeConversation, requestId = active?.active_request_id
        if (!active || !requestId || busy || !current() || draftRef.current.write.pending
            || draftRef.current.write.conversationId !== active.conversation_id) return
        const conversationId = active.conversation_id, draftId = draftRef.current.write.id
        const owner = ++ticket.current, controller = new AbortController()
        abort.current?.abort(); abort.current = controller; setWorkController(controller); setNotice(null)
        setControlKind(requestStop ? 'stop' : 'check')
        const owned = () => current() && owner === ticket.current && !controller.signal.aborted && draftRef.current.write.id === draftId
            && !draftRef.current.write.pending && draftRef.current.write.conversationId === conversationId
        const unsettled = t(requestStop ? 'novelEditor.assistant.stopUnconfirmed' : 'novelEditor.assistant.noResult')
        try {
            const result = await (requestStop ? source.stopTurn : source.turnState)(conversationId, requestId, controller.signal)
            if (!owned()) return
            if (result.request_id !== requestId) throw new Error('Assistant request identity changed')
            if (result.status === 'completed') {
                retireCopies(requestId, { conversationId, result: { status: 'completed', request_id: requestId, execution_id: result.turn.llm_execution.execution_id } })
                setNotice(t('novelEditor.assistant.recovered'))
            } else if (isNovelAssistantTerminal(result) && novelAssistantControlSettled(result)) {
                const outcome = { conversationId, result: structuredClone(result) }
                if (!save({ outcome })) return
                retireCopies(requestId, outcome)
            } else { setNotice(unsettled); return }
            await assistant.reloadConversation({ currentHead: true })
        } catch { if (owned()) setNotice(unsettled) }
        finally { if (current() && owner === ticket.current) { setWorkController(null); setControlKind(null) } }
    }
    const checkActive = () => controlActive(false)
    const stopActive = () => controlActive(true)
    async function selectRefinement(load:(signal:AbortSignal)=>Promise<NovelGenerationRefinement>,signal:AbortSignal) {
        if(!current()||busy||readOnly||draftRef.current.write.pending||assistant.activeConversation?.active_request_id||draftRef.current.write.storyId!==source.storyId)return false
        const captured=draftRef.current.write
        const owner=++ticket.current,controller=new AbortController()
        const cancel=()=>controller.abort()
        signal.addEventListener('abort',cancel,{once:true});if(signal.aborted)cancel()
        abort.current?.abort();abort.current=controller;setWorkController(controller);setNotice(null);setPrepared(false)
        const owned=()=>current()&&writingAllowed.current&&owner===ticket.current&&!controller.signal.aborted&&draftRef.current.write.id===captured.id
            &&draftRef.current.write.sequence===captured.sequence
        try {
            const target=await load(controller.signal)
            if(!owned())return false
            const value=target.refinement,parent=value.parent
            if(!verifyNovelRefinementSource(value,source.storyId)||target.selection&&target.selection.sceneId!==parent.sceneId
                ||!('variant'in value)&&parent.command==='continue'&&target.selection)throw new Error('Retained target changed')
            const saved=save({refinement:structuredClone(value),settings:{...withoutAction(captured.settings),task:'suggest',anchorSceneId:parent.sceneId,
                scope:target.selection?'selection':'scene',selection:structuredClone(target.selection),sceneIds:[]}})
            if(!saved||saved.storageFailed){if(saved?.storageFailed)setNotice(t('novelEditor.assistant.storageFailed'));return false}
            setReview(null);setNotice(t('novelEditor.assistant.refineReady'));return true
        } catch {if(owned())setNotice(t('novelEditor.assistant.refineFailed'));return false}
        finally {
            signal.removeEventListener('abort',cancel)
            if(current()&&owner===ticket.current)setWorkController(null)
        }
    }
    async function refine(record:NovelAssistantRecord,signal:AbortSignal) {
        if(!open||!verifyNovelAssistantRecord(record,source.storyId)||!record.result.proposal)return false
        const proposal=structuredClone(record.result.proposal)
        return selectRefinement(async signal=>{
            const value=await source.refinement(proposal.id,signal),parent=value.parent
            if(parent.id!==proposal.id||parent.storyId!==source.storyId||parent.sceneId!==proposal.sceneId
                ||parent.baseRevision!==proposal.baseRevision||parent.output!==proposal.markdown||parent.instruction!==proposal.instruction
                ||parent.command!==(proposal.operation==='append_scene'?'continue':'rewrite'))throw new Error('Retained proposal changed')
            return {refinement:value,selection:proposal.operation==='replace_selection'
                ?selection?.sceneId===parent.sceneId?structuredClone(selection):structuredClone(proposal.selection):null}
        },signal)
    }
    async function refineGeneration(generation:StoryGeneration,signal:AbortSignal,currentSelection:StoryAnnotationSelection|null=null) {
        return selectRefinement(signal=>source.refinementForGeneration(structuredClone(generation),signal,currentSelection),signal)
    }
    async function refineVariant(record:StoryVariantRecord,signal:AbortSignal) {
        return selectRefinement(signal=>source.refinementForVariant(structuredClone(record),signal),signal)
    }
    /** A plan step becomes the unsent Suggest request for its scene; the author still reviews and sends it. */
    function draftStep(sceneId: string, instruction: string, number: number) {
        if (!current() || busy || readOnly || draftRef.current.write.pending || assistant.activeConversation?.active_request_id) { setNotice(t('novelEditor.assistant.plan.unavailable')); return false }
        const captured = draftRef.current.write
        if (captured.refinement || captured.message.trim() && captured.message.trim() !== instruction) { setNotice(t('novelEditor.assistant.plan.blocked')); return false }
        const saved = save({ message: instruction, settings: { ...withoutAction(captured.settings), task: 'suggest', anchorSceneId: sceneId, scope: 'scene', selection: null, sceneIds: [] } })
        if (!saved || saved.storageFailed) { if (saved?.storageFailed) setNotice(t('novelEditor.assistant.storageFailed')); return false }
        setReview(null); setPrepared(false); setNotice(t('novelEditor.assistant.plan.ready', { number }))
        return true
    }
    /**
     * Primes one reviewed Summary request over the chosen scenes (rest of K09); the author still prepares and sends it.
     * From summaries, the whole novel is read through one scene and the current summaries of the rest.
     */
    function refreshSummaries(sceneIds: string[], book: boolean, fromSummaries = false) {
        if (!current() || busy || readOnly || draftRef.current.write.pending || assistant.activeConversation?.active_request_id || !sceneIds.length) { setNotice(t('novelEditor.assistant.refresh.unavailable')); return false }
        const captured = draftRef.current.write
        const message = t(fromSummaries ? 'novelEditor.assistant.refresh.summariesMessage' : book ? 'novelEditor.assistant.refresh.bookMessage' : 'novelEditor.assistant.refresh.message')
        // The author's own words stay; only an empty message or an earlier refresh's wording is replaced.
        const replaceable = ['', message, ...['bookMessage', 'message', 'summariesMessage'].map(key => t('novelEditor.assistant.refresh.' + key))]
        if (captured.refinement || !replaceable.includes(captured.message.trim())) { setNotice(t('novelEditor.assistant.refresh.blocked')); return false }
        const saved = save({ message, settings: summaryRefreshSettings(captured.settings, sceneIds, book) })
        if (!saved || saved.storageFailed) { if (saved?.storageFailed) setNotice(t('novelEditor.assistant.storageFailed')); return false }
        setReview(null); setPrepared(false); setNotice(fromSummaries ? t('novelEditor.assistant.refresh.summariesReady') : t('novelEditor.assistant.refresh.ready', { count: sceneIds.length }))
        return true
    }
    /**
     * Fills the message from a prompt preset and applies its defaults (A19); the author still prepares, reviews and sends it.
     * The author's own words are replaced only once confirmed ('confirm' asks first); an unchanged earlier preset message is replaced directly.
     */
    function applyPreset(preset: StoryAssistantPreset, values: Record<string, string>, replace = false): 'applied' | 'confirm' | 'blocked' {
        if (!current() || busy || readOnly || draftRef.current.write.pending || assistant.activeConversation?.active_request_id || preset.trashedAt) { setNotice(t('novelEditor.assistant.presets.unavailable')); return 'blocked' }
        const captured = draftRef.current.write, message = renderPreset(preset.definition, values)
        if (captured.refinement) { setNotice(t('novelEditor.assistant.presets.refining')); return 'blocked' }
        if (!message) return 'blocked'
        if (!replace && captured.message.trim() && !activeAssistantPreset(captured) && captured.message.trim() !== message) return 'confirm'
        const definition = preset.definition
        let settings = { ...withoutAction(captured.settings), task: definition.task }
        if (definition.action) settings = { ...settings, action: structuredClone(definition.action) }
        // A selection default applies only when the drawer has a selection to read.
        if (definition.scope && (definition.scope !== 'selection' || captured.settings.selection)) settings = { ...settings, scope: definition.scope }
        if (definition.revealPolicy) settings = { ...settings, revealPolicy: definition.revealPolicy }
        const saved = save({ message, settings, preset: presetSnapshot(preset, values), ...(definition.profile ? { selection: structuredClone(definition.profile) } : {}) })
        if (!saved || saved.storageFailed) { if (saved?.storageFailed) setNotice(t('novelEditor.assistant.storageFailed')); return 'blocked' }
        setReview(null); setPrepared(false); setNotice(t('novelEditor.assistant.presets.ready', { name: preset.name }))
        return 'applied'
    }
    function newDraft() {
        if (busy || !current() || !preserve()) return
        assistant.newConversation()
        const value = { schema: 1 as const, write: newAssistantDraft(source.storyId, anchorSceneId, selection) }
        draftRef.current = value; setRecord(value); setReview(null); setPrepared(false); setNotice(null)
    }
    async function selectConversation(id: number) {
        if (busy || !current() || !preserve()) return
        const found = assistant.conversations.find(item => item.conversation_id === id)
        if (!found || found.kind !== 'novel' || found.story_id !== source.storyId) return
        const fresh = newAssistantDraft(source.storyId, anchorSceneId, selection)
        const value = journals.save({ ...fresh, conversationId: id, title: found.title ?? '' })
        if (!value) return
        draftRef.current = value; setRecord(value); setReview(null); setPrepared(false); setNotice(null)
        await assistant.selectConversation(id)
    }
    /** `move` replaces the original with its copy, unless the original still holds an unsettled Stop. */
    async function recover(record: RetainedAssistantDraft, move = false) {
        if (busy || !current() || record.write.storyId !== source.storyId || !preserve()) return
        const replaced = draftRef.current
        const fresh = { ...structuredClone(record.write), id: makeRequestId('novel-draft'), sequence: 0 }
        const value = journals.save(fresh)
        if (!value) return
        const moved = move && !value.storageFailed && canRetireAssistantDraft(record.write)
        if (moved) journals.remove(record)
        if (move && replaced.storageKey && !authored(replaced.write)) journals.remove(replaced)
        draftRef.current = value; setRecord(value); setReview(null); setPrepared(false)
        setNotice(t(moved ? 'novelEditor.assistant.draftResumed' : 'novelEditor.assistant.draftCopied'))
        if (fresh.conversationId) await assistant.selectConversation(fresh.conversationId)
        else assistant.newConversation()
    }
    // A reload starts a new page writer; reopening resumes the newest unsent device draft instead of adding another one.
    const resumed = useRef(false)
    useEffect(() => {
        if (!open || resumed.current || busy || !current()) return
        resumed.current = true
        if (authored(draftRef.current.write)) return
        const newest = journals.items.find(item => item.write.message.length || item.write.pending || item.write.creation && !item.write.conversationId)
        // Resuming selects its conversation; it starts after this effect rather than re-rendering inside it.
        if (newest) queueMicrotask(() => void recover(newest, true))
    // Runs once per mounted Studio, after device drafts are read and the panel is idle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, busy, journals.items])
    return { assistant, draft, record, journals, save, preserve, recover, newDraft, selectConversation, prepare, sendReviewed, checkResult, stop, checkActive, stopActive, stopping: working && controlKind === 'stop',refine,refineGeneration,refineVariant,draftStep,refreshSummaries,applyPreset,
        resume: async () => { const pending = draftRef.current.write.pending; if (pending && !pending.stopRequested && !pending.terminal && !readOnly && !busy && current()&&preserve()) await assistant.resumeRetainedTurn(pending) },
        review: review?.value ?? null, reviewCurrent, reviewSent: Boolean(review && review.value === sentReview), valid, busy, working, notice,
        close: () => { ticket.current++; abort.current?.abort(); setWorkController(null); assistant.closePanel() },
    }
}
