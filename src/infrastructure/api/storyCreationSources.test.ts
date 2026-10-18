import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { setTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { afterEach,beforeEach,expect,it,vi } from 'vitest'
import { creationSourcesPreview } from '@/test/fixtures/storyCreationSources'
import { apiService } from './index'
const fetchMock=vi.fn(),workspaceId='11111111-1111-4111-8111-111111111111'
const selection={source:{kind:'world' as const,id:'gate',title:'The gate'}}
const response=(value:unknown)=>new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}})
beforeEach(()=>{vi.resetAllMocks();setTestFeatureFlags({ novels: true });localStorage.clear();localStorage.setItem('magic_worlds:token','sources-test-token');vi.stubGlobal('fetch',fetchMock)})
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs()})
it('reviews sources without a creation request and reads the frozen origin in the same owned workspace',async()=>{
    const preview=creationSourcesPreview(selection),origin={...preview,storyId:'novel',createdAt:'2026-10-16T10:30:00Z'},api=apiService.withWorkspace(workspaceId)
    fetchMock.mockResolvedValueOnce(response(preview)).mockResolvedValueOnce(response(origin))
    expect(await api.previewStoryCreationSources(selection)).toEqual(preview)
    expect(await api.getStoryCreationSources('novel')).toEqual(origin)
    const [url,init]=fetchMock.mock.calls[0]
    expect(String(url)).toContain('/stories/creation-source-preview')
    expect(init.method).toBe('POST');expect(JSON.parse(init.body)).toEqual(selection)
    expect(String(fetchMock.mock.calls[1][0])).toContain('/stories/novel/creation-sources')
    expect(fetchMock.mock.calls[1][1].method??'GET').toBe('GET')
    for(const [,init] of fetchMock.mock.calls)expect(init.headers).toMatchObject({'Authorization':'Bearer sources-test-token','X-Workspace-Id':workspaceId})
})
it('rejects mismatched previews and foreign origins while keeping legacy absence explicit',async()=>{
    const preview=creationSourcesPreview(selection);preview.references[0].cardId='foreign'
    fetchMock.mockResolvedValueOnce(response(preview))
    await expect(apiService.previewStoryCreationSources(selection)).rejects.toMatchObject({code:'story_contract'})
    fetchMock.mockResolvedValueOnce(response({...creationSourcesPreview(selection),storyId:'foreign',createdAt:'2026-10-16T10:30:00Z'}))
    await expect(apiService.getStoryCreationSources('novel')).rejects.toMatchObject({code:'story_contract'})
    fetchMock.mockResolvedValueOnce(response(null))
    expect(await apiService.getStoryCreationSources('novel')).toBeNull()
    setTestFeatureFlags({ novels: false })
    await expect(apiService.previewStoryCreationSources(selection)).rejects.toThrow('Novels are disabled.')
    expect(fetchMock).toHaveBeenCalledTimes(3)
})
