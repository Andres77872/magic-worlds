import { fireEvent,render,screen,waitFor,within } from '@testing-library/react'
import { afterEach,beforeEach,expect,it,vi } from 'vitest'
import type { StoryOutline,StorySceneOutline } from '@/shared'
import { studioIndex } from '@/test/fixtures/storyStudio'
import { novel,storyScene,storyChapter } from '@/test/fixtures/story'
import { apiService } from '@/infrastructure/api'
const update=vi.hoisted(()=>vi.fn())
const refresh=vi.hoisted(()=>vi.fn())
vi.mock('@/app/hooks',()=>({useAuth:()=>({userHash:'metadata-author'}),useData:()=>({updateStoryScene:update,updateStoryChapter:update,updateStoryPart:update,updateStory:update,storyLifecycle:update,refreshStory:refresh})}))
import { NovelStructureDrawer } from './NovelStructureDrawer'
const workspace={workspaceId:'workspace-one',isCurrent:()=>true,detachedApi:()=>null}
const scene=storyScene({id:'scene-one',chapterId:'chapter-one',plainText:'The gate held.'})
const story=novel({chapters:[storyChapter({id:'chapter-one',scenes:[scene]})]})
beforeEach(()=>{vi.clearAllMocks();update.mockResolvedValue({...scene,metadataRevision:2});refresh.mockResolvedValue(story)})
afterEach(()=>vi.restoreAllMocks())
it('requires preview and a successful save barrier before moving a scene to Trash',async()=>{
    const before=vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true)
    const operate=vi.fn().mockResolvedValue(story)
    render(<NovelStructureDrawer workspace={workspace} story={story} target={{kind:'scene',id:scene.id}} onSelect={vi.fn()} onClose={vi.fn()} readOnly={false} busy={false} beforeWrite={before} operate={operate} splitCursor={()=>null} activeSceneId={scene.id}/>)
    fireEvent.click(screen.getByRole('button',{name:'Move to Trash'}))
    const review=await screen.findByRole('dialog',{name:'Review organization change'})
    expect(within(review).getByText('The gate held.')).toBeInTheDocument()
    expect(operate).not.toHaveBeenCalled()
    fireEvent.click(within(review).getByRole('button',{name:'Apply change'}))
    await waitFor(()=>expect(before).toHaveBeenCalledTimes(1))
    expect(operate).not.toHaveBeenCalled()
    fireEvent.click(within(review).getByRole('button',{name:'Apply change'}))
    await waitFor(()=>expect(operate).toHaveBeenCalledWith({op:'trash',kind:'scene',id:scene.id}))
})
it('saves scene metadata with its own revision and keeps prose out of the request',async()=>{
    render(<NovelStructureDrawer workspace={workspace} story={story} target={{kind:'scene',id:scene.id}} onSelect={vi.fn()} onClose={vi.fn()} readOnly={false} busy={false} beforeWrite={async()=>true} operate={vi.fn()} splitCursor={()=>null} activeSceneId={scene.id}/>)
    fireEvent.change(screen.getByLabelText('Word goal for this item'),{target:{value:'800'}})
    fireEvent.click(screen.getByRole('button',{name:'Save details'}))
    await waitFor(()=>expect(update).toHaveBeenCalled())
    const write=update.mock.calls[0][2]
    expect(write).toMatchObject({expectedMetadataRevision:1,requestId:expect.any(String),wordGoal:800})
    expect(write).not.toHaveProperty('document')
    expect(write).not.toHaveProperty('body')
})
it('keeps details readable and all mutations disabled in an archived workspace',()=>{
    const operate=vi.fn()
    render(<NovelStructureDrawer workspace={workspace} story={story} target={{kind:'scene',id:scene.id}} onSelect={vi.fn()} onClose={vi.fn()} readOnly busy={false} beforeWrite={vi.fn()} operate={operate} splitCursor={()=>null} activeSceneId={scene.id}/>)
    expect(screen.getByLabelText('Word goal for this item')).toBeDisabled()
    expect(screen.getByRole('button',{name:'Save details'})).toBeDisabled()
    expect(screen.getByRole('button',{name:'Move to Trash'})).toBeDisabled()
    expect(screen.getByRole('button',{name:'Create'})).toBeDisabled()
    expect(operate).not.toHaveBeenCalled()
})

it('shows a copied summary with no verified source pin as unverified',()=>{
    localStorage.clear()
    const copiedScene=storyScene({id:'copied-scene',chapterId:'chapter-one',details:{summary:'An inherited summary',summaryRevision:null}})
    const copied=novel({chapters:[storyChapter({id:'chapter-one',scenes:[copiedScene]})]})
    render(<NovelStructureDrawer workspace={workspace} story={copied} target={{kind:'scene',id:copiedScene.id}} onSelect={vi.fn()} onClose={vi.fn()} readOnly={false} busy={false} beforeWrite={async()=>true} operate={vi.fn()} splitCursor={()=>null} activeSceneId={copiedScene.id}/>)
    expect(screen.getByText('This summary has no verified source revision. Review it against the current scene.')).toBeInTheDocument()
})

it('opens a fresh saved-source copy review through the editor barrier without requiring a title first',async()=>{
    const before=vi.fn().mockResolvedValue(true),operate=vi.fn().mockResolvedValue(story)
    const api=apiService.withWorkspace('11111111-1111-4111-8111-111111111111')
    const counts=vi.spyOn(apiService,'getStoryAnnotationCopyPreview').mockImplementation(async(_id,kind)=>({storyId:story.id,annotationRevision:7,...(kind==='bookmark'?{kind}:{}),scenes:[{sceneId:scene.id,open:kind==='bookmark'?1:2,resolved:0,trashed:0}]}))
    render(<NovelStructureDrawer workspace={{...workspace,detachedApi:()=>api}} story={story} target={{kind:'scene',id:scene.id}} onSelect={vi.fn()} onClose={vi.fn()} readOnly={false} busy={false} beforeWrite={before} operate={operate} splitCursor={()=>null} activeSceneId={scene.id}/>)
    fireEvent.click(screen.getByRole('button',{name:'Duplicate'}))
    const review=await screen.findByRole('dialog',{name:'Duplicate chapter or scene'})
    await within(review).findByText('The gate held.')
    expect(counts).toHaveBeenCalledWith(story.id);expect(counts.mock.contexts[0]).toBe(api);expect(within(review).getByText('Personal review notes: 2')).toBeInTheDocument()
    expect(counts).toHaveBeenCalledWith(story.id,'bookmark');expect(within(review).getByText('Bookmarks to copy: 0')).toBeInTheDocument()
    expect(before).toHaveBeenCalledOnce();expect(refresh).toHaveBeenCalledWith(story.id)
    fireEvent.click(within(review).getByRole('button',{name:'Create copy'}))
    await waitFor(()=>expect(operate).toHaveBeenCalledWith(expect.objectContaining({op:'duplicate',kind:'scene',id:scene.id,sourceStructureRevision:1,includeComments:true,sourceAnnotationRevision:7,options:{includeNotes:true,includeContext:true,includeArchived:false,includeTrash:false}})))
})

it('requires an active destination and freezes it in restore review behind the save barrier',async()=>{
    const hidden=storyScene({id:'restore-scene',chapterId:'old-chapter',trashedAt:'2026-10-16T10:00:00',plainText:'Retained writing.'})
    const source=novel({chapters:[storyChapter({id:'old-chapter',title:'Trashed parent',trashedAt:'2026-10-16T10:00:00',scenes:[hidden]}),storyChapter({id:'destination',title:'A safe chapter',scenes:[]})]})
    const before=vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true),operate=vi.fn().mockResolvedValue(source)
    render(<NovelStructureDrawer workspace={workspace} story={source} target={{kind:'scene',id:hidden.id}} onSelect={vi.fn()} onClose={vi.fn()} readOnly={false} busy={false} beforeWrite={before} operate={operate} splitCursor={()=>null} activeSceneId={hidden.id}/>)
    expect(screen.getByRole('button',{name:'Restore'})).toBeDisabled()
    fireEvent.click(screen.getByRole('combobox',{name:'Restore into'}))
    expect(screen.queryByRole('option',{name:'Trashed parent'})).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('option',{name:'A safe chapter'}))
    fireEvent.click(screen.getByRole('button',{name:'Restore'}))
    const review=await screen.findByRole('dialog',{name:'Review organization change'})
    expect(within(review).getByText('Destination: A safe chapter · At the end')).toBeInTheDocument()
    expect(within(review).getByText('Retained writing.')).toBeInTheDocument()
    expect(operate).not.toHaveBeenCalled()
    fireEvent.click(within(review).getByRole('button',{name:'Apply change'}));await waitFor(()=>expect(before).toHaveBeenCalledOnce())
    expect(operate).not.toHaveBeenCalled()
    fireEvent.click(within(review).getByRole('button',{name:'Apply change'}))
    await waitFor(()=>expect(operate).toHaveBeenCalledWith({op:'restore',kind:'scene',id:hidden.id,parentId:'destination'}))
})

it('does not transfer a restore destination to a different trashed unit',()=>{
    const first=storyScene({id:'recover-first',chapterId:'old-chapter',trashedAt:'2026-10-16T10:00:00'}),second={...first,id:'recover-second'}
    const source=novel({chapters:[storyChapter({id:'old-chapter',trashedAt:'2026-10-16T10:00:00',scenes:[first,second]}),storyChapter({id:'safe-chapter',title:'Safe destination',scenes:[]})]})
    const props={workspace,story:source,onSelect:vi.fn(),onClose:vi.fn(),readOnly:false,busy:false,beforeWrite:async()=>true,operate:vi.fn(),splitCursor:()=>null,activeSceneId:first.id}
    const view=render(<NovelStructureDrawer {...props} target={{kind:'scene',id:first.id}}/>)
    fireEvent.click(screen.getByRole('combobox',{name:'Restore into'}));fireEvent.click(screen.getByRole('option',{name:'Safe destination'}))
    expect(screen.getByRole('button',{name:'Restore'})).toBeEnabled()
    view.rerender(<NovelStructureDrawer {...props} target={{kind:'scene',id:second.id}}/>)
    expect(screen.getByRole('button',{name:'Restore'})).toBeDisabled()
})

it('reviews exact insertion after the selected scene and keeps the anchor identity through the save barrier',async()=>{
    const before=vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true),operate=vi.fn().mockResolvedValue(story)
    render(<NovelStructureDrawer workspace={workspace} story={story} target={{kind:'scene',id:scene.id}} onSelect={vi.fn()} onClose={vi.fn()} readOnly={false} busy={false} beforeWrite={before} operate={operate} splitCursor={()=>null} activeSceneId={scene.id}/>)
    fireEvent.change(screen.getByLabelText('New item title'),{target:{value:'An author title'}})
    fireEvent.click(screen.getByRole('combobox',{name:'Item type'}));fireEvent.click(screen.getByRole('option',{name:'Scene'}))
    fireEvent.click(screen.getByRole('combobox',{name:'Insertion position'}));fireEvent.click(screen.getByRole('option',{name:'After “Scene 1”'}))
    fireEvent.click(screen.getByRole('button',{name:'Create'}))
    const review=await screen.findByRole('dialog',{name:'Review organization change'})
    expect(within(review).getByText('Destination: Chapter 1 · After “Scene 1”')).toBeInTheDocument()
    expect(within(review).getByText('New title: An author title')).toBeInTheDocument()
    fireEvent.click(within(review).getByRole('button',{name:'Apply change'}));await waitFor(()=>expect(before).toHaveBeenCalledOnce())
    expect(operate).not.toHaveBeenCalled()
    fireEvent.click(within(review).getByRole('button',{name:'Apply change'}))
    await waitFor(()=>expect(operate).toHaveBeenCalledWith({op:'create',kind:'scene',title:'An author title',parentId:'chapter-one',afterId:'scene-one'}))
})

it('does not substitute the novel for a selected item that disappeared',()=>{
    const operate=vi.fn()
    render(<NovelStructureDrawer workspace={workspace} story={story} target={{kind:'scene',id:'missing-scene'}} onSelect={vi.fn()} onClose={vi.fn()} readOnly={false} busy={false} beforeWrite={async()=>true} operate={operate} splitCursor={()=>null} activeSceneId={scene.id}/>)
    expect(screen.getByRole('alert')).toHaveTextContent('This item is no longer available.')
    expect(screen.queryByRole('button',{name:'Create'})).not.toBeInTheDocument();expect(operate).not.toHaveBeenCalled()
})

it('blocks a relative insertion if its anchor moves out of the reviewed container',()=>{
    const operate=vi.fn(),props={workspace,story,target:{kind:'scene' as const,id:scene.id},onSelect:vi.fn(),onClose:vi.fn(),readOnly:false,busy:false,beforeWrite:async()=>true,operate,splitCursor:()=>null,activeSceneId:scene.id}
    const view=render(<NovelStructureDrawer {...props}/>)
    fireEvent.change(screen.getByLabelText('New item title'),{target:{value:'A positioned scene'}})
    fireEvent.click(screen.getByRole('combobox',{name:'Item type'}));fireEvent.click(screen.getByRole('option',{name:'Scene'}))
    fireEvent.click(screen.getByRole('combobox',{name:'Insertion position'}));fireEvent.click(screen.getByRole('option',{name:'After “Scene 1”'}))
    expect(screen.getByRole('button',{name:'Create'})).toBeEnabled()
    const moved=novel({structureRevision:2,chapters:[storyChapter({id:'chapter-one',scenes:[]}),storyChapter({id:'chapter-two',title:'Other container',order:1,scenes:[{...scene,chapterId:'chapter-two'}]})]})
    view.rerender(<NovelStructureDrawer {...props} story={moved}/>)
    expect(screen.getByRole('button',{name:'Create'})).toBeDisabled();expect(operate).not.toHaveBeenCalled()
    expect(screen.getByRole('combobox',{name:'Insertion position'})).toHaveTextContent('Choose a current position')
})

it('requires another explicit organization review when saving changes the reviewed passage head',async()=>{
    const original=studioIndex(story),changed=studioIndex(novel({...story,chapters:[storyChapter({...story.chapters[0],scenes:[{...scene,revision:2,contentHash:'b'.repeat(64)}]})]}))
    const excerpts=vi.fn(async(source:StoryOutline,scenes:StorySceneOutline[])=>({schemaVersion:1,projection:'scene_excerpts',storyId:source.id,source:{},items:scenes.map(scene=>({sceneId:scene.id,text:'Saved preview',truncated:false}))}))
    const owner={...workspace,detachedApi:()=>({getStoryStudioExcerpts:excerpts}) as never},operate=vi.fn().mockResolvedValue(changed)
    refresh.mockResolvedValue(changed)
    const props={workspace:owner,story:original,target:{kind:'scene' as const,id:scene.id},onSelect:vi.fn(),onClose:vi.fn(),readOnly:false,busy:false,beforeWrite:async()=>true,operate,splitCursor:()=>null,activeSceneId:scene.id}
    const view=render(<NovelStructureDrawer {...props}/>)
    fireEvent.click(screen.getByRole('button',{name:'Move to Trash'}))
    const review=await screen.findByRole('dialog',{name:'Review organization change'})
    await waitFor(()=>expect(within(review).getByRole('button',{name:'Apply change'})).toBeEnabled())
    fireEvent.click(within(review).getByRole('button',{name:'Apply change'}))
    expect(await screen.findByText('The saved manuscript changed after this review opened. Review the operation again before applying it.')).toBeInTheDocument()
    expect(operate).not.toHaveBeenCalled()
    view.rerender(<NovelStructureDrawer {...props} story={changed}/>)
    fireEvent.click(screen.getByRole('button',{name:'Move to Trash'}))
    const fresh=await screen.findByRole('dialog',{name:'Review organization change'})
    await waitFor(()=>expect(within(fresh).getByRole('button',{name:'Apply change'})).toBeEnabled())
    fireEvent.click(within(fresh).getByRole('button',{name:'Apply change'}))
    await waitFor(()=>expect(operate).toHaveBeenCalledOnce())
})
