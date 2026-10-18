import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { setTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { readFileSync } from 'node:fs'
import { afterEach,beforeEach,expect,it,vi } from 'vitest'
import { apiService } from './index'
import { verifyReadingPage } from './storyReadingContract'
import { readingItem,readingPage } from '@/test/fixtures/storyReading'
import { matchesReadingScene } from '@/shared/storyReading'
import { novel,storyChapter,storyScene } from '@/test/fixtures/story'
import { indexedReadingWindow,readerSceneId } from '@/test/fixtures/storyReadingWindow'

const fetchMock=vi.fn()
beforeEach(()=>{setTestFeatureFlags({ novels: true });localStorage.setItem('magic_worlds:token','reader-token');vi.stubGlobal('fetch',fetchMock);fetchMock.mockReset()})
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();localStorage.clear()})
it('posts private scope/position in the captured workspace and guards the canonical read-only projection',async()=>{
    fetchMock.mockResolvedValue(new Response(JSON.stringify(readingPage()),{status:200,headers:{'Content-Type':'application/json'}}))
    expect(await apiService.withWorkspace('11111111-1111-4111-8111-111111111111').readStoryManuscript('story-1',{})).toEqual(readingPage())
    const [url,init]=fetchMock.mock.calls[0];expect(url).toContain('/stories/story-1/manuscript-reader')
    expect(init.method).toBe('POST');expect(init.headers).toMatchObject({'X-Workspace-Id':'11111111-1111-4111-8111-111111111111',Authorization:'Bearer reader-token'})
    expect(JSON.parse(init.body)).toEqual({})
})
it('rejects foreign/tampered documents, paths, pages and accidental full scene/cache fields',()=>{
    const item=readingItem();expect(verifyReadingPage(readingPage(),'story-1',{})).toBe(true)
    for(const patch of [{storyId:'foreign'},{sourceSnapshot:'invalid'},{offset:1},{totalScenes:0},{nextAfterSceneId:'other'},
        {items:[item,item]},{items:[{...item,scene:{...item.scene,plainText:'other'}}]},
        {items:[{...item,scene:{...item.scene,details:{notes:'Not prose'}}}]},
        {items:[{...item,header:{...item.header,chapterId:'other'}}]},
        {items:[{...item,header:{...item.header,archived:true,readOnly:true}}]}, {chapters:[]}]){
        expect(verifyReadingPage({...readingPage(),...patch},'story-1',{})).toBe(false)
    }
    expect(verifyReadingPage(readingPage(),'story-1',{sourceSnapshot:'d'.repeat(64)})).toBe(false)
    expect(verifyReadingPage(readingPage(),'story-1',{scope:'chapter',unitId:'other'})).toBe(false)
    expect(verifyReadingPage(readingPage({totalScenes:0,items:[]}),'story-1',{})).toBe(true)
})
it('requires exact selected unit and independent metadata heads before opening the writing scene',()=>{
    const item=readingItem(),page=readingPage(),story=novel({chapters:[storyChapter({scenes:[storyScene({id:item.header.sceneId})]})]})
    expect(matchesReadingScene(story,page,item)).toBe(true)
    expect(matchesReadingScene({...story,contextRevision:2},page,item)).toBe(false)
    expect(matchesReadingScene({...story,chapters:[{...story.chapters[0],metadataRevision:2}]},page,item)).toBe(false)
    expect(matchesReadingScene({...story,chapters:[{...story.chapters[0],scenes:[{...story.chapters[0].scenes[0],contentHash:'d'.repeat(64)}]}]},page,item)).toBe(false)
})
it.skipIf(!process.env.NOVEL_READER_PERSISTENCE)('accepts real reopened native MySQL/HTTP reading batches',()=>{
    const value=JSON.parse(readFileSync(process.env.NOVEL_READER_PERSISTENCE!,'utf8'))
    for(const row of value.pages)expect(verifyReadingPage(row.page,value.storyId,row.request)).toBe(true)
})
it('guards source-bound direct seeks and backward page edges without full scene metadata',()=>{
    const query={windowed:true,startSceneId:readerSceneId(990),limit:2},page=indexedReadingWindow(query)
    expect(verifyReadingPage(page,'story-1',query)).toBe(true)
    expect(verifyReadingPage(page,'story-1',{})).toBe(false)
    expect(verifyReadingPage({...page,navigation:{...page.navigation,previousBeforeSceneId:readerSceneId(988)}},'story-1',query)).toBe(false)
    expect(verifyReadingPage({...page,navigation:{...page.navigation,startSceneId:readerSceneId(991)}},'story-1',query)).toBe(false)
    const reverse={windowed:true,beforeSceneId:readerSceneId(1),sourceSnapshot:'b'.repeat(64)},prior=indexedReadingWindow(reverse)
    expect(verifyReadingPage(prior,'story-1',reverse)).toBe(true)
    expect(verifyReadingPage({...prior,navigation:{...prior.navigation,previousChapterId:'foreign'}},'story-1',reverse)).toBe(false)
})
it.skipIf(!process.env.NOVEL_READER_WINDOW_PERSISTENCE)('guards actual native bidirectional pages and direct thousand-scene seeking',()=>{
    const value=JSON.parse(readFileSync(process.env.NOVEL_READER_WINDOW_PERSISTENCE!,'utf8'))
    for(const row of value.pages)expect(verifyReadingPage(row.page,value.storyId,row.request)).toBe(true)
    for(const row of value.longPages)expect(verifyReadingPage(row.page,value.longStoryId,row.request)).toBe(true)
})
