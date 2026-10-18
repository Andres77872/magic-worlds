import { fireEvent,render,screen,waitFor,within } from '@testing-library/react'
import { beforeEach,expect,it,vi } from 'vitest'
import { ApiError } from '@/infrastructure/api'
import { novel } from '@/test/fixtures/story'
import { searchMatch,searchPage } from '@/test/fixtures/storySearch'
import { replacementAck,replacementPreview } from '@/test/fixtures/storyReplacement'
import type { StoryReplacementPreview,StoryReplacementRequest } from '@/shared/types/storyReplacement.types'
import type { ManuscriptReplacementSource } from '../hooks/useManuscriptReplacementSource'
import type { ManuscriptSearchSource } from '../hooks/useManuscriptSearchSource'
import { useManuscriptReplacements } from '../hooks/useManuscriptReplacements'
import { NovelManuscriptSearch } from './NovelManuscriptSearch'
const auth=vi.hoisted(()=>({userHash:'replacement-ui',isAuthenticated:true,openLoginModal:vi.fn()}))
vi.mock('@/app/hooks',()=>({useAuth:()=>auth}))
let source:ManuscriptReplacementSource,searchSource:ManuscriptSearchSource,before:ReturnType<typeof vi.fn<()=>Promise<boolean>>>,readOnly:boolean
function reviewFor(query:StoryReplacementRequest):StoryReplacementPreview {
    const value=replacementPreview(),changes=query.targets.map((target)=>({...value.changes[0],...target,replacement:query.replacement,
        proposed:query.replacement?[{type:'text',text:query.replacement,marks:[{type:'italic'}]}]:[],reason:target.position===20?'reference' as const:null}))
    const changed=changes.filter((item)=>item.reason===null).length
    return {...value,operation:{op:'replace',preview:query},changes,counts:{selected:changes.length,changed,unchanged:0,blocked:changes.length-changed,scenes:changed?1:0},
        scenes:value.scenes.map((scene)=>({...scene,changed})),canApply:changed>0&&changes.length===changed}
}
function Harness(){const replacements=useManuscriptReplacements(source,'desk',readOnly);return <NovelManuscriptSearch open source={searchSource} story={novel()} onClose={()=>{}} beforeNavigate={before} onNavigate={()=>true} replacements={replacements}/>}
beforeEach(()=>{
    vi.restoreAllMocks();vi.clearAllMocks();localStorage.clear();readOnly=false;before=vi.fn(async()=>true)
    searchSource={key:'owned',storyId:'story-1',isCurrent:()=>true,search:vi.fn(async()=>searchPage()),resolve:vi.fn()}
    source={key:'owned',storyId:'story-1',isCurrent:()=>true,preview:vi.fn(async(query)=>reviewFor(query)),reverse:vi.fn(),recover:vi.fn(async()=>null),
        write:vi.fn(async(write)=>replacementAck(write)),refresh:vi.fn(async()=>{const story=novel();Object.assign(story.chapters[0].scenes[0],{id:'scene-1',revision:2,contentHash:'d'.repeat(64)});return story})}
})
async function choose(){fireEvent.change(screen.getByLabelText('Text to find'),{target:{value:'gate'}});fireEvent.change(screen.getByLabelText('Replacement text'),{target:{value:'Door'}});fireEvent.click(screen.getByRole('button',{name:'Search saved text'}));await screen.findByRole('switch',{name:'Include match 1 in Scene 1'});fireEvent.click(screen.getByRole('switch',{name:'Include match 1 in Scene 1'}))}
it('requires exact review, invalidates changed text, then applies only after a second writing barrier',async()=>{
    render(<Harness/>);await choose();fireEvent.click(screen.getByRole('button',{name:'Review replacements'}))
    await screen.findByRole('region',{name:'Review manuscript changes'});expect(source.write).not.toHaveBeenCalled();expect(before).toHaveBeenCalledOnce()
    expect(source.preview).toHaveBeenCalledWith(expect.objectContaining({q:'gate',replacement:'Door',targets:[{sceneId:'scene-1',position:4}]}))
    fireEvent.change(screen.getByLabelText('Replacement text'),{target:{value:'Different\ntext'}})
    expect(screen.getByRole('button',{name:'Apply reviewed replacements'})).toBeDisabled();expect(screen.getByText(/Selection or replacement text changed/)).toBeVisible()
    fireEvent.change(screen.getByLabelText('Replacement text'),{target:{value:'Door'}});fireEvent.click(screen.getByRole('button',{name:'Apply reviewed replacements'}))
    await screen.findByText('The reviewed manuscript changes were saved.');expect(before).toHaveBeenCalledTimes(2);expect(source.write).toHaveBeenCalledOnce();expect(source.refresh).toHaveBeenCalledOnce()
    expect(screen.getByRole('button',{name:'Review undo'})).toBeEnabled()
})
it('shows protected matches and refuses the entire batch until the author removes them and reviews again',async()=>{
    vi.mocked(searchSource.search).mockResolvedValue(searchPage({items:[searchMatch(),searchMatch({position:20,startOffset:20,endOffset:24})]}))
    render(<Harness/>);await choose();fireEvent.click(screen.getByRole('button',{name:'Select loaded matches'}));fireEvent.click(screen.getByRole('button',{name:'Review replacements'}))
    await screen.findByText('Protected Codex reference');expect(screen.getByRole('button',{name:'Apply reviewed replacements'})).toBeDisabled();expect(source.write).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('switch',{name:'Include match 2 in Scene 1'}));fireEvent.click(screen.getByRole('button',{name:'Review replacements'}))
    await waitFor(()=>expect(screen.getByRole('button',{name:'Apply reviewed replacements'})).toBeEnabled());expect(source.preview).toHaveBeenCalledTimes(2)
})
it('preserves the draft when its barrier refuses preview, and reports source conflict without a write',async()=>{
    before.mockResolvedValue(false);render(<Harness/>);await choose();fireEvent.click(screen.getByRole('button',{name:'Review replacements'}))
    await screen.findByText(/Resolve the current draft, recovery or AI review before reviewing/);expect(source.preview).not.toHaveBeenCalled()
    before.mockResolvedValue(true);vi.mocked(source.preview).mockRejectedValueOnce(new ApiError(409,'Changed',{code:'STORY_REPLACE_SOURCE_CHANGED'}))
    fireEvent.click(screen.getByRole('button',{name:'Review replacements'}));await screen.findByText(/The saved manuscript or replacement target changed/);expect(source.write).not.toHaveBeenCalled()
})
it('reviews reversal of the confirmed original request, without applying implicitly',async()=>{
    render(<Harness/>);await choose();fireEvent.click(screen.getByRole('button',{name:'Review replacements'}));await screen.findByRole('region',{name:'Review manuscript changes'})
    fireEvent.click(screen.getByRole('button',{name:'Apply reviewed replacements'}));await screen.findByText('The reviewed manuscript changes were saved.')
    const original=vi.mocked(source.write).mock.calls[0][0].requestId,base=replacementPreview()
    vi.mocked(source.reverse).mockResolvedValue({...base,operation:{op:'reverse',direction:'undo',originRequestId:original,sourceSnapshot:base.sourceSnapshot},
        changes:base.changes.map((change)=>({...change,quote:'Door',replacement:'gate',original:change.proposed,proposed:change.original}))})
    fireEvent.click(screen.getByRole('button',{name:'Review undo'}));const region=await screen.findByRole('region',{name:'Review manuscript changes'})
    expect(source.reverse).toHaveBeenCalledWith({originRequestId:original,direction:'undo'});expect(within(region).getByRole('button',{name:'Apply reviewed undo'})).toBeEnabled();expect(source.write).toHaveBeenCalledOnce()
})
it('ignores a late preview after closing, and keeps readonly replacement controls disabled',async()=>{
    let finish!:(review:StoryReplacementPreview)=>void
    vi.mocked(source.preview).mockImplementationOnce(()=>new Promise((resolve)=>{finish=resolve}))
    const view=render(<Harness/>);await choose();fireEvent.click(screen.getByRole('button',{name:'Review replacements'}));await waitFor(()=>expect(source.preview).toHaveBeenCalledOnce());view.unmount()
    finish(replacementPreview());readOnly=true;render(<Harness/>);expect(screen.getByLabelText('Replacement text')).toBeDisabled();expect(source.write).not.toHaveBeenCalled()
})
