import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { setTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { apiService } from './index'
import { authSession } from './authSession'
import { isNovelAssistantTerminal, verifyNovelAssistantTurnState } from './novelAssistantControlContract'
import type { NovelAssistantTerminalState } from '@/shared/types/novelAssistantControl.types'
import { assistantTurnFixture } from '@/test/assistantFixtures'
import wire from '@/test/fixtures/novelAssistantTurn.json'

vi.mock('./baseUrl', () => ({ API_BASE_URL: 'https://api.test.invalid' }))
const executionId='00000000-0000-4000-8000-000000000001'
const requestId='stop-original'
const fetchMock=vi.fn()
const json=(body:unknown)=>new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}})
const result=():NovelAssistantTerminalState=>({status:'cancelled',request_id:requestId,execution_id:executionId,recovery_required:false,
    control:{stop_requested:true,executor_stopped:true,settlement:'pending',usage:null,usage_complete:false}})
const turn=()=>{
    const record=structuredClone(wire.records.ask)
    const value=assistantTurnFixture('novel',requestId,{conversation:{kind:'novel',conversation_id:2,story_id:wire.index.id,conversation_version:1}})
    value.user_message.content=record.context.request.message
    value.assistant_message.content=record.result.answer
    value.assistant_message.metadata={request_id:requestId,usage:null,novel:record}
    value.messages=[value.user_message,value.assistant_message]
    return value
}
const storyId=turn().conversation.story_id!
const detail=()=>({conversation:turn().conversation,messages:turn().messages,target:wire.index,target_cas:{revision:wire.preview.context.sourceVersion,content_hash:wire.preview.context.sourceVersion}})

beforeEach(()=>{vi.resetAllMocks();localStorage.clear();sessionStorage.clear();authSession.authenticate('stop-owner','FAKE_SESSION');vi.stubGlobal('fetch',fetchMock);setTestFeatureFlags({ novels: true })})
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs()})

it('keeps terminal uncertainty separate from running work and completed output',()=>{
    expect(verifyNovelAssistantTurnState(result(),storyId,2,requestId)).toBe(true)
    expect(verifyNovelAssistantTurnState({status:'running',request_id:requestId,execution_id:executionId,recovery_required:true},storyId,2,requestId)).toBe(true)
    expect(verifyNovelAssistantTurnState({status:'completed',request_id:requestId,recovery_required:false,turn:turn()},storyId,2,requestId)).toBe(true)
    expect(verifyNovelAssistantTurnState(result(),storyId,2,'different')).toBe(false)
    expect(verifyNovelAssistantTurnState({status:'completed',request_id:requestId,recovery_required:false,turn:turn()},'other-story',2,requestId)).toBe(false)
})

it.each([
    {status:['cancelled']},{status:'unknown'},{request_id:'bad/id'},{recovery_required:true},{execution_id:'wrong'},
    {control:{...result().control,settlement:['pending']}},{control:{...result().control,usage_complete:true}},
    {control:{...result().control,usage_complete:true,settlement:'used'}},
    {control:{...result().control,settlement:'not_used',usage_complete:false}},
    {control:{...result().control,usage:{prompt_tokens:1,completion_tokens:1,total_tokens:3}}},
    {control:{...result().control,usage:{prompt_tokens:true,completion_tokens:1,total_tokens:2}}},
    {control:{...result().control,usage:{prompt_tokens:-1,completion_tokens:1,total_tokens:0}}},
    {control:{...result().control,usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2,provider:'hidden'}}},
    {control:{...result().control,executor_stopped:false,settlement:'used'}},
    {control:{...result().control,executor_stopped:false,usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}}},
    {credentials:{api_key:'NEVER_RETAIN'}},{turn:turn()},
])('rejects a malformed terminal result without making it resumable: %j',change=>{
    expect(isNovelAssistantTerminal({...result(),...change})).toBe(false)
})

it('accepts an exact pre-admission Stop without inventing an execution',()=>{
    const {execution_id,...value}=result();void execution_id
    value.control={stop_requested:true,executor_stopped:true,settlement:'not_used',usage:null,usage_complete:true}
    expect(isNovelAssistantTerminal(value)).toBe(true)
    expect(isNovelAssistantTerminal({...value,status:'failed'})).toBe(false)
    expect(isNovelAssistantTerminal({...value,control:{...value.control,stop_requested:false}})).toBe(false)
})

it('checks the bound novel before posting an empty Stop with the same workspace and identity',async()=>{
    fetchMock.mockResolvedValueOnce(json(detail())).mockResolvedValueOnce(json(result()))
    const api=apiService.withWorkspace('00000000-0000-4000-8000-000000000002')
    expect(await api.stopNovelAssistantTurn(storyId,2,requestId)).toEqual(result())
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [url,options]=fetchMock.mock.calls[1]
    expect(url).toBe(`https://api.test.invalid/assistant/conversations/2/turns/${requestId}/stop`)
    expect(options.method).toBe('POST');expect(options.body).toBe('{}')
    expect(new Headers(options.headers).get('X-Workspace-Id')).toBe('00000000-0000-4000-8000-000000000002')
    expect(new Headers(options.headers).get('Content-Type')).toBe('application/json')
    expect(JSON.parse(options.body)).not.toHaveProperty('llm')
})

it('refuses to stop a conversation from another novel',async()=>{
    fetchMock.mockResolvedValueOnce(json(detail()))
    await expect(apiService.stopNovelAssistantTurn('another-novel',2,requestId)).rejects.toMatchObject({code:'ASSISTANT_SCOPE_CHANGED'})
    expect(fetchMock).toHaveBeenCalledOnce()
})

it('does not post after the account changes during the bound-conversation read',async()=>{
    fetchMock.mockImplementationOnce(async()=>{authSession.authenticate('another-owner','FAKE_OTHER_SESSION');return json(detail())})
    await expect(apiService.stopNovelAssistantTurn(storyId,2,requestId)).rejects.toBeDefined()
    expect(fetchMock).toHaveBeenCalledOnce()
})

it('rejects an unqualified Stop response while keeping the request identity',async()=>{
    fetchMock.mockResolvedValueOnce(json(detail())).mockResolvedValueOnce(json({...result(),request_id:'foreign'}))
    await expect(apiService.stopNovelAssistantTurn(storyId,2,requestId)).rejects.toMatchObject({code:'assistant_control_contract'})
    expect(fetchMock).toHaveBeenCalledTimes(2)
})
