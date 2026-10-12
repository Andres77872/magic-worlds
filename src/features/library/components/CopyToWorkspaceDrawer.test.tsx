import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CopyOutcome } from '@/shared/types'
import { OTHER_WORKSPACE_ID, TEST_COLLECTION_ID, TEST_WORKSPACE_ID, testWorkspace } from '@/shared/hooks/testing/workspaceTestUtils'

const mocks = vi.hoisted(() => ({
    listCollections: vi.fn(),
    copyCardsToWorkspace: vi.fn(),
}))

vi.mock('@/infrastructure/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/infrastructure/api')>()),
    apiService: { listCollections: mocks.listCollections, copyCardsToWorkspace: mocks.copyCardsToWorkspace },
}))

import { ApiError, WorkspaceApiError } from '@/infrastructure/api'
import { CopyToWorkspaceDrawer, copyErrorKey, copyRequestIdFor, type CopyCardRef } from './CopyToWorkspaceDrawer'

const source = testWorkspace(TEST_WORKSPACE_ID, 'Main library')
const destination = testWorkspace(OTHER_WORKSPACE_ID, 'Novel A')
const cards: CopyCardRef[] = [
    { cardType: 'character', cardId: 'char_1', title: 'Lyra' },
    { cardType: 'world', cardId: 'world_1', title: 'Ashfall' },
]

function outcome(): CopyOutcome {
    return {
        replayed: false,
        result: {
            request_id: 'r',
            source_workspace_id: TEST_WORKSPACE_ID,
            destination_workspace_id: OTHER_WORKSPACE_ID,
            cards: [{ source: { card_type: 'character', card_id: 'char_1' }, destination: { card_type: 'character', card_id: 'char_9' } }],
            lorebooks: [],
            resources: [],
        },
    }
}

function renderDrawer(selection: CopyCardRef[] = cards, onViewCopies = vi.fn()) {
    render(
        <CopyToWorkspaceDrawer
            open
            onClose={vi.fn()}
            source={source}
            cards={selection}
            destinations={[destination]}
            onViewCopies={onViewCopies}
        />,
    )
    return { onViewCopies }
}

async function chooseDestination() {
    fireEvent.click(screen.getByRole('combobox', { name: 'Destination workspace' }))
    fireEvent.click(screen.getByRole('option', { name: 'Novel A' }))
    await screen.findByRole('button', { name: /Sketches/ })
}

describe('CopyToWorkspaceDrawer', () => {
    beforeEach(() => {
        mocks.listCollections.mockReset().mockResolvedValue({
            items: [{ id: TEST_COLLECTION_ID, name: 'Sketches', description: null, position: 0, row_version: 1, created_at: '', updated_at: '', card_count: 0 }],
        })
        mocks.copyCardsToWorkspace.mockReset()
    })

    it('asks for the destination first, then loads its collections and copies into them', async () => {
        const { onViewCopies } = renderDrawer()
        expect(screen.getByRole('button', { name: 'Copy 2 cards' })).toBeDisabled()
        expect(screen.getByText(/never a default persona/)).toBeInTheDocument()

        await chooseDestination()
        expect(mocks.listCollections).toHaveBeenCalledWith(OTHER_WORKSPACE_ID)
        fireEvent.click(screen.getByRole('button', { name: /Sketches/ }))
        mocks.copyCardsToWorkspace.mockResolvedValue(outcome())
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Copy 2 cards' }))
        })

        const [destinationId, body] = mocks.copyCardsToWorkspace.mock.calls[0]
        expect(destinationId).toBe(OTHER_WORKSPACE_ID)
        expect(body).toMatchObject({
            source_workspace_id: TEST_WORKSPACE_ID,
            cards: [{ card_type: 'character', card_id: 'char_1' }, { card_type: 'world', card_id: 'world_1' }],
            destination_collection_ids: [TEST_COLLECTION_ID],
        })
        expect(body.request_id).toMatch(/\S/)
        expect(await screen.findByText('Cards copied to Novel A')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: /View copies/ }))
        expect(onViewCopies).toHaveBeenCalledWith(destination, outcome())
    })

    it('reuses the request ID for Try again and mints a new one for Copy again', async () => {
        renderDrawer()
        await chooseDestination()
        mocks.copyCardsToWorkspace.mockRejectedValueOnce(new TypeError('Failed to fetch'))
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Copy 2 cards' }))
        })
        expect(await screen.findByText('Nothing was copied')).toBeInTheDocument()

        mocks.copyCardsToWorkspace.mockResolvedValueOnce(outcome())
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
        })
        const first = mocks.copyCardsToWorkspace.mock.calls[0][1].request_id
        const retry = mocks.copyCardsToWorkspace.mock.calls[1][1].request_id
        expect(retry).toBe(first)

        await screen.findByText('Cards copied to Novel A')
        fireEvent.click(screen.getByRole('button', { name: 'Copy again' }))
        mocks.copyCardsToWorkspace.mockResolvedValueOnce(outcome())
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Copy 2 cards' }))
        })
        expect(mocks.copyCardsToWorkspace.mock.calls[2][1].request_id).not.toBe(first)
    })

    it('mints a new request ID when the input changes after an error', async () => {
        renderDrawer()
        await chooseDestination()
        mocks.copyCardsToWorkspace.mockRejectedValueOnce(new ApiError(503, 'unavailable'))
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Copy 2 cards' }))
        })
        await screen.findByText('Nothing was copied')
        fireEvent.click(screen.getByRole('button', { name: /Sketches/ }))
        mocks.copyCardsToWorkspace.mockResolvedValueOnce(outcome())
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Copy 2 cards' }))
        })
        expect(mocks.copyCardsToWorkspace.mock.calls[1][1].request_id).not.toBe(mocks.copyCardsToWorkspace.mock.calls[0][1].request_id)
    })

    it('blocks more than 20 cards with an explanation', async () => {
        const many = Array.from({ length: 21 }, (_, index) => ({ cardType: 'item' as const, cardId: `item_${index}`, title: `Item ${index}` }))
        renderDrawer(many)
        expect(screen.getByRole('alert')).toHaveTextContent('You can copy up to 20 cards at a time. Remove 1 from the selection to continue.')
        await chooseDestination()
        expect(screen.getByRole('button', { name: 'Copy 21 cards' })).toBeDisabled()
        expect(mocks.copyCardsToWorkspace).not.toHaveBeenCalled()
        // Items only: the persona line is not shown.
        expect(screen.queryByText(/never a default persona/)).not.toBeInTheDocument()
    })

    it('reloads the destination collections when one disappeared', async () => {
        renderDrawer()
        await chooseDestination()
        mocks.copyCardsToWorkspace.mockRejectedValueOnce(new WorkspaceApiError(404, 'gone', { code: 'COLLECTION_NOT_FOUND' }))
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Copy 2 cards' }))
        })
        expect(await screen.findByText('A selected collection no longer exists in the destination.')).toBeInTheDocument()
        await waitFor(() => expect(mocks.listCollections).toHaveBeenCalledTimes(2))
    })
})

describe('copy request helpers', () => {
    it('reuses an ID only for an unchanged, still-reusable attempt', () => {
        const mint = vi.fn(() => 'fresh')
        expect(copyRequestIdFor(null, 'sig', mint)).toBe('fresh')
        expect(copyRequestIdFor({ requestId: 'old', signature: 'sig', reusable: true }, 'sig', mint)).toBe('old')
        expect(copyRequestIdFor({ requestId: 'old', signature: 'sig', reusable: true }, 'other', mint)).toBe('fresh')
        expect(copyRequestIdFor({ requestId: 'old', signature: 'sig', reusable: false }, 'sig', mint)).toBe('fresh')
    })

    it('classifies uncertain failures as retryable network errors', () => {
        expect(copyErrorKey(new TypeError('Failed to fetch'))).toBe('network')
        expect(copyErrorKey(new ApiError(502, 'bad gateway'))).toBe('network')
        expect(copyErrorKey(new ApiError(400, 'bad'))).toBe('generic')
        expect(copyErrorKey(new WorkspaceApiError(409, 'conflict', { code: 'COPY_REQUEST_CONFLICT' }))).toBe('conflict')
        expect(copyErrorKey(new WorkspaceApiError(409, 'archived', { code: 'WORKSPACE_ARCHIVED' }))).toBe('archived')
        expect(copyErrorKey(new WorkspaceApiError(422, 'limit', { code: 'COPY_LIMIT_EXCEEDED' }))).toBe('limit')
    })
})
