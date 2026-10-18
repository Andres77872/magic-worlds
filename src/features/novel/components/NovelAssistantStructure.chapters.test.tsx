import { fireEvent,render,screen,waitFor } from '@testing-library/react'
import { expect,it,vi } from 'vitest'
import wire from '@/test/fixtures/novelAssistantTurn.json'
import { novel,storyChapter,storyScene } from '@/test/fixtures/story'
import type { StoryOutline } from '@/shared'
import type { NovelAssistantRecord,NovelAssistantStructureChange } from '@/shared/types/storyAssistant.types'
import { NovelAssistantStructure } from './NovelAssistantStructure'

type Chapter={id:string;title:string;order:number;scenes:string[];trashedAt?:string;mergedInto?:string;copiedFrom?:string}
function outline(chapters:Chapter[],structureRevision=4):StoryOutline{
    return novel({structureRevision,chapters:chapters.map(row=>storyChapter({id:row.id,title:row.title,order:row.order,trashedAt:row.trashedAt??null,copiedFrom:row.copiedFrom??null,
        ...(row.mergedInto?{mergedInto:row.mergedInto}:{}),scenes:row.scenes.map((id,order)=>storyScene({id,title:'Scene '+id.slice(-1),chapterId:row.id,order}))}))}) as unknown as StoryOutline
}
const start=()=>outline([{id:'chapter-1',title:'Chapter 1',order:0,scenes:['scene-0','scene-1','scene-2']},{id:'chapter-2',title:'Chapter 2',order:1,scenes:['scene-3']}])
function record(...changes:NovelAssistantStructureChange[]):NovelAssistantRecord{
    const value=structuredClone(wire.records.suggest) as unknown as NovelAssistantRecord
    value.result.structure=changes
    return value
}
const title=(id:string)=>id.startsWith('scene-')?'Scene '+id.slice(-1):null
const move:NovelAssistantStructureChange={kind:'move_chapter',chapterId:'chapter-2',partId:null,beforeChapterId:'chapter-1',reason:'Open on the letter.'}
const fresh:NovelAssistantStructureChange={kind:'new_chapter',chapterId:'chapter-1',partId:null,title:'The Storm',sceneIds:['scene-1','scene-2'],reason:'A turn.'}

it('applies every ready chapter change together as one changeset, shows each as done, and undoes them with one Undo',async()=>{
    const applied=outline([{id:'chapter-2',title:'Chapter 2',order:0,scenes:['scene-3']},{id:'chapter-1',title:'Chapter 1',order:1,scenes:['scene-0']},
        {id:'chapter-9',title:'The Storm',order:2,scenes:['scene-1','scene-2']}],5)
    const operate=vi.fn().mockResolvedValueOnce(applied).mockResolvedValueOnce({...start(),structureRevision:6})
    const view=render(<NovelAssistantStructure record={record(move,fresh)} story={start()} structure={{operate,busy:false}} readOnly={false} sceneTitle={title}/>)
    expect(screen.getByText('Move “Chapter 2” before “Chapter 1”.')).toBeInTheDocument()
    expect(screen.getByText('Add a chapter, “The Storm”, after “Chapter 1”, and move these 2 scenes into it, in this order: Scene 1, Scene 2.')).toBeInTheDocument()
    expect(screen.getAllByText('Ready')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button',{name:'Apply all 2 ready changes together'}))
    await waitFor(()=>expect(operate).toHaveBeenCalledWith({op:'changeset',operations:[
        {op:'move',kind:'chapter',id:'chapter-2',parentId:null,beforeId:'chapter-1'},
        {op:'create',kind:'chapter',parentId:null,title:'The Storm',afterId:'chapter-1'},
        {op:'bulk_scenes',action:'move',ids:['scene-1','scene-2'],parentId:{created:1}}]}))
    view.rerender(<NovelAssistantStructure record={record(move,fresh)} story={applied} structure={{operate,busy:false}} readOnly={false} sceneTitle={title}/>)
    expect(await screen.findByText('Applied 2 changes as one organization change.')).toBeInTheDocument()
    expect(screen.getAllByText('Already in the outline')).toHaveLength(2)
    expect(screen.queryByRole('button',{name:/Apply/})).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Undo'}))
    await waitFor(()=>expect(operate).toHaveBeenLastCalledWith({op:'undo_structure',revision:5,sourceStructureRevision:5}))
    expect(await screen.findByText('Undone. The outline is back as it was; later edits are kept.')).toBeInTheDocument()
})

it('applies a new chapter alone as one changeset and a chapter split or merge as a single write',async()=>{
    const split:NovelAssistantStructureChange={kind:'split_chapter',chapterId:'chapter-1',sceneId:'scene-2',revision:1,title:'After',reason:'Two halves.'}
    const merge:NovelAssistantStructureChange={kind:'merge_chapters',chapterId:'chapter-1',otherChapterId:'chapter-2',reason:'One movement.'}
    const operate=vi.fn().mockResolvedValue(null)
    render(<NovelAssistantStructure record={record(fresh,split,merge)} story={start()} structure={{operate,busy:false}} readOnly={false} sceneTitle={title}/>)
    expect(screen.getByText('Split “Chapter 1”: a new chapter, “After”, starts with “Scene 2” and takes the scenes after it.')).toBeInTheDocument()
    expect(screen.getByText('Merge “Chapter 2” into “Chapter 1”, the chapter before it; its scenes follow the ones already there.')).toBeInTheDocument()
    const buttons=screen.getAllByRole('button',{name:'Apply change'})
    fireEvent.click(buttons[0])
    await waitFor(()=>expect(operate).toHaveBeenLastCalledWith({op:'changeset',operations:[{op:'create',kind:'chapter',parentId:null,title:'The Storm',afterId:'chapter-1'},
        {op:'bulk_scenes',action:'move',ids:['scene-1','scene-2'],parentId:{created:0}}]}))
    fireEvent.click(buttons[1])
    await waitFor(()=>expect(operate).toHaveBeenLastCalledWith({op:'split_chapter',id:'chapter-1',beforeSceneId:'scene-2',title:'After'}))
    fireEvent.click(buttons[2])
    await waitFor(()=>expect(operate).toHaveBeenLastCalledWith({op:'merge_chapters',id:'chapter-1',withId:'chapter-2'}))
})

it('says when chapter changes cannot apply together, and which ones the outline already holds or no longer allows',async()=>{
    const split:NovelAssistantStructureChange={kind:'split_chapter',chapterId:'chapter-1',sceneId:'scene-2',revision:1,title:'After',reason:'Two halves.'}
    const merge:NovelAssistantStructureChange={kind:'merge_chapters',chapterId:'chapter-1',otherChapterId:'chapter-2',reason:'One movement.'}
    const operate=vi.fn().mockResolvedValue(null)
    const view=render(<NovelAssistantStructure record={record(split,merge)} story={start()} structure={{operate,busy:false,error:'validation'}} readOnly={false} sceneTitle={title}/>)
    fireEvent.click(screen.getByRole('button',{name:'Apply all 2 ready changes together'}))
    expect(await screen.findByRole('alert')).toHaveTextContent('These changes cannot all be applied one after another')
    // The split happened (a copied chapter starts with its scene) and the other chapter was merged into this one.
    const done=outline([{id:'chapter-1',title:'Chapter 1',order:0,scenes:['scene-0','scene-1','scene-3']},{id:'chapter-8',title:'After',order:1,copiedFrom:'chapter-1',scenes:['scene-2']},
        {id:'chapter-2',title:'Chapter 2',order:2,scenes:[],trashedAt:'2026-10-18T00:00:00Z',mergedInto:'chapter-1'}],6)
    view.rerender(<NovelAssistantStructure record={record(split,merge)} story={done} structure={{operate,busy:false}} readOnly={false} sceneTitle={title}/>)
    expect(screen.getAllByText('Already in the outline')).toHaveLength(2)
    // The scene to split at now opens the chapter, and the chapters to merge are no longer next to each other.
    const apart=outline([{id:'chapter-1',title:'Chapter 1',order:0,scenes:['scene-2','scene-0']},{id:'chapter-5',title:'Between',order:1,scenes:['scene-5']},
        {id:'chapter-2',title:'Chapter 2',order:2,scenes:['scene-3']}])
    view.rerender(<NovelAssistantStructure record={record(split,merge)} story={apart} structure={{operate,busy:false}} readOnly={false} sceneTitle={title}/>)
    expect(screen.getAllByText('Not possible now')).toHaveLength(2)
    expect(screen.queryByRole('button',{name:/Apply/})).not.toBeInTheDocument()
})

it('says how many proposed outline changes were left out, alone or beside changes that can apply',()=>{
    const left=(count:number,...changes:NovelAssistantStructureChange[])=>{
        const value=record(...changes)
        if(!changes.length)delete value.result.structure
        value.result.structureOmitted=count
        return value
    }
    const operate=vi.fn()
    const view=render(<NovelAssistantStructure record={left(1)} story={start()} structure={{operate,busy:false}} readOnly={false} sceneTitle={title}/>)
    expect(screen.getByRole('note')).toHaveTextContent('The reply proposed 1 more outline change that could not be used')
    expect(screen.queryByRole('button',{name:/Apply/})).not.toBeInTheDocument()
    view.rerender(<NovelAssistantStructure record={left(2,move)} story={start()} structure={{operate,busy:false}} readOnly={false} sceneTitle={title}/>)
    expect(screen.getByRole('note')).toHaveTextContent('2 more outline changes that could not be used')
    expect(screen.getAllByRole('button',{name:/Apply/})).toHaveLength(1)
    view.rerender(<NovelAssistantStructure record={record(move)} story={start()} structure={{operate,busy:false}} readOnly={false} sceneTitle={title}/>)
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
})

it('describes a new part with the chapters it takes and where it goes, and applies it as one changeset',async()=>{
    const split:NovelAssistantStructureChange={kind:'new_part',chapterId:'chapter-2',partId:null,title:'Book Two',reason:'A new movement.'}
    const operate=vi.fn().mockResolvedValue(null)
    render(<NovelAssistantStructure record={record(split)} story={start()} structure={{operate,busy:false}} readOnly={false} sceneTitle={title}/>)
    expect(screen.getByText('New part')).toBeInTheDocument()
    expect(screen.getByText('Add a part, “Book Two”, with the chapter Chapter 2.')).toBeInTheDocument()
    // With no parts yet there is nothing to place it against, so no placement note.
    expect(screen.queryByText(/reading order stays the same/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Apply change'}))
    await waitFor(()=>expect(operate).toHaveBeenLastCalledWith({op:'changeset',operations:[{op:'start_part',id:'chapter-2',title:'Book Two'}]}))
})

it('says where a new part goes among the parts already there',()=>{
    const unit=(id:string,title:string,order:number)=>({id,storyId:'story-1',title,metadataRevision:1,order,status:null,wordGoal:null,povCardId:null,locationCardId:null,details:{},trashedAt:null,copiedFrom:null})
    const story=novel({parts:[unit('part-1','Book One',0)],chapters:[['chapter-1','part-1'],['chapter-2','part-1'],['chapter-3',null]].map(([id,partId],order)=>
        storyChapter({id:id!,title:'Chapter '+id!.slice(-1),partId,order,scenes:[storyScene({id:'scene-'+id,chapterId:id!})]}))}) as unknown as StoryOutline
    const later:NovelAssistantStructureChange={kind:'new_part',chapterId:'chapter-2',partId:'part-1',title:'Book Two',reason:'Later.'}
    const loose:NovelAssistantStructureChange={kind:'new_part',chapterId:'chapter-3',partId:null,title:'Prologue',reason:'Before.'}
    render(<NovelAssistantStructure record={record(later,loose)} story={story} structure={{operate:vi.fn(),busy:false}} readOnly={false} sceneTitle={title}/>)
    expect(screen.getByText('It follows “Book One”, which keeps its earlier chapters, so the reading order stays the same.')).toBeInTheDocument()
    expect(screen.getByText('It goes before the existing parts, so the reading order stays the same.')).toBeInTheDocument()
})
