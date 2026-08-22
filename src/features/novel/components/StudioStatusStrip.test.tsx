import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { NovelSaveState } from '../utils/novelUtils'
import { StudioStatusStrip } from './StudioStatusStrip'

function renderStrip(overrides: { saveState?: NovelSaveState; goal?: number | null } = {}) {
    const spies = { onSetGoal: vi.fn(), onRetrySave: vi.fn() }
    render(
        <StudioStatusStrip
            words={1204}
            goal={overrides.goal ?? null}
            saveState={overrides.saveState ?? 'saved'}
            lastSavedAt={null}
            {...spies}
        />,
    )
    return spies
}

describe('StudioStatusStrip', () => {
    it('is the one place the save state is reported', () => {
        renderStrip({ saveState: 'saved' })

        expect(screen.getByTestId('novel-save-state')).toHaveTextContent('Saved')
        expect(screen.queryByRole('button', { name: 'Retry save' })).toBeNull()
    })

    it('grows a retry only when the save failed, and it re-triggers the save', () => {
        const spies = renderStrip({ saveState: 'error' })

        fireEvent.click(screen.getByRole('button', { name: 'Retry save' }))

        expect(spies.onRetrySave).toHaveBeenCalledTimes(1)
    })

    it('carries no AI review controls — those belong on the generated passage', () => {
        renderStrip()

        expect(screen.queryByRole('button', { name: /Accept/ })).toBeNull()
        expect(screen.queryByRole('button', { name: /Regenerate/ })).toBeNull()
        expect(screen.queryByRole('button', { name: /Decline/ })).toBeNull()
    })
})
