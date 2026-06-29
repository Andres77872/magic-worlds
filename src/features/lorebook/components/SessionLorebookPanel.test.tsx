import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Lorebook } from '@/shared'
import { apiService } from '@/infrastructure/api'
import { SessionLorebookPanel } from './SessionLorebookPanel'

vi.mock('@/infrastructure/api', () => ({
    apiService: {
        listLorebookAttachments: vi.fn(),
        putLorebookAttachment: vi.fn(),
        deleteLorebookAttachment: vi.fn(),
    },
}))

const setLorebooks = vi.fn()
let lorebooks: Lorebook[] = []

vi.mock('@/app/hooks', () => ({
    useData: () => ({ lorebooks, setLorebooks }),
    useFloatingWindows: () => ({ openWindow: vi.fn(), closeWindow: vi.fn(), closeAll: vi.fn(), focusWindow: vi.fn(), windows: [] }),
}))

const GLASS_BOOK: Lorebook = {
    id: 'lb-1',
    name: 'Glass Courts',
    description: 'Court etiquette and old pacts.',
    tags: ['court'],
    enabled: true,
    settings: { scanDepth: 8, tokenBudget: 1200, recursiveScanning: false, matchWholeWords: true, caseSensitive: false },
    entries: [
        {
            id: 'entry-1',
            lorebookId: 'lb-1',
            title: 'Mirror pact',
            entryType: 'rule',
            content: 'Mirrors bind names.',
            keys: ['mirror'],
            secondaryKeys: [],
            selectiveLogic: 'any',
            enabled: true,
            constant: false,
            caseSensitive: false,
            matchWholeWords: true,
            regex: false,
            isSecret: false,
            insertionOrder: 0,
            priority: 0,
            insertionPosition: 'before_context',
        },
    ],
    attachments: [
        { id: 'att-1', lorebookId: 'lb-1', targetKind: 'character_chat', targetId: '9', mode: 'linked' },
    ],
}

const MOON_BOOK: Lorebook = {
    ...GLASS_BOOK,
    id: 'lb-2',
    name: 'Moon Codex',
    description: 'Moonlit city facts.',
    tags: ['moon'],
    entries: [],
    attachments: [],
    metadata: {
        resources: [
            {
                id: 'resource-1',
                title: 'Reliquary notes',
                triggers: ['silver reliquary'],
                fileName: 'reliquary.txt',
                fileType: 'txt',
                content: 'The reliquary opens at moonrise.',
                extractionStatus: 'completed',
                extraction: {
                    keywords: ['moonrise key'],
                    shortSummary: 'Notes about the silver reliquary.',
                    longSummary: 'The silver reliquary opens at moonrise.',
                    notes: [],
                    snippets: [
                        {
                            id: 'snippet-1',
                            title: 'Reliquary opening',
                            content: 'The reliquary opens at moonrise.',
                            triggers: ['moonrise lock'],
                            source: 'reliquary.txt',
                        },
                    ],
                },
            },
        ],
    },
}

describe('SessionLorebookPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubEnv('VITE_FEATURE_LOREBOOKS_ENABLED', 'true')
        vi.stubEnv('VITE_FEATURE_LOREBOOK_RESOURCES_ENABLED', 'true')
        lorebooks = [GLASS_BOOK, MOON_BOOK]
        vi.mocked(apiService.listLorebookAttachments).mockResolvedValue([
            { id: 'att-1', lorebookId: 'lb-1', targetKind: 'character_chat', targetId: '9', mode: 'linked' },
        ])
        vi.mocked(apiService.putLorebookAttachment).mockResolvedValue({
            id: 'att-2',
            lorebookId: 'lb-2',
            targetKind: 'character_chat',
            targetId: '9',
            mode: 'linked',
        })
        vi.mocked(apiService.deleteLorebookAttachment).mockResolvedValue(undefined)
    })

    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('loads and renders lorebooks attached to the active target', async () => {
        render(<SessionLorebookPanel targetKind="character_chat" targetId="9" />)

        await waitFor(() => expect(apiService.listLorebookAttachments).toHaveBeenCalledWith('character_chat', '9'))
        expect(await screen.findByText('Glass Courts')).toBeInTheDocument()
        expect(screen.getByText('Court etiquette and old pacts.')).toBeInTheDocument()
    })

    it('adds selected lorebooks as linked attachments and prevents duplicates', async () => {
        render(<SessionLorebookPanel targetKind="character_chat" targetId="9" />)

        expect(await screen.findByText('Glass Courts')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Add lorebook' }))

        expect(screen.getAllByTestId('session-lorebook-option')[0]).toBeDisabled()
        fireEvent.click(screen.getByRole('button', { name: /Moon Codex/i }))
        fireEvent.click(screen.getByTestId('session-lorebook-add-submit'))

        await waitFor(() => {
            expect(apiService.putLorebookAttachment).toHaveBeenCalledWith({
                lorebookId: 'lb-2',
                targetKind: 'character_chat',
                targetId: '9',
                mode: 'linked',
                snapshot: null,
            })
        })
        expect(await screen.findByText('Moon Codex')).toBeInTheDocument()
        expect(setLorebooks).toHaveBeenCalledWith(expect.arrayContaining([
            expect.objectContaining({
                id: 'lb-2',
                attachments: [expect.objectContaining({ id: 'att-2', targetKind: 'character_chat', targetId: '9' })],
            }),
        ]))
    })

    it('searches attachable lorebooks by resource metadata', async () => {
        render(<SessionLorebookPanel targetKind="character_chat" targetId="9" />)

        expect(await screen.findByText('Glass Courts')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Add lorebook' }))
        fireEvent.change(screen.getByTestId('session-lorebook-search'), { target: { value: 'silver reliquary' } })

        const drawer = screen.getByRole('dialog')
        expect(within(drawer).getByRole('heading', { name: 'Add lorebooks' })).toBeInTheDocument()
        expect(within(drawer).getByRole('button', { name: /Moon Codex/i })).toBeInTheDocument()
        expect(within(drawer).getByText('0 entries · 1 resources')).toBeInTheDocument()
        expect(within(drawer).queryByRole('button', { name: /Glass Courts/i })).not.toBeInTheDocument()
    })

    it('removes an attachment and updates lorebook state', async () => {
        render(<SessionLorebookPanel targetKind="character_chat" targetId="9" />)

        expect(await screen.findByText('Glass Courts')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Remove Glass Courts' }))

        await waitFor(() => expect(apiService.deleteLorebookAttachment).toHaveBeenCalledWith('att-1'))
        await waitFor(() => expect(screen.queryByText('Glass Courts')).not.toBeInTheDocument())
        expect(setLorebooks).toHaveBeenCalledWith(expect.arrayContaining([
            expect.objectContaining({ id: 'lb-1', attachments: [] }),
        ]))
    })
})
