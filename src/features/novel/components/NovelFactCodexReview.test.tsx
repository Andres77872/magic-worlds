import { fireEvent,render,screen,waitFor } from '@testing-library/react'
import { expect,it,vi } from 'vitest'
import { planItem } from '@/test/fixtures/planItems'
import { NovelFactCodexReview,type FactCodex,type FactCodexResult } from './NovelFactCodexReview'
import { suggestedFactEntry } from '../utils/factCodex'

const fact=planItem('fact',{subject:'Mara',kind:'trait',statement:'Keeps the lamp at Gull Point.',sourceSceneId:'s1',quote:'Mara kept the lamp',sourceRevision:6,origin:'assistant'},{state:'approved'})
const entries=[{id:'ref-mara',label:'Mara',kind:'character' as const,description:'A lighthouse keeper.',sourceId:'card-1',values:{name:'Mara',alias:'',race:'Human'}},{id:'ref-gull',label:'Gull Point',kind:'world' as const,description:'',sourceId:'card-2'}]
function codex(results:FactCodexResult[]):FactCodex{
    const apply=vi.fn(async()=>results.shift()!)
    return {entries,readOnly:false,busy:false,apply}
}
const choose=(label:string,option:string)=>{fireEvent.click(screen.getByRole('combobox',{name:label}));fireEvent.click(screen.getByRole('option',{name:option}))}

it('suggests only an entry that alone names the subject',()=>{
    expect(suggestedFactEntry(fact,entries)).toBe('ref-mara')
    expect(suggestedFactEntry(fact,[...entries,{...entries[0],id:'ref-mara-2'}])).toBe('')
    expect(suggestedFactEntry({...fact,data:{...fact.data,subjectCardId:'card-2'}},entries)).toBe('ref-gull')
})

it('shows each detail before and after, writes only the details chosen to change and records which ones',async()=>{
    const value=codex([{ok:false,reason:'conflict'},{ok:true,revision:12}]),applied=vi.fn(async()=>true),close=vi.fn()
    render(<NovelFactCodexReview fact={fact} codex={value} sceneTitle={()=>'Scene 1'} onClose={close} onApplied={applied}/>)
    expect(screen.getByText('From Scene 1 · revision 6')).toBeInTheDocument()
    // Name, alias and race start on Keep; the description proposes the statement as its own paragraph.
    expect(screen.getByRole('radiogroup',{name:'Race: keep or change'})).toBeInTheDocument()
    expect(screen.queryByRole('textbox',{name:'Race after'})).not.toBeInTheDocument()
    expect(screen.getByText('A lighthouse keeper.')).toBeInTheDocument()
    const after=screen.getByRole('textbox',{name:'Description after'})
    expect(after).toHaveValue('A lighthouse keeper.\n\nKeeps the lamp at Gull Point.')
    fireEvent.change(after,{target:{value:'A lighthouse keeper. Keeps the lamp at Gull Point.'}})
    fireEvent.click(screen.getAllByRole('radio',{name:'Change'})[2])
    const race=screen.getByRole('textbox',{name:'Race after'})
    expect(race).toHaveValue('Human')
    fireEvent.change(race,{target:{value:'Selkie'}})
    fireEvent.click(screen.getByRole('button',{name:'Apply to this novel’s Codex'}))
    expect(await screen.findByRole('alert')).toHaveTextContent('The Codex changed since you opened this review.')
    expect(applied).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button',{name:'Apply to this novel’s Codex'}))
    await waitFor(()=>expect(applied).toHaveBeenCalledWith('ref-mara',12,{fields:['race','description']}))
    expect(value.apply).toHaveBeenLastCalledWith('ref-mara',{race:'Selkie',description:'A lighthouse keeper. Keeps the lamp at Gull Point.'})
    expect(close).toHaveBeenCalled()
})

it('offers nothing to apply when every detail is kept',()=>{
    render(<NovelFactCodexReview fact={fact} codex={codex([])} sceneTitle={()=>undefined} onClose={vi.fn()} onApplied={vi.fn()}/>)
    fireEvent.click(screen.getAllByRole('radio',{name:'Keep'})[3])
    expect(screen.getByText('Nothing would change yet. Choose Change on a detail and edit it.')).toBeInTheDocument()
    expect(screen.getByRole('button',{name:'Apply to this novel’s Codex'})).toBeDisabled()
})

it('retries only the fact link when the Codex already holds the text',async()=>{
    const value=codex([{ok:true,revision:4}]),applied=vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true),close=vi.fn()
    render(<NovelFactCodexReview fact={fact} codex={value} sceneTitle={()=>undefined} onClose={close} onApplied={applied}/>)
    fireEvent.click(screen.getByRole('button',{name:'Apply to this novel’s Codex'}))
    expect(await screen.findByRole('alert')).toHaveTextContent('could not record it')
    expect(screen.getByRole('button',{name:'Apply to this novel’s Codex'})).toBeDisabled()
    fireEvent.click(screen.getByRole('button',{name:'Try linking again'}))
    await waitFor(()=>expect(close).toHaveBeenCalled())
    expect(value.apply).toHaveBeenCalledTimes(1)
    expect(applied).toHaveBeenNthCalledWith(2,'ref-mara',4,{fields:['description']})
})

it('blocks applying while another Codex change is unconfirmed or the Codex is read-only',()=>{
    const view=render(<NovelFactCodexReview fact={fact} codex={{...codex([]),busy:true}} sceneTitle={()=>undefined} onClose={vi.fn()} onApplied={vi.fn()}/>)
    expect(screen.getByRole('button',{name:'Apply to this novel’s Codex'})).toBeDisabled()
    view.rerender(<NovelFactCodexReview fact={fact} codex={{...codex([]),entries:[]}} sceneTitle={()=>undefined} onClose={vi.fn()} onApplied={vi.fn()}/>)
    expect(screen.getByText(/has no entries yet/)).toBeInTheDocument()
})

it('adds a new reference that only this novel has, from the fact’s subject and statement',async()=>{
    const create=vi.fn(async()=>({ok:true as const,entryId:'ref-new',revision:7})),applied=vi.fn(async()=>true)
    render(<NovelFactCodexReview fact={fact} codex={{...codex([]),entries:[],create}} sceneTitle={()=>undefined} onClose={vi.fn()} onApplied={applied}/>)
    expect(screen.getByRole('note')).toHaveTextContent('exists only in this novel’s Codex. No library card is created')
    expect(screen.getByRole('textbox',{name:'Name'})).toHaveValue('Mara')
    fireEvent.change(screen.getByRole('textbox',{name:'Alias · optional'}),{target:{value:'The Keeper'}})
    fireEvent.click(screen.getByRole('button',{name:'Add the reference'}))
    await waitFor(()=>expect(applied).toHaveBeenCalledWith('ref-new',7,{created:'reference'}))
    expect(create).toHaveBeenCalledWith('reference',{name:'Mara',alias:'The Keeper',description:'Keeps the lamp at Gull Point.'},undefined)
})

it('creates a library card or lorebook entry only as a separate choice, saying what changes in the library',async()=>{
    const create=vi.fn().mockResolvedValueOnce({ok:false,reason:'lorebookMissing'}).mockResolvedValueOnce({ok:true,entryId:'ref-bell',revision:9})
    const lorebooks=vi.fn(async()=>[{id:'book-1',title:'Gull Point Lore'},{id:'book-2',title:'Harbor Lore'}]),applied=vi.fn(async()=>true)
    render(<NovelFactCodexReview fact={fact} codex={{...codex([]),create,cardKinds:['character'],lorebooks}} sceneTitle={()=>undefined} onClose={vi.fn()} onApplied={applied}/>)
    // The existing entry stays the default destination.
    expect(screen.getByRole('textbox',{name:'Description after'})).toBeInTheDocument()
    choose('Where the fact goes','A new character card in your library')
    expect(screen.getByRole('note')).toHaveTextContent('creates a new private character card in your library')
    expect(screen.getByRole('textbox',{name:'Race · optional'})).toHaveValue('')
    choose('Where the fact goes','A new entry in a library lorebook')
    await waitFor(()=>expect(screen.getByRole('combobox',{name:'Lorebook'})).toBeInTheDocument())
    expect(screen.getByRole('button',{name:'Add the entry to the lorebook'})).toBeDisabled()
    choose('Lorebook','Gull Point Lore')
    expect(screen.getByRole('note')).toHaveTextContent('adds a new entry to Gull Point Lore in your library now')
    expect(screen.getByRole('textbox',{name:'Keys'})).toHaveValue('Mara')
    fireEvent.change(screen.getByRole('textbox',{name:'Keys'}),{target:{value:Array.from({length:21},(_,index)=>'key '+index).join(', ')}})
    expect(screen.getByText('Use at most 20 keys.')).toBeInTheDocument()
    expect(screen.getByRole('button',{name:'Add the entry to the lorebook'})).toBeDisabled()
    fireEvent.change(screen.getByRole('textbox',{name:'Keys'}),{target:{value:'Mara, keeper, Mara'}})
    fireEvent.click(screen.getByRole('button',{name:'Add the entry to the lorebook'}))
    expect(await screen.findByRole('alert')).toHaveTextContent('That lorebook is gone')
    fireEvent.click(screen.getByRole('button',{name:'Add the entry to the lorebook'}))
    await waitFor(()=>expect(applied).toHaveBeenCalledWith('ref-bell',9,{created:'lorebook_entry'}))
    expect(create).toHaveBeenLastCalledWith('lorebook_entry',{name:'Mara',description:'Keeps the lamp at Gull Point.',keys:['Mara','keeper']},'book-1')
    expect(lorebooks).toHaveBeenCalledTimes(1)
})
