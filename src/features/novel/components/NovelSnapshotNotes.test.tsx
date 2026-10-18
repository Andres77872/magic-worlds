import { act,fireEvent,render,screen,waitFor,within } from '@testing-library/react'
import { beforeEach,expect,it,vi } from 'vitest'
import type { StorySnapshotAnnotationDetail } from '@/shared'
import type { StorySnapshotSource } from '../hooks/useSnapshotSource'
import { annotatedSnapshot,snapshotNoteReaders,snapshotNoteIndex,frozenPersonalNote } from '@/test/fixtures/storySnapshotNotes'
import { snapshotComparison,snapshotPreview,snapshotPage,snapshotView,snapshotStory,snapshotRestorePreview } from '@/test/fixtures/storySnapshots'
import { NovelSnapshotNotes } from './NovelSnapshotNotes'

let source:StorySnapshotSource
beforeEach(()=>{
    source={...snapshotNoteReaders,key:'author:workspace:story-1',isCurrent:()=>true,preview:async()=>snapshotPreview(),list:async()=>snapshotPage(),compare:async()=>snapshotComparison(),
        scene:vi.fn().mockResolvedValue(snapshotView()),currentScene:vi.fn().mockResolvedValue(snapshotStory(true).chapters[0].scenes[0]),restorePreview:async(_id,options)=>snapshotRestorePreview(options),
        notes:vi.fn(snapshotNoteReaders.notes),note:vi.fn(snapshotNoteReaders.note)}
})
it('distinguishes notes not captured from a verified empty collection without reading live notes',()=>{
    const snapshot=snapshotComparison(),view=render(<NovelSnapshotNotes snapshot={snapshot} source={source}/>)
    expect(screen.getByText('This older snapshot did not capture personal notes.')).toBeInTheDocument()
    snapshot.manifest.annotations={revision:1,notes:[]};view.rerender(<NovelSnapshotNotes snapshot={snapshot} source={source}/>)
    expect(screen.getByText('No personal notes existed when this snapshot was captured.')).toBeInTheDocument()
    expect(source.notes).not.toHaveBeenCalled();expect(source.currentScene).not.toHaveBeenCalled()
})
it('lazily reads the historical body/status and resolves its exact captured passage',async()=>{
    const snapshot=annotatedSnapshot();render(<NovelSnapshotNotes snapshot={snapshot} source={source}/>)
    expect(source.notes).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button',{name:'Read captured notes'}))
    fireEvent.click(await screen.findByRole('button',{name:'Read captured note'}))
    const detail=await screen.findByRole('region',{name:'Captured personal note'})
    expect(within(detail).getByText(frozenPersonalNote().body)).toBeInTheDocument()
    expect(within(detail).getByText('Resolved')).toBeInTheDocument()
    fireEvent.click(within(detail).getByRole('button',{name:'Read captured passage'}))
    await waitFor(()=>expect(detail.querySelector('mark')?.textContent).toBe('original'))
    expect(source.scene).toHaveBeenCalledWith(3,snapshot.manifest.chapters[0].scenes[0],snapshot.manifestHash)
    expect(source.currentScene).not.toHaveBeenCalled()
})
it('shows a verification failure without substituting current prose or note content',async()=>{
    source.scene=vi.fn().mockResolvedValue({...snapshotView(),scene:snapshotStory(true).chapters[0].scenes[0]})
    render(<NovelSnapshotNotes snapshot={annotatedSnapshot()} source={source}/>)
    fireEvent.click(screen.getByRole('button',{name:'Read captured notes'}));fireEvent.click(await screen.findByRole('button',{name:'Read captured note'}))
    fireEvent.click(await screen.findByRole('button',{name:'Read captured passage'}));await screen.findByRole('alert')
    expect(document.querySelector('mark')).toBeNull();expect(screen.queryByText('The current gate opens.')).not.toBeInTheDocument()
    expect(source.currentScene).not.toHaveBeenCalled()
})
it('retains an orphan quote and does not read a scene guessed from equal text',async()=>{
    const snapshot=annotatedSnapshot(),index={...snapshotNoteIndex(),anchorState:'orphaned' as const,orphanReason:'crosses_scene_split' as const}
    snapshot.manifest.annotations!.notes=[index]
    source.note=vi.fn().mockResolvedValue({...await snapshotNoteReaders.note(snapshot,index),note:{...frozenPersonalNote(),anchor:null,anchorState:'orphaned',orphanReason:'crosses_scene_split'}})
    render(<NovelSnapshotNotes snapshot={snapshot} source={source}/>)
    fireEvent.click(screen.getByRole('button',{name:'Read captured notes'}));fireEvent.click(await screen.findByRole('button',{name:'Read captured note'}))
    const detail=await screen.findByRole('region',{name:'Captured personal note'})
    expect(within(detail).getByText('original')).toBeInTheDocument();expect(within(detail).queryByRole('button',{name:'Read captured passage'})).not.toBeInTheDocument()
    expect(source.scene).not.toHaveBeenCalled()
})
it('ignores an old note read after changing account/workspace subscription',async()=>{
    let finish!:(value:StorySnapshotAnnotationDetail)=>void
    source.note=vi.fn(()=>new Promise<StorySnapshotAnnotationDetail>((resolve)=>{finish=resolve}))
    const snapshot=annotatedSnapshot(),view=render(<NovelSnapshotNotes key={source.key} snapshot={snapshot} source={source}/>)
    fireEvent.click(screen.getByRole('button',{name:'Read captured notes'}));fireEvent.click(await screen.findByRole('button',{name:'Read captured note'}))
    view.rerender(<NovelSnapshotNotes key="other-owner" snapshot={snapshotComparison()} source={{...source,key:'other-owner'}}/>)
    await act(async()=>finish(await snapshotNoteReaders.note(snapshot,snapshotNoteIndex())))
    expect(screen.queryByRole('region',{name:'Captured personal note'})).not.toBeInTheDocument()
})

it('separates captured bookmark counts and point reads from personal notes and current account text',async()=>{
    const snapshot=annotatedSnapshot(),prior=frozenPersonalNote(),point={...prior.lastAnchor,start:{nodeId:'scene-1-p',offset:4},end:{nodeId:'scene-1-p',offset:4},quote:''}
    const bookmark={...prior,id:'bookmark-1',kind:'bookmark' as const,body:'Frozen crossing label',state:'open' as const,origin:point,anchor:point,lastAnchor:point}
    const index={...snapshotNoteIndex(),id:bookmark.id,kind:'bookmark' as const,state:'open' as const,bodyPreview:bookmark.body,quotePreview:''}
    snapshot.manifest.annotations!.notes.unshift(index)
    source.note=vi.fn(async()=>({...await snapshotNoteReaders.note(snapshot,index),note:bookmark}))
    render(<NovelSnapshotNotes snapshot={snapshot} source={source}/>)
    expect(screen.getByText('Personal notes captured: 1')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Bookmarks'}))
    expect(screen.getByText('Bookmarks captured: 1')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Read captured bookmarks'}))
    fireEvent.click(await screen.findByRole('button',{name:'Read captured bookmark'}))
    expect(source.notes).toHaveBeenCalledWith(snapshot,{kind:'bookmark'})
    const detail=await screen.findByRole('region',{name:'Captured bookmark'});expect(detail).toHaveTextContent('Frozen crossing label')
    fireEvent.click(within(detail).getByRole('button',{name:'Read captured location'}))
    await waitFor(()=>expect(detail.querySelector('mark')?.textContent).toBe('│'))
    expect(source.currentScene).not.toHaveBeenCalled()
})
