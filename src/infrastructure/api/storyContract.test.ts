import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { setTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { manuscript, novel, storyChapter, storyScene } from '@/test/fixtures/story'
import { apiService } from './index'
import { matchesStoryWrite, verifyStory, verifyStoryScene } from './storyContract'

const fetchMock=vi.fn()
const response=(value:unknown)=>new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}})
beforeEach(()=>{vi.clearAllMocks();localStorage.clear();localStorage.setItem('magic_worlds:token','test-token');setTestFeatureFlags({ novels: true });vi.stubGlobal('fetch',fetchMock)})
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals()})

describe('novel acknowledgement contracts',()=>{
    it.each([
        ['truncated metadata',{id:'chapter-1',metadataRevision:2}],
        ['another novel',storyChapter({storyId:'other',metadataRevision:2})],
        ['another unit',storyChapter({id:'other',metadataRevision:2})],
        ['stale revision',storyChapter({metadataRevision:1})],
        ['wrong committed value',storyChapter({metadataRevision:2,wordGoal:700})],
    ])('rejects %s without reporting a details save',async(_label,value)=>{
        fetchMock.mockResolvedValueOnce(response(value))
        await expect(apiService.updateStoryChapter('story-1','chapter-1',{requestId:'details-one',expectedMetadataRevision:1,wordGoal:800})).rejects.toMatchObject({status:502,code:'story_contract'})
    })
    it.each([
        ['empty',{ }],['another novel',{id:'other',metadataRevision:2}],['stale',{id:'story-1',metadataRevision:1}],
    ])('retains a lifecycle request after a %s response',async(_label,value)=>{
        fetchMock.mockResolvedValueOnce(response(value))
        await expect(apiService.storyLifecycle('story-1',{requestId:'trash-one',expectedMetadataRevision:1,action:'trash'})).rejects.toMatchObject({status:502})
    })
    it.each([{structureRevision:1,selectedId:null},{structureRevision:2},{structureRevision:2,selectedId:7}])('rejects malformed outline receipt %j',async(value)=>{
        fetchMock.mockResolvedValueOnce(response(value))
        await expect(apiService.changeStoryStructure('story-1',{requestId:'move-one',expectedStructureRevision:1,operation:{op:'archive',kind:'scene',id:'scene-1'}})).rejects.toMatchObject({status:502})
    })
    it('accepts exact compact lifecycle and outline acknowledgements',async()=>{
        fetchMock.mockResolvedValueOnce(response({id:'story-1',metadataRevision:2})).mockResolvedValueOnce(response({structureRevision:2,selectedId:null}))
        await expect(apiService.storyLifecycle('story-1',{requestId:'archive-one',expectedMetadataRevision:1,action:'archive'})).resolves.toBeUndefined()
        await expect(apiService.changeStoryStructure('story-1',{requestId:'move-one',expectedStructureRevision:1,operation:{op:'archive',kind:'scene',id:'scene-1'}})).resolves.toEqual({structureRevision:2,selectedId:null})
    })
    it('requires the exact saved document rather than an unrelated valid scene',async()=>{
        const saved=storyScene({revision:2,document:manuscript('Different writing')})
        fetchMock.mockResolvedValueOnce(response(saved))
        await expect(apiService.updateStoryScene('story-1',saved.id,{requestId:'save-one',expectedRevision:1,document:manuscript('My writing')})).rejects.toMatchObject({status:502})
        expect(matchesStoryWrite(saved,{document:saved.document,expectedRevision:1})).toBe(true)
    })
})

it('accepts metadata summaries only as library results and rejects them as editable manuscripts',async()=>{
    const summary=novel({summary:true,chapterCount:12,sceneCount:40,chapters:[]})
    expect(verifyStory(summary,undefined,true)).toBe(true)
    expect(verifyStory(summary)).toBe(false)
    fetchMock.mockResolvedValueOnce(response(summary))
    await expect(apiService.getStory(summary.id)).rejects.toMatchObject({status:502})
})

it('rejects orphaned structure, duplicate identities, missing metadata and inconsistent projections',()=>{
    const valid=novel()
    expect(verifyStory(valid)).toBe(true)
    expect(verifyStory(novel({chapters:[storyChapter({partId:'missing'})]}))).toBe(false)
    expect(verifyStory(novel({chapters:[valid.chapters[0],valid.chapters[0]]}))).toBe(false)
    expect(verifyStoryScene({...valid.chapters[0].scenes[0],status:undefined})).toBe(false)
    expect(verifyStoryScene({...valid.chapters[0].scenes[0],plainText:'Incorrect projection'})).toBe(false)
    expect(verifyStoryScene({...valid.chapters[0].scenes[0],body:'Incorrect Markdown projection'})).toBe(false)
})

const smokeFixture=process.env.NOVEL_SMOKE_FIXTURE_INPUT
it.skipIf(!smokeFixture)('accepts the actual provider-free MySQL smoke document through the frontend contract',()=>{
    const value:unknown=JSON.parse(readFileSync(smokeFixture!,'utf8'))
    expect(verifyStory(value)).toBe(true)
})
