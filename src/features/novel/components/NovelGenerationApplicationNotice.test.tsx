import {fireEvent,render,screen} from '@testing-library/react'
import {expect,it,vi} from 'vitest'
import {manuscript} from '@/test/fixtures/story'
import {NovelGenerationApplicationNotice} from './NovelGenerationApplicationNotice'

it('explains the blocked application and exposes a controllable comparison action',()=>{
    const value={reason:'writing_changed' as const,generationId:'generation-1',write:{requestId:'accept-1',expectedRevision:1,document:manuscript('Proposed writing.')}},onCompare=vi.fn()
    const view=render(<NovelGenerationApplicationNotice value={value} onCompare={onCompare} />)
    expect(screen.getByRole('alert')).toHaveTextContent('The manuscript revision changed')
    fireEvent.click(screen.getByRole('button',{name:'Review the rejected application'}))
    expect(onCompare).toHaveBeenCalledOnce()
    view.rerender(<NovelGenerationApplicationNotice value={value} onCompare={onCompare} disabled />)
    expect(screen.getByRole('button',{name:'Review the rejected application'})).toBeDisabled()
})
