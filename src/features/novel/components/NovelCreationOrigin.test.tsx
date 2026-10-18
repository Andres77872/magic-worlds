import { act,fireEvent,render,screen } from '@testing-library/react'
import { beforeEach,expect,it,vi } from 'vitest'
import { novel } from '@/test/fixtures/story'
import { creationSourcesPreview } from '@/test/fixtures/storyCreationSources'
import { importRecord } from '@/test/fixtures/storyImport'
import type { StoryCreationSources } from '@/shared'
import type { StoryWorkspace } from '../hooks/useStoryWorkspace'
const auth=vi.hoisted(()=>({userHash:'origin-author'}))
vi.mock('@/app/hooks',()=>({useAuth:()=>auth}))
import { NovelCreationOrigin } from './NovelCreationOrigin'
const read=vi.fn(),imported=vi.fn(),download=vi.fn()
const workspace={workspaceId:'work-one',isCurrent:()=>true,detachedApi:()=>({getStoryCreationSources:read,getStoryImportRecord:imported,downloadStoryImportSource:download})} as unknown as StoryWorkspace
const origin=(id='novel'):StoryCreationSources=>({...creationSourcesPreview({source:{kind:'world',id:'gate',title:'The old gate'}}),storyId:id,createdAt:'2026-10-16T10:30:00Z'})
beforeEach(()=>{vi.resetAllMocks();auth.userHash='origin-author';read.mockResolvedValue(origin());imported.mockResolvedValue(null)})
it('reads initial frozen content only when requested, including in an archived manuscript',async()=>{
    render(<NovelCreationOrigin story={novel({id:'novel',status:'archived'})} workspace={workspace}/>)
    expect(read).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button',{name:'Creation sources'}))
    await screen.findByText('The old gate')
    expect(screen.getByText(/Version 3/)).toBeInTheDocument()
    expect(read).toHaveBeenCalledWith('novel')
    expect(screen.getByText('This creation record is fixed. Current Codex entries may contain later edits.')).toBeInTheDocument()
})
it('keeps absent legacy review honest and rejects a foreign or corrupted origin',async()=>{
    read.mockResolvedValueOnce(null).mockResolvedValueOnce(origin('foreign'))
    render(<NovelCreationOrigin story={novel({id:'novel'})} workspace={workspace}/>)
    const button=screen.getByRole('button',{name:'Creation sources'})
    fireEvent.click(button)
    await screen.findByText('This creation has no recorded source review. Current Codex entries are available separately.')
    fireEvent.click(button);fireEvent.click(button)
    expect(await screen.findByRole('alert')).toHaveTextContent('The creation source record could not be loaded.')
})
it('ignores an old source read after changing manuscript or account and leaves copies to their copy provenance',async()=>{
    let finish!:(value:StoryCreationSources)=>void
    read.mockImplementationOnce(()=>new Promise((resolve)=>{finish=resolve}))
    const view=render(<NovelCreationOrigin story={novel({id:'novel'})} workspace={workspace}/>)
    fireEvent.click(screen.getByRole('button',{name:'Creation sources'}))
    auth.userHash='another-author';view.rerender(<NovelCreationOrigin story={novel({id:'another'})} workspace={workspace}/>)
    await act(async()=>{finish(origin())})
    expect(screen.queryByText('The old gate')).not.toBeInTheDocument()
    expect(screen.getByRole('button',{name:'Creation sources'})).toHaveAttribute('aria-expanded','false')
    view.rerender(<NovelCreationOrigin story={novel({id:'copy',copiedFrom:'novel'})} workspace={workspace}/>)
    expect(screen.queryByRole('button',{name:'Creation sources'})).not.toBeInTheDocument()
})
it('shows the file an imported novel came from, what the conversion changed, and downloads the original file',async()=>{
    const record=importRecord({storyId:'novel'});read.mockResolvedValue(null);imported.mockResolvedValue(record)
    download.mockResolvedValue(new Blob(['original']))
    const save=vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:original');vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{})
    render(<NovelCreationOrigin story={novel({id:'novel'})} workspace={workspace}/>)
    fireEvent.click(screen.getByRole('button',{name:'Creation sources'}))
    await screen.findByText(/Imported from gull.docx \(Word\)/)
    expect(screen.getByText(/2 chapters and 3 scenes/)).toBeInTheDocument()
    expect(screen.getByText('3 comments left out')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Download original file'}))
    await vi.waitFor(()=>expect(save).toHaveBeenCalled())
    expect(download).toHaveBeenCalledWith(record)
})
