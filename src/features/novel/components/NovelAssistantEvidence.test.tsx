import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { novelAssistantReviewFixture } from '@/test/fixtures/novelAssistantReview'
import type { AssistantTurn } from '@/features/creation/common/components/assistant/assistantModel'
import type { NovelAssistantSource } from '../hooks/useNovelAssistantSource'
import { NovelAssistantEvidence } from './NovelAssistantEvidence'
import {ApiError} from '@/infrastructure/api'

function setup() {
    const fixture = novelAssistantReviewFixture()
    const source: NovelAssistantSource = { key: 'author/workspace/book', storyId: fixture.index.id, isCurrent: () => true,
        prepare: vi.fn(), preview: vi.fn(), getTurn: vi.fn(), turnState: vi.fn(), stopTurn: vi.fn(), generation: vi.fn(async () => fixture.detail), stash: vi.fn(), sceneDocument: vi.fn(), acceptTogether: vi.fn(), recoverTogether: vi.fn(), undoTogether: vi.fn(), refinement: vi.fn(), refinementForGeneration:vi.fn(), refinementForVariant:vi.fn(), readRefinementSource:vi.fn(), reviewCandidate: vi.fn() }
    const turn: AssistantTurn = { message: { message_id: 11, conversation_id: 7, sequence_no: 2, role: 'assistant', status: 'completed',
        content: fixture.record.result.answer, metadata: { request_id: 'saved-turn', novel: fixture.record } },
        appliedChanges: [], isStreaming: false, isInterrupted: false }
    const review = vi.fn<(record: typeof fixture.record, signal: AbortSignal) => Promise<boolean>>(async () => true)
    const props = { turns: [turn], story: fixture.index, source, readOnly: false, onReviewSuggestion: review }
    return { ...fixture, source, review, props }
}
async function inspect() {
    fireEvent.click(screen.getByRole('button', { name: 'Review suggestion' }))
    const dialog = await screen.findByRole('dialog', { name: 'Suggested passage' })
    await within(dialog).findByText(/Saved suggestion status/)
    return dialog
}
it('opens authored versions with the verified original generation and its own scene identity',async()=>{
    const test=setup(),open=vi.fn()
    render(<NovelAssistantEvidence {...test.props} onAuthorVersions={open}/>)
    const dialog=await inspect()
    fireEvent.click(within(dialog).getByRole('button',{name:'Authored versions'}))
    expect(open).toHaveBeenCalledExactlyOnceWith(test.detail.generation,false)
    expect(test.review).not.toHaveBeenCalled();expect(test.source.stash).not.toHaveBeenCalled()
})

it('selects refinement through the reachable footer without applying or stashing the parent',async()=>{
    const test=setup(),refine=vi.fn(async()=>true)
    render(<NovelAssistantEvidence {...test.props} onRefineSuggestion={refine} />)
    const dialog=await inspect()
    fireEvent.click(within(dialog).getByRole('button',{name:'Refine suggestion'}))
    await act(async()=>{})
    expect(refine).toHaveBeenCalledWith(test.record,expect.any(AbortSignal))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(test.source.stash).not.toHaveBeenCalled()
    expect(test.review).not.toHaveBeenCalled()
})

it('keeps evidence and refinement available when the saved sources changed before handoff',async()=>{
    const test=setup(),refine=vi.fn(async()=>true)
    test.review.mockRejectedValueOnce(new ApiError(409,'Saved context changed',{code:'STORY_ASSISTANT_SOURCE_CHANGED'}))
    render(<NovelAssistantEvidence {...test.props} onRefineSuggestion={refine} />)
    const dialog=await inspect()
    fireEvent.click(within(dialog).getByRole('button',{name:'Review suggestion'}))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('The manuscript or context changed after this suggestion')
    fireEvent.click(within(dialog).getByRole('button',{name:'Refine suggestion'}))
    await act(async()=>{})
    expect(refine).toHaveBeenCalledWith(test.record,expect.any(AbortSignal))
    expect(test.source.stash).not.toHaveBeenCalled()
})

it('closing refinement aborts the parent read and retains the saved evidence',async()=>{
    const test=setup();let finish!:(value:boolean)=>void
    const refine=vi.fn<NonNullable<React.ComponentProps<typeof NovelAssistantEvidence>['onRefineSuggestion']>>(()=>new Promise(resolve=>{finish=resolve}))
    render(<NovelAssistantEvidence {...test.props} onRefineSuggestion={refine} />)
    const dialog=await inspect()
    fireEvent.click(within(dialog).getByRole('button',{name:'Refine suggestion'}))
    const signal=refine.mock.calls[0][1]
    fireEvent.click(within(dialog).getByRole('button',{name:'Close'}))
    expect(signal.aborted).toBe(true)
    await act(async()=>finish(false))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button',{name:'Review suggestion'})).toBeInTheDocument()
    expect(test.source.stash).not.toHaveBeenCalled()
})

it('hands off the inspected original candidate and closes only after Studio stages it', async () => {
    const test = setup()
    let finish!: (value: boolean) => void
    test.review.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    render(<NovelAssistantEvidence {...test.props} />)
    const dialog = await inspect(), button = within(dialog).getByRole('button', { name: 'Review suggestion' })
    fireEvent.click(button)
    expect(button).toBeDisabled()
    expect(test.review).toHaveBeenCalledWith(test.record, expect.any(AbortSignal))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await act(async () => finish(true))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(test.source.stash).not.toHaveBeenCalled()
})

it('closing the inspector aborts handoff and ignores a late rejection', async () => {
    const test = setup()
    let finish!: (value: boolean) => void
    test.review.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    render(<NovelAssistantEvidence {...test.props} />)
    const dialog = await inspect()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Review suggestion' }))
    const signal = test.review.mock.calls[0][1]
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(signal.aborted).toBe(true)
    await act(async () => finish(false))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it.each(['rejected', 'failed'])('retains the inspected evidence when handoff is %s', async mode => {
    const test = setup()
    if (mode === 'failed') test.review.mockRejectedValueOnce(new Error('Controlled failed review'))
    else test.review.mockResolvedValueOnce(false)
    render(<NovelAssistantEvidence {...test.props} />)
    const dialog = await inspect()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Review suggestion' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('The suggestion could not be opened for review')
    expect(within(dialog).getByRole('button', { name: 'Review suggestion' })).toBeEnabled()
    expect(within(dialog).getByText(test.record.result.proposal!.markdown)).toBeInTheDocument()
})

it('hides the old inspector immediately when the owner scope changes', async () => {
    const test = setup(), view = render(<NovelAssistantEvidence {...test.props} />)
    await inspect()
    view.rerender(<NovelAssistantEvidence {...test.props} turns={[]} source={{ ...test.source, key: 'another-owner/workspace/book' }} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByText(test.record.result.proposal!.markdown)).not.toBeInTheDocument()
    expect(test.review).not.toHaveBeenCalled()
})

it.each(['read_only', 'accepted'])('keeps %s evidence readable without a write handoff', async mode => {
    const test = setup()
    if (mode === 'accepted') test.detail.generation.status = 'accepted'
    render(<NovelAssistantEvidence {...test.props} readOnly={mode === 'read_only'} />)
    const dialog = await inspect()
    expect(within(dialog).getByText(test.record.result.proposal!.markdown)).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Review suggestion' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Stash suggestion' })).not.toBeInTheDocument()
})

it('renders the saved answer as Markdown, the same way the conversation shows it',async()=>{
    const test=setup()
    test.record.result.answer='**New chapter** after the harbor.'
    render(<NovelAssistantEvidence {...test.props}/>)
    const dialog=await inspect()
    expect(within(dialog).getByText('New chapter').tagName).toBe('STRONG')
    expect(within(dialog).queryByText(/\*\*New chapter\*\*/)).not.toBeInTheDocument()
})
