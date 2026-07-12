import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Story } from '@/shared'
import type { NovelSaveState } from '../utils/novelUtils'
import { NovelStudioHeader } from './NovelStudioHeader'

const story: Story = {
    id: 's1',
    title: 'The Hollow Crown',
    description: 'A story.',
    source: { kind: 'blank', id: null, title: null },
    chapters: [],
    activeCardRefs: [],
    activeContext: {
        includeSelectedCards: true,
        includeLorebooks: true,
        includeRecentChapters: 1,
        tokenBudget: 1000,
        styleSource: 'current_chapter',
        customStyleInstruction: null,
    },
}

function renderHeader(saveState: NovelSaveState, onSave = vi.fn()) {
    render(
        <NovelStudioHeader
            story={story}
            saveState={saveState}
            lastSavedAt={null}
            words={100}
            goal={null}
            onSetGoal={() => {}}
            focusMode={false}
            codexOpen={false}
            typewriter={false}
            onSave={onSave}
            onToggleFocusMode={() => {}}
            onToggleCodex={() => {}}
            onToggleTypewriter={() => {}}
            onOpenHistory={() => {}}
            onSaveMeta={() => {}}
        />,
    )
    return onSave
}

describe('NovelStudioHeader save state', () => {
    it('offers a retry action only when the save failed', () => {
        renderHeader('saved')
        expect(screen.queryByRole('button', { name: 'Retry save' })).toBeNull()
    })

    it('retry re-triggers the save', () => {
        const onSave = renderHeader('error')

        fireEvent.click(screen.getByRole('button', { name: 'Retry save' }))

        expect(onSave).toHaveBeenCalledTimes(1)
    })
})
