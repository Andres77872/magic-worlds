import { fireEvent,render,screen,waitFor } from '@testing-library/react'
import { beforeEach,expect,it,vi } from 'vitest'
import { ApiError } from '@/infrastructure/api'
import { novel,storyReference } from '@/test/fixtures/story'
import type { Story,StoryNovelWrite } from '@/shared'
import type { StoryWorkspace } from '../hooks/useStoryWorkspace'
const mocks=vi.hoisted(()=>({update:vi.fn(),refresh:vi.fn(),images:vi.fn()}))
vi.mock('@/app/hooks',()=>({useAuth:()=>({userHash:'metadata-author'}),useData:()=>({updateStory:mocks.update,updateStoryScene:mocks.update,updateStoryChapter:mocks.update,refreshStory:mocks.refresh})}))
vi.mock('@/infrastructure/api/useAuthenticatedMediaUrl',()=>({useAuthenticatedMediaUrl:(src:string)=>({src,loading:false,error:null})}))
import { NovelUnitDetails } from './NovelUnitDetails'
const workspaceId='11111111-1111-4111-8111-111111111111'
const story=novel({organization:{workspace_id:workspaceId},details:{genre:'Fantasy',tags:['old']},activeCardRefs:[storyReference()]})
const api={listWorkspaceMedia:mocks.images,uploadCardImage:vi.fn()}
const workspace:StoryWorkspace={workspaceId,isCurrent:()=>true,detachedApi:()=>api as never}
beforeEach(()=>{
    vi.resetAllMocks();localStorage.clear();mocks.refresh.mockResolvedValue(story)
    mocks.images.mockResolvedValue({items:[{media_kind:'image',asset_id:'cover-image',job_id:null,organization:{workspace_id:workspaceId},asset:{asset_id:'cover-image',url:'/images/assets/cover-image'}}],total:1,limit:24,offset:0})
    mocks.update.mockImplementation(async(_id:string,write:StoryNovelWrite)=>({...story,...write,details:write.details??story.details,metadataRevision:2} as Story))
})
const show=()=>render(<NovelUnitDetails story={story} unit={story} workspace={workspace} kind="novel" readOnly={false} beforeWrite={async()=>true}/>)
it('edits an owned cover, default POV and manually typed tags with exact Unicode metadata',async()=>{
    show()
    fireEvent.click(screen.getByRole('combobox',{name:'Default POV character'}));fireEvent.click(screen.getByRole('option',{name:'Mira'}))
    fireEvent.click(screen.getByRole('button',{name:'Choose or upload cover'}))
    fireEvent.click(await screen.findByRole('button',{name:'Image 1'}));fireEvent.click(screen.getByRole('button',{name:'Use image'}))
    const tags=screen.getByRole('textbox',{name:'Tags, one per line'})
    fireEvent.change(tags,{target:{value:'old\n'}});expect(tags).toHaveValue('old\n')
    fireEvent.change(tags,{target:{value:'old\nCafé'}})
    fireEvent.change(screen.getByRole('textbox',{name:'Cover description'}),{target:{value:'  Road at dusk 🙂.  '}})
    fireEvent.change(screen.getByRole('textbox',{name:'Title'}),{target:{value:'🙂'.repeat(200)}})
    fireEvent.click(screen.getByRole('button',{name:'Save details'}))
    await waitFor(()=>expect(mocks.update).toHaveBeenCalledOnce())
    expect(mocks.update.mock.calls[0][1]).toMatchObject({title:'🙂'.repeat(200),details:{genre:'Fantasy',tags:['old','Café'],povCardId:'mira',coverAssetId:'cover-image',coverAlt:'  Road at dusk 🙂.  '}})
})
it('keeps over-limit cover text visible and recoverable without sending invalid metadata',()=>{
    const first=show(),description='🙂'.repeat(2001)
    fireEvent.change(screen.getByRole('textbox',{name:'Cover description'}),{target:{value:description}})
    expect(screen.getByRole('textbox',{name:'Cover description'})).toHaveValue(description)
    expect(screen.getByRole('button',{name:'Save details'})).toBeDisabled();expect(mocks.update).not.toHaveBeenCalled()
    first.unmount();show()
    fireEvent.click(screen.getByRole('button',{name:'Resume device draft'}))
    expect(screen.getByRole('textbox',{name:'Cover description'})).toHaveValue(description)
})

it('retains an unfinished beat across inspector closure, then saves only the ordered metadata with exact multiline text',async()=>{
    const scene={...story.chapters[0].scenes[0],details:{summary:'Existing summary',summaryRevision:1,notes:'Personal note'}}
    const options={story,unit:scene,kind:'scene' as const,readOnly:false,beforeWrite:async()=>true}
    mocks.update.mockImplementation(async(_story:string,_scene:string,write:object)=>({...scene,...write,metadataRevision:2}))
    const first=render(<NovelUnitDetails {...options}/>)
    fireEvent.click(screen.getByRole('button',{name:'Add beat'}))
    expect(screen.getByRole('button',{name:'Save details'})).toBeDisabled()
    first.unmount();render(<NovelUnitDetails {...options}/>)
    fireEvent.click(screen.getByRole('button',{name:'Resume device draft'}))
    expect(screen.getByRole('textbox',{name:'Beat 1'})).toHaveValue('')
    fireEvent.change(screen.getByRole('textbox',{name:'Beat 1'}),{target:{value:'  Mira arrives.\n雨 🙂  '}})
    fireEvent.change(screen.getByRole('textbox',{name:'Tags, one per line'}),{target:{value:'Arrival\n秘密'}})
    fireEvent.click(screen.getByRole('button',{name:'Save details'}))
    await waitFor(()=>expect(mocks.update).toHaveBeenCalledOnce())
    expect(mocks.update.mock.calls[0][2]).toMatchObject({expectedMetadataRevision:1,details:{summary:'Existing summary',summaryRevision:1,notes:'Personal note',tags:['Arrival','秘密'],plannedBeats:['  Mira arrives.\n雨 🙂  ']}})
    expect(mocks.update.mock.calls[0][2]).not.toHaveProperty('document')
})

it('shows distinct beat boundaries during conflict comparison even when joining their prose would look equal',async()=>{
    const scene={...story.chapters[0].scenes[0],details:{plannedBeats:['A','B\nC']}}
    mocks.update.mockRejectedValueOnce(new ApiError(409,'Stale details'))
    mocks.refresh.mockResolvedValue({...story,chapters:[{...story.chapters[0],scenes:[{...scene,metadataRevision:2}]}]})
    render(<NovelUnitDetails story={story} unit={scene} kind="scene" readOnly={false} beforeWrite={async()=>true}/>)
    fireEvent.change(screen.getByRole('textbox',{name:'Beat 1'}),{target:{value:'A\nB'}})
    fireEvent.change(screen.getByRole('textbox',{name:'Beat 2'}),{target:{value:'C'}})
    fireEvent.click(screen.getByRole('button',{name:'Save details'}))
    fireEvent.click(await screen.findByRole('button',{name:'Compare versions'}))
    expect(screen.getByRole('heading',{name:'Planned beats'})).toBeInTheDocument()
    expect(screen.getByText((_,element)=>element?.tagName==='P'&&element.textContent===JSON.stringify(['A\nB','C'],null,2))).toBeInTheDocument()
    expect(screen.getByText((_,element)=>element?.tagName==='P'&&element.textContent===JSON.stringify(['A','B\nC'],null,2))).toBeInTheDocument()
})

it('makes a chapter front matter, and offers export sections for chapters only',async()=>{
    const chapter={...story.chapters[0],details:{}}
    mocks.update.mockImplementation(async(_story:string,_chapter:string,write:object)=>({...chapter,...write,metadataRevision:2}))
    const first=render(<NovelUnitDetails story={story} unit={chapter} kind="chapter" readOnly={false} beforeWrite={async()=>true}/>)
    fireEvent.click(screen.getByRole('combobox',{name:'Export section'}));fireEvent.click(screen.getByRole('option',{name:'Front matter · Dedication'}))
    fireEvent.click(screen.getByRole('button',{name:'Save details'}))
    await waitFor(()=>expect(mocks.update).toHaveBeenCalledOnce())
    expect(mocks.update.mock.calls[0][2]).toMatchObject({details:{exportRole:'dedication'}})
    first.unmount()
    render(<NovelUnitDetails story={story} unit={story.chapters[0].scenes[0]} kind="scene" readOnly={false} beforeWrite={async()=>true}/>)
    expect(screen.queryByRole('combobox',{name:'Export section'})).toBeNull()
})

it('edits the style sheet with trimmed terms, a refused repeat, an example and a Codex voice, then saves it exactly',async()=>{
    show()
    fireEvent.click(screen.getByRole('button',{name:'Add convention'}))
    const term=screen.getByRole('textbox',{name:'Term 1'})
    expect(term).toHaveFocus()
    fireEvent.change(term,{target:{value:'grey '}});fireEvent.blur(term)
    expect(term).toHaveValue('grey')
    fireEvent.change(screen.getByRole('textbox',{name:'Rule'}),{target:{value:'Not gray.'}})
    fireEvent.click(screen.getByRole('button',{name:'Add convention'}))
    fireEvent.change(screen.getByRole('textbox',{name:'Term 2'}),{target:{value:'GREY'}})
    expect(screen.getByText('This term already has a convention of this kind.')).toBeInTheDocument()
    expect(screen.getByRole('button',{name:'Save details'})).toBeDisabled()
    fireEvent.click(screen.getByRole('button',{name:'Remove convention 2'}))
    fireEvent.click(screen.getByRole('button',{name:'Add example'}))
    fireEvent.change(screen.getByRole('textbox',{name:'Example 1'}),{target:{value:'The gate opened.\nNobody said so.'}})
    fireEvent.click(screen.getByRole('combobox',{name:'Add a voice'}));fireEvent.click(screen.getByRole('option',{name:'Mira'}))
    expect(screen.getByRole('textbox',{name:'How Mira speaks'})).toHaveFocus()
    expect(screen.getByRole('button',{name:'Save details'})).toBeDisabled()
    fireEvent.click(screen.getByRole('button',{name:'Add sample line'}))
    fireEvent.change(screen.getByRole('textbox',{name:'Sample line 1'}),{target:{value:'Open it. 🙂'}})
    expect(screen.getByText('Every Codex character in this novel has a voice.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Save details'}))
    await waitFor(()=>expect(mocks.update).toHaveBeenCalledOnce())
    expect(mocks.update.mock.calls[0][1].details.styleSheet).toEqual({conventions:[{term:'grey',rule:'Not gray.',kind:'spelling'}],
        examples:[{label:'',text:'The gate opened.\nNobody said so.'}],voices:[{refId:'reference-1',traits:'',lines:['Open it. 🙂']}]})
})

it('clears an emptied style sheet and keeps an unread voice of a removed Codex entry visible',async()=>{
    const removed=novel({organization:{workspace_id:workspaceId},details:{styleSheet:{conventions:[],examples:[],voices:[{refId:'reference-1',traits:'Quiet.',lines:[]}]}},
        activeCardRefs:[storyReference({removedAt:'2026-10-17T10:00:00Z'})]})
    mocks.update.mockImplementation(async(_id:string,write:StoryNovelWrite)=>({...removed,...write,details:write.details??removed.details,metadataRevision:2} as Story))
    render(<NovelUnitDetails story={removed} unit={removed} workspace={workspace} kind="novel" readOnly={false} beforeWrite={async()=>true}/>)
    expect(screen.getByText(/This Codex entry was removed from the novel/)).toBeInTheDocument()
    expect(screen.getByText('Add characters to the novel’s Codex to give them a voice.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Remove the voice of Mira'}))
    fireEvent.click(screen.getByRole('button',{name:'Save details'}))
    await waitFor(()=>expect(mocks.update).toHaveBeenCalledOnce())
    expect(mocks.update.mock.calls[0][1].details.styleSheet).toBeNull()
})
