import { beforeEach, expect, it } from 'vitest'
import { novelMutationKey, retireNovelMutation, writeNovelMutation } from '@/shared/novelMutationJournal'
import { ASSISTANT_DRAFT_DOMAIN, assistantSourceOptions, isNovelAssistantDraft, listAssistantDrafts, newAssistantDraft, profileAssistantLimits } from './assistantDraftJournal'
import { isAssistantContextRequest } from '@/infrastructure/api/storyAssistantContextContract'
import refined from '@/test/fixtures/novelAssistantRefinement.json'

beforeEach(() => localStorage.clear())
const scope = { userHash: 'author', workspaceId: 'workspace', storyId: 'book' }

it('retains unfinished questions and budgets while rejecting credentials or runtime graphs', () => {
    const draft = newAssistantDraft('book', 'scene', null)
    draft.message = '  A question I have not sent\n'
    draft.settings.limits.contextWindow = ''
    expect(isNovelAssistantDraft(draft)).toBe(true)
    expect(isNovelAssistantDraft({ ...draft, credentials: { api_key: 'never-store-this' } })).toBe(false)
    expect(isNovelAssistantDraft({ ...draft, selection: { mode: 'inherit', credentials: 'never' } })).toBe(false)
    expect(isNovelAssistantDraft({ ...draft, settings: { ...draft.settings, payload: { agt: {} } } })).toBe(false)
    expect(assistantSourceOptions(draft.settings, draft.message).message).toBe('A question I have not sent')
})

it('keeps writers and book/account/workspace scopes separate and retires only exact content', () => {
    const first = newAssistantDraft('book', 'scene', null)
    first.message = 'My question'
    const second = { ...structuredClone(first), message: 'Another tab’s question', sequence: 1 }
    const keyA = novelMutationKey(ASSISTANT_DRAFT_DOMAIN, scope, first.id, 'writer-a')!
    const keyB = novelMutationKey(ASSISTANT_DRAFT_DOMAIN, scope, first.id, 'writer-b')!
    writeNovelMutation(keyA, first)
    writeNovelMutation(keyB, second)
    expect(listAssistantDrafts(scope)).toHaveLength(2)
    expect(listAssistantDrafts({ ...scope, userHash: 'someone-else' })).toEqual([])
    expect(listAssistantDrafts({ ...scope, workspaceId: 'another-workspace' })).toEqual([])
    const old = listAssistantDrafts(scope).find(record => record.storageKey === keyA)!
    writeNovelMutation(keyA, { ...first, message: 'A newer question', sequence: 2 })
    retireNovelMutation(old, null)
    expect(listAssistantDrafts(scope).map(record => record.write.message)).toContain('A newer question')
    expect(JSON.parse(localStorage.getItem(keyB)!).write.message).toBe(second.message)
})

it('requires pending turns to retain their exact identity, source guards and public profile choice', () => {
    const draft = newAssistantDraft('book', 'scene', null)
    draft.conversationId = 7
    const body = { kind: 'novel', message: 'Question', source: { ...assistantSourceOptions(draft.settings, 'Question'), sourceVersion: 'a'.repeat(64) },
        expected_packet_hash: 'b'.repeat(64), expected_prompt_hash: 'c'.repeat(64), expected_conversation_version: 0 }
    const pending = { requestId: 'request-1', draftSequence: 1, conversationId: 7, body, llm: { selection: { mode: 'inherit' }, expected_revision_id: 'revision-1' } }
    expect(isNovelAssistantDraft({ ...draft, pending })).toBe(true)
    expect(isNovelAssistantDraft({ ...draft, pending: { ...pending, conversationId: 8 } })).toBe(false)
    expect(isNovelAssistantDraft({ ...draft, pending: { ...pending, llm: { ...pending.llm, credentials: { api_key: 'never' } } } })).toBe(false)
    expect(isNovelAssistantDraft({ ...draft, pending: { ...pending, body: { ...body, expected_conversation_version: -1 } } })).toBe(false)
})

it('retains the exact bounded refinement parent across device reload while rejecting added authority',()=>{
    const parent=structuredClone(refined.parent),draft={...newAssistantDraft(parent.parent.storyId,parent.parent.sceneId,null),refinement:parent,message:'Refine the retained writing.'}
    const owner={...scope,storyId:parent.parent.storyId}
    const key=novelMutationKey(ASSISTANT_DRAFT_DOMAIN,owner,draft.id,'writer-refine')!
    writeNovelMutation(key,draft)
    expect(listAssistantDrafts(owner)[0].write).toEqual(draft)
    expect(isNovelAssistantDraft({...draft,refinement:{...parent,parent:{...parent.parent,storyId:'foreign-book'}}})).toBe(false)
    expect(isNovelAssistantDraft({...draft,refinement:{...parent,credentials:{api_key:'never-store'}}})).toBe(false)
})

it('retains Stop intent and terminal uncertainty through reload without credentials or added authority',()=>{
    const draft=newAssistantDraft('book','scene',null);draft.conversationId=7
    const pending={requestId:'request-stop',draftSequence:1,conversationId:7,
        body:{kind:'novel',message:'Question',source:{...assistantSourceOptions(draft.settings,'Question'),sourceVersion:'a'.repeat(64)},
            expected_packet_hash:'b'.repeat(64),expected_prompt_hash:'c'.repeat(64),expected_conversation_version:0},
        llm:{selection:{mode:'inherit'},expected_revision_id:'revision-1'},stopRequested:true,
        terminal:{status:'cancelled',request_id:'request-stop',execution_id:'00000000-0000-4000-8000-000000000001',recovery_required:false,
            control:{stop_requested:true,executor_stopped:false,settlement:'pending',usage:null,usage_complete:false}}}
    const value={...draft,pending}
    expect(isNovelAssistantDraft(value)).toBe(true)
    const key=novelMutationKey(ASSISTANT_DRAFT_DOMAIN,scope,draft.id,'stop-writer')!
    writeNovelMutation(key,value)
    expect(listAssistantDrafts(scope)[0].write.pending).toEqual(pending)
    expect(isNovelAssistantDraft({...value,pending:{...pending,stopRequested:false}})).toBe(false)
    expect(isNovelAssistantDraft({...value,pending:{...pending,stopRequested:null}})).toBe(false)
    expect(isNovelAssistantDraft({...value,pending:{...pending,terminal:{...pending.terminal,request_id:'another'}}})).toBe(false)
    expect(isNovelAssistantDraft({...value,pending:{...pending,terminal:{...pending.terminal,credentials:{api_key:'never'}}}})).toBe(false)
    expect(isNovelAssistantDraft({...draft,outcome:{conversationId:8,result:pending.terminal}})).toBe(false)
})

it('defaults to a budget that reserves the default profile output and fits the server bounds', () => {
    const draft = newAssistantDraft('book', 'scene', null)
    expect(draft.settings.limits).toMatchObject({ contextWindow: '200000', outputTokens: '16384' })
    expect(isAssistantContextRequest({ ...assistantSourceOptions(draft.settings, 'Who wrote the letter?'), sourceVersion: '0'.repeat(64) })).toBe(true)
})

it('fits the reserve to the profile output limit and keeps the window within server bounds', () => {
    expect(profileAssistantLimits({ max_input_tokens: 200_000, max_output_tokens: 16_384 })).toEqual({ contextWindow: '216384', outputTokens: '16384' })
    expect(profileAssistantLimits({ max_input_tokens: 1_000_000, max_output_tokens: 32_768 })).toEqual({ contextWindow: '262144', outputTokens: '32768' })
    expect(profileAssistantLimits({ max_input_tokens: 0, max_output_tokens: 512 })).toEqual({ contextWindow: '1536', outputTokens: '512' })
    // An output limit the server cannot reserve has no fitted budget.
    expect(profileAssistantLimits({ max_input_tokens: 200_000, max_output_tokens: 131_072 })).toBeNull()
    expect(profileAssistantLimits({ max_input_tokens: 200_000, max_output_tokens: 0 })).toBeNull()
    const fitted = profileAssistantLimits({ max_input_tokens: 1_000_000, max_output_tokens: 65_536 })!
    const draft = newAssistantDraft('book', 'scene', null)
    expect(isAssistantContextRequest({ ...assistantSourceOptions({ ...draft.settings, limits: { ...draft.settings.limits, ...fitted } }, 'Q'), sourceVersion: '0'.repeat(64) })).toBe(true)
})
