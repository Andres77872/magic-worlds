import { act,fireEvent,render,screen,waitFor } from '@testing-library/react'
import { expect,it,vi } from 'vitest'
import type { StoryOutline,StorySceneOutline,StoryStudioExcerpts } from '@/shared'
import { studioExcerptsRequest } from '@/infrastructure/api/storyStudioExcerptsContract'
import { studioIndex } from '@/test/fixtures/storyStudio'
import { novel,storyChapter,storyScene } from '@/test/fixtures/story'
import { NovelSceneExcerpts,type SceneExcerptReader } from './NovelSceneExcerpts'
const source=studioIndex(novel({chapters:[storyChapter({scenes:Array.from({length:21},(_,i)=>storyScene({id:'scene-'+i,order:i,title:'Scene '+i}))})]}))
const scenes=source.chapters[0].scenes
const excerpts=(source:StoryOutline,scenes:StorySceneOutline[]):StoryStudioExcerpts=>({schemaVersion:1 as const,projection:'scene_excerpts' as const,storyId:source.id,source:studioExcerptsRequest(source,scenes)!,items:scenes.map(scene=>({sceneId:scene.id,revision:scene.revision,metadataRevision:scene.metadataRevision,contentHash:scene.contentHash,text:'Saved '+scene.title,truncated:false}))})
it('loads at most twenty bounded excerpts and keeps canonical documents out of preview state',async()=>{
    const read=vi.fn<SceneExcerptReader>(async(source,scenes)=>excerpts(source,scenes)),ready=vi.fn()
    render(<NovelSceneExcerpts source={source} scenes={scenes} read={read} onReady={ready}/>)
    expect(ready).toHaveBeenCalledWith(false)
    await screen.findByText('Saved Scene 0')
    expect(read.mock.calls[0][1]).toHaveLength(20)
    expect(screen.queryByText('Scene 20')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Next scenes'}))
    await screen.findByText('Saved Scene 20')
    expect(read.mock.calls[1][1].map(scene=>scene.id)).toEqual(['scene-20'])
    expect(screen.queryByText('Saved Scene 0')).not.toBeInTheDocument()
})
it('ignores a retired source response and permits retry without discarding the review rows',async()=>{
    let finish!:(value:unknown)=>void
    const read=vi.fn().mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve})).mockRejectedValueOnce(new Error('Offline')).mockImplementation(async(source,scenes)=>excerpts(source,scenes)),ready=vi.fn()
    const view=render(<NovelSceneExcerpts source={source} scenes={scenes.slice(0,1)} read={read} onReady={ready}/>)
    const next={...source,metadataRevision:2}
    view.rerender(<NovelSceneExcerpts source={next} scenes={scenes.slice(0,1)} read={read} onReady={ready}/>)
    await screen.findByRole('alert')
    await act(async()=>{finish(excerpts(source,scenes.slice(0,1)))})
    expect(screen.queryByText('Saved Scene 0')).not.toBeInTheDocument()
    expect(ready).toHaveBeenLastCalledWith(false)
    fireEvent.click(screen.getByRole('button',{name:'Retry previews'}))
    await waitFor(()=>expect(screen.getByText('Saved Scene 0')).toBeInTheDocument())
    expect(ready).toHaveBeenLastCalledWith(true)
})
