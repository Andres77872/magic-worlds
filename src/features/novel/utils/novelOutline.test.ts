import { expect,it } from 'vitest'
import type { StoryPart } from '@/shared'
import { novelOutline,outlineCard,outlineExcerpt } from './novelOutline'
import { storyChapter,storyScene,storyReference } from '@/test/fixtures/story'

const part=(id:string,order:number,patch:Partial<StoryPart>={}):StoryPart=>({id,order,storyId:'story-1',title:id,metadataRevision:1,status:null,wordGoal:null,povCardId:null,locationCardId:null,details:{},trashedAt:null,copiedFrom:null,...patch})
it('numbers active reading order across parts and skips archived/trashed ancestors without renaming titles',()=>{
    const parts=[part('later',3),part('hidden',0,{trashedAt:'2026-10-16T10:00:00'}),part('earlier',2),part('archive',1,{status:'archived'})]
    const chapters=[storyChapter({id:'later-chapter',partId:'later',scenes:[storyScene({id:'late',plainText:'Five words live in here.'})]}),
        storyChapter({id:'hidden-chapter',partId:'hidden',scenes:[storyScene({plainText:'Hidden text'})]}),
        storyChapter({id:'earlier-chapter',title:'An author title',partId:'earlier',scenes:[storyScene({id:'early',plainText:'Two words'})]}),
        storyChapter({id:'archived-chapter',partId:'archive',scenes:[storyScene({id:'old',plainText:'Archived text stays readable.'})]}),
        storyChapter({id:'ungrouped',partId:null,scenes:[storyScene({id:'second',order:3,plainText:'End'}),storyScene({id:'removed',order:0,trashedAt:'2026-10-16T10:00:00'}),storyScene({id:'inactive',order:1,status:'archived',plainText:'Inactive'}),storyScene({id:'first',order:2,plainText:'Start'})]})]
    const original=JSON.stringify({parts,chapters}),model=novelOutline(chapters,parts)
    expect(model.chapters.map((row)=>[row.unit.id,row.number])).toEqual([['ungrouped',1],['archived-chapter',null],['earlier-chapter',2],['later-chapter',3]])
    expect(model.parts.map((row)=>[row.unit.id,row.number])).toEqual([['archive',null],['earlier',1],['later',2]])
    expect(model.ungrouped[0].scenes.map((row)=>[row.unit.id,row.number])).toEqual([['inactive',null],['first','1.1'],['second','1.2']])
    expect(model.words).toBe(9)
    expect(model.chapters[2].unit.title).toBe('An author title');expect(JSON.stringify({parts,chapters})).toBe(original)
})
it('derives new numbers after reorder and restore while updating counts for changed prose',()=>{
    const a=storyChapter({id:'a',order:0,scenes:[storyScene({plainText:'One'})]}),b=storyChapter({id:'b',order:1,scenes:[]})
    expect(novelOutline([b,a]).chapters.map((row)=>row.unit.id)).toEqual(['a','b'])
    a.order=2;a.scenes[0].plainText='Two words'
    expect(novelOutline([a,b]).chapters.map((row)=>[row.unit.id,row.number])).toEqual([['b',1],['a',2]])
    expect(novelOutline([a,b]).words).toBe(2)
    b.trashedAt='2026-10-16T10:00:00';expect(novelOutline([a,b]).chapters[0].number).toBe(1)
    b.trashedAt=null;expect(novelOutline([a,b]).chapters[1].number).toBe(2)
})
it('resolves scoped character names without substituting a foreign scene or a removed pin for an active one',()=>{
    const root=storyReference({id:'root',cardId:'mira',snapshot:{id:'mira',name:'Root Mira',description:'Root',story_card_kind:'character'}})
    const chapter={...root,id:'chapter',chapterId:'chapter-1',snapshot:{...root.snapshot,name:'Chapter Mira'}}
    const local={...root,id:'scene',sceneId:'scene-1',enabled:false,snapshot:{...root.snapshot,name:'Local Mira'}}
    const refs=[root,chapter,local,{...local,id:'foreign',sceneId:'other-scene'}]
    expect(outlineCard(refs,'mira','character','chapter-1','scene-1')?.label).toBe('Local Mira')
    local.removedAt='2026-10-16T10:00:00';expect(outlineCard(refs,'mira','character','chapter-1','scene-1')?.label).toBe('Chapter Mira')
    expect(outlineCard([local],'mira','character','chapter-1','scene-1')).toEqual({label:'Local Mira',removed:true})
    expect(outlineCard(refs,'mira','world','chapter-1','scene-1')).toBeNull()
})
it('keeps bounded outline excerpts on Unicode boundaries',()=>{
    expect(outlineExcerpt('a'.repeat(239)+'🌒B')).toBe('a'.repeat(239)+'🌒…')
})
