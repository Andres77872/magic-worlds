import type { AssistantTurnRequest } from '@/shared/types/assistant.types'
import type { LlmSelection } from '@/shared/types/llm.types'
import type { StoryAnnotationSelection } from '@/shared/types/storyAnnotation.types'
import type { StoryAssistantActionKind,StoryAssistantContextOptions,NovelRefinementSource,NovelPresetSnapshot } from '@/shared/types/storyAssistant.types'
import { isPresetReference,isPresetSnapshot,isPresetSnapshotRecord } from '@/infrastructure/api/storyAssistantPresetContract'
import { isNovelRefinementReference } from '@/infrastructure/api/novelRefinementContract'
import { verifyNovelRefinementSource } from '@/infrastructure/api/variantRefinementContract'
import { isAnnotationSelection } from '@/infrastructure/api/storyAnnotationContract'
import { ASSISTANT_ACTION_TASKS, isAssistantAction, isAssistantContextRequest } from '@/infrastructure/api/storyAssistantContextContract'
import { isRecord, listNovelMutations, type NovelJournalRecord } from '@/shared/novelMutationJournal'
import { makeRequestId } from '@/utils/uuid'
import type { NovelAssistantTerminalState, NovelAssistantCompletedSummary } from '@/shared/types/novelAssistantControl.types'
import { isNovelAssistantTerminal, isNovelAssistantCompletedSummary, novelAssistantControlSettled } from '@/infrastructure/api/novelAssistantControlContract'

export interface AssistantSourceSettings extends Omit<StoryAssistantContextOptions, 'message' | 'limits'> {
    limits: Record<keyof StoryAssistantContextOptions['limits'], string>
}
/** Only public selection intent and bounded source choices belong in device drafts. */
export interface NovelAssistantPendingTurn {
    stopRequested?: true
    terminal?: NovelAssistantTerminalState
    requestId: string
    draftSequence: number
    conversationId: number
    body: AssistantTurnRequest<'novel'>
    llm: { selection: LlmSelection; expected_revision_id: string }
}
export interface NovelAssistantDraft {
    outcome?: { conversationId: number; result: NovelAssistantTerminalState | NovelAssistantCompletedSummary } | null
    refinement?:NovelRefinementSource|null
    /** The preset version the message was filled from (A19); it travels with the turn only while the message and task are unchanged. */
    preset?:NovelPresetSnapshot|null
    storyId: string
    id: string
    sequence: number
    conversationId: number | null
    title: string
    message: string
    settings: AssistantSourceSettings
    selection: LlmSelection
    /** The title and identity freeze before the first create, including uncertain results. */
    creation: { requestId: string; title: string } | null
    pending: NovelAssistantPendingTurn | null
}
export const ASSISTANT_DRAFT_DOMAIN = 'assistant-draft'
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(key => key in v)
const id = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9._:-]{1,64}$/.test(v)
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v)
const positiveId = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) > 0
const title = (v: unknown): v is string => typeof v === 'string' && Array.from(v).length <= 255
export function isAssistantProfileSelection(v: unknown): v is LlmSelection {
    return isRecord(v) && (v.mode === 'inherit' ? exact(v, ['mode']) : v.mode === 'profile' && exact(v, ['mode', 'profile_id']) && id(v.profile_id))
}
export function assistantSourceOptions(settings: AssistantSourceSettings, message: string): StoryAssistantContextOptions {
    const action = settings.action
    return { ...structuredClone(settings), message: message.trim(),
        ...(action ? { action: action.kind === 'dialogue' ? { ...action, speaker: action.speaker.trim() } : action.kind === 'translate' ? { ...action, language: action.language.trim() } : structuredClone(action) } : {}),
        selection: settings.scope === 'selection' ? settings.selection : null,
        sceneIds: settings.scope === 'scenes' ? [...new Set([settings.anchorSceneId, ...settings.sceneIds])] : [],
        limits: { contextWindow: Number(settings.limits.contextWindow), outputTokens: Number(settings.limits.outputTokens), maxSources: Number(settings.limits.maxSources), maxPassages: Number(settings.limits.maxPassages) } }
}
/** The draft's preset while its message and task are still exactly what the preset filled in; otherwise the message is the author's own. */
export function activeAssistantPreset(draft: Pick<NovelAssistantDraft, 'preset' | 'settings' | 'message'>): NovelPresetSnapshot | null {
    return draft.preset && isPresetSnapshot(draft.preset, assistantSourceOptions(draft.settings, draft.message)) ? draft.preset : null
}
/** Flows that set their own task (refinement, plan steps) leave any chosen action behind. */
export function withoutAction(settings: AssistantSourceSettings): AssistantSourceSettings {
    const next = { ...settings }
    delete next.action
    return next
}
// The server bounds (AssistantContextLimits) and the profile default output limit (16,384).
const MAX_CONTEXT_WINDOW = 262_144, MAX_RESERVED_OUTPUT = 65_536
export function initialAssistantSettings(anchorSceneId: string, selection: StoryAnnotationSelection | null): AssistantSourceSettings {
    return { anchorSceneId, selection, scope: selection ? 'selection' : 'scene', sceneIds: [], task: 'ask', revealPolicy: 'through_anchor', includeArchived: false, includeCodex: true,
        limits: { contextWindow: '200000', outputTokens: '16384', maxSources: '6', maxPassages: '24' } }
}
/** A turn must reserve the profile's whole output limit; the window adds the profile's input limit. */
export function profileAssistantLimits(settings: { max_input_tokens: number; max_output_tokens: number }): { contextWindow: string; outputTokens: string } | null {
    const output = settings.max_output_tokens
    if (!Number.isSafeInteger(output) || output < 1 || output > MAX_RESERVED_OUTPUT) return null
    const window = Math.min(MAX_CONTEXT_WINDOW, output + Math.max(1024, settings.max_input_tokens))
    return window > output ? { contextWindow: String(window), outputTokens: String(output) } : null
}
export function newAssistantDraft(storyId: string, anchorSceneId: string, selection: StoryAnnotationSelection | null): NovelAssistantDraft {
    return { storyId, id: makeRequestId('novel-draft'), sequence: 0, conversationId: null, title: '', message: '',
        settings: initialAssistantSettings(anchorSceneId, selection), selection: { mode: 'inherit' }, creation: null, pending: null }
}
/** An action with half-chosen parameters (no change, no focus, a speaker or language still being typed) for the current task. */
function isRecoverableAction(v: unknown, task: unknown): boolean {
    if (!isRecord(v) || typeof v.kind !== 'string' || !Object.prototype.hasOwnProperty.call(ASSISTANT_ACTION_TASKS, v.kind) || ASSISTANT_ACTION_TASKS[v.kind as StoryAssistantActionKind] !== task) return false
    const complete = v.kind === 'transform' && v.pov === null && v.tense === null ? { ...v, pov: 'first' }
        : v.kind === 'line_edit' && Array.isArray(v.focus) && v.focus.length === 0 ? { ...v, focus: ['grammar'] }
            : v.kind === 'dialogue' && typeof v.speaker === 'string' ? { ...v, speaker: v.speaker.trim() || 'Speaker' }
                : v.kind === 'translate' && typeof v.language === 'string' ? { ...v, language: v.language.trim() || 'Language' } : v
    return isAssistantAction(complete)
}
export function isAssistantSourceSettings(v: unknown): v is AssistantSourceSettings {
    if (!isRecord(v) || !exact(v, ['anchorSceneId', 'scope', 'sceneIds', 'selection', 'task', 'revealPolicy', 'includeArchived', 'includeCodex', 'limits', ...('action' in v ? ['action'] : [])])
        || !isRecord(v.limits) || !exact(v.limits, ['contextWindow', 'outputTokens', 'maxSources', 'maxPassages'])
        || !Object.values(v.limits).every(value => typeof value === 'string' && /^\d{0,7}$/.test(value))
        || v.selection !== null && (!isAnnotationSelection(v.selection) || v.selection.sceneId !== v.anchorSceneId || v.selection.quote.length > 20000)) return false
    if ('action' in v && !isRecoverableAction(v.action, v.task)) return false
    // Invalid or half-typed budget fields and action choices remain recoverable, but cannot be prepared.
    const rest: Record<string, unknown> = { ...v }
    delete rest.action
    const probe = { ...rest, sourceVersion: '0'.repeat(64), message: 'Draft',
        selection: v.scope === 'selection' ? v.selection : null,
        sceneIds: v.scope === 'scenes' ? v.sceneIds : [], limits: { contextWindow: 16000, outputTokens: 2000, maxSources: 6, maxPassages: 24 } }
    return Array.isArray(v.sceneIds) && v.sceneIds.length <= 20 && v.sceneIds.every(id) && new Set(v.sceneIds).size === v.sceneIds.length && isAssistantContextRequest(probe)
}
export function isNovelAssistantPending(v: unknown): v is NovelAssistantPendingTurn {
    if (!isRecord(v) || !exact(v, ['requestId', 'draftSequence', 'conversationId', 'body', 'llm', ...('stopRequested' in v ? ['stopRequested'] : []), ...('terminal' in v ? ['terminal'] : [])])
        || 'stopRequested' in v && v.stopRequested !== true
        || 'terminal' in v && (!isNovelAssistantTerminal(v.terminal) || v.terminal.request_id !== v.requestId)
        || !id(v.requestId) || !positiveId(v.conversationId) || !positiveId(v.draftSequence)
        || !isRecord(v.body) || !exact(v.body, ['kind', 'message', 'source', 'expected_packet_hash', 'expected_conversation_version', 'expected_prompt_hash',...['refinement','preset'].filter(k=>k in (v.body as object))])
        || 'preset' in v.body && !isPresetReference(v.body.preset)
        || v.body.kind !== 'novel' || !isAssistantContextRequest(v.body.source) || v.body.message !== v.body.source.message
        || !hash(v.body.expected_packet_hash) || !hash(v.body.expected_prompt_hash)
        || !Number.isSafeInteger(v.body.expected_conversation_version) || Number(v.body.expected_conversation_version) < 0
        || !isRecord(v.llm) || !exact(v.llm, ['selection', 'expected_revision_id']) || !isAssistantProfileSelection(v.llm.selection) || !id(v.llm.expected_revision_id)) return false
    return !('refinement'in v.body)||isNovelRefinementReference(v.body.refinement)&&v.body.source.task==='suggest'
}
export function isNovelAssistantDraft(v: unknown): v is NovelAssistantDraft {
    return isRecord(v) && exact(v, ['storyId', 'id', 'sequence', 'conversationId', 'title', 'message', 'settings', 'selection', 'creation', 'pending',...['refinement','preset','outcome'].filter(k=>k in v)])
        && id(v.storyId) && id(v.id) && Number.isSafeInteger(v.sequence) && Number(v.sequence) >= 0
        && (v.conversationId === null || positiveId(v.conversationId)) && title(v.title) && typeof v.message === 'string' && v.message.length <= 4000
        && isAssistantSourceSettings(v.settings) && isAssistantProfileSelection(v.selection)
        &&(!('refinement'in v)||v.refinement===null||verifyNovelRefinementSource(v.refinement,String(v.storyId)))
        &&(!('preset'in v)||v.preset===null||isPresetSnapshotRecord(v.preset))
        && (v.creation === null || isRecord(v.creation) && exact(v.creation, ['requestId', 'title']) && id(v.creation.requestId) && title(v.creation.title) && Boolean(v.creation.title.trim()))
        && (v.pending === null || isNovelAssistantPending(v.pending) && v.pending.conversationId === v.conversationId)
        && (!('outcome' in v) || v.outcome === null || isRecord(v.outcome) && exact(v.outcome, ['conversationId','result'])
            && positiveId(v.outcome.conversationId) && v.outcome.conversationId === v.conversationId
            && (isNovelAssistantTerminal(v.outcome.result) && novelAssistantControlSettled(v.outcome.result) || isNovelAssistantCompletedSummary(v.outcome.result)))
}
export const listAssistantDrafts = (scope: { userHash: string | null | undefined; workspaceId: string | null | undefined }): NovelJournalRecord<NovelAssistantDraft>[] =>
    listNovelMutations(ASSISTANT_DRAFT_DOMAIN, scope, isNovelAssistantDraft, draft => ({ storyId: draft.storyId, target: draft.id }))

/** A recovered copy can prove the same Stop finished; removal still compares the original writer's exact bytes. */
export function canRetireAssistantDraft(draft: NovelAssistantDraft, outcome?: NovelAssistantDraft['outcome']): boolean {
    const pending = draft.pending
    if (!pending?.stopRequested && !pending?.terminal) return true
    if (!pending || !outcome || outcome.conversationId !== pending.conversationId || outcome.result.request_id !== pending.requestId) return false
    if (pending.terminal && (outcome.result.status !== pending.terminal.status || outcome.result.execution_id !== pending.terminal.execution_id)) return false
    return isNovelAssistantCompletedSummary(outcome.result) || isNovelAssistantTerminal(outcome.result) && novelAssistantControlSettled(outcome.result)
}
