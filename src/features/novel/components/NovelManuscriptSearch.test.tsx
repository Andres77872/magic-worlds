import { act,fireEvent,render,screen,waitFor } from '@testing-library/react'
import { beforeEach,expect,it,vi } from 'vitest'
import { ApiError } from '@/infrastructure/api'
import { novel } from '@/test/fixtures/story'
import { searchMatch,searchPage,searchResult } from '@/test/fixtures/storySearch'
import type { ManuscriptSearchSource } from '../hooks/useManuscriptSearchSource'
import type { StorySearchResult } from '@/shared/types/storySearch.types'
import { NovelManuscriptSearch } from './NovelManuscriptSearch'

let source:ManuscriptSearchSource,close:ReturnType<typeof vi.fn<()=>void>>,navigate:ReturnType<typeof vi.fn<(result:StorySearchResult)=>boolean>>,before:ReturnType<typeof vi.fn<()=>Promise<boolean>>>
beforeEach(()=>{source={key:'owned',storyId:'story-1',isCurrent:()=>true,search:vi.fn().mockResolvedValue(searchPage()),resolve:vi.fn().mockResolvedValue(searchResult())};close=vi.fn();navigate=vi.fn(()=>true);before=vi.fn(async()=>true)})
function mount(){return render(<NovelManuscriptSearch open source={source} story={novel()} onClose={close} beforeNavigate={before} onNavigate={navigate}/>)}
async function search(){fireEvent.change(screen.getByLabelText('Text to find'),{target:{value:'gate'}});fireEvent.click(screen.getByRole('button',{name:'Search saved text'}));await screen.findByRole('button',{name:/Open saved passage/})}
it('uses literal saved text and blocks an obsolete query before navigation',async()=>{
    mount();await search()
    expect(source.search).toHaveBeenCalledWith({q:'gate',caseSensitive:false,includeArchived:false})
    fireEvent.change(screen.getByLabelText('Text to find'),{target:{value:'  '}})
    expect(screen.getByRole('button',{name:/Open saved passage/})).toBeDisabled()
    fireEvent.click(screen.getByRole('button',{name:'Search saved text'}))
    await waitFor(()=>expect(source.search).toHaveBeenLastCalledWith({q:'  ',caseSensitive:false,includeArchived:false}))
})
it('flushes first and verifies the exact result before opening the scene',async()=>{
    mount();await search();fireEvent.click(screen.getByRole('button',{name:/Open saved passage/}))
    await waitFor(()=>expect(close).toHaveBeenCalledOnce())
    expect(before).toHaveBeenCalledOnce();expect(source.resolve).toHaveBeenCalledWith({q:'gate',caseSensitive:false,includeArchived:false,sourceSnapshot:'b'.repeat(64),target:{sceneId:'scene-1',position:4}})
    expect(navigate).toHaveBeenCalledWith(searchResult())
})
it('leaves review/draft intact when flushing is blocked',async()=>{
    before.mockResolvedValue(false);mount();await search();fireEvent.click(screen.getByRole('button',{name:/Open saved passage/}))
    await screen.findByText(/Resolve the current draft/);expect(source.resolve).not.toHaveBeenCalled();expect(navigate).not.toHaveBeenCalled()
})
it('keeps stale results visible with refresh guidance and never navigates after source conflict',async()=>{
    vi.mocked(source.resolve).mockRejectedValue(new ApiError(409,'changed',{code:'STORY_SEARCH_SOURCE_CHANGED'}))
    mount();await search();fireEvent.click(screen.getByRole('button',{name:/Open saved passage/}))
    await screen.findByText(/The saved manuscript changed/);expect(navigate).not.toHaveBeenCalled();expect(close).not.toHaveBeenCalled()
})
it('ignores a late resolution after the drawer closes',async()=>{
    let finish!:(value:ReturnType<typeof searchResult>)=>void
    vi.mocked(source.resolve).mockImplementation(()=>new Promise((resolve)=>{finish=resolve}))
    const view=mount();await search();fireEvent.click(screen.getByRole('button',{name:/Open saved passage/}))
    await waitFor(()=>expect(source.resolve).toHaveBeenCalledOnce());view.unmount()
    await act(async()=>{finish(searchResult())})
    expect(navigate).not.toHaveBeenCalled();expect(close).not.toHaveBeenCalled()
})
it('rejects a changed result instead of navigating to a nearby phrase',async()=>{
    vi.mocked(source.resolve).mockResolvedValue(searchResult({match:searchMatch({position:9})}))
    mount();await search();fireEvent.click(screen.getByRole('button',{name:/Open saved passage/}))
    await screen.findByText(/The saved manuscript changed/);expect(navigate).not.toHaveBeenCalled()
})
it('retains loaded results but blocks a duplicate page rather than appending it',async()=>{
    vi.mocked(source.search).mockResolvedValueOnce(searchPage({nextCursor:'owned_cursor'})).mockResolvedValueOnce(searchPage({nextCursor:'owned_cursor'}))
    mount();await search();fireEvent.click(screen.getByRole('button',{name:'Load more results'}))
    await screen.findByText(/The saved manuscript changed/)
    expect(screen.getAllByRole('button',{name:/Open saved passage/})).toHaveLength(1)
    expect(screen.getByRole('button',{name:'Load more results'})).toBeDisabled()
})
