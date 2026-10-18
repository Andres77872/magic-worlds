import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
const state=vi.hoisted(()=>({items:[{storyId:'novel-one',title:'The vanished crown',write:{requestId:'lost-trash',expectedMetadataRevision:2,action:'trash'},storageFailed:false}],retry:vi.fn()}))
vi.mock('@/app/hooks',()=>({useData:()=>({pendingStoryLifecycle:state.items,retryStoryLifecycle:state.retry})}))
import { NovelPendingLifecycle } from './NovelPendingLifecycle'
beforeEach(()=>{vi.clearAllMocks();state.retry.mockResolvedValue(undefined)})
it('makes an interrupted Trash request reachable without a library card',async()=>{
    const refresh=vi.fn()
    render(<NovelPendingLifecycle onResolved={refresh}/>)
    expect(screen.getByText(/The vanished crown/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Retry save'}))
    await waitFor(()=>expect(state.retry).toHaveBeenCalledWith('novel-one','lost-trash'))
    await waitFor(()=>expect(refresh).toHaveBeenCalledTimes(1))
})
it('keeps recovery readable in an archived workspace and disables the write',()=>{
    render(<NovelPendingLifecycle readOnly/>)
    expect(screen.getByRole('button',{name:'Retry save'})).toBeDisabled()
    expect(state.retry).not.toHaveBeenCalled()
})
