import { fireEvent,render,screen,waitFor } from '@testing-library/react'
import { expect,it,vi } from 'vitest'
import wire from '@/test/fixtures/novelAssistantTurn.json'
import { planItems } from '@/test/fixtures/planItems'
import type { NovelAssistantRecord } from '@/shared/types/storyAssistant.types'
import { NovelAssistantNotes } from './NovelAssistantNotes'

function record():NovelAssistantRecord{
    const value=structuredClone(wire.records.suggest) as unknown as NovelAssistantRecord,source=value.context.packet.sources[0],passage=source.passages[0]
    const excerpt=passage.quote.trim().split(/\s+/).slice(0,2).join(' ')
    value.result.notes=[{aspect:'pacing',title:'The letter lands early',observation:'The reveal arrives before any doubt builds.',options:['Delay it a scene.','Keep it, add a beat of doubt.'],
        evidence:[{passage:passage.id,sceneId:source.sceneId,revision:source.revision,excerpt}]}]
    return value
}

it('turns a cited note into one open critique task carrying every option',async()=>{
    const value=record(),tasks=planItems('task'),source=value.context.packet.sources[0],note=value.result.notes![0]
    const view=render(<NovelAssistantNotes record={value} messageId={9} tasks={tasks} readOnly={false} sceneTitle={()=>'Scene 1'}/>)
    expect(screen.getByText('Pacing')).toBeInTheDocument()
    expect(screen.getByText('Delay it a scene.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Send 1 to Tasks'}))
    await waitFor(()=>expect(tasks.create).toHaveBeenCalledTimes(1))
    expect(vi.mocked(tasks.create).mock.calls[0][0]).toEqual({title:'The letter lands early',sceneId:source.sceneId,quote:note.evidence[0].excerpt,sourceRevision:source.revision,
        origin:'critique',originRef:'novel-reply:9#note-0',
        body:'The reveal arrives before any doubt builds.\n\nOption: Delay it a scene.\n\nOption: Keep it, add a beat of doubt.\n\nAspect: Pacing'})
    expect(await screen.findByRole('status')).toHaveTextContent('1 critique task is open in Tasks & stash.')
    view.rerender(<NovelAssistantNotes record={value} messageId={9} tasks={tasks} readOnly={false} sceneTitle={()=>'Scene 1'}/>)
    expect(screen.getByRole('button',{name:'All in Tasks'})).toBeDisabled()
    view.rerender(<NovelAssistantNotes record={value} messageId={9} tasks={tasks} readOnly sceneTitle={()=>null}/>)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
})
