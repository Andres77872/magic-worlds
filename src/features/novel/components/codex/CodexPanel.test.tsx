import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const addStoryCardRefs = vi.fn().mockResolvedValue(undefined)
const updateStoryCardRef = vi.fn().mockResolvedValue(undefined)
const deleteStoryCardRef = vi.fn().mockResolvedValue(undefined)

vi.mock('@/app/hooks', () => ({
    useData: () => ({ addStoryCardRefs, updateStoryCardRef, deleteStoryCardRef }),
    useFloatingWindows: () => ({ openWindow: vi.fn(), closeWindow: vi.fn(), closeAll: vi.fn(), focusWindow: vi.fn(), windows: [] }),
}))

vi.mock('@/infrastructure/api', () => ({
    apiService: {
        getLorebooks: vi.fn(),
        getCharacters: vi.fn().mockResolvedValue([]),
        getWorlds: vi.fn().mockResolvedValue([]),
        getItems: vi.fn().mockResolvedValue([]),
        getAdventureTemplates: vi.fn().mockResolvedValue([]),
    },
    resolveMediaUrl: (url?: string | null) => url ?? undefined,
}))

import type { Story, StoryCardRef } from '@/shared'
import { apiService } from '@/infrastructure/api'
import { useCodex } from '../../hooks/useCodex'
import { CodexPanel } from './CodexPanel'

function ref(overrides: Partial<StoryCardRef>): StoryCardRef {
    return {
        id: 'ref-x',
        storyId: 's1',
        kind: 'character',
        cardId: 'card-x',
        source: 'manual',
        enabled: true,
        precedence: 0,
        snapshot: null,
        ...overrides,
    }
}

function story(refs: StoryCardRef[]): Story {
    return {
        id: 's1',
        title: 'Glass War',
        scenes: [],
        chapters: [],
        activeCardRefs: refs,
        activeContext: {
            includeSelectedCards: true,
            includeMentionedCards: true,
            includeLorebooks: true,
            includeRecentScenes: 2,
            tokenBudget: 6000,
        },
    }
}

function Harness({ refs }: { refs: StoryCardRef[] }) {
    const codex = useCodex({ story: story(refs) })
    return <CodexPanel codex={codex} requireAuth={() => true} onOpenCardPicker={() => {}} />
}

const RAW_LOREBOOK = {
    id: 'lb-1',
    name: 'Twin Courts',
    description: 'Court lore',
    entries: [
        { entry_id: 'entry-1', title: 'The Glass Pact', entry_type: 'rule', content: 'An oath sworn on shattered mirrors.', keys: ['pact'], enabled: true },
        { entry_id: 'entry-2', title: 'The Mirror Court', entry_type: 'place', content: 'A palace of halls.', keys: ['court'], enabled: true },
    ],
}

describe('CodexPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(apiService.getLorebooks).mockResolvedValue([RAW_LOREBOOK])
    })

    it('renders grouped entries with counts and an empty state otherwise', () => {
        const { rerender } = render(<Harness refs={[]} />)
        expect(screen.getByText('Your codex is empty')).toBeInTheDocument()

        rerender(
            <Harness
                refs={[
                    ref({ id: 'a', snapshot: { name: 'Aria' } }),
                    ref({ id: 'b', kind: 'world', cardId: 'w1', precedence: 1, snapshot: { name: 'Eldoria' } }),
                ]}
            />,
        )
        expect(screen.getByText('Characters')).toBeInTheDocument()
        expect(screen.getByText('Worlds')).toBeInTheDocument()
        expect(screen.getByText('Aria')).toBeInTheDocument()
        expect(screen.getByText('Eldoria')).toBeInTheDocument()
    })

    it('toggles an entry through its switch', async () => {
        render(<Harness refs={[ref({ id: 'a', snapshot: { name: 'Aria' } })]} />)

        fireEvent.click(screen.getByRole('switch', { name: 'Disable Aria' }))

        await waitFor(() => expect(updateStoryCardRef).toHaveBeenCalledWith('s1', 'a', { enabled: false }))
    })

    it('removes an entry only after the confirm dialog', async () => {
        render(<Harness refs={[ref({ id: 'a', snapshot: { name: 'Aria' } })]} />)

        fireEvent.click(screen.getByRole('button', { name: 'Remove Aria' }))
        const dialog = await screen.findByRole('dialog')
        fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
        expect(deleteStoryCardRef).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole('button', { name: 'Remove Aria' }))
        const dialog2 = await screen.findByRole('dialog')
        fireEvent.click(within(dialog2).getByRole('button', { name: 'Remove' }))
        await waitFor(() => expect(deleteStoryCardRef).toHaveBeenCalledWith('s1', 'a'))
    })

    it('edits a snapshot through the entry drawer', async () => {
        render(<Harness refs={[ref({ id: 'a', snapshot: { name: 'Aria', race: 'elf' } })]} />)

        // The title now opens a preview window; the pencil opens the editor drawer.
        fireEvent.click(screen.getByRole('button', { name: 'Edit Aria' }))
        const nameInput = await screen.findByTestId('codex-entry-name')
        fireEvent.change(nameInput, { target: { value: 'Aria the Red' } })
        fireEvent.change(screen.getByTestId('codex-entry-content'), { target: { value: 'A ranger.' } })
        fireEvent.click(screen.getByTestId('codex-entry-save'))

        await waitFor(() =>
            expect(updateStoryCardRef).toHaveBeenCalledWith('s1', 'a', {
                snapshot: { name: 'Aria the Red', title: 'Aria the Red', description: 'A ranger.', race: 'elf' },
            }),
        )
    })

    it('clones selected lorebook entries through the two-step drawer', async () => {
        render(<Harness refs={[]} />)

        fireEvent.click(screen.getAllByRole('button', { name: /Add lorebook/ })[0])
        const book = await screen.findByTestId('codex-lorebook-option')
        fireEvent.click(book)

        // Both enabled entries are pre-checked; uncheck the second.
        const entries = await screen.findAllByTestId('codex-lorebook-entry')
        expect(entries).toHaveLength(2)
        fireEvent.click(entries[1])
        fireEvent.click(screen.getByTestId('codex-clone-entries-submit'))

        await waitFor(() => expect(addStoryCardRefs).toHaveBeenCalledTimes(1))
        const [, payloads] = addStoryCardRefs.mock.calls[0]
        expect(payloads).toHaveLength(1)
        expect(payloads[0]).toMatchObject({
            kind: 'lorebook_entry',
            cardId: 'entry-1',
            snapshot: expect.objectContaining({
                name: 'The Glass Pact',
                content: 'An oath sworn on shattered mirrors.',
                source_lorebook_id: 'lb-1',
            }),
        })
    })
})
