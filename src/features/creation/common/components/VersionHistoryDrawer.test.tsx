import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { apiService } from '@/infrastructure/api'
import {
    createWorkspaceTestState,
    OTHER_WORKSPACE_ID,
    TEST_WORKSPACE_ID,
    WorkspaceTestProvider,
} from '@/shared/hooks/testing/workspaceTestUtils'
import { VersionHistoryDrawer } from './VersionHistoryDrawer'

afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
})

// Workspace R1: versions and usage are private reads through the committed workspace's client.
function wrapper({ children }: { children: ReactNode }) {
    const workspace = createWorkspaceTestState({ api: apiService.withWorkspace(TEST_WORKSPACE_ID) })
    return <WorkspaceTestProvider state={workspace}>{children}</WorkspaceTestProvider>
}

describe('VersionHistoryDrawer', () => {
    it('shows the usage line so restore impact is clear', async () => {
        vi.spyOn(apiService, 'listCardVersions').mockResolvedValue({
            card_id: 'vhd-1',
            latest_version_id: null,
            latest_version_number: 0,
            versions: [],
        })
        vi.spyOn(apiService, 'getCardUsage').mockResolvedValue({ sessions: 3, stories: 0 })

        render(
            <VersionHistoryDrawer
                open
                onClose={() => {}}
                cardType="character"
                cardId="vhd-1"
                cardName="Lyra"
            />,
            { wrapper },
        )

        expect(await screen.findByText('Used in 3 sessions')).toBeInTheDocument()
    })

    it('falls back to "Not used yet" when the card has no usage', async () => {
        vi.spyOn(apiService, 'listCardVersions').mockResolvedValue({
            card_id: 'vhd-2',
            latest_version_id: null,
            latest_version_number: 0,
            versions: [],
        })
        vi.spyOn(apiService, 'getCardUsage').mockResolvedValue({ sessions: 0, stories: 0 })

        render(
            <VersionHistoryDrawer
                open
                onClose={() => {}}
                cardType="world"
                cardId="vhd-2"
                cardName="Eldermoor"
            />,
            { wrapper },
        )

        expect(await screen.findByText('Not used yet')).toBeInTheDocument()
    })

    it('is read-only and hands off to the editor via "Edit to publish changes"', async () => {
        vi.spyOn(apiService, 'listCardVersions').mockResolvedValue({
            card_id: 'vhd-3',
            latest_version_id: null,
            latest_version_number: 0,
            versions: [],
        })
        vi.spyOn(apiService, 'getCardUsage').mockResolvedValue({ sessions: 0, stories: 0 })
        const onEdit = vi.fn()

        render(
            <VersionHistoryDrawer
                open
                onClose={() => {}}
                cardType="character"
                cardId="vhd-3"
                cardName="Lyra"
                hasDraft
                onEdit={onEdit}
            />,
            { wrapper },
        )

        // No mutating "save version" control in the read-only viewer.
        expect(screen.queryByPlaceholderText(/label/i)).not.toBeInTheDocument()
        // A pending draft is surfaced, and the CTA opens the editor.
        const edit = await screen.findByRole('button', { name: /edit to publish changes/i })
        fireEvent.click(edit)
        expect(onEdit).toHaveBeenCalledTimes(1)
    })

    it("lists versions and usage in the card's own workspace", async () => {
        const list = vi.spyOn(apiService, 'listCardVersions').mockResolvedValue({
            card_id: 'vhd-own',
            latest_version_id: null,
            latest_version_number: 0,
            versions: [],
        })
        const usage = vi.spyOn(apiService, 'getCardUsage').mockResolvedValue({ sessions: 2, stories: 0 })

        render(
            <VersionHistoryDrawer
                open
                onClose={() => {}}
                cardType="world"
                cardId="vhd-own"
                cardName="Silverwood"
                workspaceId={OTHER_WORKSPACE_ID}
            />,
            { wrapper },
        )

        expect(await screen.findByText('Used in 2 sessions')).toBeInTheDocument()
        expect((list.mock.contexts[0] as typeof apiService).workspaceScope?.workspaceId).toBe(OTHER_WORKSPACE_ID)
        expect((usage.mock.contexts[0] as typeof apiService).workspaceScope?.workspaceId).toBe(OTHER_WORKSPACE_ID)
    })
})
