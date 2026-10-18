import { fireEvent,render,screen,waitFor } from '@testing-library/react'
import { expect,it,vi } from 'vitest'
import wire from '@/test/fixtures/novelAssistantTurn.json'
import { planItems } from '@/test/fixtures/planItems'
import type { NovelAssistantRecord } from '@/shared/types/storyAssistant.types'
import { NovelAssistantPlan } from './NovelAssistantPlan'

function record():NovelAssistantRecord{
    const value=structuredClone(wire.records.suggest) as unknown as NovelAssistantRecord,source=value.context.packet.sources[0]
    value.result.plan={title:'Foreshadow the letter',steps:[{sceneId:source.sceneId,revision:source.revision,instruction:'Hint at a letter in the drawer.'},
        {sceneId:'gone',revision:3,instruction:'Pay off the letter.'}]}
    return value
}

it('tracks steps as plan tasks, shows progress, and hands a step to the composer',async()=>{
    const value=record(),tasks=planItems('task'),source=value.context.packet.sources[0],draft=vi.fn(()=>true)
    const title=(id:string)=>id===source.sceneId?'Scene 1':null
    const view=render(<NovelAssistantPlan record={value} messageId={5} tasks={tasks} readOnly={false} sceneTitle={title} drafted={()=>false} onDraftStep={draft}/>)
    expect(screen.getByText('Scene no longer in the outline')).toBeInTheDocument()
    const [first,second]=screen.getAllByRole('button',{name:'Draft this step'})
    expect(second).toBeDisabled()
    fireEvent.click(first)
    expect(draft).toHaveBeenCalledWith({sceneId:source.sceneId,instruction:'Hint at a letter in the drawer.',number:1})
    fireEvent.click(screen.getByRole('button',{name:'Track 2 steps in Tasks'}))
    await waitFor(()=>expect(tasks.create).toHaveBeenCalledTimes(2))
    expect(vi.mocked(tasks.create).mock.calls[0][0]).toEqual({title:'Foreshadow the letter · step 1 of 2',body:`Hint at a letter in the drawer.\n\nPlanned from scene revision ${source.revision}.`,
        sceneId:source.sceneId,sourceRevision:source.revision,origin:'plan',originRef:'novel-reply:5#step-0'})
    view.rerender(<NovelAssistantPlan record={value} messageId={5} tasks={tasks} readOnly={false} sceneTitle={title} drafted={step=>step.number===1} onDraftStep={draft}/>)
    expect(screen.getByText('0 of 2 steps done')).toBeInTheDocument()
    expect(screen.getByText('Suggestion ready')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button',{name:'Mark done'})[0])
    await waitFor(()=>expect(tasks.update).toHaveBeenCalledTimes(1))
    view.rerender(<NovelAssistantPlan record={value} messageId={5} tasks={tasks} readOnly={false} sceneTitle={title} drafted={()=>false} onDraftStep={draft}/>)
    expect(screen.getByText('1 of 2 steps done')).toBeInTheDocument()
    expect(screen.getByRole('button',{name:'All steps in Tasks'})).toBeDisabled()
    view.rerender(<NovelAssistantPlan record={value} messageId={5} tasks={tasks} readOnly sceneTitle={title} drafted={()=>false} onDraftStep={draft}/>)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
})
