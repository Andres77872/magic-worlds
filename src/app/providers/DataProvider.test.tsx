import { useContext } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdventureSnapshot } from '../../shared'

// Auth: always authenticated so saveInProgressSnapshot proceeds.
vi.mock('@/app/hooks', () => ({
    useAuth: () => ({ isAuthenticated: true, openLoginModal: vi.fn() }),
    useData: () => ({}),
    useNavigation: () => ({}),
}))

// API: stub the reads loadData performs, and spy on the writes we care about.
vi.mock('@/infrastructure', () => {
    class ApiError extends Error {
        isTransient = false
    }
    return {
        ApiError,
        apiService: {
            getCharacters: vi.fn().mockResolvedValue([]),
            getWorlds: vi.fn().mockResolvedValue([]),
            getAdventureTemplates: vi.fn().mockResolvedValue([]),
            getAdventureSessions: vi.fn().mockResolvedValue([]),
            updateAdventureSnapshot: vi.fn().mockResolvedValue({}),
            updateCharacter: vi.fn().mockResolvedValue({}),
            updateWorld: vi.fn().mockResolvedValue({}),
            deleteAllUserData: vi.fn().mockResolvedValue({ message: 'ok', deleted: {} }),
            deleteCharacter: vi.fn().mockResolvedValue({}),
            deleteWorld: vi.fn().mockResolvedValue({}),
            deleteAdventureTemplate: vi.fn().mockResolvedValue({}),
            deleteAdventureSession: vi.fn().mockResolvedValue({}),
        },
    }
})

import { apiService } from '@/infrastructure'
import { DataContext, DataProvider } from './DataProvider'

const SNAPSHOT: AdventureSnapshot = {
    schema_version: 1,
    source: 'mysql_card_body',
    template_card_id: 'tpl-1',
    template: {
        id: 'tpl-1',
        description: 'Edited scenario',
        characters: [{ id: 'c1', name: 'Dorn the Bold', race: 'Dwarf' }],
    },
}

function Saver() {
    const ctx = useContext(DataContext)
    return <button onClick={() => ctx?.saveInProgressSnapshot('7', SNAPSHOT)}>save</button>
}

describe('DataProvider.saveInProgressSnapshot', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('persists to the adventure snapshot endpoint, never the library card endpoints', async () => {
        render(
            <DataProvider>
                <Saver />
            </DataProvider>,
        )

        fireEvent.click(screen.getByText('save'))

        await waitFor(() => {
            expect(apiService.updateAdventureSnapshot).toHaveBeenCalledWith(7, SNAPSHOT)
        })
        // The original character / world library cards must stay untouched.
        expect(apiService.updateCharacter).not.toHaveBeenCalled()
        expect(apiService.updateWorld).not.toHaveBeenCalled()
    })
})

function Clearer() {
    const ctx = useContext(DataContext)
    return <button onClick={() => ctx?.clearAllData()}>clear</button>
}

describe('DataProvider.clearAllData', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('wipes all data through the single DELETE /user/data endpoint, not item-by-item', async () => {
        render(
            <DataProvider>
                <Clearer />
            </DataProvider>,
        )

        fireEvent.click(screen.getByText('clear'))

        await waitFor(() => {
            expect(apiService.deleteAllUserData).toHaveBeenCalledTimes(1)
        })
        // The legacy per-item delete path must no longer be used.
        expect(apiService.deleteCharacter).not.toHaveBeenCalled()
        expect(apiService.deleteWorld).not.toHaveBeenCalled()
        expect(apiService.deleteAdventureTemplate).not.toHaveBeenCalled()
        expect(apiService.deleteAdventureSession).not.toHaveBeenCalled()
    })
})
