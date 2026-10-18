import { expect,it } from 'vitest'
import { novel,storyChapter,storyReference,storyScene,storyGeneration } from '@/test/fixtures/story'
import { searchMatch,searchResult } from '@/test/fixtures/storySearch'
import { mergeStorySearchResult } from './storySearchCache'

it('hydrates a known scene without clearing omitted pins/history or changing another document',()=>{
    const ref=storyReference(),history=storyGeneration(),scene=storyScene({activeCardRefs:[ref],generationHistory:[history]})
    const other=storyScene({id:'other',plainText:'Unrelated prose'})
    const current=novel({activeCardRefs:[ref],chapters:[storyChapter({scenes:[scene,other]})]})
    const value=mergeStorySearchResult(current,searchResult())!
    expect(value.chapters[0].scenes[0].activeCardRefs).toEqual([ref])
    expect(value.chapters[0].scenes[0].generationHistory).toEqual([history])
    expect(value.chapters[0].scenes[1].document).toEqual(other.document)
})
it('rejects unknown/moved paths, later prose and mismatched root or parent authority',()=>{
    const current=novel({chapters:[storyChapter({scenes:[storyScene()]})]}),result=searchResult()
    for(const value of [novel({structureRevision:2}),novel({contextRevision:2}),novel({metadataRevision:2}),
        {...current,chapters:[{...current.chapters[0],metadataRevision:2}]},
        novel({chapters:[storyChapter({scenes:[storyScene({revision:2})]})]})])expect(mergeStorySearchResult(value,result)).toBeNull()
    expect(mergeStorySearchResult(current,searchResult({match:searchMatch({chapterId:'unknown'})}))).toBeNull()
})
