import { fireEvent,render,screen } from '@testing-library/react'
import { beforeEach,expect,it,vi } from 'vitest'
import { copyProvenance } from '@/test/fixtures/storyCopy'
import { novel } from '@/test/fixtures/story'
const mocks=vi.hoisted(()=>({read:vi.fn(),capture:()=>({owner:'same'}),isCurrent:()=>true}))
vi.mock('@/app/hooks/useWorkspace',()=>({useWorkspace:()=>({api:{getStoryCopyProvenance:mocks.read},capture:mocks.capture,isCurrent:mocks.isCurrent})}))
import { NovelCopyOrigin } from './NovelCopyOrigin'
beforeEach(()=>{vi.resetAllMocks();mocks.read.mockResolvedValue(copyProvenance())})
it('loads frozen source identity, revisions and choices only when requested',async()=>{
    render(<NovelCopyOrigin story={novel({id:'story-copy',copiedFrom:'story-1'})}/>)
    expect(mocks.read).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button',{name:'Copy origin'}))
    await screen.findByText(/Copied from “The gate”/)
    expect(screen.getByText('Opening · Source revision 7')).toBeInTheDocument()
    expect(mocks.read).toHaveBeenCalledWith('story-copy')
})
it('does not present a manifest whose source disagrees with the copied novel',async()=>{
    mocks.read.mockResolvedValue({...copyProvenance(),sourceId:'other-source'})
    render(<NovelCopyOrigin story={novel({id:'story-copy',copiedFrom:'story-1'})}/>)
    fireEvent.click(screen.getByRole('button',{name:'Copy origin'}))
    expect(await screen.findByRole('alert')).toHaveTextContent('The saved copy origin could not be loaded.')
})
