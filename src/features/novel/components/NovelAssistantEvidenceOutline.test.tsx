import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { novelAssistantReviewFixture } from '@/test/fixtures/novelAssistantReview'
import type { AssistantTurn } from '@/features/creation/common/components/assistant/assistantModel'
import type { NovelAssistantRecord } from '@/shared/types/storyAssistant.types'
import type { NovelAssistantSource } from '../hooks/useNovelAssistantSource'
import { NovelAssistantEvidence } from './NovelAssistantEvidence'

// The saved fixture is a Suggest turn; a chapter plan is an Ask turn whose packet names the action. Record
// integrity is covered by the contract tests, so here only the record's shape decides what the evidence offers.
vi.mock('@/infrastructure/api/novelAssistantContract', async (original) => ({
    ...await original<typeof import('@/infrastructure/api/novelAssistantContract')>(),
    verifyNovelAssistantRecord: (value: unknown) => Boolean(value),
}))

function setup(target: 'chapter_plan' | 'beats') {
    const fixture = novelAssistantReviewFixture()
    const source = { key: 'author/workspace/book', storyId: fixture.index.id, isCurrent: () => true, generation: vi.fn() } as unknown as NovelAssistantSource
    const record = structuredClone(fixture.record) as NovelAssistantRecord
    record.context.request = { ...record.context.request, task: 'ask', action: { kind: 'outline', target } }
    record.result = { ...record.result, proposal: null, answer: '## Chapter 4: The Tideline\n\n- **Low Water.** Mara walks the shore.' }
    const turn: AssistantTurn = { message: { message_id: 11, conversation_id: 7, sequence_no: 2, role: 'assistant', status: 'completed',
        content: record.result.answer, metadata: { request_id: 'saved-turn', novel: record } }, appliedChanges: [], isStreaming: false, isInterrupted: false }
    return { story: fixture.index, source, turns: [turn], record }
}

it('offers a chapter plan reply to the outline import with its exact answer, and closes the evidence', async () => {
    const test = setup('chapter_plan'), outline = vi.fn()
    render(<NovelAssistantEvidence turns={test.turns} story={test.story} source={test.source} readOnly={false} outline={outline} />)
    fireEvent.click(screen.getByRole('button', { name: 'Inspect saved evidence' }))
    const dialog = await screen.findByRole('dialog', { name: 'Saved reply evidence' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add to outline…' }))
    expect(outline).toHaveBeenCalledExactlyOnceWith(test.record.result.answer)
    expect(screen.queryByRole('dialog', { name: 'Saved reply evidence' })).not.toBeInTheDocument()
})

it('offers nothing for other outline shapes, read-only novels or where the outline cannot change', async () => {
    for (const [target, readOnly, outline] of [['beats', false, vi.fn()], ['chapter_plan', true, vi.fn()], ['chapter_plan', false, undefined]] as const) {
        const test = setup(target)
        const view = render(<NovelAssistantEvidence turns={test.turns} story={test.story} source={test.source} readOnly={readOnly} outline={outline} />)
        fireEvent.click(screen.getByRole('button', { name: 'Inspect saved evidence' }))
        await screen.findByRole('dialog', { name: 'Saved reply evidence' })
        expect(screen.queryByRole('button', { name: 'Add to outline…' })).not.toBeInTheDocument()
        view.unmount()
    }
})
