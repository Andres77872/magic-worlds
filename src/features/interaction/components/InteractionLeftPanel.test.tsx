import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Adventure } from '@/shared'
import { InteractionLeftPanel } from './InteractionLeftPanel'
import sidebarStory from './InteractionLeftPanel.stories'

vi.mock('../../../app/hooks', () => ({
    useData: () => ({ characters: [], worlds: [] }),
    useFloatingWindows: () => ({ openWindow: vi.fn(), closeWindow: vi.fn(), closeAll: vi.fn(), focusWindow: vi.fn(), windows: [] }),
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
        schema_version: 2,
        source: 'resolved_library_clone',
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
    beforeEach(() => {
        vi.stubEnv('VITE_FEATURE_LOREBOOKS_ENABLED', 'true')
    })

    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('wires the session lorebook panel to the active adventure session id', () => {
        render(<InteractionLeftPanel adventure={ADVENTURE} onBack={vi.fn()} onSnapshotChange={vi.fn()} />)

        const panel = screen.getByTestId('session-lorebook-panel')
        expect(panel).toHaveAttribute('data-target-kind', 'adventure_session')
        expect(panel).toHaveAttribute('data-target-id', '77')
    })

    it('renders the sidebar story fixture with a serialized stored snapshot', () => {
        const adventure = JSON.parse(JSON.stringify(sidebarStory.args.adventure)) as Adventure
        render(<InteractionLeftPanel adventure={adventure} onBack={vi.fn()} />)

        expect(screen.getByText('Rain taps the leaded glass as a hooded figure slides a damp envelope across your table.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Mirren Vale/ })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Lyra Dawnwhisper/ })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /The Sunken Library/ })).toBeInTheDocument()
    })
})
