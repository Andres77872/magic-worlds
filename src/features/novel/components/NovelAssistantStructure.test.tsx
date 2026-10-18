import { fireEvent,render,screen,waitFor } from '@testing-library/react'
import { expect,it,vi } from 'vitest'
import wire from '@/test/fixtures/novelAssistantTurn.json'
import { novel,storyChapter,storyScene } from '@/test/fixtures/story'
import type { StoryOutline } from '@/shared'
import type { NovelAssistantRecord } from '@/shared/types/storyAssistant.types'
import { NovelAssistantStructure } from './NovelAssistantStructure'

function outline(order:string[],patch:{revision?:Record<string,number>;structureRevision?:number;hash?:Record<string,string>}={}):StoryOutline{
    const scenes=order.map((id,index)=>({...storyScene({id,title:'Scene '+id.slice(-1),chapterId:'chapter-1',order:index,revision:patch.revision?.[id]??1}),
        ...(patch.hash?.[id]?{contentHash:patch.hash[id]}:{})}))
    return novel({structureRevision:patch.structureRevision??4,chapters:[storyChapter({id:'chapter-1',title:'Chapter 1',scenes})]}) as unknown as StoryOutline
}

function record():NovelAssistantRecord{
    const value=structuredClone(wire.records.suggest) as unknown as NovelAssistantRecord
    value.result.structure=[
        {kind:'move_scene',sceneId:'scene-2',revision:1,chapterId:'chapter-1',beforeSceneId:'scene-0',reason:'Open on the letter.'},
        {kind:'merge_scenes',sceneId:'scene-0',revision:1,otherSceneId:'scene-1',otherRevision:1,reason:'One beat, not two.'},
        {kind:'split_scene',sceneId:'scene-2',revision:1,offset:20,excerpt:'She waited.',title:'Waiting',reason:'Two moments.'},
    ]
    return value
}

it('applies one proposed outline change at a time, shows what the outline already holds, and undoes it in one step',async()=>{
    const story=outline(['scene-0','scene-1','scene-2']),moved={...outline(['scene-2','scene-0','scene-1'],{revision:{'scene-2':2},structureRevision:5})}
    const operate=vi.fn().mockResolvedValueOnce(moved).mockResolvedValueOnce({...story,structureRevision:6})
    const title=(id:string)=>['scene-0','scene-1','scene-2'].includes(id)?'Scene '+id.slice(-1):null
    const view=render(<NovelAssistantStructure record={record()} story={story} structure={{operate,busy:false}} readOnly={false} sceneTitle={title}/>)
    expect(screen.getByText('Move “Scene 2” to “Chapter 1”, before “Scene 0”.')).toBeInTheDocument()
    expect(screen.getByText('Merge “Scene 1” into “Scene 0”, with a scene break between them.')).toBeInTheDocument()
    expect(screen.getByText('She waited.')).toBeInTheDocument()
    expect(screen.getAllByText('Ready')).toHaveLength(3)
    fireEvent.click(screen.getAllByRole('button',{name:'Apply change'})[0])
    await waitFor(()=>expect(operate).toHaveBeenCalledWith({op:'move',kind:'scene',id:'scene-2',parentId:'chapter-1',beforeId:'scene-0'}))
    view.rerender(<NovelAssistantStructure record={record()} story={moved} structure={{operate,busy:false}} readOnly={false} sceneTitle={title}/>)
    expect(await screen.findByText('Applied. It is one organization change.')).toBeInTheDocument()
    expect(screen.getByText('Already in the outline')).toBeInTheDocument()
    // The split's scene prose changed after the reply; the scenes to merge are still next to each other.
    expect(screen.getByText('Changed since this reply')).toBeInTheDocument()
    expect(screen.getAllByText('Ready')).toHaveLength(1)
    expect(screen.getAllByRole('button',{name:'Apply change'})).toHaveLength(1)
    view.rerender(<NovelAssistantStructure record={record()} story={{...moved,chapters:[{...moved.chapters[0],scenes:moved.chapters[0].scenes.map(scene=>scene.id==='scene-0'?{...scene,order:9}:scene)}]}}
        structure={{operate,busy:false}} readOnly={false} sceneTitle={title}/>)
    expect(screen.getByText('Not possible now')).toBeInTheDocument()
    view.rerender(<NovelAssistantStructure record={record()} story={moved} structure={{operate,busy:false}} readOnly={false} sceneTitle={title}/>)
    fireEvent.click(screen.getByRole('button',{name:'Undo'}))
    await waitFor(()=>expect(operate).toHaveBeenLastCalledWith({op:'undo_structure',revision:5,sourceStructureRevision:5}))
    expect(await screen.findByText('Undone. The outline is back as it was; later edits are kept.')).toBeInTheDocument()
})

it('offers no Undo once later organization changes exist, keeps failures visible, and applies nothing when read-only',async()=>{
    const story=outline(['scene-0','scene-1','scene-2'])
    const operate=vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({...story,structureRevision:5})
    const title=(id:string)=>'Scene '+id.slice(-1)
    const view=render(<NovelAssistantStructure record={record()} story={story} structure={{operate,busy:false,error:'STORY_PENDING_PROPOSAL'}} readOnly={false} sceneTitle={title}/>)
    fireEvent.click(screen.getAllByRole('button',{name:'Apply change'})[1])
    await waitFor(()=>expect(operate).toHaveBeenCalledWith({op:'merge_scenes',id:'scene-0',withId:'scene-1',expectedRevision:1,otherExpectedRevision:1,sceneBreak:true}))
    expect(await screen.findByRole('alert')).toHaveTextContent('A scene in this change has a suggestion waiting for review')
    fireEvent.click(screen.getAllByRole('button',{name:'Apply change'})[2])
    await waitFor(()=>expect(operate).toHaveBeenLastCalledWith({op:'split_scene',id:'scene-2',textOffset:20,expectedRevision:1,title:'Waiting'}))
    view.rerender(<NovelAssistantStructure record={record()} story={{...story,structureRevision:6}} structure={{operate,busy:false}} readOnly={false} sceneTitle={title}/>)
    expect(await screen.findByText('Later organization changes exist. Undo this change from Organization history.')).toBeInTheDocument()
    expect(screen.queryByRole('button',{name:'Undo'})).not.toBeInTheDocument()
    view.rerender(<NovelAssistantStructure record={record()} story={story} structure={{operate,busy:false}} readOnly sceneTitle={title}/>)
    expect(screen.queryByRole('button',{name:'Apply change'})).not.toBeInTheDocument()
})

it('keeps a prose-bound change usable when an undo restored the exact prose the reply read',async()=>{
    const value=record(),saved=value.context.packet.sources.find(source=>source.sceneId==='scene-2')!.contentHash
    const restored=outline(['scene-0','scene-1','scene-2'],{revision:{'scene-2':3},hash:{'scene-2':saved}})
    const operate=vi.fn().mockResolvedValue({...restored,structureRevision:5})
    render(<NovelAssistantStructure record={value} story={restored} structure={{operate,busy:false}} readOnly={false} sceneTitle={id=>'Scene '+id.slice(-1)}/>)
    expect(screen.queryByText('Changed since this reply')).not.toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button',{name:'Apply change'})[2])
    await waitFor(()=>expect(operate).toHaveBeenCalledWith({op:'split_scene',id:'scene-2',textOffset:20,expectedRevision:3,title:'Waiting'}))
})
