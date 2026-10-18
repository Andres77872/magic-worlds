import { expect,it } from 'vitest'
import { manuscript,novel,storyChapter,storyScene } from '@/test/fixtures/story'
import { studioIndex,studioSceneRead } from '@/test/fixtures/storyStudio'
import { StudioSceneCache } from './studioSceneCache'

it('bounds retained confirmed documents during many switches and never contains drafts or pending operations',()=>{
    const scenes=Array.from({length:100},(_,number)=>storyScene({id:'scene-'+number,document:manuscript('Saved passage '+number,'p-'+number)}))
    const index=studioIndex(novel({chapters:[storyChapter({scenes})]})),cache=new StudioSceneCache()
    for(const scene of scenes){
        const head=index.chapters[0].scenes.find((head)=>head.id===scene.id)!
        expect(cache.put(index,head,studioSceneRead(index,scene))).toBe(true)
        expect(cache.size).toBeLessThanOrEqual(3)
    }
    expect(cache.get(index,index.chapters[0].scenes[0])).toBeNull()
    expect(cache.get(index,index.chapters[0].scenes[99])?.scene.plainText).toBe('Saved passage 99')
    cache.clear();expect(cache.size).toBe(0);expect(cache.byteSize).toBe(0)
})
it('refuses stale root/ancestor/document preconditions and oversized entries while retaining unrelated confirmed reads',()=>{
    const scene=storyScene(),index=studioIndex(novel({chapters:[storyChapter({scenes:[scene]})]})),cache=new StudioSceneCache(),head=index.chapters[0].scenes[0]
    const value=studioSceneRead(index,scene)
    cache.put(index,head,value)
    const changed={...index,chapters:[{...index.chapters[0],metadataRevision:2}]}
    expect(cache.get(changed,head)).toBeNull()
    expect(cache.put(index,head,{...value,scene:{...value.scene,contentHash:'c'.repeat(64)}})).toBe(false)
    const small=new StudioSceneCache(3,10)
    expect(small.put(index,head,value)).toBe(false);expect(small.size).toBe(0)
})
