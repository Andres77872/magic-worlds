import { fireEvent,render,screen,waitFor } from '@testing-library/react'
import { expect,it,vi } from 'vitest'
import { planItem } from '@/test/fixtures/planItems'
import { NovelFactCodexReview,type FactCodex,type FactCodexResult } from './NovelFactCodexReview'
import { suggestedFactEntry } from '../utils/factCodex'

const fact=planItem('fact',{subject:'Mara',kind:'trait',statement:'Keeps the lamp at Gull Point.',sourceSceneId:'s1',quote:'Mara kept the lamp',sourceRevision:6,origin:'assistant'},{state:'approved'})
const entries=[{id:'ref-mara',label:'Mara',kind:'character' as const,description:'A lighthouse keeper.',sourceId:'card-1'},{id:'ref-gull',label:'Gull Point',kind:'world' as const,description:'',sourceId:'card-2'}]
function codex(results:FactCodexResult[]):FactCodex{
    const apply=vi.fn(async()=>results.shift()!)
    return {entries,readOnly:false,busy:false,apply}
}

it('suggests only an entry that alone names the subject',()=>{
    expect(suggestedFactEntry(fact,entries)).toBe('ref-mara')
    expect(suggestedFactEntry(fact,[...entries,{...entries[0],id:'ref-mara-2'}])).toBe('')
    expect(suggestedFactEntry({...fact,data:{...fact.data,subjectCardId:'card-2'}},entries)).toBe('ref-gull')
})

it('shows the evidence and the description before and after, applies the reviewed text and records provenance',async()=>{
    const value=codex([{ok:false,reason:'conflict'},{ok:true,revision:12}]),applied=vi.fn(async()=>true),close=vi.fn()
    render(<NovelFactCodexReview fact={fact} codex={value} sceneTitle={()=>'Scene 1'} onClose={close} onApplied={applied}/>)
    expect(screen.getByText('From Scene 1 · revision 6')).toBeInTheDocument()
    expect(screen.getByText('A lighthouse keeper.')).toBeInTheDocument()
    const after=screen.getByRole('textbox',{name:'Description after applying'})
    expect(after).toHaveValue('A lighthouse keeper.\n\nKeeps the lamp at Gull Point.')
    fireEvent.change(after,{target:{value:'A lighthouse keeper. Keeps the lamp at Gull Point.'}})
    fireEvent.click(screen.getByRole('button',{name:'Apply to this novel’s Codex'}))
    expect(await screen.findByRole('alert')).toHaveTextContent('The Codex changed since you opened this review.')
    expect(applied).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button',{name:'Apply to this novel’s Codex'}))
    await waitFor(()=>expect(applied).toHaveBeenCalledWith('ref-mara',12))
    expect(value.apply).toHaveBeenLastCalledWith('ref-mara','A lighthouse keeper. Keeps the lamp at Gull Point.')
    expect(close).toHaveBeenCalled()
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
    expect(applied).toHaveBeenNthCalledWith(2,'ref-mara',4)
})

it('blocks applying while another Codex change is unconfirmed or the Codex is read-only',()=>{
    const view=render(<NovelFactCodexReview fact={fact} codex={{...codex([]),busy:true}} sceneTitle={()=>undefined} onClose={vi.fn()} onApplied={vi.fn()}/>)
    expect(screen.getByRole('button',{name:'Apply to this novel’s Codex'})).toBeDisabled()
    view.rerender(<NovelFactCodexReview fact={fact} codex={{...codex([]),entries:[]}} sceneTitle={()=>undefined} onClose={vi.fn()} onApplied={vi.fn()}/>)
    expect(screen.getByText(/has no entries yet/)).toBeInTheDocument()
})
