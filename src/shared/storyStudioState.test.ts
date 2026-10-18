import { expect,it } from 'vitest'
import { novel,storyScene,storyChapter,storyReference,manuscript } from '@/test/fixtures/story'
import { studioIndex } from '@/test/fixtures/storyStudio'
import { applyStudioSceneAcknowledgement,applyStudioCodexAcknowledgement,mergeStudioIndex,storyOutlineSummary,studioMatchesIndex } from './storyStudioState'
import { verifyStoryStudioIndex,verifyStoryStudioSource } from '@/infrastructure/api/storyStudioContract'

it('keeps only confirmed scene heads, invalidates the former server source version and ignores stale acknowledgements',()=>{
    const scene=storyScene(),index=studioIndex(novel({chapters:[storyChapter({scenes:[scene]})]}))
    const next=applyStudioSceneAcknowledgement(index,storyScene({...scene,revision:2,contentHash:'c'.repeat(64),document:manuscript('Latest writing')}))
    expect(next.projection).toBe('studio_state');expect(next.sourceVersion).toBeNull()
    expect(next.chapters[0].scenes[0]).toMatchObject({revision:2,contentHash:'c'.repeat(64),statistics:null})
    expect(next.chapters[0].scenes[0]).not.toHaveProperty('document')
    expect(verifyStoryStudioSource(next)).toBe(true);expect(verifyStoryStudioIndex(next)).toBe(false)
    expect(applyStudioSceneAcknowledgement(next,scene)).toBe(next)
})
it('matches a fresh index after a save acknowledged in place only while the saved heads are the same',()=>{
    const scene=storyScene(),index=studioIndex(novel({chapters:[storyChapter({scenes:[scene]})]}))
    const saved=applyStudioSceneAcknowledgement(index,storyScene({...scene,revision:2,contentHash:'c'.repeat(64)}))
    const fresh={...studioIndex(novel({chapters:[storyChapter({scenes:[{...scene,revision:2,contentHash:'c'.repeat(64)}]})]})),sourceVersion:'d'.repeat(64)}
    expect(saved.sourceVersion).toBeNull()
    expect(studioMatchesIndex(index,index)).toBe(true);expect(studioMatchesIndex(saved,fresh)).toBe(true)
    expect(studioMatchesIndex(saved,index)).toBe(false);expect(studioMatchesIndex(index,fresh)).toBe(false)
})
it('merges independent metadata, document, context and organization heads without resurrecting older parents or prose',()=>{
    const scene=storyScene({revision:3,metadataRevision:4,contentHash:'c'.repeat(64),title:'Latest title'}),current=studioIndex(novel({structureRevision:4,contextRevision:3,
        activeCardRefs:[storyReference()],chapters:[storyChapter({id:'new-parent',scenes:[{...scene,chapterId:'new-parent'}]})]}))
    const incoming=studioIndex(novel({metadataRevision:2,title:'Renamed',chapters:[storyChapter({scenes:[storyScene()]})]}))
    const result=mergeStudioIndex(incoming,current)
    expect(result.title).toBe('Renamed');expect(result.activeCardRefs).toEqual(current.activeCardRefs)
    expect(result.chapters[0].id).toBe('new-parent')
    expect(result.chapters[0].scenes[0]).toMatchObject({revision:3,metadataRevision:4,title:'Latest title',chapterId:'new-parent'})
    expect(result.sourceVersion).toBeNull();expect(verifyStoryStudioSource(result)).toBe(true)
})
it('takes a matching fresh source version and its numeric cache while preserving explicit novel POV inheritance',()=>{
    const current=studioIndex(),incoming=studioIndex(novel({details:{povCardId:'mira'}}))
    const result=mergeStudioIndex(incoming,current)
    expect(result.projection).toBe('studio_index');expect(result.sourceVersion).toBe(incoming.sourceVersion)
    expect(result.chapters[0].scenes[0].inheritance?.values.povCardId).toBe('mira')
    expect(applyStudioCodexAcknowledgement(result,{contextRevision:2,refs:[storyReference()]}).sourceVersion).toBeNull()
})
it('stores a metadata-only library summary independently of scene prose and root Codex snapshots',()=>{
    const full=novel({activeCardRefs:[storyReference()]})
    const value=storyOutlineSummary(studioIndex(full))
    expect(value).toMatchObject({summary:true,chapterCount:1,sceneCount:1,parts:[],chapters:[],activeCardRefs:[]})
    expect(value).not.toHaveProperty('projection');expect(value).not.toHaveProperty('sourceVersion')
    expect(storyOutlineSummary(value)).toBe(value)
})
