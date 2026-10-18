import { fireEvent,render,screen,within } from '@testing-library/react'
import { expect,it,vi } from 'vitest'
import { outlineStory } from '@/test/fixtures/novelOutline'
import { storyChapter,storyScene } from '@/test/fixtures/story'
import { LARGE_OUTLINE_SCENES,NovelChapterRail } from './NovelChapterRail'

it('keeps compact writing navigation and reveals distinct planned/current/stale summaries with independent goals',()=>{
    const story=outlineStory(),select=vi.fn(),move=vi.fn(),manage=vi.fn()
    render(<NovelChapterRail chapters={story.chapters} parts={story.parts} references={story.activeCardRefs} activeChapterId="chapter-one" activeSceneId="arrival" onSelect={select} onMove={move} onAdd={vi.fn()} onManage={manage}/>)
    expect(screen.queryByText('Planned synopsis')).not.toBeInTheDocument()
    const arrival=screen.getByRole('button',{current:'page'});expect(arrival).toHaveAttribute('aria-current','page')
    expect(screen.getByRole('button',{name:'An earlier entrance'})).toHaveAttribute('draggable','false')
    fireEvent.click(screen.getByRole('button',{name:'Details'}))
    expect(screen.getByText('Mira must decide whether to cross.')).toBeInTheDocument()
    expect(screen.getByText('Mira reaches the gate and finds it sealed.')).toBeInTheDocument()
    expect(screen.getByText('Current revision')).toBeInTheDocument();expect(screen.getByText('Earlier revision')).toBeInTheDocument();expect(screen.getByText('Unverified')).toBeInTheDocument()
    expect(screen.getByText(/\/ 300 words/)).toBeInTheDocument();expect(screen.getByText(/\/ 800 words/)).toBeInTheDocument()
    expect(screen.getByText('The old gate')).toBeInTheDocument();expect(screen.getByText('Excluded from AI')).toBeInTheDocument()
    fireEvent.click(arrival);expect(select).toHaveBeenCalledWith('arrival')
    fireEvent.click(screen.getByRole('button',{name:'Details for The arrival'}));expect(manage).toHaveBeenCalledWith({kind:'scene',id:'arrival'})
    expect(move).not.toHaveBeenCalled()
})
it('keeps view controls usable while archived writing actions stay disabled and view changes do not rename units',()=>{
    const story=outlineStory(),before=JSON.stringify(story)
    render(<NovelChapterRail chapters={story.chapters} parts={story.parts} references={story.activeCardRefs} activeChapterId="chapter-one" onSelect={vi.fn()} onAdd={vi.fn()} readOnly/>)
    expect(screen.getByTestId('novel-chapter-add')).toBeDisabled()
    const options=screen.getByRole('group',{name:'Outline view'})
    fireEvent.click(within(options).getByRole('button',{name:'Numbering'}))
    expect(within(options).getByRole('button',{name:'Numbering'})).toHaveAttribute('aria-pressed','false')
    fireEvent.click(within(options).getByRole('button',{name:'Details'}));expect(screen.getByText('Current revision')).toBeInTheDocument()
    expect(JSON.stringify(story)).toBe(before)
})
it('starts a long novel with only the open chapter listing its scenes, and lets the author show or hide any chapter',()=>{
    const chapters=[0,1,2].map((c)=>storyChapter({id:'chapter-'+c,title:'Chapter '+c,order:c,
        scenes:Array.from({length:70},(_,n)=>storyScene({id:`scene-${c}-${n}`,title:`Scene ${c}.${n}`,chapterId:'chapter-'+c,order:n,plainText:'Fog.'}))}))
    expect(3*70).toBeGreaterThan(LARGE_OUTLINE_SCENES)
    const select=vi.fn()
    render(<NovelChapterRail chapters={chapters} activeChapterId="chapter-1" activeSceneId="scene-1-3" onSelect={select} onAdd={vi.fn()}/>)
    expect(screen.getByText(/only the open chapter lists its scenes/)).toBeInTheDocument()
    expect(screen.getAllByRole('button',{name:/^Scene /})).toHaveLength(70)
    expect(screen.getByRole('button',{name:'Scene 1.3'})).toHaveAttribute('aria-current','page')
    const show=screen.getByRole('button',{name:'Show 70 scenes in Chapter 0'})
    expect(show).toHaveAttribute('aria-expanded','false');expect(show).not.toHaveAttribute('aria-controls')
    fireEvent.click(show)
    const hide=screen.getByRole('button',{name:'Hide scenes in Chapter 0'})
    expect(hide).toHaveAttribute('aria-expanded','true');expect(document.getElementById(hide.getAttribute('aria-controls')!)).toContainElement(screen.getByRole('button',{name:'Scene 0.5'}))
    fireEvent.click(screen.getByRole('button',{name:'Scene 0.5'}));expect(select).toHaveBeenCalledWith('scene-0-5')
    // The open chapter can be hidden too; the author's choice wins over the default.
    fireEvent.click(screen.getByRole('button',{name:'Hide scenes in Chapter 1'}))
    expect(screen.queryByRole('button',{name:'Scene 1.3'})).not.toBeInTheDocument()
})
it('keeps a short novel fully listed, with each chapter still collapsible',()=>{
    const story=outlineStory()
    render(<NovelChapterRail chapters={story.chapters} parts={story.parts} activeChapterId={null} onSelect={vi.fn()} onAdd={vi.fn()}/>)
    expect(screen.queryByText(/only the open chapter lists its scenes/)).not.toBeInTheDocument()
    expect(screen.getByRole('button',{name:'Hide scenes in At the boundary'})).toHaveAttribute('aria-expanded','true')
    expect(screen.getByRole('button',{name:'The arrival'})).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Hide scenes in At the boundary'}))
    expect(screen.queryByRole('button',{name:'The arrival'})).not.toBeInTheDocument()
    expect(screen.getByRole('button',{name:'Show 3 scenes in At the boundary'})).toHaveAttribute('aria-expanded','false')
})
