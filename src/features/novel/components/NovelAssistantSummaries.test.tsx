import { fireEvent,render,screen,waitFor } from '@testing-library/react'
import { expect,it,vi } from 'vitest'
import wire from '@/test/fixtures/novelAssistantTurn.json'
import { novel,storyChapter,storyScene } from '@/test/fixtures/story'
import type { StoryInheritance,StoryOutline } from '@/shared'
import type { NovelAssistantRecord } from '@/shared/types/storyAssistant.types'
import { NovelAssistantSummaries } from './NovelAssistantSummaries'

const HASH='a'.repeat(64)
function outline(patch:Record<string,{revision?:number;summary?:string;summaryRevision?:number;readOnly?:boolean}>={}):StoryOutline{
    const scenes=['scene-0','scene-1','scene-2','scene-3'].map((id,index)=>{
        const own=patch[id]??{}
        return {...storyScene({id,title:'Scene '+id.slice(-1),chapterId:'chapter-1',order:index,revision:own.revision??1}),contentHash:HASH,
            details:own.summary?{summary:own.summary,summaryRevision:own.summaryRevision??1}:{},...(own.readOnly?{inheritance:{readOnly:true} as unknown as StoryInheritance}:{})}
    })
    return novel({chapters:[storyChapter({id:'chapter-1',title:'Chapter 1',scenes})]}) as unknown as StoryOutline
}
function record():NovelAssistantRecord{
    const value=structuredClone(wire.records.suggest) as unknown as NovelAssistantRecord
    const row=(sceneId:string,text:string,complete=true)=>({sceneId,revision:1,contentHash:HASH,complete,text})
    value.result.summaries=[row('scene-0','Aria turns seventeen.'),row('scene-1','Aria learns the gate.'),row('scene-2','Only the opening was read.',false),row('scene-3','The letter waits.')]
    return value
}
const title=(id:string)=>id.startsWith('scene-')?'Scene '+id.slice(-1):null

it('saves one summary at the revision the reply read and marks what is already saved, changed, partial or replaced',async()=>{
    const save=vi.fn().mockResolvedValue('saved')
    const story=outline({'scene-1':{revision:2},'scene-3':{summary:'An older summary.',summaryRevision:1}})
    const view=render(<NovelAssistantSummaries record={record()} story={story} writer={{save}} readOnly={false} sceneTitle={title}/>)
    expect(screen.getByRole('heading',{name:'Chapter 1 · Scene 0'})).toBeInTheDocument()
    expect(screen.getAllByText('Ready')).toHaveLength(2)
    expect(screen.getByText('Scene changed since this reply')).toBeInTheDocument()
    expect(screen.getByText('From part of the scene')).toBeInTheDocument()
    expect(screen.getByText(/cannot be saved as the scene’s summary/)).toBeInTheDocument()
    expect(screen.getByText('Saving replaces the summary the scene has now.')).toBeInTheDocument()
    expect(screen.getAllByRole('button',{name:'Save as scene summary'})).toHaveLength(2)
    fireEvent.click(screen.getAllByRole('button',{name:'Save as scene summary'})[0])
    await waitFor(()=>expect(save).toHaveBeenCalledWith('scene-0','Aria turns seventeen.',1))
    expect(await screen.findByText('Saved. This is now the summary of “Chapter 1 · Scene 0”.')).toBeInTheDocument()
    view.rerender(<NovelAssistantSummaries record={record()} story={outline({'scene-0':{summary:'Aria turns seventeen.'},'scene-1':{revision:2}})} writer={{save}} readOnly={false} sceneTitle={title}/>)
    expect(screen.getByText('Saved as the scene summary')).toBeInTheDocument()
    expect(screen.getAllByRole('button',{name:'Save as scene summary'})).toHaveLength(1)
})

it('explains a refused save and offers no save where scene details cannot change',async()=>{
    const save=vi.fn().mockResolvedValueOnce('changed').mockResolvedValueOnce('failed')
    const view=render(<NovelAssistantSummaries record={record()} story={outline()} writer={{save}} readOnly={false} sceneTitle={title}/>)
    fireEvent.click(screen.getAllByRole('button',{name:'Save as scene summary'})[0])
    expect(await screen.findByText('The scene changed after this reply, so the summary was not saved.')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button',{name:'Save as scene summary'})[1])
    expect(await screen.findByText('The summary could not be saved. Try again.')).toBeInTheDocument()
    view.rerender(<NovelAssistantSummaries record={record()} story={outline({'scene-0':{readOnly:true}})} writer={{save}} readOnly={false} sceneTitle={title}/>)
    expect(screen.getByText('Not possible now')).toBeInTheDocument()
    view.rerender(<NovelAssistantSummaries record={record()} story={outline()} readOnly={false} sceneTitle={title}/>)
    expect(screen.queryByRole('button',{name:'Save as scene summary'})).toBeNull()
    view.rerender(<NovelAssistantSummaries record={record()} story={outline()} writer={{save}} readOnly sceneTitle={title}/>)
    expect(screen.queryByRole('button',{name:'Save as scene summary'})).toBeNull()
    const none=record();delete none.result.summaries
    view.rerender(<NovelAssistantSummaries record={none} story={outline()} writer={{save}} readOnly={false} sceneTitle={title}/>)
    expect(screen.queryByRole('heading',{name:'Scene summaries'})).toBeNull()
})
