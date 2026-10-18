import { useMemo, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { AssistantChatMessage, AssistantConversation } from '@/shared/types/assistant.types'
import type { StoryStudioIndex } from '@/shared/types/storyStudio.types'
import type { NovelAssistantRecord, NovelAssistantTurnPreview } from '@/shared/types/storyAssistant.types'
import { LlmFeatureControlView } from '@/features/llmProfiles/LlmFeatureControlView'
import { Button } from '@/ui/primitives'
import {novelAssistantReviewFixture} from '@/test/fixtures/novelAssistantReview'
import {sceneRevision} from '@/test/fixtures/storyRevisions'
import { canonicalJson } from '@/utils/json'
import wire from '@/test/fixtures/novelAssistantTurn.json'
import refined from '@/test/fixtures/novelAssistantRefinement.json'
import { newAssistantDraft, assistantSourceOptions, type NovelAssistantDraft } from '../persistence/assistantDraftJournal'
import type { useNovelAssistant } from '../hooks/useNovelAssistant'
import type { NovelAssistantSource } from '../hooks/useNovelAssistantSource'
import { NovelAssistantDrawerView } from './NovelAssistantDrawer'
import {NovelGenerationHistoryDrawer} from './NovelGenerationHistoryDrawer'
import {readGenerationRefinement,type NovelGenerationRefinement} from '../hooks/novelRefinementTarget'

const index = wire.index as unknown as StoryStudioIndex
const preview = wire.preview as unknown as NovelAssistantTurnPreview
function initial(refining=false): NovelAssistantDraft {
    const active=refining?refined.preview as unknown as NovelAssistantTurnPreview:preview
    const { sourceVersion, message, limits, ...settings } = active.context.request
    void sourceVersion
    return { ...newAssistantDraft(index.id, settings.anchorSceneId, settings.selection), title: 'The unopened letter', conversationId: 7, message,...(refining?{refinement:active.refinement}:{}),
        settings: { ...settings, limits: Object.fromEntries(Object.entries(limits).map(([key, value]) => [key, String(value)])) as NovelAssistantDraft['settings']['limits'] } }
}
/** Controlled fictional replies only. These examples never call an API, provider or credential vault. */
function StudioAssistantDemo({ interrupted = false, savedReply = false,refinedPrompt=false,historyHandoff=false }: { interrupted?: boolean; savedReply?: boolean;refinedPrompt?:boolean;historyHandoff?:boolean }) {
    const [open, setOpen] = useState(!historyHandoff), [draft, setDraft] = useState(()=>initial(refinedPrompt)), [reviewed, setReviewed] = useState(true)
    const [historyOpen,setHistoryOpen]=useState(historyHandoff),[focusRevision,setFocusRevision]=useState(0)
    const fixture=useMemo(()=>novelAssistantReviewFixture(),[])
    const activePreview=draft.refinement?refined.preview as unknown as NovelAssistantTurnPreview:preview
    const [notice, setNotice] = useState<string | null>(null)
    const record = useMemo(() => structuredClone(wire.records.suggest) as unknown as NovelAssistantRecord, [])
    const conversation: AssistantConversation = { kind: 'novel', story_id: index.id, conversation_id: 7, conversation_version: 0, title: 'The unopened letter' }
    const reply: AssistantChatMessage = { message_id: 11, conversation_id: 7, sequence_no: 2, role: 'assistant', status: 'completed', content: record.result.answer, metadata: { request_id: 'fictional-turn', novel: record } }
    const matches = canonicalJson(assistantSourceOptions(draft.settings, draft.message)) === canonicalJson((({ sourceVersion, ...options }) => { void sourceVersion; return options })(activePreview.context.request))
    const current = reviewed && matches
    const source: NovelAssistantSource = useMemo(() => ({ key: 'fictional-studio', storyId: index.id, isCurrent: () => true, prepare: async () => preview.context, preview: async () => preview,
        refinement:async()=>structuredClone(refined.parent) as unknown as NonNullable<NovelAssistantRecord['refinement']>,
        refinementForVariant:async()=>{throw new Error('Authored-source refinement is covered by its own example.')},
        readRefinementSource:async()=>structuredClone(refined.parent) as unknown as NonNullable<NovelAssistantRecord['refinement']>,
        refinementForGeneration:(generation,signal,selection)=>readGenerationRefinement({storyId:index.id,isCurrent:()=>true,api:{
            getStoryRefinementParent:async()=>structuredClone(refined.parent) as unknown as NonNullable<NovelAssistantRecord['refinement']>,
            getStoryGenerationHistoryDetail:async()=>structuredClone(fixture.detail),
            getStoryRevision:async()=>sceneRevision({document:fixture.scene.document,storyId:index.id,sceneId:fixture.scene.id,revision:1,parentRevision:null,contentHash:fixture.scene.contentHash})}},generation,signal,selection),
        getTurn: async () => null, turnState: async () => { throw new Error('This preview sends no requests.') }, stopTurn: async () => { throw new Error('This preview sends no requests.') }, stash: async () => undefined, sceneDocument: async () => { throw new Error('This preview sends no requests.') }, acceptTogether: async () => { throw new Error('This preview sends no requests.') }, recoverTogether: async () => null, undoTogether: async () => { throw new Error('This preview sends no requests.') }, reviewCandidate: async () => ({ index, detail: await source.generation(record.result.proposal!.id) }), generation: async () => ({ schemaVersion: 1 as const, storyId: index.id, chapterTitle: 'Opening', sceneTitle: 'The letter', location: 'active' as const, generation: { id: record.result.proposal!.id, storyId: index.id, sceneId: record.result.proposal!.sceneId, chapterId: record.result.proposal!.chapterId, command: 'rewrite' as const, status: 'candidate' as const, baseRevision: record.result.proposal!.baseRevision, inputRange: null, contextTrace: { cards: [], loreEntries: [], scenes: [], structureRevision: record.context.packet.novel.structureRevision, novelMetadataRevision: record.context.packet.novel.metadataRevision, contextRevision: record.context.packet.novel.contextRevision, totalEstimatedTokens: 0 }, output: record.result.proposal!.markdown, instruction:record.result.proposal!.instruction,promptSummary: 'A restrained letter' } }) }),[record,fixture])
    const [stopRequested,setStopRequested]=useState(false),[usageChecked,setUsageChecked]=useState(false)
    const save = (change: Partial<NovelAssistantDraft>) => { setDraft(value => ({ ...value, ...change, sequence: value.sequence + 1 })); return null }
    const noop = () => {}, done = async () => {}
    const chooseRefinement=(target:NovelGenerationRefinement)=>{
        setDraft(value=>({...value,sequence:value.sequence+1,refinement:target.refinement,
            settings:{...value.settings,task:'suggest',scope:target.selection?'selection':'scene',selection:target.selection,sceneIds:[],anchorSceneId:target.refinement.parent.sceneId}}))
        setReviewed(false);setNotice('Prior suggestion selected. Your unsent instruction is retained. Review the current sources and target before sending.')
        return true
    }
    const pendingDraft = interrupted ? { ...draft, pending: { requestId: 'fictional-original-request', draftSequence: 1, conversationId: 7,
        body: { kind: 'novel' as const, message: preview.context.request.message, source: preview.context.request, expected_packet_hash: preview.context.packetHash, expected_prompt_hash: preview.promptHash, expected_conversation_version: 0 },
        llm: { selection: { mode: 'inherit' as const }, expected_revision_id: preview.profile.revision_id } } } : draft
    const stopped = { status: 'cancelled' as const, request_id: 'fictional-original-request', execution_id: '00000000-0000-4000-8000-000000000001', recovery_required: false as const,
        control: { stop_requested: true, executor_stopped: true, settlement: usageChecked ? 'used' as const : 'pending' as const,
            usage: usageChecked ? { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 } : null, usage_complete: usageChecked } }
    const activeDraft:NovelAssistantDraft = stopRequested && pendingDraft.pending ? { ...pendingDraft,
        pending: usageChecked ? null : { ...pendingDraft.pending, stopRequested: true, terminal: stopped },
        ...(usageChecked ? { outcome: { conversationId: 7, result: stopped } } : {}) } : pendingDraft
    const model: ReturnType<typeof useNovelAssistant> = {
        draft: activeDraft, record: { schema: 1, write: activeDraft },
        assistant: { open, openPanel: noop, closePanel: noop, ready: true, unavailable: false, recheck: noop, status: 'idle', conversations: [conversation], activeConversation: conversation,
            turns: savedReply ? [{ message: reply, appliedChanges: [], isStreaming: false, isInterrupted: false }] : [], notice: null, pendingTarget: null,
            applyPendingTarget: noop, dismissPendingTarget: noop, send: done, prepareConversation: async () => conversation, resumeRetainedTurn: done, stop: noop, retry: noop, newConversation: noop,
            selectConversation: done, deleteConversation: done, reloadConversation: async () => true, clearNotice: noop },
        journals: { items: [], owns: () => true, save: () => null, remove: noop }, save,preserve:()=>true, recover: done, newDraft: () => { setDraft(initial()); setReviewed(false) }, selectConversation: done,
        prepare: async () => { if (matches) setReviewed(true); else setNotice('This fictional example supports its original compiled question and source choices. It makes no model request.') },
        sendReviewed: async () => setNotice('Controlled example: no request was sent. The reviewed sources and your question remain available.'), checkResult: async()=>{if(stopRequested)setUsageChecked(true)}, resume: done, stop: async()=>setStopRequested(true), checkActive: done, stopActive: done, stopping: false,
        refineGeneration:async(generation,signal,selection)=>chooseRefinement(await source.refinementForGeneration(generation,signal,selection)),
        refineVariant:async()=>false,draftStep:()=>false,refreshSummaries:()=>false,applyPreset:()=>'blocked' as const,
        refine:async()=>chooseRefinement({refinement:structuredClone(refined.parent) as unknown as NonNullable<NovelAssistantRecord['refinement']>,selection:null}),
        review: activePreview, reviewCurrent: current && !interrupted, reviewSent: false, valid: true, busy: false, working: false, notice, close: () => setOpen(false),
    }
    return <>
        <Button onClick={() => setOpen(true)}>Open writing assistant</Button>
        {historyHandoff&&<><Button variant="secondary" onClick={()=>setHistoryOpen(true)}>Open generation history</Button>
            <NovelGenerationHistoryDrawer open={historyOpen} onClose={()=>setHistoryOpen(false)} scopeKey="fictional-history" generations={[{...fixture.detail.generation,chapterTitle:fixture.detail.chapterTitle}]}
                onRefine={async(generation,signal)=>{const ready=await model.refineGeneration(generation,signal);if(ready&&!signal.aborted){setHistoryOpen(false);setOpen(true);setFocusRevision(value=>value+1)}return ready}}/></>}
        <NovelAssistantDrawerView open={open} onClose={() => setOpen(false)} source={source} story={index} readOnly={false} model={model} focusRevision={focusRevision}
            profileControl={<LlmFeatureControlView feature="novel_assistant" selection={{ mode: 'inherit' }} effective={{ ...preview.profile, project_hash: 'fictional-project' }} editable={false} onOpen={noop} onSelect={noop} onMore={noop} onRefresh={noop} onForget={noop} />} />
    </>
}
const meta = { title: 'Novel/Writing assistant', component: StudioAssistantDemo, tags: ['autodocs'], parameters: { layout: 'fullscreen', docs: { description: { component: 'Novel-bound conversations, retained composer input, exact profile/history/source inspection, and separate evidence/proposal review. These controlled fictional examples use Python-compiled packets and make no API, provider or credential request. The prepared feature remains uninstalled.' } } }, args: { interrupted: false, savedReply: false } } satisfies Meta<typeof StudioAssistantDemo>
export default meta
type Story = StoryObj<typeof meta>
export const ReviewedPrompt: Story = {}
export const InterruptedRequest: Story = { args: { interrupted: true } }
export const SavedSuggestion: Story = { args: { savedReply: true } }
export const RefinementPrompt:Story={args:{refinedPrompt:true,savedReply:true}}
export const InlineHistoryRefinement:Story={args:{historyHandoff:true}}

export const StopRecovery: Story = { args: { interrupted: true } }
