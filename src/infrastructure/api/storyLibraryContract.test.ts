import { existsSync,readFileSync } from 'node:fs'
import { expect,it } from 'vitest'
import { verifyStory } from './storyContract'
import { isStoryLibraryFilters } from '@/shared/storyLibrary'
const path='/tmp/novel-library-wire.json'
it.skipIf(!existsSync(path))('accepts actual MySQL filtered summaries without treating them as editable manuscripts',()=>{
    const value=JSON.parse(readFileSync(path,'utf-8'))
    expect(isStoryLibraryFilters(value.filters)).toBe(true)
    expect(value.page.length).toBeGreaterThan(0)
    for(const summary of value.page){expect(verifyStory(summary,undefined,true)).toBe(true);expect(verifyStory(summary)).toBe(false)}
})
