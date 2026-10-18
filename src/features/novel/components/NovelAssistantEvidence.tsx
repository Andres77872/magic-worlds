import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AssistantTurn } from '@/features/creation/common/components/assistant/assistantModel'
import { AssistantMarkdown } from '@/features/creation/common/components/assistant/AssistantMarkdown'
import { verifyNovelAssistantRecord } from '@/infrastructure/api/novelAssistantContract'
import type { NovelAssistantRecord } from '@/shared/types/storyAssistant.types'
import type { StoryOutline, StoryGenerationDetail } from '@/shared/types/storyStudio.types'
import type { StoryGeneration } from '@/shared'
import { Badge, Button, Callout, Card, Modal } from '@/ui/primitives'
import type { NovelAssistantSource } from '../hooks/useNovelAssistantSource'
import { NovelAssistantSources } from './NovelAssistantSources'
import { NovelRefinementSummary } from './NovelRefinementSummary'
import { NovelPresetProvenance } from './NovelPresetProvenance'
import { NovelAssistantFacts } from './NovelAssistantFacts'
import { NovelAssistantIssues } from './NovelAssistantIssues'
import { NovelAssistantNotes } from './NovelAssistantNotes'
import { NovelAssistantPlan, type PlanStepDraft } from './NovelAssistantPlan'
import { NovelAssistantStructure } from './NovelAssistantStructure'
import { NovelAssistantSummaries, type SceneSummaryWriter } from './NovelAssistantSummaries'
import { NovelAssistantWideSummaries } from './NovelAssistantWideSummaries'
import { NovelAssistantCopy, type NovelCopyWriter } from './NovelAssistantCopy'
import { NovelProposalReferences } from './NovelProposalReferences'
import { NovelAssistantSaveAll } from './NovelAssistantSaveAll'
import { NovelAssistantTogether } from './NovelAssistantTogether'
import type { SuggestionsTogether } from '../hooks/useSuggestionsTogether'
import type { BulkScenes } from './NovelBulkScenes'
import type { PlanItems } from '../hooks/usePlanItems'
import {ApiError} from '@/infrastructure/api'

export function NovelAssistantEvidence({ turns, story, source, readOnly, onReviewSuggestion,onRefineSuggestion,onAuthorVersions,refineDisabled=false,facts,tasks,onDraftStep,structure,summaries,outline,copy,referenceLabels=[],together }: {
    turns: AssistantTurn[]; story: StoryOutline; source: NovelAssistantSource; readOnly: boolean
    /** Where proposed facts from a reply are staged for the author's review. */
    facts?: PlanItems<'fact'>
    /** Where continuity issues, critique notes and plan steps from a reply become open tasks. */
    tasks?: PlanItems<'task'>
    /** Puts a plan step in the composer for its scene; true when the composer now holds it. */
    onDraftStep?: (step: PlanStepDraft) => boolean
    /** Applies a reply's proposed outline changes one at a time; absent where the outline cannot change. */
    structure?: BulkScenes
    /** Saves a reply's scene summary as that scene's summary; absent where scene details cannot change. */
    summaries?: SceneSummaryWriter
    /** Opens the outline import with a reply's chapter plan for review; absent where the outline cannot change. */
    outline?: (text: string) => void
    /** Saves a reviewed blurb or synopsis as the novel's description or synopsis; absent where the novel's details cannot change. */
    copy?: NovelCopyWriter
    /** The novel's Codex reference labels, to show which @references a proposal keeps. */
    referenceLabels?: readonly string[]
    /** Accepts the latest suggestion of several scenes as one manuscript change; absent where the manuscript cannot change. */
    together?: SuggestionsTogether
    onReviewSuggestion?: (record: NovelAssistantRecord, signal: AbortSignal) => Promise<boolean>
    onRefineSuggestion?: (record:NovelAssistantRecord,signal:AbortSignal)=>Promise<boolean>
    onAuthorVersions?: (generation:StoryGeneration,startEditing:boolean)=>void
    refineDisabled?:boolean
}) {
    const { t } = useTranslation(), text = (key: string, values?: Record<string, unknown>) => t('novelEditor.assistant.' + key, values)
    const scope = JSON.stringify([source.key, story.id])
    const [selection, setSelected] = useState<{ scope: string; record: NovelAssistantRecord; messageId: number } | null>(null)
    const selected = selection?.scope === scope ? selection.record : null
    const [detail, setDetail] = useState<StoryGenerationDetail | null>(null)
    const [working, setWorking] = useState(false), [failed, setFailed] = useState<'read' | 'review' | 'refine'|'sources' | null>(null)
    const serial = useRef(0), abort = useRef<AbortController | null>(null)
    useEffect(() => () => { serial.current++; abort.current?.abort() }, [source])
    const records = turns.filter(turn => turn.message.role === 'assistant' && turn.message.status === 'completed')
        .flatMap(turn => { const value = turn.message.metadata?.novel; return verifyNovelAssistantRecord(value, story.id) ? [{ id: turn.message.message_id, record: value }] : [] })
    function close() { serial.current++; abort.current?.abort(); setSelected(null); setDetail(null); setFailed(null); setWorking(false) }
    async function inspect(record: NovelAssistantRecord, messageId: number) {
        const owner = ++serial.current, controller = new AbortController()
        abort.current?.abort(); abort.current = controller
        setSelected({ scope, record, messageId }); setDetail(null); setWorking(Boolean(record.result.proposal)); setFailed(null)
        if (!record.result.proposal) return
        try {
            const result = await source.generation(record.result.proposal.id, controller.signal)
            if (source.isCurrent() && serial.current === owner && !controller.signal.aborted) setDetail(result)
        } catch { if (source.isCurrent() && serial.current === owner && !controller.signal.aborted) setFailed('read') }
        finally { if (source.isCurrent() && serial.current === owner) setWorking(false) }
    }
    async function stash() {
        if (!selected?.result.proposal || !detail || readOnly || working || !source.isCurrent()) return
        const owner = serial.current, proposal = selected.result.proposal
        setWorking(true); setFailed(null)
        try { await source.stash(proposal.id); if (source.isCurrent() && serial.current === owner) await inspect(selected, selection!.messageId) }
        catch { if (source.isCurrent() && serial.current === owner) setFailed('read') }
        finally { if (source.isCurrent() && serial.current === owner) setWorking(false) }
    }
    async function review() {
        if (!selected || !detail || !onReviewSuggestion || readOnly || working || !source.isCurrent()) return
        const owner = ++serial.current, controller = new AbortController()
        abort.current?.abort(); abort.current = controller
        setWorking(true); setFailed(null)
        try {
            const staged = await onReviewSuggestion(selected, controller.signal)
            if (source.isCurrent() && serial.current === owner && !controller.signal.aborted) {
                if (staged) close()
                else setFailed('review')
            }
        } catch(error) { if (source.isCurrent() && serial.current === owner && !controller.signal.aborted) setFailed(error instanceof ApiError&&error.code==='STORY_ASSISTANT_SOURCE_CHANGED'?'sources':'review') }
        finally { if (source.isCurrent() && serial.current === owner) setWorking(false) }
    }
    async function refine() {
        if(!selected||!detail||!onRefineSuggestion||refineDisabled||readOnly||working||!source.isCurrent())return
        const owner=++serial.current,controller=new AbortController()
        abort.current?.abort();abort.current=controller;setWorking(true);setFailed(null)
        try {
            const ready=await onRefineSuggestion(selected,controller.signal)
            if(source.isCurrent()&&serial.current===owner&&!controller.signal.aborted){if(ready)close();else setFailed('refine')}
        }catch{if(source.isCurrent()&&serial.current===owner&&!controller.signal.aborted)setFailed('refine')}
        finally{if(source.isCurrent()&&serial.current===owner)setWorking(false)}
    }
    const proposal = selected?.result.proposal
    const action = selected?.context.request.action
    const chapterPlan = Boolean(outline && !readOnly && action?.kind === 'outline' && action.target === 'chapter_plan' && selected?.result.answer.trim())
    // A step counts as drafted once a later reply here suggests writing for its scene from exactly its instruction.
    const drafted = (planMessageId: number, step: PlanStepDraft) => records.some(({ id, record }) => id > planMessageId
        && record.result.proposal?.sceneId === step.sceneId && record.context.request.message.trim() === step.instruction)
    const sceneTitle = (sceneId: string) => story.chapters.flatMap(chapter => chapter.scenes).find(scene => scene.id === sceneId)?.title || null
    const original = proposal ? selected!.context.packet.sources.find(row => row.sceneId === proposal.sceneId)?.passages.map(row => row.quote).join('\n\n') ?? '' : ''
    return <>
        {(records.length > 0 || together?.changeset || together?.failure) && <section aria-label={text('evidence')} className="space-y-3"><h3 className="font-display text-h3">{text('evidence')}</h3><NovelAssistantTogether records={records.map(row => row.record)} story={story} together={together} readOnly={readOnly} />{records.map(({ id, record }) => <Card key={id} className="space-y-2 p-3"><p className="whitespace-pre-wrap text-body">{record.context.request.message}</p><div className="flex flex-wrap items-center gap-2"><Button size="sm" variant="secondary" onClick={() => void inspect(record, id)}>{text(record.result.proposal ? 'readProposal' : 'inspectEvidence')}</Button>{record.result.facts?.length ? <Badge tone="arcane">{text('facts.count', { count: record.result.facts.length })}</Badge> : null}{record.result.issues?.length ? <Badge tone="warning">{text('issues.count', { count: record.result.issues.length })}</Badge> : null}{record.result.notes?.length ? <Badge tone="arcane">{text('notes.count', { count: record.result.notes.length })}</Badge> : null}{record.result.plan ? <Badge tone="ember">{text('plan.count', { count: record.result.plan.steps.length })}</Badge> : null}{record.result.structure?.length ? <Badge tone="arcane">{text('structure.count', { count: record.result.structure.length })}</Badge> : null}</div></Card>)}</section>}
        <Modal open={Boolean(selected)} onClose={close} title={text(proposal ? 'proposal' : 'evidence')} size="lg" footer={selected && proposal ? <div className="w-full space-y-3">
            {working && <p role="status">{t('novelEditor.loading.historyLoading')}</p>}
            {failed && <Callout tone="warning" role="alert">{failed === 'sources'?text('proposalChanged'):failed === 'review' ? text('proposalReviewFailed') : failed==='refine'?text('refineFailed'):t('novelEditor.loading.historyFailed')}</Callout>}
            <div className="flex flex-wrap justify-end gap-2">
                {onAuthorVersions&&detail&&<Button variant="secondary" size="sm" disabled={working} onClick={()=>{onAuthorVersions(detail.generation,false);close()}}>{t('novelEditor.variants.versions')}</Button>}
                {onAuthorVersions&&!readOnly&&detail&&['candidate','stashed'].includes(detail.generation.status)&&<Button variant="secondary" size="sm" disabled={working||refineDisabled} onClick={()=>{onAuthorVersions(detail.generation,true);close()}}>{t('novelEditor.variants.open')}</Button>}
                <Button variant="secondary" size="sm" disabled={working} onClick={() => void inspect(selected, selection!.messageId)}>{t('novelEditor.loading.historyRefresh')}</Button>
                {!readOnly && detail && ['candidate', 'stashed'].includes(detail.generation.status) && <Button variant="secondary" size="sm" disabled={working || detail.generation.status === 'stashed'} onClick={() => void stash()}>{text('stashSuggestion')}</Button>}
                {onRefineSuggestion&&!readOnly&&detail&&detail.location==='active'&&<Button variant="secondary" size="sm" disabled={working||refineDisabled} onClick={()=>void refine()}>{text('refineSuggestion')}</Button>}
                {onReviewSuggestion && !readOnly && detail && ['candidate', 'stashed'].includes(detail.generation.status) && <Button disabled={working} onClick={() => void review()}>{text('readProposal')}</Button>}
            </div>
        </div> : undefined}>
            {selected && <div className="space-y-4">
                {/* The same rendering as the reply in the conversation, so Markdown reads as formatting, not symbols. */}
                <AssistantMarkdown content={selected.result.answer} />
                {chapterPlan && <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="secondary" onClick={() => { const answer = selected.result.answer; close(); outline!(answer) }}>{t('novelEditor.outlineImport.fromReply')}</Button>
                    <span className="text-caption text-parchment-400">{t('novelEditor.outlineImport.fromReplyHelp')}</span>
                </div>}
                <NovelAssistantCopy key={selection!.messageId} record={selected} story={story} writer={copy} readOnly={readOnly} />
                {selected.refinement&&<NovelRefinementSummary value={selected.refinement} />}
                {selected.preset&&<NovelPresetProvenance value={selected.preset} />}
                <section aria-label={text('citations')} className="space-y-3"><h3 className="font-display text-h3">{text('citations')}</h3>{selected.result.citations.map(citation => <Card key={citation.type === 'passage' ? citation.id : citation.referenceId} className="space-y-2 p-3"><p className="break-all font-mono text-caption text-parchment-300">{citation.type === 'passage' ? citation.sceneId + ' · ' + citation.revision : citation.title}</p><blockquote className="whitespace-pre-wrap break-words font-narrative text-body">{citation.type === 'passage' ? citation.quote : citation.text}</blockquote></Card>)}</section>
                <NovelAssistantIssues record={selected} messageId={selection!.messageId} tasks={tasks} readOnly={readOnly} sceneTitle={sceneTitle} />
                <NovelAssistantFacts record={selected} messageId={selection!.messageId} facts={facts} readOnly={readOnly} sceneTitle={sceneTitle} />
                <NovelAssistantNotes record={selected} messageId={selection!.messageId} tasks={tasks} readOnly={readOnly} sceneTitle={sceneTitle} />
                <NovelAssistantPlan record={selected} messageId={selection!.messageId} tasks={tasks} readOnly={readOnly} sceneTitle={sceneTitle}
                    drafted={step => drafted(selection!.messageId, step)} onDraftStep={onDraftStep && (step => { const ready = onDraftStep(step); if (ready) close(); return ready })} />
                <NovelAssistantStructure record={selected} story={story} structure={structure} readOnly={readOnly} sceneTitle={sceneTitle} />
                <NovelAssistantSaveAll record={selected} story={story} writer={summaries} readOnly={readOnly} />
                <NovelAssistantSummaries record={selected} story={story} writer={summaries} readOnly={readOnly} sceneTitle={sceneTitle} />
                <NovelAssistantWideSummaries record={selected} story={story} writer={summaries} readOnly={readOnly} />
                {proposal && <>
                    {detail && <Badge tone={detail.generation.status === 'accepted' ? 'ember' : 'arcane'}>{text('candidateStatus', { status: t('novelEditor.history.status.' + detail.generation.status) })}</Badge>}
                    <NovelProposalReferences original={proposal.operation === 'replace_selection' ? proposal.selection?.quote ?? '' : original} proposed={proposal.markdown} labels={referenceLabels} />
                    <div className="grid gap-4 sm:grid-cols-2"><section><h3 className="mb-2 text-label">{text('original')}</h3><p className="whitespace-pre-wrap break-words font-narrative text-body text-parchment-200">{proposal.operation === 'replace_selection' ? proposal.selection?.quote : original}</p></section><section><h3 className="mb-2 text-label">{text('proposed')}</h3><p className="whitespace-pre-wrap break-words font-narrative text-body text-arcane-300">{proposal.markdown}</p></section></div>
                </>}
                <details><summary className="cursor-pointer text-label">{text('inspectEvidence')}</summary><NovelAssistantSources value={selected.context} story={story} current={false} /></details>
            </div>}
        </Modal>
    </>
}
