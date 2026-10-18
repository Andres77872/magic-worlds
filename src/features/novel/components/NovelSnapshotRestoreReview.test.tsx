import { snapshotNoteReaders } from '@/test/fixtures/storySnapshotNotes'
import { act,fireEvent,render,screen,waitFor,within } from '@testing-library/react'
import { beforeEach,expect,it,vi } from 'vitest'
import type { StorySnapshotRestoreOperation,StorySnapshotRestorePreview } from '@/shared'
import type { StorySnapshotSource } from '../hooks/useSnapshotSource'
import { snapshotComparison,snapshotPage,snapshotPreview,snapshotRestoreOptions,snapshotRestorePreview,snapshotStory,snapshotView } from '@/test/fixtures/storySnapshots'
import { NovelSnapshotRestoreReview } from './NovelSnapshotRestoreReview'

const before=vi.fn(),operate=vi.fn(),recover=vi.fn(),done=vi.fn()
let source:StorySnapshotSource
const props=()=>({open:true,onClose:vi.fn(),onRestored:done,snapshot:snapshotComparison(),source,structureRevision:5,readOnly:false,busy:false,beforeWrite:before,operate,recover})
beforeEach(()=>{
    vi.clearAllMocks();before.mockResolvedValue(true);operate.mockResolvedValue(snapshotStory(true));recover.mockResolvedValue(snapshotStory(true))
    source={...snapshotNoteReaders,key:'author:workspace:story-1',isCurrent:()=>true,list:vi.fn().mockResolvedValue(snapshotPage()),preview:vi.fn().mockResolvedValue(snapshotPreview()),compare:vi.fn().mockResolvedValue(snapshotComparison()),scene:vi.fn().mockResolvedValue(snapshotView()),currentScene:vi.fn().mockResolvedValue(snapshotStory(true).chapters[0].scenes[0]),restorePreview:vi.fn(async(_id,options)=>snapshotRestorePreview(options))}
})
it('requires both save/review barriers and one exact immutable restore after review',async()=>{
    before.mockResolvedValueOnce(false).mockResolvedValueOnce(true).mockResolvedValueOnce(false).mockResolvedValue(true)
    render(<NovelSnapshotRestoreReview {...props()}/>)
    fireEvent.click(screen.getByRole('button',{name:'Review restore'}))
    await screen.findByRole('alert');expect(source.restorePreview).not.toHaveBeenCalled()
    await waitFor(()=>expect(screen.getByRole('button',{name:'Review restore'})).toBeEnabled())
    fireEvent.click(screen.getByRole('switch',{name:'Writing details and notes'}))
    fireEvent.click(screen.getByRole('button',{name:'Review restore'}))
    await screen.findByRole('region',{name:'Changes to apply'})
    expect(source.restorePreview).toHaveBeenCalledWith(3,{...snapshotRestoreOptions(),details:false})
    fireEvent.click(screen.getByRole('button',{name:'Apply manuscript restore'}))
    await screen.findByRole('alert');expect(operate).not.toHaveBeenCalled()
    await waitFor(()=>expect(screen.getByRole('button',{name:'Apply manuscript restore'})).toBeEnabled())
    fireEvent.click(screen.getByRole('button',{name:'Apply manuscript restore'}));fireEvent.click(screen.getByRole('button',{name:'Apply manuscript restore'}))
    await waitFor(()=>expect(operate).toHaveBeenCalledOnce())
    expect(operate).toHaveBeenCalledWith({op:'restore_snapshot',snapshotId:3,manifestHash:'d'.repeat(64),expectedSourceVersion:'c'.repeat(64),sourceStructureRevision:5,options:{...snapshotRestoreOptions(),details:false}})
    expect(done).toHaveBeenCalledOnce();expect(before).toHaveBeenCalledTimes(4)
})
it('shows exact notes and original/current prose for the selected restore effect',async()=>{
    render(<NovelSnapshotRestoreReview {...props()}/>)
    fireEvent.click(screen.getByRole('button',{name:'Review restore'}))
    fireEvent.click(await screen.findByRole('button',{name:/Scene · At the gate/}))
    const detail=await screen.findByRole('region',{name:'Restore change details'})
    expect(within(detail).getByText('Original scene notes.')).toBeInTheDocument()
    expect(within(detail).getByText('Later scene notes.')).toBeInTheDocument()
    expect(await within(detail).findByText('The original gate held.')).toBeInTheDocument()
    expect(within(detail).getByText('The current gate opens.')).toBeInTheDocument()
    expect(operate).not.toHaveBeenCalled()
})
it('never applies a changed source automatically and requires an explicit refreshed review',async()=>{
    const p=props(),view=render(<NovelSnapshotRestoreReview {...p}/>)
    fireEvent.click(screen.getByRole('button',{name:'Review restore'}));await screen.findByRole('button',{name:'Apply manuscript restore'})
    view.rerender(<NovelSnapshotRestoreReview {...p} operationError="STORY_SNAPSHOT_SOURCE_CHANGED"/>)
    expect(screen.queryByRole('button',{name:'Apply manuscript restore'})).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Refresh restore review'}))
    await waitFor(()=>expect(source.restorePreview).toHaveBeenCalledTimes(2))
    expect(operate).not.toHaveBeenCalled()
})
it('requires refreshed review when the current prose read no longer matches its prepared head',async()=>{
    source.currentScene=vi.fn().mockResolvedValue({...snapshotStory(true).chapters[0].scenes[0],revision:4})
    render(<NovelSnapshotRestoreReview {...props()}/>)
    fireEvent.click(screen.getByRole('button',{name:'Review restore'}))
    fireEvent.click(await screen.findByRole('button',{name:/Scene · At the gate/}))
    expect(await screen.findByRole('alert')).toHaveTextContent('saved manuscript changed')
    expect(screen.queryByRole('button',{name:'Apply manuscript restore'})).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Refresh restore review'}))
    await waitFor(()=>expect(source.restorePreview).toHaveBeenCalledTimes(2))
    expect(operate).not.toHaveBeenCalled()
})
it('locks archived uncertain restore choices to their original request and offers result recovery',async()=>{
    const operation:StorySnapshotRestoreOperation={op:'restore_snapshot',snapshotId:3,manifestHash:'d'.repeat(64),expectedSourceVersion:'c'.repeat(64),sourceStructureRevision:5,options:{...snapshotRestoreOptions(),details:false}}
    render(<NovelSnapshotRestoreReview {...props()} pendingOperation={operation} readOnly/>)
    expect(screen.getByRole('switch',{name:'Writing details and notes'})).not.toBeChecked()
    expect(screen.getByRole('switch',{name:'Writing details and notes'})).toBeDisabled()
    fireEvent.click(screen.getByRole('button',{name:'Recover request'}))
    await waitFor(()=>expect(recover).toHaveBeenCalledOnce())
    expect(source.restorePreview).not.toHaveBeenCalled();expect(operate).not.toHaveBeenCalled()
})
it('lists later units and blocks a restore that would hide them without an explicit choice',async()=>{
    source.restorePreview=vi.fn().mockResolvedValue({...snapshotRestorePreview(),laterUnits:[{id:'scene-1',kind:'scene',title:'Later writing'}],blockers:[{code:'STORY_SNAPSHOT_LATER_UNITS_HIDDEN',ids:['scene-1']}],canRestore:false})
    render(<NovelSnapshotRestoreReview {...props()}/>)
    fireEvent.click(screen.getByRole('button',{name:'Review restore'}))
    expect(await screen.findByText(/Scene · Later writing/)).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('would hide later units')
    expect(screen.getByRole('button',{name:'Apply manuscript restore'})).toBeDisabled()
    expect(operate).not.toHaveBeenCalled()
})
it('retains unsent choices on closure and ignores a late result after its scope is replaced',async()=>{
    let finish!:(value:StorySnapshotRestorePreview)=>void
    source.restorePreview=vi.fn(()=>new Promise<StorySnapshotRestorePreview>((resolve)=>{finish=resolve}))
    const p=props(),view=render(<NovelSnapshotRestoreReview {...p}/>)
    fireEvent.click(screen.getByRole('switch',{name:'Writing details and notes'}))
    view.rerender(<NovelSnapshotRestoreReview {...p} open={false}/>)
    view.rerender(<NovelSnapshotRestoreReview {...p}/>)
    expect(screen.getByRole('switch',{name:'Writing details and notes'})).not.toBeChecked()
    fireEvent.click(screen.getByRole('button',{name:'Review restore'}))
    await waitFor(()=>expect(source.restorePreview).toHaveBeenCalledOnce())
    view.unmount()
    await act(async()=>{finish(snapshotRestorePreview())})
    expect(operate).not.toHaveBeenCalled();expect(done).not.toHaveBeenCalled()
})
