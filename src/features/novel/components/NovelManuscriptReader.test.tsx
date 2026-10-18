import { fireEvent,render,screen,waitFor } from '@testing-library/react'
import { expect,it,vi } from 'vitest'
import { novel,storyReference,storyChapter,storyScene } from '@/test/fixtures/story'
import { readingItem,readingWindow as readingPage } from '@/test/fixtures/storyReading'
import { documentText,documentMarkdown } from '@/shared/storyDocument'
import { ApiError } from '@/infrastructure/api'
import { DEFAULT_READING } from '../utils/readingPreferences'
import { NovelManuscriptReader } from './NovelManuscriptReader'

it('captures the currently visible saved paragraph through its persistent bookmark action without opening the writer',async()=>{
    const item=readingItem(),page=readingPage({items:[item]}),open=vi.fn(),bookmark=vi.fn().mockResolvedValue(true)
    const rect=(top:number,height:number)=>({top,bottom:top+height,height,left:0,right:600,width:600,x:0,y:top,toJSON:()=>({})})
    const geometry=vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(this:HTMLElement){return this.hasAttribute('data-manuscript-node-id')?rect(100,100):this.hasAttribute('data-reader-scene-id')?rect(70,200):rect(0,500)})
    try{
        render(<NovelManuscriptReader open source={{key:'bookmark-reader',storyId:'story-1',isCurrent:()=>true,read:vi.fn().mockResolvedValue(page)}} story={novel()} preferences={DEFAULT_READING} onOpenScene={open} onClose={()=>{}} onBookmark={bookmark}/>)
        await screen.findByText(item.scene.plainText)
        fireEvent.click(screen.getByRole('button',{name:'Bookmark visible paragraph'}))
        await waitFor(()=>expect(bookmark).toHaveBeenCalledOnce())
        expect(bookmark).toHaveBeenCalledWith(page,item,{nodeId:String(item.scene.document.content.content?.[0].attrs?.nodeId),offset:0})
        expect(open).not.toHaveBeenCalled();expect(document.querySelector('[contenteditable]')).toBeNull()
        bookmark.mockResolvedValueOnce(false);fireEvent.click(screen.getByRole('button',{name:'Bookmark visible paragraph'}))
        await screen.findByText('This reading position changed or cannot be verified. Refresh the reader before bookmarking it.')
    }finally{geometry.mockRestore()}
})

it('reads continuous batches and changes scope without an editable instance or manuscript mutation',async()=>{
    const first=readingPage({totalScenes:3,items:[readingItem('one','First saved scene.'),readingItem('two','Second saved scene.')],nextAfterSceneId:'two'})
    const read=vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(readingPage({totalScenes:3,offset:2,afterSceneId:'two',items:[readingItem('three','Third saved scene.')]}))
        .mockResolvedValueOnce(readingPage({scope:'chapter',unitId:'chapter-1'}))
    const source={key:'owner',storyId:'story-1',isCurrent:()=>true,read},open=vi.fn(),close=vi.fn()
    render(<NovelManuscriptReader open source={source} story={novel()} preferences={DEFAULT_READING} onOpenScene={open} onClose={close}/>)
    await screen.findByText('First saved scene.');expect(screen.getByText('Second saved scene.')).toBeInTheDocument()
    expect(document.querySelector('[contenteditable]')).toBeNull();expect(open).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button',{name:'Load next scenes'}))
    await screen.findByText('Third saved scene.');expect(screen.getAllByRole('heading',{name:'Opening'})).toHaveLength(1);expect(screen.getByText('First saved scene.')).toBeInTheDocument()
    expect(read.mock.calls[1][0]).toMatchObject({afterSceneId:'two',sourceSnapshot:'b'.repeat(64)})
    fireEvent.click(screen.getByRole('combobox',{name:'Reading scope'}));fireEvent.click(screen.getByRole('option',{name:'Chapter'}))
    await waitFor(()=>expect(read).toHaveBeenCalledTimes(3))
    expect(read.mock.calls[2][0]).toMatchObject({scope:'chapter',unitId:'chapter-1'});expect(open).not.toHaveBeenCalled()
})
it('offers guarded scene opening, exact retained reference snapshots and no reader context writes',async()=>{
    const item=readingItem(),reference=storyReference({removedAt:'2026-10-16T00:00:00Z',enabled:false})
    item.scene.document.content.content![0].content=[{type:'codexMention',attrs:{id:reference.id,label:'Old manuscript label'}}]
    item.scene.plainText=documentText(item.scene.document);item.scene.body=documentMarkdown(item.scene.document)
    const source={key:'owner',storyId:'story-1',isCurrent:()=>true,read:vi.fn().mockResolvedValue(readingPage({items:[item]}))}
    const open=vi.fn().mockResolvedValue(false),close=vi.fn(),story=novel({activeCardRefs:[reference],chapters:[storyChapter({scenes:[storyScene()]})]})
    render(<NovelManuscriptReader open source={source} story={story} preferences={DEFAULT_READING} onOpenScene={open} onClose={close}/>)
    fireEvent.click(await screen.findByRole('button',{name:'@Old manuscript label'}))
    expect(screen.getByRole('heading',{name:'Mira'})).toBeInTheDocument()
    expect(screen.getByText('A curious traveler.')).toBeInTheDocument()
    expect(screen.queryByRole('button',{name:'Include in context'})).not.toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button',{name:'Close'})[1])
    fireEvent.click(screen.getByRole('button',{name:'Open scene: Scene 1'}))
    await waitFor(()=>expect(open).toHaveBeenCalledOnce());expect(close).not.toHaveBeenCalled()
    expect(await screen.findByRole('alert')).toHaveTextContent('Finish draft recovery or AI review')
    open.mockRejectedValueOnce(new ApiError(409,'Reader state changed',{code:'STORY_READING_WORKSPACE_READONLY'}))
    fireEvent.click(screen.getByRole('button',{name:'Open scene: Scene 1'}))
    await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('This workspace is read only'))
    expect(close).not.toHaveBeenCalled()
    open.mockResolvedValue(true);fireEvent.click(screen.getByRole('button',{name:'Open scene: Scene 1'}))
    await waitFor(()=>expect(close).toHaveBeenCalledOnce())
})

it('keeps only scoped device choices across closure and leaves prose and saved positions out of that record',async()=>{
    const preferenceKey='controlled-reader-device',key=preferenceKey+':reader-scope'
    localStorage.setItem(key,JSON.stringify({schemaVersion:1,scope:'chapter',unitId:'chapter-1',includeArchived:false}))
    const read=vi.fn(async(query)=>readingPage({scope:query.scope,unitId:query.unitId,includeArchived:query.includeArchived}))
    const props={source:{key:'owner',storyId:'story-1',isCurrent:()=>true,read},story:novel(),preferences:DEFAULT_READING,preferenceKey,onOpenScene:async()=>false,onClose:()=>{}}
    const view=render(<NovelManuscriptReader {...props} open/>)
    await waitFor(()=>expect(read).toHaveBeenCalledOnce())
    expect(read.mock.calls[0][0]).toMatchObject({scope:'chapter',unitId:'chapter-1'})
    fireEvent.click(screen.getByRole('button',{name:'Include archived sections'}))
    await waitFor(()=>expect(read).toHaveBeenCalledTimes(2))
    const stored=JSON.parse(localStorage.getItem(key)!)
    expect(stored).toEqual({schemaVersion:1,scope:'chapter',unitId:'chapter-1',includeArchived:true})
    view.rerender(<NovelManuscriptReader {...props} open={false}/>);view.rerender(<NovelManuscriptReader {...props} open/>)
    await waitFor(()=>expect(read).toHaveBeenCalledTimes(3))
    expect(read.mock.calls[2][0]).toMatchObject({scope:'chapter',unitId:'chapter-1',includeArchived:true})
    localStorage.removeItem(key)
})

it('retains an old bound passage after changed prose and subsequent window loading until the author reads again',async()=>{
    const key='changed-reader-device:reader-position',old={schemaVersion:1,scope:{scope:'novel',unitId:null,includeArchived:false},sceneId:'one',contentHash:'a'.repeat(64),nodeId:'one-p',blockOffset:0,blockHeight:100,width:600,appearance:'original'}
    localStorage.setItem(key,JSON.stringify(old))
    const geometry=vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(this:HTMLElement){
        const top=this.dataset.manuscriptNodeId?100:0,height=this.dataset.manuscriptNodeId?100:600
        return {top,bottom:top+height,left:0,right:600,width:600,height,x:0,y:top,toJSON:()=>({})} as DOMRect
    })
    const first=readingItem('one','Changed saved passage.');first.header.contentHash='b'.repeat(64);first.scene.contentHash='b'.repeat(64)
    const read=vi.fn().mockResolvedValueOnce(readingPage({totalScenes:3,items:[first,readingItem('two')],nextAfterSceneId:'two',navigation:{startSceneId:'one',beforeSceneId:null,previousBeforeSceneId:null,previousChapterId:null,previousPartId:null}}))
        .mockResolvedValueOnce(readingPage({offset:2,totalScenes:3,afterSceneId:'two',items:[readingItem('three')]}))
    const view=render(<NovelManuscriptReader open source={{key:'owner',storyId:'story-1',isCurrent:()=>true,read}} story={novel()} preferences={DEFAULT_READING} preferenceKey="changed-reader-device" onOpenScene={async()=>false} onClose={()=>{}}/>)
    await screen.findByText(/This scene changed since your last reading/)
    fireEvent.click(screen.getByRole('button',{name:'Load next scenes'}));await waitFor(()=>expect(read).toHaveBeenCalledTimes(2))
    fireEvent(window,new Event('pagehide'))
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual(old)
    const scroller=document.querySelector<HTMLElement>('[role="dialog"] [class*="overflow-y-auto"]')!
    fireEvent.wheel(scroller,{deltaY:10});fireEvent(window,new Event('pagehide'))
    expect(JSON.parse(localStorage.getItem(key)!).contentHash).toBe('b'.repeat(64))
    await waitFor(()=>expect(screen.queryByText(/This scene changed since your last reading/)).toBeNull())
    view.unmount();geometry.mockRestore();localStorage.removeItem(key)
})

it('keeps an unavailable saved scene and allows an explicit fresh beginning without another seek',async()=>{
    const key='missing-reader-device:reader-position',old={schemaVersion:1,scope:{scope:'novel',unitId:null,includeArchived:false},sceneId:'missing',contentHash:'a'.repeat(64),nodeId:'missing-p',blockOffset:0,blockHeight:100,width:600,appearance:'original'}
    localStorage.setItem(key,JSON.stringify(old))
    const read=vi.fn().mockRejectedValueOnce(new ApiError(422,'Unavailable',{code:'STORY_READING_POSITION_INVALID'})).mockResolvedValueOnce(readingPage())
    render(<NovelManuscriptReader open source={{key:'owner',storyId:'story-1',isCurrent:()=>true,read}} story={novel()} preferences={DEFAULT_READING} preferenceKey="missing-reader-device" onOpenScene={async()=>false} onClose={()=>{}}/>)
    await screen.findByText(/Your saved scene is unavailable/);expect(JSON.parse(localStorage.getItem(key)!)).toEqual(old)
    fireEvent.click(screen.getByRole('button',{name:'Read from beginning'}));await screen.findByText('The gate held. 雨 🙂')
    expect(read.mock.calls[0][0].startSceneId).toBe('missing');expect(read.mock.calls[1][0].startSceneId).toBeUndefined()
    localStorage.removeItem(key)
})
