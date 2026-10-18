import { fireEvent,render,screen,within,waitFor } from '@testing-library/react'
import { expect,it,vi } from 'vitest'
import { NovelCreateModal } from './NovelCreateModal'
import type { CreationSourceApi } from '../hooks/useCreationSourceReview'
import { creationSourcesPreview } from '@/test/fixtures/storyCreationSources'
import { writingTemplate } from '../utils/writingTemplates'
vi.mock('@/features/gallery/media/components/CardPicker',()=>({CardPicker:({onChange}:{onChange:(value:unknown)=>void})=><button onClick={()=>onChange({type:'world',id:'gate-card',name:'The gate'})}>Pick the gate card</button>}))
function choose(name:string){fireEvent.click(screen.getByRole('combobox',{name:'Writing template'}));fireEvent.click(screen.getByRole('option',{name}))}
function renderModal(sourceApi?:CreationSourceApi){const onCreate=vi.fn(),onClose=vi.fn();const view=render(<NovelCreateModal open creating={false} sourceApi={sourceApi} onClose={onClose} onCreate={onCreate}/>);return {...view,onCreate,onClose}}
it('keeps blank creation compatible and does not create implicitly while changing a template',()=>{
    const view=renderModal();choose('Three acts')
    expect(view.onCreate).not.toHaveBeenCalled();expect(screen.getByText('3 parts · 3 chapters · 4 scenes')).toBeInTheDocument()
    choose('Blank page');fireEvent.click(screen.getByRole('button',{name:'Create novel'}))
    expect(view.onCreate).toHaveBeenCalledWith({title:'Untitled Novel',description:undefined,source:{kind:'blank'},chapters:[{title:'Chapter 1',status:null}]})
})
it('submits the edited complete outline, independent goals and writing defaults alongside the selected source',async()=>{
    const sourceApi={previewStoryCreationSources:vi.fn(async(selection)=>creationSourcesPreview(selection))} satisfies CreationSourceApi
    const view=renderModal(sourceApi);choose('Three acts')
    fireEvent.change(screen.getByTestId('novel-create-title'),{target:{value:'The glass road'}})
    fireEvent.change(within(screen.getByRole('group',{name:'Writing defaults'})).getByLabelText('Narrator'),{target:{value:'Mira, first person'}})
    fireEvent.change(screen.getByRole('textbox',{name:'Style guide'}),{target:{value:'Concrete detail; spare dialogue.'}})
    fireEvent.change(screen.getByRole('textbox',{name:'Template item title'}),{target:{value:'At the gate'}})
    fireEvent.change(screen.getByRole('spinbutton',{name:'Word goal for this template item'}),{target:{value:'800'}})
    fireEvent.click(screen.getByRole('button',{name:'Edit Scene · Opening'}))
    fireEvent.change(screen.getByRole('spinbutton',{name:'Word goal for this template item'}),{target:{value:'300'}})
    fireEvent.click(screen.getByRole('button',{name:'Add scene'}))
    fireEvent.click(screen.getByTestId('novel-create-source-card'));fireEvent.click(screen.getByRole('button',{name:'Pick the gate card'}))
    expect(screen.getByRole('button',{name:'Create novel'})).toBeDisabled()
    fireEvent.click(screen.getByRole('button',{name:'Review sources'}))
    fireEvent.click(await screen.findByRole('switch',{name:'I approve these source snapshots'}))
    fireEvent.click(screen.getByRole('button',{name:'Create novel'}))
    const write=view.onCreate.mock.calls[0][0]
    expect(write.chapters).toBeUndefined();expect(write.source).toEqual({kind:'world',id:'gate-card',title:'The gate'})
    expect(write.expectedSourceVersion).toBe('a'.repeat(64))
    expect(write.template.defaults).toMatchObject({narrator:'Mira, first person',styleGuide:'Concrete detail; spare dialogue.'})
    expect(write.template.chapters[0]).toMatchObject({title:'At the gate',partIndex:0,wordGoal:800})
    expect(write.template.chapters[0].scenes.map((scene:{wordGoal?:number})=>scene.wordGoal)).toEqual([300,undefined])
    await waitFor(()=>expect(screen.getByRole('button',{name:'Create novel'})).toBeEnabled())
})
it('requires an explicit replacement of an edited plan and preserves the novel title',()=>{
    renderModal();choose('Three acts')
    fireEvent.change(screen.getByTestId('novel-create-title'),{target:{value:'A retained title'}})
    fireEvent.change(screen.getByRole('textbox',{name:'Template item title'}),{target:{value:'My edited opening'}})
    choose('Short story')
    const review=screen.getByRole('dialog',{name:'Replace edited template?'})
    expect(screen.getByRole('button',{name:'Create novel'})).toBeDisabled()
    fireEvent.click(within(review).getByRole('button',{name:'Cancel'}))
    expect(screen.getByRole('textbox',{name:'Template item title'})).toHaveValue('My edited opening')
    choose('Short story');fireEvent.click(within(screen.getByRole('dialog',{name:'Replace edited template?'})).getByRole('button',{name:'Replace template'}))
    expect(screen.getByText('0 parts · 1 chapter · 3 scenes')).toBeInTheDocument()
    expect(screen.getByTestId('novel-create-title')).toHaveValue('A retained title')
})
it('blocks invalid template titles and all template editing during an uncertain creation',()=>{
    const view=renderModal();choose('Custom outline')
    fireEvent.change(screen.getByRole('textbox',{name:'Template item title'}),{target:{value:''}})
    expect(screen.getByRole('button',{name:'Create novel'})).toBeDisabled();expect(screen.getByRole('alert')).toBeInTheDocument()
    view.rerender(<NovelCreateModal open creating={false} blocked onClose={view.onClose} onCreate={view.onCreate}/>)
    expect(screen.getByRole('combobox',{name:'Writing template'})).toBeDisabled()
    expect(screen.getByRole('textbox',{name:'Template item title'})).toBeDisabled()
    expect(view.onCreate).not.toHaveBeenCalled()
})
it('reopens retained planning and material without a carried approval and submits exact chapter metadata',async()=>{
    const sourceApi={previewStoryCreationSources:vi.fn(async(selection)=>creationSourcesPreview(selection))} satisfies CreationSourceApi
    const request={title:'Retained work',description:'  Keep exact description.  ',chapters:[{title:'Authored chapter',wordGoal:800,povCardId:'mira'}],
        source:{kind:'blank' as const},expectedSourceVersion:'c'.repeat(64),
        approvedMaterials:[{key:'arrival',kind:'approved_adventure_material' as const,title:'Arrival',text:'  Original approved passage 🙂.  '}]}
    const create=vi.fn()
    render(<NovelCreateModal open initialRequest={request} sourceApi={sourceApi} creating={false} onClose={()=>{}} onCreate={create}/>)
    expect(screen.getByRole('textbox',{name:'Title'})).toHaveValue('Retained work')
    expect(screen.getByRole('textbox',{name:'Approved reference text'})).toHaveValue(request.approvedMaterials[0].text)
    expect(screen.getByRole('button',{name:'Create novel'})).toBeDisabled()
    expect(screen.getByText(/Authored chapter/)).toHaveTextContent('800 words')
    fireEvent.click(screen.getByRole('button',{name:'Review sources'}))
    fireEvent.click(await screen.findByRole('switch',{name:'I approve these source snapshots'}))
    fireEvent.click(screen.getByRole('button',{name:'Create novel'}))
    await waitFor(()=>expect(create).toHaveBeenCalledOnce())
    expect(create.mock.calls[0][0]).toEqual({...request,expectedSourceVersion:'a'.repeat(64)})
})
it('reopens the full edited template and requires review before replacing retained chapter planning',()=>{
    const template=writingTemplate('custom',(key)=>key);template.chapters[0].title='A retained outline'
    const view=render(<NovelCreateModal open initialRequest={{title:'Retained',template}} creating={false} onClose={()=>{}} onCreate={()=>{}}/>)
    expect(screen.getByRole('textbox',{name:'Template item title'})).toHaveValue('A retained outline')
    view.unmount()
    render(<NovelCreateModal open initialRequest={{title:'Retained',chapters:[{title:'A retained chapter',wordGoal:800}]}} creating={false} onClose={()=>{}} onCreate={()=>{}}/>)
    choose('Three acts')
    expect(screen.getByRole('dialog',{name:'Replace edited template?'})).toBeInTheDocument()
    expect(screen.getByText(/A retained chapter/)).toBeInTheDocument()
})
