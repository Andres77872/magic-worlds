import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { setTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { afterEach,beforeEach,expect,it,vi } from 'vitest'
import { apiService } from './index'
import { novel } from '@/test/fixtures/story'
const fetchMock=vi.fn(),workspace='11111111-1111-4111-8111-111111111111'
beforeEach(()=>{vi.resetAllMocks();setTestFeatureFlags({ novels: true });localStorage.clear();localStorage.setItem('magic_worlds:token','library-token');vi.stubGlobal('fetch',fetchMock)})
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs()})
it('keeps search, filters, Trash and pagination in an owned read without fetching manuscripts',async()=>{
    const summaries=[novel({summary:true,chapters:[],chapterCount:2,sceneCount:4})]
    fetchMock.mockResolvedValue(new Response(JSON.stringify(summaries),{status:200,headers:{'Content-Type':'application/json'}}))
    expect(await apiService.withWorkspace(workspace).getStories(24,24,'moon_100%',true,{searchIn:'metadata',genre:'Fantasía',tag:'café',sort:'title_desc',status:'revising',updatedThrough:'2026-10-16'})).toEqual(summaries)
    const [url,request]=fetchMock.mock.calls[0],query=new URL(String(url)).searchParams
    expect(Object.fromEntries(query)).toMatchObject({skip:'24',limit:'24',q:'moon_100%',trashed:'true',search_in:'metadata',genre:'Fantasía',tag:'café',sort:'title_desc',status:'revising',updated_through:'2026-10-16'})
    expect(request.method??'GET').toBe('GET')
    expect(request.headers).toMatchObject({'Authorization':'Bearer library-token','X-Workspace-Id':workspace})
    expect(fetchMock).toHaveBeenCalledOnce()
})
it('rejects malformed filters before making a request',async()=>{
    await expect(apiService.getStories(0,24,undefined,false,{updatedFrom:'2026-10-17',updatedThrough:'2026-10-16'})).rejects.toMatchObject({code:'story_contract'})
    expect(fetchMock).not.toHaveBeenCalled()
})
