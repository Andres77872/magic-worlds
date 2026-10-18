import { act,fireEvent,render,screen,waitFor } from '@testing-library/react'
import { expect,it,vi } from 'vitest'
import { unitCopyStory } from '@/test/fixtures/storyUnitCopy'
import { defaultStoryCopyOptions } from '@/shared/storyCopyOptions'
import { unitCopyOperation } from '@/shared/storyUnitCopy'
import { NovelUnitCopyModal } from './NovelUnitCopyModal'

const story=unitCopyStory(),source={kind:'chapter' as const,id:'chapter-1',title:'The gate'}
const props=()=>({source,loadSource:vi.fn().mockResolvedValue(story),beforeWrite:vi.fn().mockResolvedValue(true),operate:vi.fn().mockResolvedValue(story),onClose:vi.fn()})
it('reviews explicit notes, local context and lifecycle options against frozen source revisions',async()=>{
    const p=props();render(<NovelUnitCopyModal {...p}/>)
    expect(await screen.findByText('Scenes: 1 · words: 3')).toBeInTheDocument()
    expect(screen.queryByText('An earlier gate')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('switch',{name:'Include archived scenes'}))
    fireEvent.click(screen.getByRole('switch',{name:'Include scenes in Trash'}))
    fireEvent.click(screen.getByRole('switch',{name:'Include author notes'}))
    fireEvent.click(screen.getByRole('switch',{name:'Include local Codex context'}))
    expect(screen.getByText('Scenes: 3 · words: 9')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox',{name:'Title for the copy'}),{target:{value:'Another gate'}})
    fireEvent.click(screen.getByRole('button',{name:'Create copy'}))
    await waitFor(()=>expect(p.operate).toHaveBeenCalledWith({op:'duplicate',kind:'chapter',id:'chapter-1',title:'Another gate',expectedMetadataRevision:3,expectedContextRevision:4,sourceStructureRevision:8,
        options:{includeNotes:false,includeContext:false,includeArchived:true,includeTrash:true},sourceScenes:[
            {id:'scene-active',revision:7,metadataRevision:2},{id:'scene-archived',revision:1,metadataRevision:1},{id:'scene-trashed',revision:1,metadataRevision:1},
        ]}))
    expect(p.onClose).toHaveBeenCalledOnce()
})
it('counts only notes in included scenes and keeps their collection revision in the immutable copy request',async()=>{
    const p={...props(),loadAnnotations:vi.fn().mockResolvedValue({storyId:'story-1',annotationRevision:9,scenes:[{sceneId:'scene-active',open:2,resolved:1,trashed:1},{sceneId:'scene-archived',open:4,resolved:0,trashed:0},{sceneId:'scene-trashed',open:5,resolved:0,trashed:0}]})}
    render(<NovelUnitCopyModal {...p}/>);await screen.findByText('Personal review notes: 3')
    fireEvent.click(screen.getByRole('switch',{name:'Include archived scenes'}));expect(screen.getByText('Personal review notes: 7')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('switch',{name:'Include scenes in Trash'}));expect(screen.getByText('Personal review notes: 13')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('switch',{name:'Include personal review notes'}));expect(screen.getByText('Personal review notes: 0')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Create copy'}));await waitFor(()=>expect(p.operate).toHaveBeenCalledOnce())
    expect(p.operate.mock.calls[0][0]).toMatchObject({includeComments:false,sourceAnnotationRevision:9})
})

it('loads saved scene previews and respects a failed commit barrier',async()=>{
    const p={...props(),source:{kind:'scene' as const,id:'scene-active',title:'At the gate'},beforeWrite:vi.fn().mockResolvedValue(false)}
    render(<NovelUnitCopyModal {...p}/>)
    await screen.findByText('The gate held.')
    expect(screen.queryByRole('switch',{name:'Include archived scenes'})).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Create copy'}))
    await waitFor(()=>expect(p.beforeWrite).toHaveBeenCalledOnce())
    expect(p.operate).not.toHaveBeenCalled()
    expect(await screen.findByRole('alert')).toHaveTextContent('Finish the AI preview and save the scene')
})
it('refreshes an explicitly changed source instead of silently replacing the reviewed heads',async()=>{
    const p=props(),clearError=vi.fn(),view=render(<NovelUnitCopyModal {...p} clearError={clearError}/>)
    await screen.findByText('The gate held.')
    const changed=unitCopyStory();changed.chapters[0].scenes[0].revision=8;p.loadSource.mockResolvedValue(changed)
    view.rerender(<NovelUnitCopyModal {...p} operationError="STORY_COPY_SOURCE_CHANGED" clearError={clearError}/>)
    expect(screen.getByRole('alert')).toHaveTextContent('The source changed after review')
    fireEvent.click(screen.getByRole('button',{name:'Refresh saved source'}))
    await waitFor(()=>expect(p.loadSource).toHaveBeenCalledTimes(2))
    expect(clearError).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button',{name:'Create copy'}))
    await waitFor(()=>expect(p.operate).toHaveBeenCalledWith(expect.objectContaining({sourceScenes:expect.arrayContaining([{id:'scene-active',revision:8,metadataRevision:2}])})))
})
it('locks an uncertain request to its original title/options and hides current prose during recovery',async()=>{
    const p=props(),operation=unitCopyOperation(story,'chapter','chapter-1','Original copy',{...defaultStoryCopyOptions,includeNotes:false})!
    render(<NovelUnitCopyModal {...p} pendingOperation={operation}/>)
    expect(screen.getByRole('textbox',{name:'Title for the copy'})).toHaveValue('Original copy')
    expect(screen.getByRole('textbox',{name:'Title for the copy'})).toBeDisabled()
    expect(screen.getByRole('switch',{name:'Include author notes'})).toBeDisabled()
    expect(screen.queryByText('The gate held.')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Recover original copy'}))
    await waitFor(()=>expect(p.operate).toHaveBeenCalledWith(operation))
    expect(p.loadSource).not.toHaveBeenCalled()
})
it('ignores a saved-source response after the review was closed',async()=>{
    const p=props();let finish!:(value:typeof story)=>void
    p.loadSource.mockImplementation(()=>new Promise((resolve)=>{finish=resolve}))
    const view=render(<NovelUnitCopyModal {...p}/>);view.unmount()
    await act(async()=>{finish(story)})
    expect(p.operate).not.toHaveBeenCalled();expect(p.onClose).not.toHaveBeenCalled()
})

it('keeps bookmark inclusion independent from comments and binds both counts to one reviewed annotation revision',async()=>{
    const p=props(),scene=story.chapters[0].scenes[0]
    const notes={storyId:story.id,annotationRevision:6,scenes:[{sceneId:scene.id,open:2,resolved:0,trashed:0}]}
    const bookmarks={...notes,kind:'bookmark' as const,scenes:[{sceneId:scene.id,open:1,resolved:0,trashed:1}]}
    render(<NovelUnitCopyModal {...p} loadAnnotations={async()=>notes} loadBookmarks={async()=>bookmarks}/>)
    await screen.findByText('Bookmarks to copy: 0')
    fireEvent.click(screen.getByRole('switch',{name:'Include bookmarks'}));expect(screen.getByText('Bookmarks to copy: 1')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('switch',{name:'Include personal review notes'}))
    fireEvent.click(screen.getByRole('button',{name:'Create copy'}));await waitFor(()=>expect(p.operate).toHaveBeenCalledOnce())
    expect(p.operate.mock.calls[0][0]).toMatchObject({includeComments:false,includeBookmarks:true,sourceAnnotationRevision:6})
})

it('requires a fresh review when comment and bookmark counts were read at different annotation revisions',async()=>{
    const p=props()
    render(<NovelUnitCopyModal {...p} loadAnnotations={async()=>({storyId:story.id,annotationRevision:6,scenes:[]})} loadBookmarks={async()=>({kind:'bookmark',storyId:story.id,annotationRevision:7,scenes:[]})}/>)
    await screen.findByRole('alert')
    expect(screen.getByRole('button',{name:'Create copy'})).toBeDisabled();expect(p.operate).not.toHaveBeenCalled()
})
