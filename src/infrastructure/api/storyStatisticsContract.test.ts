import { existsSync,readFileSync } from 'node:fs'
import { expect,it } from 'vitest'
import { verifyStory } from './storyContract'
import { isStoryStatistics } from '@/shared/storyStatistics'
import { plainTextWordCount } from '@/features/novel/utils/novelUtils'
const wire='/tmp/novel-statistics-wire.json'
it.skipIf(!existsSync(wire))('reads actual backfilled and mutated MySQL cache wire without hydrating summary manuscripts',()=>{
    const value=JSON.parse(readFileSync(wire,'utf-8'))
    expect(verifyStory(value.story)).toBe(true)
    expect(isStoryStatistics(value.story.statistics,value.story.structureRevision)).toBe(true)
    expect(value.page.length).toBeGreaterThan(0)
    for(const row of value.page){expect(verifyStory(row,undefined,true)).toBe(true);expect(verifyStory(row)).toBe(false)}
    const scenes=value.story.chapters.flatMap((chapter:{scenes:Array<{plainText:string;trashedAt:string|null;status:string|null}>})=>chapter.scenes)
    const words=scenes.filter((scene:{trashedAt:string|null;status:string|null})=>!scene.trashedAt&&scene.status!=='archived').reduce((sum:number,scene:{plainText:string})=>sum+plainTextWordCount(scene.plainText),0)
    expect(words).toBe(value.story.statistics.active.wordCount)
})
