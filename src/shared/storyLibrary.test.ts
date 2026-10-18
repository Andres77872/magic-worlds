import { expect,it } from 'vitest'
import { isStoryLibraryFilters,storyLibraryParams } from './storyLibrary'
it('accepts literal bounded metadata and inclusive ordered activity days without coercing invalid fields',()=>{
    expect(isStoryLibraryFilters({genre:'🙂'.repeat(255),updatedFrom:'2026-10-01',updatedThrough:'2026-10-16',includeArchivedSections:true})).toBe(true)
    for(const value of [null,[],false,{genre:' padded '},{genre:'🙂'.repeat(256)},{status:['archived']},{sort:'updated_at;DROP TABLE story_novel'},
        {updatedFrom:'2026-02-30'},{updatedFrom:'0000-01-01'},{updatedThrough:'9999-12-31'},{updatedFrom:'2026-10-17',updatedThrough:'2026-10-16'},
        {includeArchivedSections:1},{sceneId:'hidden'}])expect(isStoryLibraryFilters(value)).toBe(false)
})
it('serializes optional filters without changing literal Unicode, wildcard-looking text or UTC dates',()=>{
    const filters={searchIn:'metadata' as const,genre:'Fantasía_100%',tag:'café + road',sort:'title_asc' as const,status:'revising' as const,updatedFrom:'2026-10-01',updatedThrough:'2026-10-16',includeArchivedSections:false}
    const params=storyLibraryParams(filters)
    expect(Object.fromEntries(params)).toEqual({search_in:'metadata',genre:'Fantasía_100%',tag:'café + road',sort:'title_asc',status:'revising',updated_from:'2026-10-01',updated_through:'2026-10-16',include_archived_sections:'false'})
    expect(storyLibraryParams({}).toString()).toBe('')
})
