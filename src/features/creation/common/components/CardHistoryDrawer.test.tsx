import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { apiService } from '@/infrastructure/api'
import { CardHistoryDrawer } from './CardHistoryDrawer'

afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
})

function renderDrawer(props: Partial<Parameters<typeof CardHistoryDrawer>[0]> = {}) {
    const handlers = { onPublish: vi.fn(), onDiscard: vi.fn(), onRestore: vi.fn(), onView: vi.fn(), onClose: vi.fn() }
    render(
        <CardHistoryDrawer
            open
            cardType="character"
            cardId="card-1"
            cardName="Lyra"
            hasDraft
            basedOnVersionNumber={2}
            latestVersionNumber={2}
            busy={false}
            {...handlers}
            {...props}
        />,
    )
    return handlers
}

describe('CardHistoryDrawer', () => {
    it('shows the Draft tier and routes Publish / Discard through callbacks', async () => {
        vi.spyOn(apiService, 'listCardVersions').mockResolvedValue({
            card_id: 'card-1',
            latest_version_id: 'v2',
            latest_version_number: 2,
            versions: [
                { version_id: 'v2', version_number: 2, label: 'Second', created_at: '2026-06-15T10:00:00' },
                { version_id: 'v1', version_number: 1, label: null, created_at: '2026-06-14T10:00:00' },
            ],
        })
        vi.spyOn(apiService, 'getCardUsage').mockResolvedValue({ sessions: 1, stories: 0 })
        const handlers = renderDrawer()

        // Draft tier present with the "unpublished since v2" copy.
        expect(await screen.findByText(/unpublished changes since v2/i)).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /^Publish$/i }))
        expect(handlers.onPublish).toHaveBeenCalledTimes(1)
        fireEvent.click(screen.getByRole('button', { name: /discard draft/i }))
        expect(handlers.onDiscard).toHaveBeenCalledTimes(1)
    })

    it('marks the newest version as Latest and restores older ones into the draft', async () => {
        vi.spyOn(apiService, 'listCardVersions').mockResolvedValue({
            card_id: 'card-1',
            latest_version_id: 'v2',
            latest_version_number: 2,
            versions: [
                { version_id: 'v2', version_number: 2, label: null, created_at: '2026-06-15T10:00:00' },
                { version_id: 'v1', version_number: 1, label: null, created_at: '2026-06-14T10:00:00' },
            ],
        })
        vi.spyOn(apiService, 'getCardUsage').mockResolvedValue({ sessions: 0, stories: 0 })
        const handlers = renderDrawer({ hasDraft: false })

        expect(await screen.findByText('Latest')).toBeInTheDocument()
        // Two version rows, newest first → the second Restore button targets v1.
        const restoreButtons = screen.getAllByRole('button', { name: /^Restore$/i })
        expect(restoreButtons).toHaveLength(2)
        fireEvent.click(restoreButtons[1])
        expect(handlers.onRestore).toHaveBeenCalledWith(1)
    })

    it('offers a read-only View for each version (drives the ?version= deep-link)', async () => {
        vi.spyOn(apiService, 'listCardVersions').mockResolvedValue({
            card_id: 'card-1',
            latest_version_id: 'v2',
            latest_version_number: 2,
            versions: [
                { version_id: 'v2', version_number: 2, label: null, created_at: '2026-06-15T10:00:00' },
                { version_id: 'v1', version_number: 1, label: null, created_at: '2026-06-14T10:00:00' },
            ],
        })
        vi.spyOn(apiService, 'getCardUsage').mockResolvedValue({ sessions: 0, stories: 0 })
        const handlers = renderDrawer({ hasDraft: false })

        const viewButtons = await screen.findAllByRole('button', { name: /^View$/i })
        expect(viewButtons).toHaveLength(2)
        fireEvent.click(viewButtons[1])
        expect(handlers.onView).toHaveBeenCalledWith(1)
    })

    it('shows an empty state when there are no published versions', async () => {
        vi.spyOn(apiService, 'listCardVersions').mockResolvedValue({
            card_id: 'card-1',
            latest_version_id: null,
            latest_version_number: 0,
            versions: [],
        })
        vi.spyOn(apiService, 'getCardUsage').mockResolvedValue({ sessions: 0, stories: 0 })
        renderDrawer({ hasDraft: false })

        expect(await screen.findByText(/no published versions yet/i)).toBeInTheDocument()
    })
})
