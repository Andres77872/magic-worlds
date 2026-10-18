import { expect,it,vi } from 'vitest'
import { t } from 'i18next'
import { novel } from '@/test/fixtures/story'
import { sectionStatistics,storyStatistics } from '@/test/fixtures/storyStatistics'
import { novelItems } from './novelGalleryConfig'
it('uses saved aggregates for gallery totals without recounting a full manuscript',()=>{
    const segmentation=vi.spyOn(Intl,'Segmenter')
    const source=novel({statistics:storyStatistics({active:sectionStatistics({wordCount:65000,chapters:8,scenes:30}),archived:sectionStatistics({wordCount:4000,chapters:1,scenes:2})})})
    const active=novelItems([source],t)[0],retained=novelItems([source],t,true)[0]
    expect(active.tags.some((tag)=>tag.includes((65000).toLocaleString()))).toBe(true)
    expect(retained.tags.some((tag)=>tag.includes((69000).toLocaleString()))).toBe(true)
    expect(segmentation).not.toHaveBeenCalled();segmentation.mockRestore()
})
it('keeps unavailable summary totals distinct from a known empty manuscript',()=>{
    const missing=novel({summary:true,parts:[],chapters:[],chapterCount:null,sceneCount:null,statistics:null})
    expect(novelItems([missing],t)[0].tags).toEqual([t('novelEditor.library.totalsUnavailable')])
    const empty=novel({...missing,chapterCount:1,sceneCount:1,statistics:storyStatistics({active:sectionStatistics({chapters:1,scenes:1})})})
    expect(novelItems([empty],t)[0].tags.some((tag)=>tag.includes('0'))).toBe(true)
})
