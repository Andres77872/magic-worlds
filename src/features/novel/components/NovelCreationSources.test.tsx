import { fireEvent,render,screen,waitFor } from '@testing-library/react'
import { expect,it,vi } from 'vitest'
import { ApiError } from '@/infrastructure/api'
import { NovelCreateModal } from './NovelCreateModal'
import { creationSourcesPreview } from '@/test/fixtures/storyCreationSources'
import type { CreationSourceApi } from '../hooks/useCreationSourceReview'
it('preserves approved material as reference text and requires a fresh review after a stale creation rejection',async()=>{
    const api={previewStoryCreationSources:vi.fn(async(selection)=>creationSourcesPreview(selection))} satisfies CreationSourceApi
    const create=vi.fn().mockRejectedValueOnce(new ApiError(409,'Source changed',{code:'STORY_CREATION_SOURCE_CHANGED'})).mockResolvedValue(undefined)
    render(<NovelCreateModal open creating={false} sourceApi={api} onClose={()=>{}} onCreate={create}/>)
    fireEvent.change(screen.getByRole('textbox',{name:'Title'}),{target:{value:'The glass road'}})
    fireEvent.click(screen.getByRole('button',{name:'Add approved adventure material'}))
    const text='  Mira llegó 🙂.\nThe gate stayed shut.  '
    fireEvent.change(screen.getByRole('textbox',{name:'Approved reference text'}),{target:{value:text}})
    fireEvent.click(screen.getByRole('button',{name:'Review sources'}));fireEvent.click(await screen.findByRole('switch',{name:'I approve these source snapshots'}))
    fireEvent.click(screen.getByRole('button',{name:'Create novel'}))
    await screen.findByText('A source changed before creation. Review the current snapshots again; your title, outline and source choices are retained.')
    expect(screen.getByRole('textbox',{name:'Title'})).toHaveValue('The glass road')
    expect(screen.getByRole('textbox',{name:'Approved reference text'})).toHaveValue(text)
    expect(screen.getByRole('button',{name:'Create novel'})).toBeDisabled()
    fireEvent.click(screen.getByRole('button',{name:'Review sources'}));fireEvent.click(await screen.findByRole('switch',{name:'I approve these source snapshots'}))
    fireEvent.click(screen.getByRole('button',{name:'Create novel'}))
    await waitFor(()=>expect(create).toHaveBeenCalledTimes(2))
    expect(create.mock.calls[1][0].approvedMaterials[0].text).toBe(text)
    expect(create.mock.calls[1][0].chapters).toEqual([{title:'Chapter 1',status:null}])
})
it('keeps an oversized pasted source intact while blocking review and creation',()=>{
    const api={previewStoryCreationSources:vi.fn()},create=vi.fn()
    render(<NovelCreateModal open creating={false} sourceApi={api} onClose={()=>{}} onCreate={create}/>)
    fireEvent.click(screen.getByRole('button',{name:'Add approved adventure material'}))
    const text='🙂'.repeat(20_001)
    fireEvent.change(screen.getByRole('textbox',{name:'Approved reference text'}),{target:{value:text}})
    expect(screen.getByRole('textbox',{name:'Approved reference text'})).toHaveValue(text)
    expect(screen.getByRole('button',{name:'Review sources'})).toBeDisabled();expect(screen.getByRole('button',{name:'Create novel'})).toBeDisabled()
    expect(api.previewStoryCreationSources).not.toHaveBeenCalled();expect(create).not.toHaveBeenCalled()
})
