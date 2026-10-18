import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { setTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { afterEach,beforeEach,expect,it,vi } from 'vitest'
import { apiService } from './index'
import { copyAck,copyPreview,copyProvenance,copyWrite } from '@/test/fixtures/storyCopy'
const fetchMock=vi.fn()
const response=(value:unknown)=>new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}})
beforeEach(()=>{vi.resetAllMocks();setTestFeatureFlags({ novels: true });localStorage.clear();localStorage.setItem('magic_worlds:token','copy-test-token');vi.stubGlobal('fetch',fetchMock)})
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs()})

it('sends an immutable scoped copy and uses GET for result/provenance recovery',async()=>{
    const write=copyWrite(),api=apiService.withWorkspace('11111111-1111-4111-8111-111111111111')
    for(const value of [copyPreview(),copyAck(write),copyAck(write),copyProvenance()])fetchMock.mockResolvedValueOnce(response(value))
    await api.previewStoryCopy('story-1');await api.copyStory('story-1',write);await api.getStoryCopyResult('story-1',write);await api.getStoryCopyProvenance('story-copy')
    expect(fetchMock.mock.calls.map(([url])=>String(url).split('/stories/')[1])).toEqual(['story-1/copy-preview?comments=true','story-1/copy','story-1/copy-requests/novel-copy-one','story-copy/copy-provenance'])
    expect(fetchMock.mock.calls[1][1].method).toBe('POST')
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual(write)
    expect(fetchMock.mock.calls[2][1].method??'GET').toBe('GET')
    for(const [,init] of fetchMock.mock.calls)expect(init.headers).toMatchObject({'X-Workspace-Id':'11111111-1111-4111-8111-111111111111'})
})
it('rejects mismatched and partial confirmations and accepts an absent receipt as absent',async()=>{
    const write=copyWrite()
    fetchMock.mockResolvedValueOnce(response({...copyAck(),title:'Wrong copy'}))
    await expect(apiService.copyStory('story-1',write)).rejects.toMatchObject({code:'story_contract'})
    fetchMock.mockResolvedValueOnce(response({storyId:'copy-only'}))
    await expect(apiService.getStoryCopyResult('story-1',write)).rejects.toMatchObject({code:'story_contract'})
    fetchMock.mockResolvedValueOnce(response(null))
    expect(await apiService.getStoryCopyResult('story-1',write)).toBeNull()
})
