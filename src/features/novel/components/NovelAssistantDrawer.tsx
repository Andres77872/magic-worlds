import { useEffect,useImperativeHandle,useMemo,useRef,useState, type ReactNode,type Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, MessageSquareText } from 'lucide-react'
import type { StoryOutline } from '@/shared/types/storyStudio.types'
import type { StoryAnnotationSelection } from '@/shared/types/storyAnnotation.types'
import type { NovelAssistantRecord } from '@/shared/types/storyAssistant.types'
import { AssistantBanner } from '@/features/creation/common/components/assistant/AssistantBanner'
import { AssistantComposer } from '@/features/creation/common/components/assistant/AssistantComposer'
import { AssistantMessageList } from '@/features/creation/common/components/assistant/AssistantMessageList'
import { ConversationMenu } from '@/features/creation/common/components/assistant/ConversationMenu'
import { LlmFeatureControl } from '@/features/llmProfiles/LlmFeatureControl'
import { Badge, Button, Callout, Card, Drawer, Field, Icon, Input } from '@/ui/primitives'
import { downloadBlob, safeFilename } from '@/utils/download'
import { useNovelAssistant } from '../hooks/useNovelAssistant'
import type { NovelAssistantSource } from '../hooks/useNovelAssistantSource'
import type { StoryWorkspace } from '../hooks/useStoryWorkspace'
import { NovelAssistantSourceFields } from './NovelAssistantSourceFields'
import { NovelAssistantActions } from './NovelAssistantActions'
import { NovelAssistantPreferences,type AssistantPreferencesApi } from './NovelAssistantPreferences'
import { NovelAssistantPresets,type AssistantPresetsApi } from './NovelAssistantPresets'
import { NovelPresetProvenance } from './NovelPresetProvenance'
import { NovelAssistantTurnReview } from './NovelAssistantTurnReview'
import { NovelAssistantEvidence } from './NovelAssistantEvidence'
import { NovelRefinementSummary } from './NovelRefinementSummary'
import {activeAssistantPreset, initialAssistantSettings, canRetireAssistantDraft, profileAssistantLimits} from '../persistence/assistantDraftJournal'
import type { EffectiveLlmProfile } from '@/shared/types/llmProfile.types'
import { NovelAssistantRequestState } from './NovelAssistantRequestState'
import type {StoryGeneration} from '@/shared'
import type {StoryVariantRecord} from '@/shared/types/storyVariant.types'
import type { PlanItems } from '../hooks/usePlanItems'
import type { BulkScenes } from './NovelBulkScenes'
import type { SceneSummaryWriter } from './NovelAssistantSummaries'
import type { NovelCopyWriter } from './NovelAssistantCopy'
import type { SuggestionsTogether } from '../hooks/useSuggestionsTogether'

interface Props {
    open: boolean; onClose: () => void; source: NovelAssistantSource; workspace: StoryWorkspace; story: StoryOutline
    anchorSceneId: string; selection: StoryAnnotationSelection | null; readOnly: boolean; onAuthRequired: () => void
    onReviewSuggestion?: (record: NovelAssistantRecord, signal: AbortSignal) => Promise<boolean>
    onAuthorVersions?: (generation:StoryGeneration,startEditing:boolean)=>void
    facts?: PlanItems<'fact'>
    tasks?: PlanItems<'task'>
    /** Applies a reply's proposed outline changes; absent where the outline cannot change. */
    structure?: BulkScenes
    /** Saves a reply's scene summaries as scene summaries; absent where scene details cannot change. */
    summaries?: SceneSummaryWriter
    /** Opens the outline import with a reply's chapter plan (S18); absent where the outline cannot change. */
    outline?: (text: string) => void
    /** Saves a reviewed blurb or synopsis as the novel's description or synopsis (A26); absent where the novel's details cannot change. */
    copy?: NovelCopyWriter
    /** The novel's Codex reference labels, to show which @references a proposal keeps (A10). */
    referenceLabels?: readonly string[]
    /** Accepts the latest suggestion of several scenes as one manuscript change; absent where the manuscript cannot change. */
    together?: SuggestionsTogether
}
export interface NovelAssistantHandle {
    refineGeneration:(generation:StoryGeneration,signal:AbortSignal,selection?:StoryAnnotationSelection|null)=>Promise<boolean>
    refineVariant:(record:StoryVariantRecord,signal:AbortSignal)=>Promise<boolean>
    preserve:()=>boolean
    primeTarget:(sceneId:string,selection:StoryAnnotationSelection|null)=>void
    /** Primes a reviewed Summary request over these scenes; the drawer shows why when it cannot. */
    refreshSummaries:(sceneIds:string[],book:boolean,fromSummaries?:boolean)=>boolean
}
export function NovelAssistantDrawer({ref,...props}: Props&{ref?:Ref<NovelAssistantHandle>}) {
    const model = useNovelAssistant(props)
    const [focusRevision,setFocusRevision]=useState(0)
    useImperativeHandle(ref,()=>({refineGeneration:async(generation,signal,selection)=>{
        const ready=await model.refineGeneration(generation,signal,selection)
        if(ready)setFocusRevision(value=>value+1)
        return ready
    },refineVariant:async(record,signal)=>{
        const ready=await model.refineVariant(record,signal)
        if(ready)setFocusRevision(value=>value+1)
        return ready
    },refreshSummaries:(sceneIds,book,fromSummaries)=>{
        const ready=model.refreshSummaries(sceneIds,book,fromSummaries)
        if(ready)setFocusRevision(value=>value+1)
        return ready
    },preserve:model.preserve,primeTarget:(sceneId,selection)=>{
        if(model.draft.sequence===0&&!model.draft.message&&!model.draft.conversationId&&!model.draft.pending)
            model.save({settings:initialAssistantSettings(sceneId,selection)})
    }}),[model])
    // Reply preferences belong to the account; the workspace client only keeps a switch from writing through a stale view.
    const {workspace}=props
    const preferencesApi=useMemo<AssistantPreferencesApi>(()=>{
        const client=()=>{const api=workspace.isCurrent()?workspace.detachedApi():null;if(!api)throw new Error('Novel workspace changed');return api}
        return {get:(signal)=>client().getStoryAssistantPreferences({signal}),save:(preferences,version)=>client().saveStoryAssistantPreferences(preferences,version),
            clear:(version)=>client().clearStoryAssistantPreferences(version)}
    },[workspace])
    const presetsApi=useMemo<AssistantPresetsApi>(()=>{
        const client=()=>{const api=workspace.isCurrent()?workspace.detachedApi():null;if(!api)throw new Error('Novel workspace changed');return api}
        return {list:(signal)=>client().listStoryAssistantPresets({signal}),create:(id,name,definition)=>client().createStoryAssistantPreset(id,name,definition),
            update:(id,name,definition,revision)=>client().updateStoryAssistantPreset(id,name,definition,revision),
            setTrashed:(id,trashed,revision)=>client().setStoryAssistantPresetTrashed(id,trashed,revision),remove:(id,revision)=>client().deleteStoryAssistantPreset(id,revision)}
    },[workspace])
    return <NovelAssistantDrawerView {...props} focusRevision={focusRevision} model={model} preferencesApi={preferencesApi} presetsApi={presetsApi} onClose={() => { if(model.preserve()){model.close();props.onClose()} }} />
}
export function NovelAssistantDrawerView({ open, onClose, source, story, readOnly, model, onReviewSuggestion, onAuthorVersions, profileControl,focusRevision=0,facts,tasks,structure,summaries,outline,copy,referenceLabels,together,preferencesApi,presetsApi }: Pick<Props, 'open' | 'onClose' | 'source' | 'story' | 'readOnly' | 'onReviewSuggestion' | 'onAuthorVersions' | 'facts' | 'tasks' | 'structure' | 'summaries' | 'outline' | 'copy' | 'referenceLabels' | 'together'> & { model: ReturnType<typeof useNovelAssistant>; profileControl?: ReactNode;focusRevision?:number;preferencesApi?:AssistantPreferencesApi;presetsApi?:AssistantPresetsApi }) {
    const { t } = useTranslation(), text = (key: string) => t('novelEditor.assistant.' + key)
    const [discarding, setDiscarding] = useState<string | null>(null)
    const composer=useRef<HTMLDivElement>(null)
    const [focusComposer,setFocusComposer]=useState<{scope:string;serial:number}|null>(null)
    const scope=JSON.stringify([source.key,story.id])
    const focusDraft=()=>setFocusComposer(previous=>({scope,serial:(previous?.serial??0)+1}))
    useEffect(()=>{
        if((!focusComposer||focusComposer.scope!==scope)&&!focusRevision||!open||readOnly)return
        const frame=requestAnimationFrame(()=>{if(source.isCurrent())composer.current?.querySelector('textarea')?.focus()})
        return()=>cancelAnimationFrame(frame)
    },[focusComposer,focusRevision,scope,source,open,readOnly])
    const { assistant, draft } = model
    const preset = activeAssistantPreset(draft)
    const [effective, setEffective] = useState<EffectiveLlmProfile | null>(null)
    const fitted = effective ? profileAssistantLimits(effective.roles.primary.settings) : null
    // The server rejects a reserve below the profile's output limit; offer the fitted budget instead.
    const reserveShort = Boolean(fitted && Number(draft.settings.limits.outputTokens) < Number(fitted.outputTokens))
    const streaming = assistant.status === 'streaming'
    const retained = model.journals.items.filter(record => record.storageKey !== model.record.storageKey && (record.write.message.length || record.write.pending || record.write.creation && !record.write.conversationId))
    const download = () => downloadBlob(new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' }), safeFilename(draft.title || 'assistant-draft') + '.json')
    return <Drawer open={open} onClose={onClose} title={text('title')} icon={<Icon icon={MessageSquareText} />} size="2xl" footer={<div className="flex min-w-0 flex-wrap gap-2">
        <Button variant="ghost" onClick={onClose}>{t('common.close')}</Button>
        <Button variant="secondary" disabled={model.busy || !model.valid || Boolean(draft.pending) || readOnly || assistant.unavailable} onClick={() => void model.prepare()}>{text(model.working ? 'preparing' : 'prepare')}</Button>
        <Button disabled={!model.reviewCurrent || model.busy || readOnly || assistant.unavailable} onClick={() => void model.sendReviewed()}>{text('send')}</Button>
    </div>}>
        <div className="space-y-4">
            <p className="text-body text-parchment-200">{text('help')}</p>
            {readOnly && <Callout tone="info">{text('readOnly')}</Callout>}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge tone="neutral">{assistant.activeConversation?.title || draft.title || text('draftFallback')}</Badge>
                <div className="flex items-center gap-2"><Button variant="secondary" size="sm" disabled={model.busy} onClick={model.newDraft}>{text('newDraft')}</Button><ConversationMenu conversations={assistant.conversations} activeId={assistant.activeConversation?.conversation_id ?? null} disabled={model.busy} onSelect={id => void model.selectConversation(id)} onNew={model.newDraft} onDelete={readOnly || draft.pending ? undefined : id => void assistant.deleteConversation(id)} /></div>
            </div>
            {!draft.conversationId && <Field label={text('draftTitle')} helper={text('draftTitleHelp')}><Input maxLength={255} value={draft.creation?.title ?? draft.title} disabled={Boolean(draft.creation) || readOnly} onChange={event => model.save({ title: event.target.value })} /></Field>}
            {profileControl ?? <LlmFeatureControl feature="novel_assistant" disabled={model.busy || readOnly || Boolean(draft.pending)} selection={draft.selection} onSelectionChange={selection => model.save({ selection })} onEffectiveChange={setEffective} />}
            {reserveShort && fitted && <Callout tone="warning" role="status"><span>{t('novelEditor.assistant.reserveShort', { tokens: Number(fitted.outputTokens).toLocaleString() })}</span>
                <Button variant="secondary" size="sm" className="mt-2" disabled={model.busy || readOnly || Boolean(draft.pending)}
                    onClick={() => model.save({ settings: { ...draft.settings, limits: { ...draft.settings.limits, ...fitted } } })}>{text('useProfileLimits')}</Button></Callout>}
            <div className="flex max-h-96 min-h-48 flex-col rounded-lg border border-line bg-ink-800"><AssistantMessageList turns={assistant.turns} status={assistant.status} suggestions={[]} onSuggestion={message => model.save({ message })} conversationKey={assistant.activeConversation?.conversation_id ?? null} emptyTitle={text('emptyTitle')} emptyDescription={text('emptyDescription')} /></div>
            {assistant.unavailable && <AssistantBanner notice={{ kind: 'info', message: t('creation.common.assistant.notices.unavailable') }} />}
            {assistant.notice && !(draft.pending?.stopRequested || draft.pending?.terminal || !draft.pending && draft.outcome) && <AssistantBanner notice={assistant.notice} onReload={() => void assistant.reloadConversation({ currentHead: true })} onDismiss={assistant.clearNotice} />}
            {model.notice && <Callout tone="info" role="status">{model.notice}</Callout>}
            {draft.refinement&&<NovelRefinementSummary value={draft.refinement} disabled={model.busy||Boolean(draft.pending)||readOnly} onClear={()=>{model.save({refinement:null});focusDraft()}} />}
            {!draft.refinement && <NovelAssistantActions value={draft.settings} message={draft.message} disabled={model.busy || readOnly || assistant.unavailable || Boolean(draft.pending)} onChange={(settings, message) => model.save({ settings, message })} />}
            <div ref={composer}><AssistantComposer value={draft.message} onValueChange={message => model.save({ message })} clearOnSubmit={false} submitLabel={text('review')} submitIcon={<Eye size={18} strokeWidth={1.75} />} streaming={streaming} disabled={model.busy || readOnly || assistant.unavailable || Boolean(draft.pending)} placeholder={text('question')} onSend={() => void model.prepare()} onStop={() => void model.stop()} /></div>
            {preset ? <NovelPresetProvenance value={preset} /> : draft.preset && <p className="text-caption text-parchment-400">{t('novelEditor.assistantPresets.edited', { name: draft.preset.name })}</p>}
            <p className="text-caption text-parchment-300" role="status">{text(model.record.storageFailed ? 'storageFailed' : 'draftSaved')}</p>
            {model.record.storageFailed && <div className="flex flex-wrap gap-2"><Button variant="secondary" size="sm" onClick={download}>{text('downloadDraft')}</Button><Button variant="secondary" size="sm" onClick={()=>model.preserve()}>{text('retryStorage')}</Button></div>}
            <NovelAssistantRequestState pending={draft.pending} outcome={draft.outcome} live={streaming} busy={model.busy} stopping={model.stopping}
                canResume={!readOnly && assistant.activeConversation?.conversation_id === draft.pending?.conversationId}
                canStop={!model.working && assistant.status !== 'switching'} onStop={() => void model.stop()} onCheck={() => void model.checkResult()} onResume={() => void model.resume()} />
            {assistant.activeConversation?.active_request_id && !draft.pending && <Callout tone="info" role="status"><p>{text('activeElsewhere')}</p>
                {draft.conversationId === assistant.activeConversation.conversation_id && <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" disabled={model.busy} onClick={() => void model.checkActive()}>{text('checkResult')}</Button>
                    <Button variant="secondary" size="sm" disabled={model.busy} onClick={() => void model.stopActive()}>{text('stopRequest')}</Button></div>}</Callout>}
            <details><summary className="mb-3 cursor-pointer text-label">{text('sources')}</summary><Callout tone="info" className="mb-3">{t('novelEditor.assistantContext.savedOnly')}</Callout><NovelAssistantSourceFields value={draft.settings} story={story} disabled={model.busy || readOnly || Boolean(draft.pending)} onChange={settings => model.save({ settings })} /></details>
            <NovelAssistantPreferences api={preferencesApi} disabled={readOnly} />
            <NovelAssistantPresets api={presetsApi} disabled={readOnly} settings={draft.settings} selection={draft.selection} activePresetId={preset?.id ?? null}
                useDisabled={model.busy || Boolean(draft.pending) || assistant.unavailable || Boolean(draft.refinement) || Boolean(assistant.activeConversation?.active_request_id)}
                onUse={(value, values, replace) => { const result = model.applyPreset(value, values, replace); if (result === 'applied') focusDraft(); return result }} />
            {model.review && !model.reviewSent && <NovelAssistantTurnReview preview={model.review} story={story} current={model.reviewCurrent} />}
            <NovelAssistantEvidence turns={assistant.turns} story={story} source={source} readOnly={readOnly} onReviewSuggestion={onReviewSuggestion} onAuthorVersions={onAuthorVersions} facts={facts} tasks={tasks} structure={structure} summaries={summaries} outline={outline} copy={copy} referenceLabels={referenceLabels} together={together}
                refineDisabled={model.busy||Boolean(draft.pending)||Boolean(assistant.activeConversation?.active_request_id)}
                onRefineSuggestion={async(record,signal)=>{const ready=await model.refine(record,signal);if(ready)focusDraft();return ready}}
                onDraftStep={readOnly?undefined:step=>{const ready=model.draftStep(step.sceneId,step.instruction,step.number);if(ready)focusDraft();return ready}} />
            {retained.length > 0 && <details><summary className="mb-3 cursor-pointer text-label">{text('retained')} · {retained.length}</summary><div className="space-y-3">{retained.map(record => <Card key={record.storageKey ?? record.write.id} className="space-y-2 p-3"><p className="text-label">{record.write.title || text('draftFallback')}</p><p className="line-clamp-3 whitespace-pre-wrap break-words text-body text-parchment-200">{record.write.message}</p>{record.write.pending && <Badge tone="arcane">{text('pending')}</Badge>}<div className="flex flex-wrap gap-2"><Button variant="secondary" size="sm" disabled={model.busy} onClick={() => void model.recover(record)}>{text('recover')}</Button><Button variant="danger-ghost" size="sm" disabled={model.busy || !canRetireAssistantDraft(record.write, draft.outcome)} onClick={() => { const key = record.storageKey ?? record.write.id; if (discarding === key) { model.journals.remove(record, draft.outcome); setDiscarding(null) } else setDiscarding(key) }}>{text(discarding === (record.storageKey ?? record.write.id) ? 'discardConfirm' : 'discard')}</Button></div></Card>)}</div></details>}
        </div>
    </Drawer>
}
