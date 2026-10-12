import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/app/i18n'
import { WorkspaceContext } from '@/app/providers/workspaceContext'
import type { ApiService } from '@/infrastructure/api'
import type { Lorebook } from '@/shared'
import {
    OTHER_WORKSPACE_ID,
    TEST_WORKSPACE_ID,
    WorkspaceTestProvider,
    createWorkspaceTestState,
    testWorkspace,
    type WorkspaceTestState,
} from '@/shared/hooks/testing/workspaceTestUtils'

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

let workspace: WorkspaceTestState

function renderPage(ui: ReactElement = <LorebookGalleryPage />) {
    return render(<WorkspaceTestProvider state={workspace}>{ui}</WorkspaceTestProvider>)
}

function renderSpanish(ui: ReactElement) {
    const localI18n = i18n.cloneInstance({ lng: 'es' })
    return renderPage(<I18nextProvider i18n={localI18n}>{ui}</I18nextProvider>)
}

describe('LorebookGalleryPage', () => {
    beforeEach(async () => {
        await i18n.changeLanguage('en')
        authed = true
        vi.clearAllMocks()
        vi.stubEnv('VITE_FEATURE_LOREBOOKS_ENABLED', 'true')
        vi.stubEnv('VITE_FEATURE_LOREBOOK_RESOURCES_ENABLED', 'true')
        vi.mocked(apiService.getLorebooks).mockResolvedValue([LOREBOOK])
        workspace = createWorkspaceTestState({ api: apiService })
    })

    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('renders lorebook cards and opens the editor from a card click', async () => {
        renderPage()

        fireEvent.click(await screen.findByRole('button', { name: 'Open lorebook Glass Courts' }))

        expect(editLorebook).toHaveBeenCalledWith(expect.objectContaining({ id: 'lore-1' }))
        expect(setPage).toHaveBeenCalledWith('lorebook')
        expect(screen.getByText('Entries')).toBeInTheDocument()
        expect(screen.getByText('Resources')).toBeInTheDocument()
        expect(screen.getByText('1 secret')).toBeInTheDocument()
    })

    it('renders signed-out without fetching and asks for login only on create', async () => {
        authed = false

        renderPage()

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

    it('lists the new workspace from offset 0 and ignores a late page of the previous one', async () => {
        let finishPrevious!: (value: unknown) => void
        const clients = {
            [TEST_WORKSPACE_ID]: { getLorebooks: vi.fn(() => new Promise((resolve) => { finishPrevious = resolve })) },
            [OTHER_WORKSPACE_ID]: { getLorebooks: vi.fn().mockResolvedValue([{ ...LOREBOOK, id: 'lore-b', name: 'Night Market' }]) },
        }
        // Like the real provider, every committed workspace has its own scoped client.
        function ScopedProvider({ children }: { children: ReactNode }) {
            const value = workspace.value()
            const api = clients[value.selectedWorkspaceId as keyof typeof clients] as unknown as ApiService
            return <WorkspaceContext.Provider value={{ ...value, api }}>{children}</WorkspaceContext.Provider>
        }
        const { rerender } = render(<ScopedProvider><LorebookGalleryPage /></ScopedProvider>)
        await waitFor(() => expect(clients[TEST_WORKSPACE_ID].getLorebooks).toHaveBeenCalledWith(0, 24, undefined))

        act(() => workspace.switchTo(OTHER_WORKSPACE_ID))
        rerender(<ScopedProvider><LorebookGalleryPage /></ScopedProvider>)

        expect(await screen.findByText('Night Market')).toBeInTheDocument()
        expect(clients[OTHER_WORKSPACE_ID].getLorebooks).toHaveBeenCalledWith(0, 24, undefined)
        await act(async () => finishPrevious([LOREBOOK]))
        expect(screen.queryByText('Glass Courts')).not.toBeInTheDocument()
        expect(screen.getByText('Night Market')).toBeInTheDocument()
        expect(apiService.getLorebooks).not.toHaveBeenCalled()
    })

    it('keeps an archived selected workspace readable while create, delete and resource attachment are disabled', async () => {
        workspace = createWorkspaceTestState({
            api: apiService,
            workspaces: [
                testWorkspace(TEST_WORKSPACE_ID, 'Main library', { archived_at: '2026-10-10T00:00:00Z' }),
                testWorkspace(OTHER_WORKSPACE_ID, 'Novel A'),
            ],
        })
        renderPage()

        expect(await screen.findByText('Glass Courts')).toBeInTheDocument()
        const create = screen.getByRole('button', { name: 'New lorebook' })
        expect(create).toBeDisabled()
        fireEvent.click(create)
        expect(setEditingLorebook).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole('button', { name: 'Actions for Glass Courts' }))
        expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeDisabled()
        expect(screen.getByRole('menuitem', { name: 'Add resources' })).toBeDisabled()
        expect(screen.getByRole('menuitem', { name: 'Edit' })).toBeEnabled()
        fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }))
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(deleteLorebook).not.toHaveBeenCalled()

        // Search and opening a book (to read it) keep working.
        expect(screen.getByRole('searchbox', { name: 'Search lorebooks by name, tag, or key' })).toBeEnabled()
        fireEvent.click(screen.getByRole('button', { name: 'Open lorebook Glass Courts' }))
        expect(editLorebook).toHaveBeenCalledWith(expect.objectContaining({ id: 'lore-1' }))
        expect(setPage).toHaveBeenCalledWith('lorebook')
    })

    it('keeps the empty-state create disabled in an archived workspace', async () => {
        vi.mocked(apiService.getLorebooks).mockResolvedValueOnce([])
        workspace = createWorkspaceTestState({
            api: apiService,
            workspaces: [testWorkspace(TEST_WORKSPACE_ID, 'Main library', { archived_at: '2026-10-10T00:00:00Z' })],
        })
        renderPage()

        expect(await screen.findByText('No lorebooks yet')).toBeInTheDocument()
        for (const button of screen.getAllByRole('button', { name: 'New lorebook' })) expect(button).toBeDisabled()
    })
})
