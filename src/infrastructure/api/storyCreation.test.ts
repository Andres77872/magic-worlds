import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { setTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { afterEach,beforeEach,expect,it,vi } from 'vitest'
import { apiService } from './index'
import { creationAck,creationWrite } from '@/test/fixtures/storyCreation'
const fetchMock=vi.fn()
const response=(value:unknown)=>new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}})
beforeEach(()=>{vi.resetAllMocks();setTestFeatureFlags({ novels: true });localStorage.clear();localStorage.setItem('magic_worlds:token','creation-test-token');vi.stubGlobal('fetch',fetchMock)})
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs()})
it('sends the original creation and recovers its bound receipt by a scoped GET',async()=>{
    const write=creationWrite(),ack=creationAck(write),api=apiService.withWorkspace('11111111-1111-4111-8111-111111111111')
    fetchMock.mockResolvedValueOnce(response(ack)).mockResolvedValueOnce(response(ack))
    expect(await api.createStory(write)).toEqual(ack)
    expect(await api.getStoryCreationResult(write)).toEqual(ack)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(write)
    expect(fetchMock.mock.calls[0][1].method).toBe('POST')
    expect(String(fetchMock.mock.calls[1][0])).toContain('/stories/creation-requests/creation-one')
    expect(fetchMock.mock.calls[1][1].method??'GET').toBe('GET')
    for(const [,init] of fetchMock.mock.calls)expect(init.headers).toMatchObject({'Authorization':'Bearer creation-test-token','X-Workspace-Id':'11111111-1111-4111-8111-111111111111'})
})
it('rejects foreign or truncated acknowledgements and does not invent an absent result',async()=>{
    const write=creationWrite()
    fetchMock.mockResolvedValueOnce(response({...creationAck(),write:{...write,title:'Another draft'}}))
    await expect(apiService.createStory(write)).rejects.toMatchObject({code:'story_contract'})
    fetchMock.mockResolvedValueOnce(response({storyId:'unknown'}))
    await expect(apiService.getStoryCreationResult(write)).rejects.toMatchObject({code:'story_contract'})
    fetchMock.mockResolvedValueOnce(response(null))
    expect(await apiService.getStoryCreationResult(write)).toBeNull()
})
