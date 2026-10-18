import { act,fireEvent,render,screen,waitFor,within } from '@testing-library/react'
import { beforeEach,expect,it,vi } from 'vitest'
import type { StoryStructureHistoryPage } from '@/shared'
import { novel } from '@/test/fixtures/story'
import { historyDetail,historyPage,historyRow } from '@/test/fixtures/storyHistory'
import { snapshotManifest,snapshotStory } from '@/test/fixtures/storySnapshots'
import { NovelStructureHistory,type StoryHistorySource } from './NovelStructureHistory'

let source:StoryHistorySource
const before=vi.fn(),operate=vi.fn()
const props=()=>({source,structureRevision:3,readOnly:false,busy:false,beforeWrite:before,operate})
beforeEach(()=>{
    vi.clearAllMocks()
    source={key:'story-1:author-workspace',isCurrent:()=>true,readPage:vi.fn().mockResolvedValue(historyPage()),readRevision:vi.fn().mockResolvedValue(historyDetail())}
    before.mockResolvedValue(true);operate.mockResolvedValue(novel({structureRevision:4}))
})
it('shows saved novel details and frozen Codex contents before reversing a manuscript restore',async()=>{
    const detail=historyDetail({action:'restore_snapshot',targetAction:'restore_snapshot',operation:{op:'restore_snapshot',snapshotId:2}})
    detail.before!.novel=snapshotManifest(true).novel;detail.after.novel=snapshotManifest().novel
    const old=snapshotStory(true).activeCardRefs[0],saved=snapshotStory().activeCardRefs[0]
    detail.referenceChanges=[{id:old.id,before:{enabled:old.enabled,removedAt:old.removedAt,reference:old},after:{enabled:saved.enabled,removedAt:saved.removedAt,reference:saved}}]
    source.readRevision=vi.fn().mockResolvedValue(detail)
    source.readPage=vi.fn().mockResolvedValue(historyPage({undo:{revision:3,operationRevision:3,action:'restore_snapshot'}}))
    render(<NovelStructureHistory {...props()}/>)
    await waitFor(()=>expect(screen.getByRole('button',{name:'Review undo'})).toBeEnabled())
    fireEvent.click(screen.getByRole('button',{name:'Review undo'}))
    const review=await screen.findByRole('dialog',{name:'Review history change'})
    expect(within(review).getByRole('region',{name:'Novel details'})).toHaveTextContent('The revised gate')
    expect(within(review).getByRole('region',{name:'Codex reference change'})).toHaveTextContent('Original frozen notes.')
    expect(within(review).getByText('Later local notes.')).toBeInTheDocument()
    expect(operate).not.toHaveBeenCalled()
})
it('compares saved parents, observes both save/review barriers and submits one exact reviewed undo',async()=>{
    before.mockResolvedValueOnce(false).mockResolvedValue(true)
    render(<NovelStructureHistory {...props()}/>)
    const undo=await screen.findByRole('button',{name:'Review undo'})
    await waitFor(()=>expect(undo).toBeEnabled())
    fireEvent.click(undo)
    expect(await screen.findByRole('alert')).toHaveTextContent('Finish the AI review')
    expect(source.readRevision).not.toHaveBeenCalled()
    await waitFor(()=>expect(undo).toBeEnabled())
    fireEvent.click(undo)
    const review=await screen.findByRole('dialog',{name:'Review history change'})
    expect(within(review).getByText(/Beyond the gate · Position 1/)).toBeInTheDocument()
    expect(within(review).getByText(/Opening · Position 1/)).toBeInTheDocument()
    const apply=within(review).getByRole('button',{name:'Apply history change'})
    fireEvent.click(apply);fireEvent.click(apply)
    await waitFor(()=>expect(operate).toHaveBeenCalledOnce())
    expect(operate).toHaveBeenCalledWith({op:'undo_structure',revision:3,sourceStructureRevision:3})
    expect(before).toHaveBeenCalledTimes(3)
})
it('retains readable history while archived or awaiting an uncertain structure receipt',async()=>{
    const view=render(<NovelStructureHistory {...props()} readOnly/>)
    const row=await screen.findByRole('button',{name:'Revision 3 · Move'})
    expect(screen.getByRole('button',{name:'Review undo'})).toBeDisabled()
    fireEvent.click(row)
    expect(await screen.findByRole('region',{name:'Organization comparison'})).toHaveTextContent('Opening')
    view.rerender(<NovelStructureHistory {...props()} pendingOperation={{op:'undo_structure',revision:3,sourceStructureRevision:3}}/>)
    expect(screen.getByRole('button',{name:'Review undo'})).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('awaiting confirmation')
    expect(operate).not.toHaveBeenCalled()
})
it('requires refreshed review after a definite text conflict and keeps the current text message visible',async()=>{
    const clear=vi.fn(),view=render(<NovelStructureHistory {...props()} clearOperationError={clear}/>)
    await waitFor(()=>expect(screen.getByRole('button',{name:'Review undo'})).toBeEnabled())
    fireEvent.click(screen.getByRole('button',{name:'Review undo'}))
    const review=await screen.findByRole('dialog',{name:'Review history change'})
    view.rerender(<NovelStructureHistory {...props()} operationError="STORY_REVISION_CONFLICT" clearOperationError={clear}/>)
    expect(within(review).getByRole('button',{name:'Apply history change'})).toBeDisabled()
    expect(within(review).getByRole('alert')).toHaveTextContent('current text is retained')
    fireEvent.click(within(review).getByRole('button',{name:'Cancel'}))
    fireEvent.click(screen.getByRole('button',{name:'Refresh history'}))
    expect(clear).toHaveBeenCalledOnce()
    expect(operate).not.toHaveBeenCalled()
})
it('does not expose late history from a previous scope',async()=>{
    let finish!:(value:StoryStructureHistoryPage)=>void
    source.readPage=vi.fn(()=>new Promise<StoryStructureHistoryPage>((resolve)=>{finish=resolve}))
    const view=render(<NovelStructureHistory {...props()}/>)
    const next={...source,key:'story-2:another-workspace',readPage:vi.fn().mockResolvedValue(historyPage({storyId:'story-2',items:[historyRow({action:'create',targetAction:'create',title:'A new opening'})]}))}
    view.rerender(<NovelStructureHistory {...props()} source={next}/>)
    await screen.findByRole('button',{name:'Revision 3 · Create · A new opening'})
    await act(async()=>{finish(historyPage({items:[historyRow({title:'Private former manuscript'})]}))})
    expect(screen.queryByText(/Private former manuscript/)).not.toBeInTheDocument()
})
it('loads older pages by their cursor and retries a failed read without losing current rows',async()=>{
    const newest=historyPage({structureRevision:100,undo:null,items:Array.from({length:50},(_,index)=>historyRow({revision:100-index,parentRevision:99-index,operationRevision:100-index})),nextBefore:51})
    const older=historyPage({structureRevision:100,undo:null,items:[historyRow({revision:50,parentRevision:49,operationRevision:50})]})
    source.readPage=vi.fn().mockResolvedValueOnce(newest).mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce(older)
    render(<NovelStructureHistory {...props()} structureRevision={100}/>)
    fireEvent.click(await screen.findByRole('button',{name:'Load older changes'}))
    await screen.findByRole('alert')
    expect(screen.getByRole('button',{name:'Revision 100 · Move'})).toBeInTheDocument()
    await waitFor(()=>expect(screen.getByRole('button',{name:'Load older changes'})).toBeEnabled())
    fireEvent.click(screen.getByRole('button',{name:'Load older changes'}))
    await screen.findByRole('button',{name:'Revision 50 · Move'})
    expect(source.readPage).toHaveBeenLastCalledWith({before:51})
    expect(operate).not.toHaveBeenCalled()
})
it('filters by recorded dates and rejects reversed dates before a remote read',async()=>{
    render(<NovelStructureHistory {...props()}/>)
    await screen.findByRole('button',{name:'Revision 3 · Move'})
    fireEvent.change(screen.getByLabelText('From date'),{target:{value:'2026-10-01'}})
    await waitFor(()=>expect(source.readPage).toHaveBeenLastCalledWith({fromDate:'2026-10-01'}))
    fireEvent.change(screen.getByLabelText('Through date'),{target:{value:'2026-09-30'}})
    await screen.findByText('Choose an end date on or after the start date.')
    expect(source.readPage).toHaveBeenCalledTimes(2)
})
it('refreshes the manuscript as well as history when another client advanced the outline',async()=>{
    source.refreshStory=vi.fn().mockResolvedValue(undefined)
    const view=render(<NovelStructureHistory {...props()} structureRevision={2}/>)
    await screen.findByRole('button',{name:'Revision 3 · Move'})
    expect(screen.getByRole('button',{name:'Review undo'})).toBeDisabled()
    fireEvent.click(screen.getByRole('button',{name:'Refresh history'}))
    await waitFor(()=>expect(source.refreshStory).toHaveBeenCalledOnce())
    view.rerender(<NovelStructureHistory {...props()} structureRevision={3}/>)
    await waitFor(()=>expect(screen.getByRole('button',{name:'Review undo'})).toBeEnabled())
})
it('shows an older saved outline without offering an unverified inverse',async()=>{
    source.readPage=vi.fn().mockResolvedValue(historyPage({undo:null,items:[historyRow({reversible:false})]}))
    source.readRevision=vi.fn().mockResolvedValue(historyDetail({before:null,reversible:false}))
    render(<NovelStructureHistory {...props()}/>)
    fireEvent.click(await screen.findByRole('button',{name:'Revision 3 · Move'}))
    const comparison=await screen.findByRole('region',{name:'Organization comparison'})
    expect(within(comparison).getByText('Opening',{exact:false})).toBeInTheDocument()
    expect(within(comparison).getByText(/no verified before-state/)).toBeInTheDocument()
    expect(screen.getByRole('button',{name:'Review undo'})).toBeDisabled()
})
