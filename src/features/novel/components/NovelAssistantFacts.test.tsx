import { fireEvent,render,screen,waitFor } from '@testing-library/react'
import { expect,it,vi } from 'vitest'
import wire from '@/test/fixtures/novelAssistantTurn.json'
import { planItem,planItems } from '@/test/fixtures/planItems'
import type { NovelAssistantRecord } from '@/shared/types/storyAssistant.types'
import { assistantFactData,assistantFactRef } from '../utils/assistantFacts'
import { NovelAssistantFacts } from './NovelAssistantFacts'

function record():NovelAssistantRecord{
    const value=structuredClone(wire.records.suggest) as unknown as NovelAssistantRecord,source=value.context.packet.sources[0],passage=source.passages[0]
    value.result.facts=[
        {subject:'Mara',kind:'location',statement:'Keeps the lamp at Gull Point',object:null,passage:passage.id,sceneId:source.sceneId,revision:source.revision,excerpt:null},
        {subject:'Mara',kind:'relationship',statement:'Distrusts the harbour master',object:'Harbour master',passage:passage.id,sceneId:source.sceneId,revision:source.revision,excerpt:null},
    ]
    return value
}

it('stages a reply\'s facts as proposed, cited and from their evidence scene, only once',async()=>{
    const value=record(),facts=planItems('fact'),source=value.context.packet.sources[0]
    const view=render(<NovelAssistantFacts record={value} messageId={41} facts={facts} readOnly={false} sceneTitle={(id)=>id===source.sceneId?'The arrival':null}/>)
    expect(screen.getAllByText('The arrival')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button',{name:'Send 2 to Facts for review'}))
    await waitFor(()=>expect(facts.create).toHaveBeenCalledTimes(2))
    expect(facts.create).toHaveBeenNthCalledWith(2,{subject:'Mara',kind:'relationship',statement:'Distrusts the harbour master',object:'Harbour master',
        fromSceneId:source.sceneId,sourceSceneId:source.sceneId,quote:Array.from(source.passages[0].quote.trim()).slice(0,2000).join(''),sourceRevision:source.revision,
        origin:'assistant',originRef:'novel-reply:41#1'},'proposed')
    expect(await screen.findByRole('status')).toHaveTextContent('2 facts are waiting for your review in Facts.')
    view.rerender(<NovelAssistantFacts record={value} messageId={41} facts={facts} readOnly={false} sceneTitle={()=>null}/>)
    expect(screen.getByRole('button',{name:'All in Facts'})).toBeDisabled()
    expect(screen.getAllByText('In Facts')).toHaveLength(2)
})

it('sends only what is missing, reports partial failures and hides sending when read-only',async()=>{
    const value=record(),facts=planItems('fact',[planItem('fact',{...assistantFactData(value,41,0)},{state:'rejected'})])
    expect(facts.items[0].data.originRef).toBe(assistantFactRef(41,0))
    facts.create=vi.fn(async()=>{throw new Error('offline')})
    const view=render(<NovelAssistantFacts record={value} messageId={41} facts={facts} readOnly={false} sceneTitle={()=>null}/>)
    fireEvent.click(screen.getByRole('button',{name:'Send 1 to Facts for review'}))
    expect(await screen.findByRole('alert')).toHaveTextContent('Some facts were not sent (0 sent).')
    expect(facts.create).toHaveBeenCalledTimes(1)
    view.rerender(<NovelAssistantFacts record={value} messageId={41} facts={facts} readOnly sceneTitle={()=>null}/>)
    expect(screen.queryByRole('button',{name:/Facts/})).not.toBeInTheDocument()
    expect(screen.getByText('Distrusts the harbour master')).toBeInTheDocument()
})
