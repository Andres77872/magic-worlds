import { describe,expect,it } from 'vitest'
import { applyCodexAcknowledgement,applySceneAcknowledgement,mergeStoryResponse } from './storyCache'
import { novel,storyChapter,storyScene,storyReference,manuscript } from '@/test/fixtures/story'
import { storyStatistics } from '@/test/fixtures/storyStatistics'

describe('independent novel revision authorities',()=>{
    it('does not attach an older aggregate to newer acknowledged prose or a merged late read',()=>{
        const earlier=novel({statistics:storyStatistics()})
        const target=earlier.chapters[0].scenes[0]
        const saved=applySceneAcknowledgement(earlier,{...target,revision:2,document:manuscript('Later writing')})
        expect(saved.statistics).toBeUndefined()
        expect(mergeStoryResponse(earlier,saved).statistics).toBeUndefined()
        const fresh={...saved,statistics:storyStatistics({active:{...storyStatistics().active,wordCount:2}})}
        expect(mergeStoryResponse(fresh,saved).statistics).toEqual(fresh.statistics)
        expect(applySceneAcknowledgement(fresh,target).statistics).toEqual(fresh.statistics)
    })
    it('retains a moved scene and later prose when an old story response arrives',()=>{
        const original=novel({chapters:[storyChapter({id:'one',scenes:[storyScene({id:'scene',chapterId:'one',revision:2,body:'old'})]}),storyChapter({id:'two',scenes:[]})]})
        const moved=novel({structureRevision:3,chapters:[storyChapter({id:'one',scenes:[]}),storyChapter({id:'two',scenes:[storyScene({id:'scene',chapterId:'two',revision:4,body:'new'})]})]})
        const result=mergeStoryResponse(original,moved)
        expect(result.structureRevision).toBe(3)
        expect(result.chapters[0].scenes).toEqual([])
        expect(result.chapters[1].scenes[0]).toMatchObject({id:'scene',chapterId:'two',revision:4,plainText:'new'})
    })
    it('adopts a newer text acknowledgement without undoing metadata, ordering, trash or Codex state',()=>{
        const current=novel({contextRevision:3,activeCardRefs:[storyReference()],chapters:[storyChapter({id:'two',scenes:[storyScene({id:'scene',chapterId:'two',order:3,trashedAt:'2026-10-16T00:00:00',title:'New title',metadataRevision:5,revision:3})]})]})
        const result=applySceneAcknowledgement(current,storyScene({id:'scene',chapterId:'one',title:'Old title',metadataRevision:1,revision:4,document:manuscript('New prose')}))
        expect(result.chapters[0].scenes[0]).toMatchObject({chapterId:'two',order:3,trashedAt:'2026-10-16T00:00:00',title:'New title',metadataRevision:5,revision:4,plainText:'New prose'})
        expect(result.activeCardRefs).toEqual(current.activeCardRefs)
    })
    it('uses the latest Codex revision independently of root metadata and structure',()=>{
        const current=novel({metadataRevision:3,title:'Renamed',structureRevision:4,contextRevision:2,activeCardRefs:[]})
        const stale=novel({contextRevision:3,activeCardRefs:[storyReference()]})
        const result=mergeStoryResponse(stale,current)
        expect(result).toMatchObject({title:'Renamed',metadataRevision:3,structureRevision:4,contextRevision:3})
        expect(result.chapters[0].scenes[0].activeCardRefs).toHaveLength(1)
    })
    it('keeps inherited defaults visible and scene goals independent of chapter totals',()=>{
        const current=novel({details:{narrator:'Third person'},chapters:[storyChapter({wordGoal:4000,details:{tense:'Past'},scenes:[storyScene({wordGoal:800})]})]})
        const scene=mergeStoryResponse(current,null).chapters[0].scenes[0]
        expect(scene.wordGoal).toBe(800)
        expect(scene.inheritance).toMatchObject({values:{narrator:'Third person',tense:'Past'},origins:{narrator:'novel',tense:'chapter'}})
    })
})

it('keeps a complete newer Codex head when acknowledgements arrive in reverse order without touching prose',()=>{
    const first=storyReference({id:'first',cardId:'one'})
    const second=storyReference({id:'second',cardId:'two'})
    const original=novel({chapters:[storyChapter({scenes:[storyScene({revision:7,document:manuscript('Latest writing')})]})]})
    const newer=applyCodexAcknowledgement(original,{contextRevision:3,refs:[first,second]})
    const replay=applyCodexAcknowledgement(newer,{contextRevision:2,refs:[first]})
    expect(replay.activeCardRefs).toEqual([first,second])
    expect(replay.contextRevision).toBe(3)
    expect(replay.chapters[0].scenes[0].revision).toBe(7)
    expect(replay.chapters[0].scenes[0].plainText).toBe('Latest writing')
})

it('keeps the novel default POV through cache decoration, scene saves and later root metadata',()=>{
    const initial=novel({details:{povCardId:'mira',tense:'past'},chapters:[storyChapter({id:'one',scenes:[storyScene({id:'inherited',chapterId:'one'}),storyScene({id:'override',chapterId:'one',povCardId:'lena'})]})]})
    const saved=applySceneAcknowledgement(initial,storyScene({id:'inherited',chapterId:'one',revision:2,document:manuscript('Saved writing')}))
    expect(saved.chapters[0].scenes[0].inheritance).toMatchObject({values:{povCardId:'mira',tense:'past'},origins:{povCardId:'novel',tense:'novel'}})
    expect(saved.chapters[0].scenes[1].inheritance).toMatchObject({values:{povCardId:'lena'},origins:{povCardId:'scene'}})
    const changed=mergeStoryResponse({...saved,metadataRevision:2,details:{...saved.details,povCardId:'sora'}},saved)
    expect(changed.chapters[0].scenes.map((scene)=>scene.inheritance?.values.povCardId)).toEqual(['sora','lena'])
})
