import { expect,it } from 'vitest'
import { novel } from '@/test/fixtures/story'
import { storyStatistics,sectionStatistics } from '@/test/fixtures/storyStatistics'
import { isStoryStatistics,savedStoryStatistics } from './storyStatistics'
import { isStoryLibraryFilters,storyLibraryParams } from './storyLibrary'
import { verifyStory } from '@/infrastructure/api/storyContract'
it('reads cached saved counts with explicit archive scope and retains unknown totals',()=>{
    const statistics=storyStatistics({archived:sectionStatistics({wordCount:4,chapters:1,scenes:2}),trashed:sectionStatistics({wordCount:500})})
    const story=novel({statistics})
    expect(verifyStory(story)).toBe(true)
    expect(savedStoryStatistics(story)?.wordCount).toBe(7)
    expect(savedStoryStatistics(story,true)).toMatchObject({wordCount:11,chapters:2,scenes:3})
    expect(savedStoryStatistics({...story,statistics:null})).toBeNull()
    expect(savedStoryStatistics({...story,statistics:{...statistics,active:sectionStatistics({wordCount:null})}})?.wordCount).toBeNull()
})
it('rejects stale, partial, malformed or unsafe cached totals before presenting them',()=>{
    const value=storyStatistics()
    for(const invalid of [{...value,sourceStructureRevision:2},{...value,complete:false},{...value,active:{...value.active,wordCount:-1}},{...value,active:{...value.active,textBytes:NaN}},
        {...value,active:{...value.active,wordCount:true}},{...value,archived:{...value.archived,parts:1.1}},{...value,extra:'unverified'}])expect(isStoryStatistics(invalid,1)).toBe(false)
})
it('keeps zero size bounds inclusive and rejects invalid whole-number ranges',()=>{
    const filters={minWords:0,maxWords:3000,sort:'words_desc' as const,includeArchivedSections:true}
    expect(isStoryLibraryFilters(filters)).toBe(true)
    expect(storyLibraryParams(filters).toString()).toBe('sort=words_desc&include_archived_sections=true&min_words=0&max_words=3000')
    for(const invalid of [{minWords:-1},{maxWords:Infinity},{minWords:1.5},{minWords:10,maxWords:1},{minWords:'0'},{minWords:true},{maxWords:Number.MAX_SAFE_INTEGER+1}])expect(isStoryLibraryFilters(invalid)).toBe(false)
})
