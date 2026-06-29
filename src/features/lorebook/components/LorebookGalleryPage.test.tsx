import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/app/i18n'
import type { Lorebook } from '@/shared'

const setPage = vi.fn()
const openLoginModal = vi.fn()
const editLorebook = vi.fn()
const setEditingLorebook = vi.fn()
const deleteLorebook = vi.fn().mockResolvedValue(undefined)
let authed = true

vi.mock('@/app/hooks', () => ({
    useAuth: () => ({ isAuthenticated: authed, openLoginModal }),
    useNavigation: () => ({ setPage }),
    useData: () => ({ editLorebook, setEditingLorebook, deleteLorebook }),
}))

vi.mock('@/infrastructure/api', () => ({
    apiService: {
        getLorebooks: vi.fn(),
    },
}))

import { apiService } from '@/infrastructure/api'
import { LorebookGalleryPage } from './LorebookGalleryPage'

const LOREBOOK: Lorebook = {
    id: 'lore-1',
    name: 'Glass Courts',
    description: 'Moonlit court law and old grudges.',
    tags: ['court', 'moon'],
    enabled: true,
    settings: {
        scanDepth: 8,
        tokenBudget: 1200,
        recursiveScanning: false,
        matchWholeWords: true,
        caseSensitive: false,
    },
    entries: [
        {
            id: 'entry-1',
            lorebookId: 'lore-1',
            title: 'Court oath',
            entryType: 'rule',
            content: 'Never bargain under blue glass.',
            keys: ['oath', 'glass'],
            secondaryKeys: [],
            selectiveLogic: 'any',
            enabled: true,
            constant: false,
            caseSensitive: false,
            matchWholeWords: true,
            regex: false,
            isSecret: true,
            insertionOrder: 0,
            priority: 0,
            insertionPosition: 'before_context',
        },
    ],
    attachments: [{ id: 'att-1', lorebookId: 'lore-1', targetKind: 'world', targetId: 'world-1', mode: 'linked' }],
    metadata: {
        resources: [
            {
                id: 'resource-1',
                title: 'Court archive',
                triggers: ['court archive'],
                fileName: 'court.md',
                fileType: 'md',
                content: 'archive',
                extractionStatus: 'completed',
                extraction: {
                    keywords: ['glass court'],
                    shortSummary: 'A court archive.',
                    longSummary: 'A court archive.',
                    notes: [],
                    snippets: [],
                },
            },
        ],
    },
}

function renderSpanish(ui: ReactElement) {
    const localI18n = i18n.cloneInstance({ lng: 'es' })
    return render(<I18nextProvider i18n={localI18n}>{ui}</I18nextProvider>)
}

describe('LorebookGalleryPage', () => {
    beforeEach(async () => {
        await i18n.changeLanguage('en')
        authed = true
        vi.clearAllMocks()
        vi.stubEnv('VITE_FEATURE_LOREBOOKS_ENABLED', 'true')
        vi.stubEnv('VITE_FEATURE_LOREBOOK_RESOURCES_ENABLED', 'true')
        vi.mocked(apiService.getLorebooks).mockResolvedValue([LOREBOOK])
    })

    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('renders lorebook cards and opens the editor from a card click', async () => {
        render(<LorebookGalleryPage />)

        fireEvent.click(await screen.findByRole('button', { name: 'Open lorebook Glass Courts' }))

        expect(editLorebook).toHaveBeenCalledWith(expect.objectContaining({ id: 'lore-1' }))
        expect(setPage).toHaveBeenCalledWith('lorebook')
        expect(screen.getByText('Entries')).toBeInTheDocument()
        expect(screen.getByText('Resources')).toBeInTheDocument()
        expect(screen.getByText('1 secret')).toBeInTheDocument()
    })

    it('renders signed-out without fetching and asks for login only on create', async () => {
        authed = false

        render(<LorebookGalleryPage />)

        expect(await screen.findByText('No lorebooks yet')).toBeInTheDocument()
        expect(apiService.getLorebooks).not.toHaveBeenCalled()
        expect(openLoginModal).not.toHaveBeenCalled()

        fireEvent.click(screen.getAllByRole('button', { name: 'New lorebook' })[0])

        expect(openLoginModal).toHaveBeenCalledTimes(1)
        expect(setPage).not.toHaveBeenCalledWith('lorebook')
    })

    it('renders Spanish gallery and empty state', async () => {
        vi.mocked(apiService.getLorebooks).mockResolvedValueOnce([])

        renderSpanish(<LorebookGalleryPage />)

        expect(await screen.findByText('Aún no hay lorebooks')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('Buscar lorebooks por nombre, etiqueta o clave...')).toBeInTheDocument()
        expect(screen.getAllByRole('button', { name: 'Nuevo lorebook' }).length).toBeGreaterThan(0)
    })

    it('renders Spanish lorebook card labels', async () => {
        renderSpanish(<LorebookGalleryPage />)

        expect(await screen.findByText('Glass Courts')).toBeInTheDocument()
        expect(screen.getByText('Entradas')).toBeInTheDocument()
        expect(screen.getByText('Recursos')).toBeInTheDocument()
        expect(screen.getByText('1 secreto')).toBeInTheDocument()
    })
})
