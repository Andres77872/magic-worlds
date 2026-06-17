import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { apiService } from '@/infrastructure/api'
import { VersionHistoryDrawer } from './VersionHistoryDrawer'

afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
})

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
        )

        expect(await screen.findByText('Not used yet')).toBeInTheDocument()
    })

    it('is read-only and hands off to the editor via "Edit to publish changes"', async () => {
        vi.spyOn(apiService, 'listCardVersions').mockResolvedValue({
            card_id: 'vhd-3',
            latest_version_id: null,
            latest_version_number: 0,
            versions: [],
            has_draft: true,
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
                onEdit={onEdit}
            />,
        )

        // No mutating "save version" control in the read-only viewer.
        expect(screen.queryByPlaceholderText(/label/i)).not.toBeInTheDocument()
        // A pending draft is surfaced, and the CTA opens the editor.
        const edit = await screen.findByRole('button', { name: /edit to publish changes/i })
        fireEvent.click(edit)
        expect(onEdit).toHaveBeenCalledTimes(1)
    })
})
