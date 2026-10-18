import { expect,it } from 'vitest'
import { novel,storyChapter,storyScene } from '@/test/fixtures/story'
import type { StoryOutline } from '@/shared'
import type { NovelAssistantStructureChange } from '@/shared/types/storyAssistant.types'
import { structureChangeOperation,structureChangesetOperation,structureChangeState,structureFailure } from './structureChanges'

const story=novel({chapters:[storyChapter({id:'chapter-1',scenes:['scene-0','scene-1','scene-2','scene-3'].map((id,order)=>storyScene({id,chapterId:'chapter-1',order,revision:3}))})]}) as unknown as StoryOutline

it('points the scenes of each new chapter at the chapter its own step creates, in reply order',()=>{
    expect(structureChangesetOperation(story,[
        {kind:'new_chapter',chapterId:'chapter-1',partId:null,title:'Storm',sceneIds:['scene-1'],reason:'A turn.'},
        {kind:'merge_scenes',sceneId:'scene-2',revision:1,otherSceneId:'scene-3',otherRevision:1,reason:'One beat.'},
        {kind:'new_chapter',chapterId:'chapter-1',partId:null,title:'Calm',sceneIds:['scene-2'],reason:'After.'},
    ])).toEqual({op:'changeset',operations:[
        {op:'create',kind:'chapter',parentId:null,title:'Storm',afterId:'chapter-1'},
        {op:'bulk_scenes',action:'move',ids:['scene-1'],parentId:{created:0}},
        // Prose-bound steps name the scenes' current revisions, which hold the reply's saved prose.
        {op:'merge_scenes',id:'scene-2',withId:'scene-3',expectedRevision:3,otherExpectedRevision:3,sceneBreak:true},
        {op:'create',kind:'chapter',parentId:null,title:'Calm',afterId:'chapter-1'},
        {op:'bulk_scenes',action:'move',ids:['scene-2'],parentId:{created:3}}]})
})

it('reads a refused group as changes that clash, but keeps prose and outline conflicts as they are',()=>{
    expect(structureFailure('validation',true)).toBe('notTogether')
    expect(structureFailure('validation')).toBe('failed')
    expect(structureFailure('STORY_REVISION_CONFLICT',true)).toBe('textChanged')
    expect(structureFailure('STORY_STRUCTURE_CONFLICT',true)).toBe('outlineChanged')
    expect(structureFailure('STORY_PENDING_PROPOSAL',true)).toBe('pendingProposal')
})

const part=(id:string,title:string,order:number)=>({id,storyId:'story-1',title,metadataRevision:1,order,status:null,wordGoal:null,povCardId:null,locationCardId:null,details:{},trashedAt:null,copiedFrom:null})
const chapters=(rows:[string,string|null][])=>rows.map(([id,partId],order)=>storyChapter({id,title:'Chapter '+id.slice(-1),partId,order,scenes:[storyScene({id:'scene-'+id,chapterId:id})]}))

it('starts a part at a chapter as a changeset step, ready outside parts and after the first chapter of a part, done once the part holds it first',()=>{
    const loose=novel({chapters:chapters([['chapter-1',null],['chapter-2',null],['chapter-3',null]])}) as unknown as StoryOutline
    const two:NovelAssistantStructureChange={kind:'new_part',chapterId:'chapter-2',partId:null,title:'Book Two',reason:'A new movement.'}
    expect(structureChangeState(loose,two)).toBe('ready')
    expect(structureChangeOperation(loose,two)).toEqual({op:'changeset',operations:[{op:'start_part',id:'chapter-2',title:'Book Two'}]})
    const one:NovelAssistantStructureChange={...two,chapterId:'chapter-1',title:'Book One'}
    expect(structureChangesetOperation(loose,[one,two])).toEqual({op:'changeset',operations:[{op:'start_part',id:'chapter-1',title:'Book One'},{op:'start_part',id:'chapter-2',title:'Book Two'}]})
    // Applied in either order the outline ends the same; each change then reads as done.
    const grouped=novel({parts:[part('part-1','Book One',0),part('part-2','Book Two',1)],chapters:chapters([['chapter-1','part-1'],['chapter-2','part-2'],['chapter-3','part-2']])}) as unknown as StoryOutline
    expect([structureChangeState(grouped,one),structureChangeState(grouped,two)]).toEqual(['done','done'])
    // Inside a part a new part starts after its first chapter, never at it.
    const inPart:NovelAssistantStructureChange={kind:'new_part',chapterId:'chapter-3',partId:'part-2',title:'Book Three',reason:'Later.'}
    expect(structureChangeState(grouped,inPart)).toBe('ready')
    expect(structureChangeState(grouped,{...inPart,chapterId:'chapter-2'})).toBe('unavailable')
    const archived={...grouped,parts:[grouped.parts![0],{...grouped.parts![1],status:'archived'}]} as unknown as StoryOutline
    expect(structureChangeState(archived,inPart)).toBe('unavailable')
})
