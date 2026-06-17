import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Adventure } from '@/shared'
import { InteractionLeftPanel } from './InteractionLeftPanel'

vi.mock('../../../app/hooks', () => ({
    useData: () => ({ characters: [], worlds: [] }),
}))

vi.mock('@/features/lorebook', () => ({
    SessionLorebookPanel: ({ targetKind, targetId }: { targetKind: string; targetId: string }) => (
        <div data-testid="session-lorebook-panel" data-target-kind={targetKind} data-target-id={targetId} />
    ),
}))

const ADVENTURE: Adventure = {
    id: '77',
    scenario: 'Open the gate.',
    characters: [],
    turns: [],
    status: 'in-progress',
    snapshot: {
        schema_version: 1,
        source: 'mysql_card_body',
        template_card_id: 'tpl-1',
        template: {
            id: 'tpl-1',
            description: 'Open the gate.',
            characters: [],
            world: [],
        },
    },
}

describe('InteractionLeftPanel lorebooks', () => {
    it('wires the session lorebook panel to the active adventure session id', () => {
        render(<InteractionLeftPanel adventure={ADVENTURE} onBack={vi.fn()} onSnapshotChange={vi.fn()} />)

        const panel = screen.getByTestId('session-lorebook-panel')
        expect(panel).toHaveAttribute('data-target-kind', 'adventure_session')
        expect(panel).toHaveAttribute('data-target-id', '77')
    })
})
