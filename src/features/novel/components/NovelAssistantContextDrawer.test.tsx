import { act,fireEvent,render,screen,waitFor,within } from '@testing-library/react'
import { expect,it,vi } from 'vitest'
import { ApiError } from '@/infrastructure/api'
import { assistantContextFixture } from '@/test/fixtures/storyAssistantContext'
import type { AssistantContextSource } from '../hooks/useAssistantContextSource'
import type { StoryAssistantContext } from '@/shared/types/storyAssistant.types'
import { NovelAssistantContextDrawer } from './NovelAssistantContextDrawer'

function setup(){
    const f=assistantContextFixture(),prepare=vi.fn<AssistantContextSource['prepare']>(async()=>f.result),source={key:'author/desk/book',storyId:f.index.id,isCurrent:()=>true,prepare},close=vi.fn()
    return {...f,prepare,source,props:{open:true,onClose:close,source,story:f.index,anchorSceneId:'scene-2',selection:null},close}
}
function choose(label:string,option:string){fireEvent.click(screen.getByRole('combobox',{name:label}));fireEvent.click(screen.getByRole('option',{name:option}))}
function question(value='How old is Aria?'){fireEvent.change(screen.getByRole('textbox',{name:'Question or editing instruction'}),{target:{value}})}
it('prepares only on explicit request and displays actual source quotes, versions, pins, conflicts and exclusions',async()=>{
    const f=setup();render(<NovelAssistantContextDrawer {...f.props}/>)
    expect(f.prepare).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'Prepare sources'})).toBeDisabled()
    question();choose('Source scope','This novel');fireEvent.click(screen.getByRole('button',{name:'Prepare sources'}))
    await screen.findByText('Prepared for these choices')
    const {sourceVersion,...options}=f.request;void sourceVersion
    expect(f.prepare.mock.calls[0][0]).toEqual(options)
    const sources=screen.getByRole('region',{name:'Saved passages'})
    expect(within(sources).getByText('Aria was seventeen 🌒.')).toBeInTheDocument()
    expect(within(sources).queryByText('Aria discovers a future secret.')).not.toBeInTheDocument()
    expect(screen.getByRole('region',{name:'Conflicting pins'})).toHaveTextContent('no version is chosen as canon')
    expect(screen.getByRole('region',{name:'Excluded sources'})).toHaveTextContent('After the anchor in reading order')
    expect(screen.getByText('Conservative input estimate: '+f.result.trace.inputEstimate)).toBeInTheDocument()
    expect(screen.queryByRole('button',{name:/apply|send|generate/i})).not.toBeInTheDocument()
})
it('marks an earlier packet stale after edits or known saved-head changes and retains unsent input across close/reopen',async()=>{
    const f=setup(),view=render(<NovelAssistantContextDrawer {...f.props}/>)
    question();choose('Source scope','This novel');fireEvent.click(screen.getByRole('button',{name:'Prepare sources'}))
    await screen.findByText('Prepared for these choices')
    question('What is Aria hiding?');expect(screen.getByText(/These sources belong to earlier choices/)).toBeInTheDocument()
    view.rerender(<NovelAssistantContextDrawer {...f.props} open={false}/>)
    view.rerender(<NovelAssistantContextDrawer {...f.props}/>)
    expect(screen.getByRole('textbox',{name:'Question or editing instruction'})).toHaveValue('What is Aria hiding?')
    question();expect(screen.getByText('Prepared for these choices')).toBeInTheDocument()
    const changed=structuredClone(f.index);changed.chapters[0].scenes[0].revision++
    view.rerender(<NovelAssistantContextDrawer {...f.props} story={changed}/>)
    expect(screen.getByText(/These sources belong to earlier choices/)).toBeInTheDocument()
})
it('freezes the request before the read, reports the old packet as stale if the question changes while waiting',async()=>{
    const f=setup();let finish!:(value:StoryAssistantContext)=>void
    f.prepare.mockImplementation(()=>new Promise(done=>{finish=done}))
    render(<NovelAssistantContextDrawer {...f.props}/>);question();choose('Source scope','This novel')
    fireEvent.click(screen.getByRole('button',{name:'Prepare sources'}));question('A later question')
    await act(async()=>finish(f.result))
    expect(f.prepare.mock.calls[0][0].message).toBe('How old is Aria?')
    expect(screen.getByText(/These sources belong to earlier choices/)).toBeInTheDocument()
    expect(screen.getByRole('textbox',{name:'Question or editing instruction'})).toHaveValue('A later question')
})
it('aborts and ignores a late reply after closing and keeps the composer available for reopening',async()=>{
    const f=setup();let finish!:(value:StoryAssistantContext)=>void
    f.prepare.mockImplementation(()=>new Promise(done=>{finish=done}))
    const view=render(<NovelAssistantContextDrawer {...f.props}/>);question()
    fireEvent.click(screen.getByRole('button',{name:'Prepare sources'}))
    const signal=f.prepare.mock.calls[0][1]
    fireEvent.click(screen.getAllByRole('button',{name:'Close'})[0]);expect(f.close).toHaveBeenCalledOnce();expect(signal?.aborted).toBe(true)
    view.rerender(<NovelAssistantContextDrawer {...f.props} open={false}/>);await act(async()=>finish(f.result))
    view.rerender(<NovelAssistantContextDrawer {...f.props}/>)
    expect(screen.queryByText('Prepared for these choices')).not.toBeInTheDocument()
    expect(screen.getByRole('textbox',{name:'Question or editing instruction'})).toHaveValue('How old is Aria?')
    expect(screen.getByRole('button',{name:'Prepare sources'})).toBeEnabled()
})
it.each([['STORY_ASSISTANT_SELECTION_CHANGED','The saved source or selected passage changed.'],['STORY_CONTEXT_BUDGET_EXCEEDED','The required scene, question or pinned context exceeds this budget.'],['STORY_ASSISTANT_SOURCE_EXCLUDED','The anchor scene is excluded from AI context or archived.']])('retains input and explains %s',async(code,notice)=>{
    const f=setup();f.prepare.mockRejectedValue(new ApiError(409,'Controlled source failure',{code}))
    render(<NovelAssistantContextDrawer {...f.props}/>);question();fireEvent.click(screen.getByRole('button',{name:'Prepare sources'}))
    await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent(notice))
    expect(screen.getByRole('textbox',{name:'Question or editing instruction'})).toHaveValue('How old is Aria?')
})
it('keeps the captured selection exact and disables an invalid reserve without calling the source',()=>{
    const f=setup(),selection={sceneId:'scene-2',expectedRevision:1,expectedContentHash:f.index.chapters[0].scenes[2].contentHash,startOffset:0,endOffset:3,quote:'The'}
    render(<NovelAssistantContextDrawer {...f.props} selection={selection}/>);question();expect(screen.getByRole('combobox',{name:'Source scope'})).toHaveTextContent('Selected passage')
    expect(screen.getByRole('region',{name:'Captured selection'})).toHaveTextContent('The')
    fireEvent.change(screen.getByRole('spinbutton',{name:'Reserved output'}),{target:{value:'16000'}})
    expect(screen.getByRole('button',{name:'Prepare sources'})).toBeDisabled();expect(f.prepare).not.toHaveBeenCalled()
})
