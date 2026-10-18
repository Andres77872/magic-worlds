import { fireEvent,render,screen,waitFor,within } from '@testing-library/react'
import { expect,it,vi } from 'vitest'
import { planItem,planItems } from '@/test/fixtures/planItems'
import { outlineStory } from '@/test/fixtures/novelOutline'
import { factConflicts,factsAt,planningScenes } from '../utils/planningViews'
import { NovelFactsPanel } from './NovelFactsPanel'

const scenes=planningScenes(outlineStory()) // arrival (1), alternate (2), answer (3)
const fact=(data:Partial<Parameters<typeof planItem<'fact'>>[1]>,state:'proposed'|'approved'|'rejected'='approved')=>
    planItem('fact',{subject:'Mira',kind:'location',statement:'At the gate',origin:'author',...data},{state})

it('places facts by reading order, keeps unknown scenes apart and flags contradictions',()=>{
    const gate=fact({fromSceneId:'arrival',untilSceneId:'answer'}),home=fact({statement:'At home',fromSceneId:'alternate'})
    const knows=fact({kind:'knowledge',statement:'The gate is sealed'},'proposed'),lost=fact({fromSceneId:'deleted-scene'}),rejected=fact({statement:'x'},'rejected')
    const all=[gate,home,knows,lost,rejected]
    expect(factsAt(all,scenes,'arrival').holding).toEqual([gate,knows])
    expect(factsAt(all,scenes,'alternate').holding).toEqual([gate,home,knows])
    expect(factsAt(all,scenes,'answer').holding).toEqual([home,knows])
    expect(factsAt(all,scenes,'answer').unplaced).toEqual([lost])
    expect(factConflicts(factsAt(all,scenes,'alternate').holding)).toEqual([[gate,home]])
    const ring=fact({kind:'possession',statement:'Has the key',object:'Key'}),lostKey=fact({kind:'possession',statement:'Lost the key',object:'key '})
    expect(factConflicts([ring,lostKey])).toEqual([[ring,lostKey]])
    expect(factConflicts([ring,fact({kind:'possession',statement:'Has a lamp',object:'Lamp'})])).toEqual([])
    const lighthouse=fact({statement:'Keeps the lamp at Gull Point lighthouse'}),based=fact({statement:'Based at Gull Point',object:'Gull Point'}),harbour=fact({statement:'Waits at the harbour',object:'The harbour'})
    expect(factConflicts([lighthouse,based])).toEqual([])
    expect(factConflicts([based,harbour])).toEqual([[based,harbour]])
    expect(factConflicts([lighthouse,harbour])).toEqual([[lighthouse,harbour]])
})

it('shows what holds at a scene, reviews proposed facts and adds a cited fact',async()=>{
    const facts=planItems('fact',[fact({fromSceneId:'arrival',untilSceneId:'answer'}),fact({statement:'At home',fromSceneId:'alternate'}),
        fact({kind:'knowledge',statement:'The gate is sealed',origin:'assistant'},'proposed')])
    const view=render(<NovelFactsPanel scenes={scenes} facts={facts} readOnly={false} activeSceneId="alternate" subjects={['Mira']}
        getSelection={()=>({sceneId:'alternate',quote:'An alternate entrance',revision:2})}/>)
    expect(screen.getByRole('status')).toHaveTextContent('1 conflict(s) at this scene')
    const holding=screen.getByRole('region',{name:'Holding at this scene'})
    expect(within(holding).getAllByRole('note').map((note)=>note.textContent)).toEqual(['Conflicts with: At home','Conflicts with: At the gate'])
    const proposed=within(holding).getByText('The gate is sealed').closest('li')!
    expect(within(proposed).getByText('Suggested by the assistant')).toBeInTheDocument()
    fireEvent.click(within(proposed).getByRole('button',{name:'Approve'}))
    await waitFor(()=>expect(facts.update).toHaveBeenCalledWith(expect.objectContaining({state:'proposed'}),{state:'approved'}))

    fireEvent.click(screen.getByRole('button',{name:'Add fact'}))
    fireEvent.change(screen.getByLabelText('Subject (character, place or thing)'),{target:{value:'Mira'}})
    fireEvent.change(screen.getByLabelText('Statement'),{target:{value:'Knows the voice'}})
    fireEvent.click(screen.getByLabelText('Link the selected passage as evidence'))
    fireEvent.click(screen.getByRole('button',{name:'Save fact'}))
    await waitFor(()=>expect(facts.create).toHaveBeenCalledWith({subject:'Mira',kind:'knowledge',statement:'Knows the voice',origin:'author',fromSceneId:'alternate',
        sourceSceneId:'alternate',quote:'An alternate entrance',sourceRevision:2},'approved'))
    view.rerender(<NovelFactsPanel scenes={scenes} facts={facts} readOnly activeSceneId="alternate" subjects={['Mira']}/>)
    expect(screen.queryByRole('button',{name:'Add fact'})).not.toBeInTheDocument()
    expect(screen.getByText('Knows the voice')).toBeInTheDocument()
})

it('offers library staging only for a fact already in a Codex entry copied from a library card',async()=>{
    const linked=fact({statement:'Keeps the lamp',codexRefId:'ref-mira',codexRevision:4}),local=fact({statement:'Waits at the gate',codexRefId:'ref-local',codexRevision:5}),loose=fact({statement:'Sings at dusk'})
    const read=vi.fn().mockResolvedValue({refId:'ref-mira',basis:'published',description:'A guide.',stamp:'a'.repeat(64),versionNumber:2})
    const codex={entries:[{id:'ref-mira',label:'Mira',kind:'character' as const,description:'A guide.\n\nKeeps the lamp',sourceId:'card-1'},{id:'ref-local',label:'Gate',kind:'world' as const,description:'',sourceId:'snap'}],
        readOnly:false,busy:false,apply:vi.fn(),library:{linked:(id:string)=>id==='ref-mira',read,stage:vi.fn()}}
    const view=render(<NovelFactsPanel scenes={scenes} facts={planItems('fact',[linked,local,loose])} readOnly={false} activeSceneId="arrival" subjects={[]} codex={codex}/>)
    const row=(text:string)=>screen.getByText(text).closest('li')!
    expect(within(row('Waits at the gate')).queryByRole('button',{name:'Stage in library card…'})).not.toBeInTheDocument()
    expect(within(row('Sings at dusk')).queryByRole('button',{name:'Stage in library card…'})).not.toBeInTheDocument()
    fireEvent.click(within(row('Keeps the lamp')).getByRole('button',{name:'Stage in library card…'}))
    expect(await screen.findByRole('dialog',{name:'Stage a fact in the library card'})).toBeInTheDocument()
    await waitFor(()=>expect(read).toHaveBeenCalledWith('ref-mira'))
    view.rerender(<NovelFactsPanel scenes={scenes} facts={planItems('fact',[linked])} readOnly={false} activeSceneId="arrival" subjects={[]} codex={{...codex,readOnly:true}}/>)
    expect(screen.queryByRole('button',{name:'Stage in library card…'})).not.toBeInTheDocument()
})
