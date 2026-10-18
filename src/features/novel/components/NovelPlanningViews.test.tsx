import { fireEvent,render,screen,waitFor,within } from '@testing-library/react'
import { expect,it,vi } from 'vitest'
import { outlineStory } from '@/test/fixtures/novelOutline'
import { novel,storyChapter,storyScene } from '@/test/fixtures/story'
import { NovelPlanningViews } from './NovelPlanningViews'
import { LARGE_OUTLINE_SCENES } from './NovelChapterRail'
import { planningScenes,sceneMatrix,storyTimeline } from '../utils/planningViews'

function timedStory(){
    const story=outlineStory(),scenes=story.chapters[0].scenes
    const scene=(id:string)=>scenes.find((item)=>item.id===id)!
    scene('arrival').details={...scene('arrival').details,storyTimeOrder:20,narrativeTime:'Dawn',plotThreads:['The sealed gate']}
    scene('alternate').details={...scene('alternate').details,storyTimeOrder:5}
    scene('answer').details={...scene('answer').details,plotThreads:['The sealed gate','A voice']}
    return story
}

it('derives reading order, chronology, flashbacks and matrix rows from the one outline',()=>{
    const story=timedStory(),before=JSON.stringify(story)
    const scenes=planningScenes(story)
    expect(scenes.map((scene)=>[scene.id,scene.reading])).toEqual([['arrival',1],['alternate',2],['answer',3]])
    const timeline=storyTimeline(scenes)
    expect(timeline.timed.map((scene)=>scene.id)).toEqual(['alternate','arrival'])
    expect([...timeline.flashbacks]).toEqual(['alternate'])
    expect(timeline.unknown.map((scene)=>scene.id)).toEqual(['answer'])
    expect(sceneMatrix(scenes)).toEqual({characters:['mira'],threads:['The sealed gate','A voice']})
    expect(JSON.stringify(story)).toBe(before)
})

it('shows the board, timeline and matrix, and opens a scene in Write',async()=>{
    const story=timedStory(),open=vi.fn().mockResolvedValue(true),close=vi.fn(),edit=vi.fn()
    render(<NovelPlanningViews open onClose={close} story={story} activeSceneId="arrival" onOpenScene={open} onEditScene={edit}/>)
    const board=screen.getByRole('tabpanel',{name:'Board'})
    expect(within(board).getByRole('region',{name:'The crossing'})).toBeInTheDocument()
    expect(within(board).getByRole('button',{name:'Open The arrival in Write'})).toHaveAttribute('aria-current','location')
    expect(within(board).getByText('POV: Mira')).toBeInTheDocument()
    fireEvent.click(within(board).getByRole('button',{name:'Edit details for An unexpected answer'}))
    expect(edit).toHaveBeenCalledWith('answer')

    fireEvent.click(screen.getByRole('tab',{name:'Timeline'}))
    const timeline=screen.getByRole('tabpanel',{name:'Timeline'})
    const rows=within(within(timeline).getByRole('list',{name:'Timeline'})).getAllByRole('listitem')
    expect(rows.map((row)=>within(row).getAllByRole('button')[0].textContent)).toEqual(['An earlier entrance','The arrival'])
    expect(within(rows[0]).getByText('Flashback')).toBeInTheDocument()
    expect(within(rows[0]).getByText('Read #2')).toBeInTheDocument()
    expect(within(rows[1]).getByText('Dawn')).toBeInTheDocument()
    expect(within(within(timeline).getByRole('region',{name:'Unknown story time'})).getByText('An unexpected answer')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab',{name:'Matrix'}))
    const matrix=screen.getByRole('tabpanel',{name:'Matrix'})
    const mira=within(matrix).getByRole('row',{name:/Mira/})
    expect(within(mira).getAllByRole('cell').map((cell)=>cell.textContent?.replace('●',''))).toEqual(['POV','Not in this scene','Appears'])
    const voice=within(matrix).getByRole('row',{name:/A voice/})
    expect(within(voice).getAllByRole('cell').map((cell)=>cell.textContent?.replace('●',''))).toEqual(['Not in this scene','Not in this scene','Appears'])
    fireEvent.click(within(matrix).getByRole('button',{name:'Open An unexpected answer in Write'}))
    await waitFor(()=>expect(close).toHaveBeenCalled())
    expect(open).toHaveBeenCalledWith('answer')
})

it('stays open and explains when the current change blocks leaving the scene',async()=>{
    const close=vi.fn()
    render(<NovelPlanningViews open onClose={close} story={timedStory()} activeSceneId="arrival" onOpenScene={vi.fn().mockResolvedValue(false)}/>)
    fireEvent.click(screen.getByRole('button',{name:'Open An unexpected answer in Write'}))
    expect(await screen.findByRole('alert')).toHaveTextContent('That scene could not open.')
    expect(close).not.toHaveBeenCalled()
    expect(screen.queryByRole('button',{name:/Edit details/})).not.toBeInTheDocument()
})

it('lists where a character appears and opens the chosen passage through the save barrier',async()=>{
    const story=timedStory(),close=vi.fn()
    const match=(sceneId:string,position:number,title:string)=>({sceneId,position,chapterId:'c1',partId:null,title,chapterTitle:'The crossing',partTitle:null,chapterMetadataRevision:1,partMetadataRevision:null,
        revision:2,metadataRevision:1,contentHash:'h',status:'draft' as const,archived:false,readOnly:false,startOffset:4,endOffset:8,quote:'Mira',before:'And ',after:' waited.',beforeCut:false,afterCut:true})
    const page={schemaVersion:1 as const,storyId:story.id,algorithm:'mysql-icu-literal-v1' as const,sourceSnapshot:'snap',queryHash:'q',sourceStructureRevision:1,sourceMetadataRevision:1,sourceContextRevision:1,
        scenesSearched:3,matchingScenes:2,items:[match('arrival',4,'The arrival'),match('answer',9,'An unexpected answer')],nextCursor:null}
    const appearances={find:vi.fn().mockResolvedValue(page),open:vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)}
    render(<NovelPlanningViews open onClose={close} story={story} activeSceneId="arrival" onOpenScene={vi.fn()} appearances={appearances}/>)
    fireEvent.click(screen.getByRole('tab',{name:'Matrix'}))
    fireEvent.click(screen.getByRole('button',{name:'Find where Mira appears'}))
    expect(appearances.find).toHaveBeenCalledWith('Mira')
    const region=await screen.findByRole('region',{name:'Appearances'})
    expect(await within(region).findByText('2 passages in 2 scene(s) for “Mira”.')).toBeInTheDocument()
    expect(within(region).getByLabelText('Name or phrase')).toHaveValue('Mira')
    const results=within(region).getAllByRole('listitem')
    expect(results[1]).toHaveTextContent('The crossing · An unexpected answerAnd Mira waited.…')
    fireEvent.click(within(results[1]).getByRole('button'))
    expect(await within(region).findByRole('alert')).toHaveTextContent('That passage could not open.')
    expect(close).not.toHaveBeenCalled()
    fireEvent.click(within(results[1]).getByRole('button'))
    await waitFor(()=>expect(close).toHaveBeenCalled())
    expect(appearances.open).toHaveBeenLastCalledWith('Mira',page,page.items[1])
    fireEvent.change(within(region).getByLabelText('Name or phrase'),{target:{value:'the gate'}})
    fireEvent.click(within(region).getByRole('button',{name:'Find'}))
    expect(appearances.find).toHaveBeenLastCalledWith('the gate')
})

it('changes several selected scenes in one reviewed write and undoes it in one step',async()=>{
    const story=timedStory(),next={...story,structureRevision:story.structureRevision+1}
    const operate=vi.fn().mockResolvedValueOnce(next).mockResolvedValueOnce({...next,structureRevision:next.structureRevision+1})
    const view=render(<NovelPlanningViews open onClose={vi.fn()} story={story} activeSceneId="arrival" onOpenScene={vi.fn()} bulk={{operate,busy:false}}/>)
    fireEvent.click(screen.getByRole('button',{name:'Select scenes'}))
    expect(screen.getByRole('checkbox',{name:'Select An earlier entrance'})).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox',{name:'Select An unexpected answer'}))
    fireEvent.click(screen.getByRole('checkbox',{name:'Select The arrival'}))
    expect(screen.getByText('2 scenes selected')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Review change'}))
    expect(screen.getByText('This changes 2 scenes:')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Apply to 2 scenes'}))
    await waitFor(()=>expect(operate).toHaveBeenCalledWith({op:'bulk_scenes',action:'status',ids:['arrival','answer'],status:'revising'}))
    view.rerender(<NovelPlanningViews open onClose={vi.fn()} story={next} activeSceneId="arrival" onOpenScene={vi.fn()} bulk={{operate,busy:false}}/>)
    expect(await screen.findByText('Set 2 scenes to Revising.')).toBeInTheDocument()
    expect(screen.queryByText('2 scenes selected')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Undo'}))
    await waitFor(()=>expect(operate).toHaveBeenLastCalledWith({op:'undo_structure',revision:next.structureRevision,sourceStructureRevision:next.structureRevision}))
    expect(await screen.findByText(/^Undone\./)).toBeInTheDocument()
})

it('leaves already matching scenes out of a bulk change and offers no Undo once later changes exist',async()=>{
    const story=timedStory(),operate=vi.fn().mockResolvedValue({...story,structureRevision:story.structureRevision+1})
    story.chapters[0].scenes.find((scene)=>scene.id==='answer')!.status='complete'
    const view=render(<NovelPlanningViews open onClose={vi.fn()} story={story} activeSceneId="arrival" onOpenScene={vi.fn()} bulk={{operate,busy:false}}/>)
    fireEvent.click(screen.getByRole('button',{name:'Select scenes'}))
    fireEvent.click(screen.getByRole('checkbox',{name:'Select An unexpected answer'}))
    fireEvent.click(screen.getByRole('checkbox',{name:'Select The arrival'}))
    fireEvent.click(screen.getByRole('combobox',{name:'New status'}));fireEvent.click(screen.getByRole('option',{name:'Complete'}))
    fireEvent.click(screen.getByRole('button',{name:'Review change'}))
    expect(screen.getByText('This changes 1 scene:')).toBeInTheDocument()
    expect(screen.getByText('1 selected scene already matches and is left alone.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Apply to 1 scene'}))
    await waitFor(()=>expect(operate).toHaveBeenCalledWith({op:'bulk_scenes',action:'status',ids:['arrival'],status:'complete'}))
    view.rerender(<NovelPlanningViews open onClose={vi.fn()} story={{...story,structureRevision:story.structureRevision+2}} activeSceneId="arrival" onOpenScene={vi.fn()} bulk={{operate,busy:false}}/>)
    expect(await screen.findByText(/Undo it from Organization history/)).toBeInTheDocument()
    expect(screen.queryByRole('button',{name:'Undo'})).not.toBeInTheDocument()
})

it('opens a long novel on the board with only the current chapter, mounts the timeline only when chosen, and keeps the author\'s choices',async()=>{
    const chapters=[0,1,2].map((c)=>storyChapter({id:'chapter-'+c,title:'Chapter '+c,order:c,
        scenes:Array.from({length:70},(_,n)=>storyScene({id:`scene-${c}-${n}`,title:`Scene ${c}.${n}`,chapterId:'chapter-'+c,order:n,plainText:'Fog.'}))}))
    expect(3*70).toBeGreaterThan(LARGE_OUTLINE_SCENES)
    const story=novel({chapters}),open=vi.fn().mockResolvedValue(true),close=vi.fn()
    const view=render(<NovelPlanningViews open onClose={close} story={story} activeSceneId="scene-1-3" onOpenScene={open}/>)
    const board=screen.getByRole('tabpanel',{name:'Board'})
    expect(within(board).getByText(/opens with the current chapter only/)).toBeInTheDocument()
    expect(within(board).getAllByRole('button',{name:/^Open Scene /})).toHaveLength(70)
    expect(within(board).getByRole('button',{name:'Open Scene 1.3 in Write'})).toHaveAttribute('aria-current','location')
    // The hidden timeline builds no rows while the board is shown.
    expect(screen.queryByRole('tabpanel',{name:'Timeline'})).not.toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(70)
    const show=within(board).getByRole('button',{name:'Show 70 scenes in Chapter 2'})
    expect(show).toHaveAttribute('aria-expanded','false');expect(show).not.toHaveAttribute('aria-controls')
    fireEvent.click(show)
    const hide=within(board).getByRole('button',{name:'Hide scenes in Chapter 2'})
    expect(hide).toHaveAttribute('aria-expanded','true')
    expect(document.getElementById(hide.getAttribute('aria-controls')!)).toContainElement(within(board).getByRole('button',{name:'Open Scene 2.9 in Write'}))
    fireEvent.click(within(board).getByRole('button',{name:'Hide scenes in Chapter 1'}))
    expect(within(board).queryByRole('button',{name:'Open Scene 1.3 in Write'})).not.toBeInTheDocument()
    // The choices survive closing and reopening the drawer.
    view.rerender(<NovelPlanningViews open={false} onClose={close} story={story} activeSceneId="scene-1-3" onOpenScene={open}/>)
    view.rerender(<NovelPlanningViews open onClose={close} story={story} activeSceneId="scene-1-3" onOpenScene={open}/>)
    expect(screen.getByRole('button',{name:'Show 70 scenes in Chapter 1'})).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Open Scene 2.9 in Write'}))
    await waitFor(()=>expect(close).toHaveBeenCalled())
    expect(open).toHaveBeenCalledWith('scene-2-9')
})

it('lists every scene on the board of a short novel with no show or hide controls',()=>{
    render(<NovelPlanningViews open onClose={vi.fn()} story={timedStory()} activeSceneId="arrival" onOpenScene={vi.fn()}/>)
    expect(screen.queryByText(/opens with the current chapter only/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button',{name:/^(Show|Hide) .*scenes/})).not.toBeInTheDocument()
    expect(screen.getAllByRole('button',{name:/^Open .* in Write$/})).toHaveLength(3)
})

it('is a surface beside the manuscript: a titled region with a way back to Write, and nothing outside Plan',()=>{
    const story=timedStory(),close=vi.fn()
    const view=render(<NovelPlanningViews open onClose={close} story={story} activeSceneId="arrival" onOpenScene={vi.fn()}/>)
    expect(screen.getByRole('region',{name:'Planning views'})).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Back to writing'}))
    expect(close).toHaveBeenCalledOnce()
    // The chosen view outlives leaving Plan.
    fireEvent.click(screen.getByRole('tab',{name:'Timeline'}))
    view.rerender(<NovelPlanningViews open={false} onClose={close} story={story} activeSceneId="arrival" onOpenScene={vi.fn()}/>)
    expect(screen.queryByTestId('novel-plan-surface')).not.toBeInTheDocument()
    view.rerender(<NovelPlanningViews open onClose={close} story={story} activeSceneId="arrival" onOpenScene={vi.fn()}/>)
    expect(screen.getByRole('tab',{name:'Timeline'})).toHaveAttribute('aria-selected','true')
})
