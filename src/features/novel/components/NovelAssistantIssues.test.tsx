import { fireEvent,render,screen,waitFor } from '@testing-library/react'
import { expect,it,vi } from 'vitest'
import wire from '@/test/fixtures/novelAssistantTurn.json'
import { planItems } from '@/test/fixtures/planItems'
import type { NovelAssistantRecord } from '@/shared/types/storyAssistant.types'
import { NovelAssistantIssues } from './NovelAssistantIssues'

function record():NovelAssistantRecord{
    const value=structuredClone(wire.records.suggest) as unknown as NovelAssistantRecord,source=value.context.packet.sources[0],passage=source.passages[0]
    const quote=passage.quote.trim(),excerpt=quote.split(/\s+/).slice(0,2).join(' ')
    value.result.issues=[{title:'Winters disagree',detail:'One scene says eleven winters, another twelve.',certainty:'certain',
        evidence:[{passage:passage.id,sceneId:source.sceneId,revision:source.revision,excerpt},{passage:passage.id,sceneId:source.sceneId,revision:source.revision,excerpt:null}]}]
    return value
}

it('turns a cited continuity issue into one open continuity task with its other evidence in the body',async()=>{
    const value=record(),tasks=planItems('task'),source=value.context.packet.sources[0],issue=value.result.issues![0]
    const view=render(<NovelAssistantIssues record={value} messageId={7} tasks={tasks} readOnly={false} sceneTitle={()=>'Scene 1'}/>)
    expect(screen.getByText('Contradiction')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Send 1 to Tasks'}))
    await waitFor(()=>expect(tasks.create).toHaveBeenCalledTimes(1))
    const [data]=vi.mocked(tasks.create).mock.calls[0]
    expect(data).toEqual({title:'Winters disagree',sceneId:source.sceneId,quote:issue.evidence[0].excerpt,sourceRevision:source.revision,origin:'continuity',originRef:'novel-reply:7#issue-0',
        body:`One scene says eleven winters, another twelve.\n\nAssistant assessment: Contradiction\n\nAlso in Scene 1: “${Array.from(source.passages[0].quote.trim()).slice(0,300).join('')}”`})
    expect(await screen.findByRole('status')).toHaveTextContent('1 continuity task is open in Tasks & stash.')
    view.rerender(<NovelAssistantIssues record={value} messageId={7} tasks={tasks} readOnly={false} sceneTitle={()=>'Scene 1'}/>)
    expect(screen.getByRole('button',{name:'All in Tasks'})).toBeDisabled()
    view.rerender(<NovelAssistantIssues record={value} messageId={7} tasks={tasks} readOnly sceneTitle={()=>null}/>)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getAllByText('Scene no longer in the outline')).toHaveLength(2)
})
