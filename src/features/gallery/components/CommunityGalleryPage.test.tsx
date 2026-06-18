import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SharedCardResource } from '@/shared'
import { CommunityGalleryPage } from './CommunityGalleryPage'

const openLoginModal = vi.fn()
const loadData = vi.fn().mockResolvedValue(undefined)
const setPage = vi.fn()

vi.mock('@/app/hooks', () => ({
    useAuth: () => ({ isAuthenticated: false, openLoginModal }),
    useData: () => ({ loadData }),
    useNavigation: () => ({ setPage }),
}))

vi.mock('@/app/hooks/usePlaylist', () => ({
    usePlaylist: () => ({
        currentTrack: null,
        isPlaying: false,
        playNow: vi.fn(),
        enqueue: vi.fn(),
        isQueued: () => false,
    }),
}))

vi.mock('@/infrastructure/api', () => ({
    apiService: {
        listPublicCards: vi.fn(),
        cloneCard: vi.fn(),
    },
    resolveMediaUrl: (url?: string | null) => url ?? undefined,
    isProtectedMediaUrl: () => false,
}))

import { apiService } from '@/infrastructure/api'

const PUBLIC_CHARACTER: SharedCardResource = {
    card_type: 'character',
    card: { id: 'c1', name: 'Lyra', race: 'Half-elf', role: 'character', triggers: ['bard'] },
    visibility: { public: true },
    original_card_id: 'c1',
    original_creator: { user_id: 7, username: 'creator' },
}

describe('CommunityGalleryPage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(apiService.listPublicCards).mockImplementation(async (_skip, _limit, _q, cardType, role) => ({
            items: cardType === 'character' && role === 'character' ? [PUBLIC_CHARACTER] : [],
            skip: 0,
            limit: 10,
        }))
    })

    it('lets signed-out users browse public cards and prompts only on import', async () => {
        render(<CommunityGalleryPage />)

        expect(await screen.findByText('Lyra')).toBeInTheDocument()
        expect(openLoginModal).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole('button', { name: 'Import' }))

        expect(openLoginModal).toHaveBeenCalledTimes(1)
        expect(apiService.cloneCard).not.toHaveBeenCalled()
        await waitFor(() => expect(apiService.listPublicCards).toHaveBeenCalled())
    })
})
