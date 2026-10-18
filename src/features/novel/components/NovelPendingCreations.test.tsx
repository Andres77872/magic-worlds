import { act,fireEvent,render,screen,waitFor,within } from '@testing-library/react'
import { beforeEach,expect,it,vi } from 'vitest'
import { creationAck,creationWrite } from '@/test/fixtures/storyCreation'
import type { PendingNovelCreation } from '../persistence/creationJournal'
import { ApiError } from '@/infrastructure/api'
import type { NovelCreateModalProps } from './NovelCreateModal'
import { writingTemplate } from '../utils/writingTemplates'

const mocks=vi.hoisted(()=>({sessionKey:'session-one',items:[] as PendingNovelCreation[],retry:vi.fn(),open:vi.fn(),dismiss:vi.fn(),setPage:vi.fn(),createStory:vi.fn(),dialog:null as NovelCreateModalProps|null}))
vi.mock('@/app/hooks',()=>({useData:()=>({novelCreations:{...mocks,busy:()=>false},createStory:mocks.createStory}),useNavigation:()=>({setPage:mocks.setPage})}))
vi.mock('./NovelCreateDialog',()=>({NovelCreateDialog:(props:NovelCreateModalProps)=>{mocks.dialog=props;return <button onClick={()=>void props.onCreate(props.initialRequest!)}>Create reviewed draft</button>}}))
import { NovelPendingCreations } from './NovelPendingCreations'

beforeEach(()=>{vi.resetAllMocks();mocks.sessionKey='session-one';mocks.dialog=null;mocks.items=[{schema:1,write:{write:creationWrite()}}];mocks.retry.mockResolvedValue(creationAck());mocks.open.mockResolvedValue({});mocks.createStory.mockResolvedValue({})})
it('recovers a request first and opens its manuscript only on the separate explicit action',async()=>{
    const resolved=vi.fn(),view=render(<NovelPendingCreations onResolved={resolved}/>)
    fireEvent.click(screen.getByRole('button',{name:'Recover creation result'}))
    await waitFor(()=>expect(resolved).toHaveBeenCalledOnce())
    expect(mocks.setPage).not.toHaveBeenCalled()
    mocks.items=[{schema:1,write:{write:creationWrite(),ack:creationAck()}}];view.rerender(<NovelPendingCreations onResolved={resolved}/>)
    fireEvent.click(screen.getByRole('button',{name:'Open novel'}))
    await waitFor(()=>expect(mocks.setPage).toHaveBeenCalledWith('story'))
    expect(mocks.open).toHaveBeenCalledWith(mocks.items[0])
})
it('keeps editor review/save barriers before opening a confirmed result',async()=>{
    mocks.items=[{schema:1,write:{write:creationWrite(),ack:creationAck()}}]
    const beforeOpen=vi.fn().mockResolvedValue(false)
    render(<NovelPendingCreations beforeOpen={beforeOpen}/>)
    fireEvent.click(screen.getByRole('button',{name:'Open novel'}))
    await waitFor(()=>expect(beforeOpen).toHaveBeenCalledOnce())
    expect(mocks.open).not.toHaveBeenCalled()
    expect(mocks.setPage).not.toHaveBeenCalled()
})
it('reports device storage failure and archived retries without hiding recovery',async()=>{
    mocks.items[0].storageFailed=true
    mocks.retry.mockRejectedValue(new ApiError(409,'Archived',{code:'WORKSPACE_ARCHIVED'}))
    render(<NovelPendingCreations/>)
    expect(screen.getByText(/Keep this tab open/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Recover creation result'}))
    expect(await screen.findByRole('alert')).toHaveTextContent('The workspace is archived')
})
it('does not refresh or navigate a view closed during recovery',async()=>{
    let finish!:(value:ReturnType<typeof creationAck>)=>void
    mocks.retry.mockImplementation(()=>new Promise((resolve)=>{finish=resolve}))
    const resolved=vi.fn(),view=render(<NovelPendingCreations onResolved={resolved}/>)
    fireEvent.click(screen.getByRole('button',{name:'Recover creation result'}));view.unmount()
    await act(async()=>{finish(creationAck())})
    expect(resolved).not.toHaveBeenCalled();expect(mocks.setPage).not.toHaveBeenCalled()
})
it('checks the rejected receipt before reopening exact authored material for a new reviewed request',async()=>{
    const template=writingTemplate('custom',(key)=>key)
    template.chapters[0].wordGoal=700
    const write={requestId:'rejected-source',title:'The gate',template,expectedSourceVersion:'a'.repeat(64),
        approvedMaterials:[{key:'arrival',kind:'approved_adventure_material' as const,title:'Arrival',text:'  Exact quotation 🙂.  '}]}
    mocks.items=[{schema:1,write:{write,rejected:'review_required'}}];mocks.retry.mockResolvedValue(null)
    const beforeOpen=vi.fn().mockResolvedValue(true)
    render(<NovelPendingCreations beforeOpen={beforeOpen}/>)
    expect(screen.getByText(/original title, outline and reference material are retained/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Review retained draft'}))
    await screen.findByRole('button',{name:'Create reviewed draft'})
    expect(mocks.retry).toHaveBeenCalledWith(mocks.items[0]);expect(mocks.createStory).not.toHaveBeenCalled()
    const expected={title:write.title,template:write.template,approvedMaterials:write.approvedMaterials}
    expect(mocks.dialog?.initialRequest).toEqual(expected)
    fireEvent.click(screen.getByRole('button',{name:'Create reviewed draft'}))
    await waitFor(()=>expect(mocks.createStory).toHaveBeenCalledWith(expected,{replaceRejectedRequestId:'rejected-source'}))
    expect(beforeOpen).toHaveBeenCalledOnce()
    await waitFor(()=>expect(mocks.setPage).toHaveBeenCalledWith('story'))
})
it('requires explicit confirmation before discarding a retained creation draft',async()=>{
    mocks.items=[{schema:1,write:{write:creationWrite(),rejected:'review_required'}}]
    render(<NovelPendingCreations/>)
    fireEvent.click(screen.getByRole('button',{name:'Discard creation draft'}))
    const dialog=await screen.findByRole('dialog',{name:'Discard retained creation draft?'})
    expect(dialog).toHaveTextContent('Existing novels are unaffected.')
    expect(mocks.dismiss).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole('button',{name:'Discard creation draft'}))
    expect(mocks.dismiss).toHaveBeenCalledWith(mocks.items[0])
})
it('ignores a late recovery after a workspace change and permits recovery in the new scope',async()=>{
    let finish!:(value:ReturnType<typeof creationAck>)=>void
    mocks.retry.mockImplementationOnce(()=>new Promise((resolve)=>{finish=resolve}))
    const resolved=vi.fn(),view=render(<NovelPendingCreations onResolved={resolved}/>)
    fireEvent.click(screen.getByRole('button',{name:'Recover creation result'}))
    mocks.sessionKey='session-two';view.rerender(<NovelPendingCreations onResolved={resolved}/>)
    expect(screen.getByRole('button',{name:'Recover creation result'})).toBeEnabled()
    await act(async()=>{finish(creationAck())})
    expect(resolved).not.toHaveBeenCalled();expect(mocks.setPage).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button',{name:'Recover creation result'}))
    await waitFor(()=>expect(resolved).toHaveBeenCalledOnce())
})
