import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { setTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { existsSync,readFileSync } from 'node:fs'
import { afterEach,beforeEach,expect,it,vi } from 'vitest'
import { apiService } from './index'
import { verifySearchPage,verifySearchResult } from './storySearchContract'
import { searchMatch,searchPage,searchResult } from '@/test/fixtures/storySearch'
import type { StorySearchResolve } from '@/shared/types/storySearch.types'

const query:StorySearchResolve={q:'gate',sourceSnapshot:'b'.repeat(64),target:{sceneId:'scene-1',position:4}}
const fetchMock=vi.fn(),response=(value:unknown)=>new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}})
beforeEach(()=>{vi.clearAllMocks();localStorage.clear();setTestFeatureFlags({ novels: true });localStorage.setItem('magic_worlds:token','search-token');vi.stubGlobal('fetch',fetchMock)})
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals()})
it('posts private literal queries in the owned workspace and distinguishes document-only projections',async()=>{
    fetchMock.mockResolvedValueOnce(response(searchPage())).mockResolvedValueOnce(response(searchResult()))
    const api=apiService.withWorkspace('11111111-1111-4111-8111-111111111111')
    expect(await api.searchStoryManuscript('story-1',{q:'gate'})).toEqual(searchPage())
    expect(await api.resolveStoryManuscriptSearch('story-1',query)).toEqual(searchResult())
    for(const [url,init] of fetchMock.mock.calls){expect(String(url)).not.toContain('gate');expect(init.method).toBe('POST');expect(init.headers).toMatchObject({'X-Workspace-Id':'11111111-1111-4111-8111-111111111111',Authorization:'Bearer search-token'})}
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({q:'gate'})
})
it('refuses foreign scopes, duplicate matches, source prose in snippets and invalid native spans',()=>{
    expect(verifySearchPage(searchPage(),'story-1',{q:'gate'})).toBe(true)
    for(const value of [searchPage({storyId:'other'}),searchPage({matchingScenes:0}),searchPage({items:[searchMatch(),searchMatch()]}),searchPage({items:[searchMatch({endOffset:7})]}),
        searchPage({items:[searchMatch({quote:'\ud800',endOffset:5})]}),{...searchPage(),plainText:'private'},searchPage({items:[Object.assign(searchMatch(),{document:{}})]})])expect(verifySearchPage(value,'story-1',{q:'gate'})).toBe(false)
    expect(verifySearchPage(searchPage(),'story-1',{q:'gate',sceneId:'other'})).toBe(false)
    expect(verifySearchPage(searchPage({items:[searchMatch({quote:'GATE'})]}),'story-1',{q:'gate',caseSensitive:true})).toBe(false)
})
it('requires the same source, native codepoint location and canonical quote when resolving a result',async()=>{
    expect(verifySearchResult(searchResult(),'story-1',query)).toBe(true)
    const current=searchResult()
    for(const value of [searchResult({sourceSnapshot:'d'.repeat(64)}),searchResult({match:searchMatch({position:5})}),searchResult({match:searchMatch({startOffset:3,endOffset:7})}),
        searchResult({scene:{...current.scene,revision:2}}),searchResult({scene:Object.assign({...current.scene},{activeCardRefs:[]})}),searchResult({scene:{...current.scene,plainText:'other'}})])expect(verifySearchResult(value,'story-1',query)).toBe(false)
    fetchMock.mockResolvedValueOnce(response({...current,projection:'full_scene'}))
    await expect(apiService.resolveStoryManuscriptSearch('story-1',query)).rejects.toMatchObject({code:'story_search_contract'})
})
it('uses the actual source quote when native case folding matches ss against a single sharp s',()=>{
    const match=searchMatch({quote:'ß',endOffset:5}),result=searchResult({match}),scene=result.scene
    const document={schemaVersion:1 as const,content:{type:'doc',content:[{type:'paragraph',attrs:{nodeId:'sharp'},content:[{type:'text',text:'A🙂 ß waits.'}]}]}}
    const value={...result,scene:{...scene,document,plainText:'A🙂 ß waits.',body:'A🙂 ß waits.'}}
    expect(verifySearchResult(value,'story-1',{...query,q:'ss'})).toBe(true)
    expect(verifySearchResult(value,'story-1',{...query,q:'ss',caseSensitive:true})).toBe(false)
})
const wire='/tmp/novel-search-wire.json'
it.skipIf(!existsSync(wire))('accepts the real isolated MySQL/HTTP Unicode search and document projection',()=>{
    const value=JSON.parse(readFileSync(wire,'utf8'))
    expect(verifySearchPage(value.page,value.page.storyId,value.request)).toBe(true)
    expect(verifySearchResult(value.resolved,value.page.storyId,value.resolveRequest)).toBe(true)
})
