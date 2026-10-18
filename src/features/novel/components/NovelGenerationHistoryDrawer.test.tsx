import { act,fireEvent,render,screen,waitFor,within } from '@testing-library/react'
import { afterEach,expect,it,vi } from 'vitest'
import { generationSummary,generationDetail } from '@/test/fixtures/storyStudio'
import { authorVariantFixture } from '@/test/fixtures/authorVariants'
import { refinementSourceReference } from '@/infrastructure/api/variantRefinementContract'
import type { HistoryGeneration,HistoryGenerationRow } from '../hooks/useGenerationHistory'
import { NovelGenerationHistoryDrawer } from './NovelGenerationHistoryDrawer'
const clipboardDescriptor=Object.getOwnPropertyDescriptor(navigator,'clipboard')
it('reads the original authored refinement source separately from a later generation, including in read-only history',async()=>{
    const f=authorVariantFixture(),source={...f.snapshot.parent,variant:f.snapshot}
    const generation={...generationDetail().generation,chapterTitle:'Opening',refinementSource:refinementSourceReference(source)}
    const read=vi.fn(async()=>source)
    render(<NovelGenerationHistoryDrawer open generations={[generation]} onClose={()=>{}} readOnly onReadRefinementSource={read}/>)
    fireEvent.click(screen.getByRole('button',{name:'Read full generation'}))
    const dialog=await screen.findByRole('dialog',{name:'Saved generation'})
    fireEvent.click(within(dialog).getByRole('button',{name:'Read refinement source'}))
    expect(await within(dialog).findByText('Refining your saved version: '+f.snapshot.title)).toBeVisible()
    expect(read).toHaveBeenCalledWith(generation.refinementSource,expect.any(AbortSignal))
    expect(within(dialog).getByText(generation.output)).toBeVisible()
    expect(within(dialog).queryByRole('button',{name:'Refine suggestion'})).not.toBeInTheDocument()
})

it('retires a pending history source reader when the account scope changes',async()=>{
    const f=authorVariantFixture(),source={...f.snapshot.parent,variant:f.snapshot}
    const generation={...generationDetail().generation,chapterTitle:'Opening',refinementSource:refinementSourceReference(source)}
    let finish!:(value:typeof source)=>void
    const read=vi.fn<NonNullable<Parameters<typeof NovelGenerationHistoryDrawer>[0]['onReadRefinementSource']>>(()=>new Promise<typeof source>(resolve=>{finish=resolve}))
    const props={open:true,generations:[generation],onClose:()=>{},onReadRefinementSource:read}
    const view=render(<NovelGenerationHistoryDrawer {...props} scopeKey="account-a"/>)
    fireEvent.click(screen.getByRole('button',{name:'Read full generation'}))
    fireEvent.click(await screen.findByRole('button',{name:'Read refinement source'}))
    view.rerender(<NovelGenerationHistoryDrawer {...props} scopeKey="account-b"/>)
    await act(async()=>finish(source))
    expect(screen.queryByText('Refining your saved version: '+f.snapshot.title)).not.toBeInTheDocument()
    expect(read.mock.calls[0][1].aborted).toBe(true)
})
it('keeps authored versions reachable for terminal writing without offering a new edit',async()=>{
    const generation={...generationDetail().generation,status:'accepted' as const,chapterTitle:'Opening'},open=vi.fn()
    render(<NovelGenerationHistoryDrawer open generations={[generation]} onClose={()=>{}} onAuthorVersions={open}/>)
    fireEvent.click(screen.getByRole('button',{name:'Read full generation'}))
    const dialog=await screen.findByRole('dialog',{name:'Saved generation'})
    expect(within(dialog).queryByRole('button',{name:'Edit a version'})).not.toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button',{name:'Authored versions'}))
    expect(open).toHaveBeenCalledExactlyOnceWith(generation,false)
})
afterEach(()=>{if(clipboardDescriptor)Object.defineProperty(navigator,'clipboard',clipboardDescriptor);else Reflect.deleteProperty(navigator,'clipboard')})
it('copies the explicitly loaded complete output instead of the truncated preview',async()=>{
    const clipboard=vi.fn().mockResolvedValue(undefined),read=vi.fn().mockResolvedValue({...generationDetail().generation,chapterTitle:'Opening'})
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:clipboard}})
    render(<NovelGenerationHistoryDrawer open generations={[generationSummary({outputPreview:'A truncated passage',outputTruncated:true})]} onClose={()=>{}} onRead={read}/>)
    fireEvent.click(screen.getByRole('button',{name:'Copy to clipboard'}))
    await waitFor(()=>expect(clipboard).toHaveBeenCalledWith('The complete saved output.'))
    expect(read).toHaveBeenCalledOnce()
})
it('does not reopen a full generation when a closed history read resolves after reopening',async()=>{
    let finish!:(value:HistoryGeneration)=>void
    const read=vi.fn<(row:HistoryGenerationRow,signal?:AbortSignal)=>Promise<HistoryGeneration>>(()=>new Promise<HistoryGeneration>(resolve=>{finish=resolve})),rows=[generationSummary()]
    const view=render(<NovelGenerationHistoryDrawer open generations={rows} scopeKey="owner" onClose={()=>{}} onRead={read}/>)
    fireEvent.click(screen.getByRole('button',{name:'Read full generation'}))
    const signal=read.mock.calls[0][1]
    view.rerender(<NovelGenerationHistoryDrawer open={false} generations={rows} scopeKey="owner" onClose={()=>{}} onRead={read}/>)
    view.rerender(<NovelGenerationHistoryDrawer open generations={rows} scopeKey="owner" onClose={()=>{}} onRead={read}/>)
    await act(async()=>{finish({...generationDetail().generation,chapterTitle:'Opening'})})
    expect(signal?.aborted).toBe(true)
    expect(screen.queryByRole('dialog',{name:'Saved generation'})).not.toBeInTheDocument()
    expect(within(screen.getByRole('dialog',{name:'Generation history'})).getByText('The gate opened.')).toBeInTheDocument()
})

it.each(['candidate','stashed'] as const)('hands a complete %s to refinement and closes history only after success',async status=>{
    const generation={...generationDetail().generation,status,chapterTitle:'Opening'},refine=vi.fn(async()=>true),close=vi.fn()
    render(<NovelGenerationHistoryDrawer open generations={[generation]} onClose={close} onRefine={refine}/>)
    fireEvent.click(screen.getByRole('button',{name:'Read full generation'}))
    const dialog=await screen.findByRole('dialog',{name:'Saved generation'})
    expect(within(dialog).getByText(generation.output)).toBeVisible()
    fireEvent.click(within(dialog).getByRole('button',{name:'Refine suggestion'}))
    await waitFor(()=>expect(close).toHaveBeenCalledOnce())
    expect(refine).toHaveBeenCalledWith(generation,expect.any(AbortSignal))
})

it.each(['critique','readOnly'] as const)('keeps %s writing readable without a refinement action',async guard=>{
    const generation={...generationDetail().generation,chapterTitle:'Opening'}
    if(guard==='critique')generation.command='critique'
    render(<NovelGenerationHistoryDrawer open generations={[generation]} onClose={()=>{}} onRefine={vi.fn()} readOnly={guard==='readOnly'}/>)
    fireEvent.click(screen.getByRole('button',{name:'Read full generation'}))
    const dialog=await screen.findByRole('dialog',{name:'Saved generation'})
    expect(within(dialog).getByText(generation.output)).toBeVisible()
    expect(within(dialog).queryByRole('button',{name:'Refine suggestion'})).not.toBeInTheDocument()
})

it('retains the full original writing when refinement fails and allows an explicit retry',async()=>{
    const generation={...generationDetail().generation,chapterTitle:'Opening'},refine=vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true),close=vi.fn()
    render(<NovelGenerationHistoryDrawer open generations={[generation]} onClose={close} onRefine={refine}/>)
    fireEvent.click(screen.getByRole('button',{name:'Read full generation'}))
    const dialog=await screen.findByRole('dialog',{name:'Saved generation'})
    fireEvent.click(within(dialog).getByRole('button',{name:'Refine suggestion'}))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Its original writing is still here.')
    expect(within(dialog).getByText(generation.output)).toBeVisible();expect(close).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole('button',{name:'Refine suggestion'}))
    await waitFor(()=>expect(close).toHaveBeenCalledOnce())
})

it.each(['close','owner'] as const)('aborts a history handoff after %s and ignores its late success',async change=>{
    const generation={...generationDetail().generation,chapterTitle:'Opening'},close=vi.fn()
    let finish!:(ready:boolean)=>void
    const refine=vi.fn<(generation:HistoryGeneration,signal:AbortSignal)=>Promise<boolean>>(()=>new Promise<boolean>(resolve=>{finish=resolve}))
    const view=render(<NovelGenerationHistoryDrawer open generations={[generation]} scopeKey="author" onClose={close} onRefine={refine}/>)
    fireEvent.click(screen.getByRole('button',{name:'Read full generation'}))
    const dialog=await screen.findByRole('dialog',{name:'Saved generation'})
    fireEvent.click(within(dialog).getByRole('button',{name:'Refine suggestion'}))
    view.rerender(<NovelGenerationHistoryDrawer open={change!=='close'} generations={[generation]} scopeKey={change==='owner'?'another-author':'author'} onClose={close} onRefine={refine}/>)
    await act(async()=>{finish(true)})
    expect(refine.mock.calls[0][1].aborted).toBe(true)
    expect(close).not.toHaveBeenCalled()
})

it.each(['archived','trashed'] as const)('keeps an %s target readable without offering refinement',async location=>{
    const generation={...generationDetail().generation,chapterTitle:'Opening'},read=vi.fn(async()=>generation)
    render(<NovelGenerationHistoryDrawer open generations={[generationSummary({location})]} onClose={()=>{}} onRead={read} onRefine={vi.fn()}/>)
    fireEvent.click(screen.getByRole('button',{name:'Read full generation'}))
    const dialog=await screen.findByRole('dialog',{name:'Saved generation'})
    expect(within(dialog).getByText(generation.output)).toBeVisible()
    expect(within(dialog).queryByRole('button',{name:'Refine suggestion'})).not.toBeInTheDocument()
})

it('passes the refreshed terminal source status without granting old application authority',async()=>{
    const generation={...generationDetail().generation,chapterTitle:'Opening'},refine=vi.fn().mockResolvedValue(true)
    const view=render(<NovelGenerationHistoryDrawer open generations={[generation]} onClose={()=>{}} onRefine={refine}/>)
    fireEvent.click(screen.getByRole('button',{name:'Read full generation'}))
    const dialog=await screen.findByRole('dialog',{name:'Saved generation'})
    expect(within(dialog).getByRole('button',{name:'Refine suggestion'})).toBeEnabled()
    view.rerender(<NovelGenerationHistoryDrawer open generations={[{...generation,status:'accepted'}]} onClose={()=>{}} onRefine={refine}/>)
    fireEvent.click(within(dialog).getByRole('button',{name:'Refine suggestion'}))
    await waitFor(()=>expect(refine).toHaveBeenCalledWith({...generation,status:'accepted'},expect.any(AbortSignal)))
})
