import { fireEvent,render,screen,waitFor,within } from '@testing-library/react'
import { expect,it,vi } from 'vitest'
import { planItem,planItems } from '@/test/fixtures/planItems'
import { NovelReviewDrawer,type NovelReviewDrawerProps } from './NovelReviewDrawer'

const selection={sceneId:'arrival',quote:'Mara kept the lamp',revision:4}
function setup(patch:Partial<NovelReviewDrawerProps>={}){
    const props:NovelReviewDrawerProps={open:true,onClose:vi.fn(),readOnly:false,tasks:planItems('task'),stash:planItems('stash'),
        sceneTitle:(id)=>id==='arrival'?'The arrival':null,getSelection:()=>selection,cutSelection:vi.fn(()=>true),insertText:vi.fn(()=>true),
        onOpenPassage:vi.fn(async()=>'opened' as const),...patch}
    const view=render(<NovelReviewDrawer {...props}/>)
    return {props,rerender:()=>view.rerender(<NovelReviewDrawer {...props}/>)}
}

it('adds a task linked to the selected passage and resolves it with a note',async()=>{
    const {props,rerender}=setup()
    fireEvent.click(screen.getByRole('button',{name:'New task'}))
    fireEvent.change(screen.getByLabelText('Task'),{target:{value:'Check the winters count'}})
    expect(screen.getByLabelText('Link the selected passage')).toBeChecked()
    fireEvent.click(screen.getByRole('button',{name:'Add task'}))
    await waitFor(()=>expect(props.tasks.create).toHaveBeenCalledWith({title:'Check the winters count',origin:'author',sceneId:'arrival',quote:'Mara kept the lamp',sourceRevision:4}))
    rerender()
    const row=screen.getByText('Check the winters count').closest('li')!
    expect(within(row).getByText('The arrival')).toBeInTheDocument()
    fireEvent.click(within(row).getByRole('button',{name:'Go to passage'}))
    await waitFor(()=>expect(props.onOpenPassage).toHaveBeenCalledWith('arrival','Mara kept the lamp'))
    fireEvent.click(within(row).getByRole('button',{name:'Mark done'}))
    fireEvent.change(within(row).getByLabelText('How it was resolved (optional)'),{target:{value:'Changed to twelve'}})
    fireEvent.click(within(row).getByRole('button',{name:'Save as done'}))
    await waitFor(()=>expect(props.tasks.update).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({title:'Check the winters count'})}),
        {state:'done',data:expect.objectContaining({resolution:'Changed to twelve'})}))
    rerender()
    expect(screen.getByText('No tasks here.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Done'}))
    expect(screen.getByText('Resolution: Changed to twelve')).toBeInTheDocument()
})

it('cuts text out of the manuscript only after the stash holds it, and inserts it back',async()=>{
    const order:string[]=[]
    const stash=planItems('stash')
    const create=stash.create;stash.create=vi.fn(async(...args:Parameters<typeof create>)=>{order.push('saved');return create(...args)})
    const cut=vi.fn(()=>{order.push('cut');return true})
    const {props,rerender}=setup({stash,cutSelection:cut})
    fireEvent.click(screen.getByRole('tab',{name:'Stash'}))
    fireEvent.click(screen.getByRole('button',{name:'Cut selection to stash'}))
    await waitFor(()=>expect(cut).toHaveBeenCalledWith('Mara kept the lamp'))
    expect(order).toEqual(['saved','cut'])
    expect(await screen.findByText('Moved to the stash. Undo in Write restores the text.')).toBeInTheDocument()
    rerender()
    fireEvent.click(screen.getByRole('button',{name:'Insert at cursor'}))
    expect(props.insertText).toHaveBeenCalledWith('Mara kept the lamp')
    fireEvent.change(screen.getByLabelText('Search the stash'),{target:{value:'nothing like it'}})
    expect(screen.getByText('Nothing in the stash matches.')).toBeInTheDocument()
})

it('keeps a failed save from cutting text and stays readable when read-only',async()=>{
    const stash=planItems('stash',[planItem('stash',{kind:'take',title:'Older opening',text:'The sea gave her a letter.'})])
    stash.create=vi.fn(async()=>{throw new Error('offline')})
    const cut=vi.fn(()=>true)
    setup({stash,cutSelection:cut})
    fireEvent.click(screen.getByRole('tab',{name:'Stash'}))
    fireEvent.click(screen.getByRole('button',{name:'Cut selection to stash'}))
    expect(await screen.findByRole('alert')).toHaveTextContent('That change was not saved.')
    expect(cut).not.toHaveBeenCalled()
})

it('hides every write while read-only',()=>{
    setup({readOnly:true,tasks:planItems('task',[planItem('task',{title:'Read me',origin:'continuity',sceneId:'arrival'})])})
    expect(screen.getByText('Read me')).toBeInTheDocument();expect(screen.getByText('Continuity check')).toBeInTheDocument()
    expect(screen.queryByRole('button',{name:'New task'})).not.toBeInTheDocument()
    expect(screen.queryByRole('button',{name:'Mark done'})).not.toBeInTheDocument()
    expect(screen.getByRole('button',{name:'Open scene'})).toBeInTheDocument()
})
