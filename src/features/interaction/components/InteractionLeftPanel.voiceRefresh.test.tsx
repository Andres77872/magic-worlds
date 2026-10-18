import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { setTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
/**
 * R1-FE-04 (D36, 05 §7.8, 09 §4.4): the adventure cast menu and the
 * multi-select "Use the cards' current voices" in the left panel.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/infrastructure/api'
import type { Adventure, Character, EffectiveVoice, SnapshotCard } from '@/shared'
import {
    createWorkspaceTestState,
    OTHER_WORKSPACE_ID,
    TEST_WORKSPACE_ID,
    testWorkspace,
    WorkspaceTestProvider,
} from '@/shared/hooks/testing/workspaceTestUtils'
import { InteractionLeftPanel } from './InteractionLeftPanel'

const mocks = vi.hoisted(() => ({
    library: [] as unknown[],
    refreshAdventureVoices: vi.fn(),
}))

vi.mock('../../../app/hooks', () => ({
    useData: () => ({ characters: mocks.library, worlds: [], refreshAdventureVoices: mocks.refreshAdventureVoices }),
    useFloatingWindows: () => ({ openWindow: vi.fn(), closeWindow: vi.fn(), closeAll: vi.fn(), focusWindow: vi.fn(), windows: [] }),
}))

vi.mock('../../voices/components/VoicePickerDialog', () => ({ VoicePickerDialog: () => null }))
vi.mock('@/features/lorebook', () => ({ SessionLorebookPanel: () => null }))

const KEY_A = `vk_${'a'.repeat(32)}`
const KEY_B = `vk_${'b'.repeat(32)}`
/** The stored voice every card and cast entry carries; the projections decide what plays. */
const STORED_VOICE = { schema_version: 2 as const, provider: 'elevenlabs' as const, voice_key: `vk_${'c'.repeat(32)}`, voice_name: 'Calm', preset_name: 'Calm' }

function el(voiceKey: string, overrides: Partial<EffectiveVoice> = {}): EffectiveVoice {
    return {
        voice_key: voiceKey,
        display_name: voiceKey === KEY_A ? 'Aria' : 'Bram',
        provider_route: 'elevenlabs',
        substitution_reason: null,
        badges: [],
        ...overrides,
    }
}

const REPLACED = el(KEY_A, { substitution_reason: 'voice_removed', badges: ['replaced'] })

function libraryCard(id: string, effective: EffectiveVoice | null): Character {
    return { id, name: id, race: '', stats: {}, role: 'character', voice: STORED_VOICE, ...(effective ? { effective_voice: effective } : {}) }
}

function adventureWith(cast: SnapshotCard[], overrides: Partial<Adventure> = {}): Adventure {
    return {
        id: '77',
        scenario: 'Open the gate.',
        characters: [],
        turns: [],
        status: 'in-progress',
        snapshot: {
            schema_version: 2,
            source: 'resolved_library_clone',
            template_card_id: 'tpl-1',
            template: { id: 'tpl-1', description: 'Open the gate.', characters: cast, world: [] },
        },
        ...overrides,
    }
}

const AFFECTED_CAST: SnapshotCard[] = [
    { id: 'c1', name: 'Lyra', voice: STORED_VOICE, effective_voice: REPLACED },
    { id: 'c2', name: 'Mirren', voice: STORED_VOICE, effective_voice: el(KEY_A) },
    { id: 'c3', name: 'Tess', voice: STORED_VOICE, effective_voice: el(KEY_B) },
]

function renderPanel(
    adventure: Adventure,
    { readOnly = false, editable = true, archived = false }: { readOnly?: boolean; editable?: boolean; archived?: boolean } = {},
) {
    const workspace = createWorkspaceTestState({
        workspaces: [
            testWorkspace(TEST_WORKSPACE_ID, 'Main library', archived ? { archived_at: '2026-10-02T00:00:00Z' } : {}),
            testWorkspace(OTHER_WORKSPACE_ID, 'Novel A'),
        ],
    })
    const view = (next: Adventure) => (
        <WorkspaceTestProvider state={workspace}>
            <InteractionLeftPanel adventure={next} onBack={vi.fn()} onSnapshotChange={editable ? vi.fn() : undefined} readOnly={readOnly} />
        </WorkspaceTestProvider>
    )
    const result = render(view(adventure))
    return { ...result, rerenderWith: (next: Adventure) => result.rerender(view(next)) }
}

function refreshCall(index = 0) {
    const [adventureId, cardIds, api] = mocks.refreshAdventureVoices.mock.calls[index] as [string, string[], { workspaceScope?: { workspaceId: string } }]
    return { adventureId, cardIds, workspaceId: api?.workspaceScope?.workspaceId }
}

beforeEach(() => {
    mocks.refreshAdventureVoices.mockReset()
    mocks.refreshAdventureVoices.mockResolvedValue(undefined)
    mocks.library = [libraryCard('c1', el(KEY_B)), libraryCard('c2', el(KEY_B)), libraryCard('c3', el(KEY_B))]
})

afterEach(() => vi.unstubAllEnvs())

describe('InteractionLeftPanel cast voice refresh (R1-FE-04)', () => {
    it('hides every cast voice action with voices disabled', () => {
        setTestFeatureFlags({ voices: false })
        renderPanel(adventureWith(AFFECTED_CAST))
        expect(screen.queryByTestId('cast-voice-refresh')).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /voice options/i })).not.toBeInTheDocument()
        expect(mocks.refreshAdventureVoices).not.toHaveBeenCalled()
    })

    it('adds nothing without projections (an older session, a share-link reader)', () => {
        mocks.library = [libraryCard('c1', null), libraryCard('c2', null)]
        const { unmount } = renderPanel(adventureWith([{ id: 'c1', name: 'Lyra', voice: STORED_VOICE }, { id: 'c2', name: 'Mirren', voice: STORED_VOICE }]))
        expect(screen.queryByTestId('cast-voice-refresh')).toBeNull()
        expect(screen.queryByRole('button', { name: /Voice options/ })).toBeNull()
        unmount()

        // The session plays a projection but its card has none: nothing differs (D39 item 6).
        mocks.library = [libraryCard('c1', null)]
        renderPanel(adventureWith([{ id: 'c1', name: 'Lyra', voice: STORED_VOICE, effective_voice: el(KEY_A) }]))
        expect(screen.queryByTestId('cast-voice-refresh')).toBeNull()
    })

    it('lists the affected cast with checkboxes, pre-selected where a substitution is active', () => {
        renderPanel(adventureWith(AFFECTED_CAST))
        const panel = screen.getByTestId('cast-voice-refresh')
        expect(within(panel).getByText('2 characters sound different from their cards.')).toBeInTheDocument()

        const open = within(panel).getByRole('button', { name: 'Use the cards’ current voices' })
        expect(open).toHaveAttribute('aria-expanded', 'false')
        fireEvent.click(open)
        expect(open).toHaveAttribute('aria-expanded', 'true')

        const group = within(panel).getByRole('group', { name: 'Characters to update' })
        expect(within(group).getByRole('checkbox', { name: 'Lyra' })).toBeChecked()
        expect(within(group).getByRole('checkbox', { name: 'Mirren' })).not.toBeChecked()
        expect(within(group).getByRole('checkbox', { name: 'Mirren' })).toHaveAccessibleDescription('Now Aria · card Bram')
        expect(within(group).queryByRole('checkbox', { name: 'Tess' })).toBeNull()
        expect(within(group).getByRole('button', { name: 'Update 1 voice' })).toBeEnabled()
    })

    it('refreshes the checked cast on the session workspace client, never the narrator or persona', async () => {
        renderPanel(adventureWith(AFFECTED_CAST))
        const panel = screen.getByTestId('cast-voice-refresh')
        fireEvent.click(within(panel).getByRole('button', { name: 'Use the cards’ current voices' }))
        fireEvent.click(within(panel).getByRole('checkbox', { name: 'Mirren' }))
        await act(async () => {
            fireEvent.click(within(panel).getByRole('button', { name: 'Update 2 voices' }))
        })

        expect(mocks.refreshAdventureVoices).toHaveBeenCalledTimes(1)
        expect(refreshCall()).toEqual({ adventureId: '77', cardIds: ['c1', 'c2'], workspaceId: TEST_WORKSPACE_ID })
        expect(within(panel).getByRole('status')).toHaveTextContent('Voice updated. New replies use it.')
    })

    it('disables Update when nothing is checked', () => {
        renderPanel(adventureWith(AFFECTED_CAST))
        const panel = screen.getByTestId('cast-voice-refresh')
        fireEvent.click(within(panel).getByRole('button', { name: 'Use the cards’ current voices' }))
        fireEvent.click(within(panel).getByRole('checkbox', { name: 'Lyra' }))
        expect(within(panel).getByRole('button', { name: 'Update 0 voices' })).toBeDisabled()
    })

    it('offers "Use the card’s current voice" in the cast menu of an affected member only', async () => {
        renderPanel(adventureWith(AFFECTED_CAST))
        expect(screen.queryByRole('button', { name: 'Voice options for Tess' })).toBeNull()
        const menu = screen.getByRole('button', { name: 'Voice options for Mirren' })
        expect(menu).toHaveAttribute('aria-expanded', 'false')
        fireEvent.click(menu)
        const region = screen.getByTestId('cast-voice-menu')
        expect(menu).toHaveAttribute('aria-controls', region.id)
        expect(within(region).getByText('Now Aria · card Bram')).toBeInTheDocument()
        await act(async () => {
            fireEvent.click(within(region).getByRole('button', { name: 'Use the card’s current voice' }))
        })
        expect(refreshCall()).toEqual({ adventureId: '77', cardIds: ['c2'], workspaceId: TEST_WORKSPACE_ID })
    })

    it('keeps the action and shows the busy copy on a 409 while a reply streams', async () => {
        mocks.refreshAdventureVoices.mockRejectedValue(new ApiError(409, 'busy', { code: 'voice_refresh_busy' }))
        renderPanel(adventureWith(AFFECTED_CAST))
        fireEvent.click(screen.getByRole('button', { name: 'Voice options for Lyra' }))
        await act(async () => {
            fireEvent.click(within(screen.getByTestId('cast-voice-menu')).getByRole('button', { name: 'Use the card’s current voice' }))
        })
        expect(screen.getByRole('status')).toHaveTextContent('Finish the current reply or call first.')
        expect(screen.getByRole('button', { name: 'Use the cards’ current voices' })).toBeEnabled()
    })

    it('clears itself once the refreshed snapshot plays the cards’ voices', async () => {
        const { rerenderWith } = renderPanel(adventureWith(AFFECTED_CAST))
        fireEvent.click(screen.getByRole('button', { name: 'Voice options for Lyra' }))
        await act(async () => {
            fireEvent.click(within(screen.getByTestId('cast-voice-menu')).getByRole('button', { name: 'Use the card’s current voice' }))
        })
        rerenderWith(adventureWith(AFFECTED_CAST.map((entry) => ({ ...entry, voice: { schema_version: 2, provider: 'elevenlabs', voice_key: KEY_B, voice_name: 'Bram' }, effective_voice: el(KEY_B) }))))
        expect(screen.queryByText(/sound different/)).toBeNull()
        expect(screen.queryByRole('button', { name: /Voice options/ })).toBeNull()
        expect(screen.getByRole('status')).toHaveTextContent('Voice updated. New replies use it.')
    })

    it('keeps keyboard focus on the outcome: the menu action and Update move it to the status line', async () => {
        const { rerenderWith } = renderPanel(adventureWith(AFFECTED_CAST))
        fireEvent.click(screen.getByRole('button', { name: 'Voice options for Mirren' }))
        const item = within(screen.getByTestId('cast-voice-menu')).getByRole('button', { name: 'Use the card’s current voice' })
        item.focus()
        await act(async () => {
            fireEvent.click(item)
        })
        expect(screen.queryByTestId('cast-voice-menu')).toBeNull()
        expect(screen.getByRole('status')).toHaveFocus()

        const panel = screen.getByTestId('cast-voice-refresh')
        fireEvent.click(within(panel).getByRole('button', { name: 'Use the cards’ current voices' }))
        const update = within(panel).getByRole('button', { name: 'Update 1 voice' })
        update.focus()
        await act(async () => {
            fireEvent.click(update)
        })
        expect(within(panel).queryByRole('group', { name: 'Characters to update' })).toBeNull()
        expect(within(panel).getByRole('status')).toHaveFocus()

        // The refreshed snapshot removes every member row and menu; focus stays on the status line.
        rerenderWith(adventureWith(AFFECTED_CAST.map((entry) => ({ ...entry, effective_voice: el(KEY_B) }))))
        expect(screen.queryByRole('button', { name: /Voice options/ })).toBeNull()
        expect(screen.getByRole('status')).toHaveFocus()
    })

    it('offers no refresh for a member whose card voice cannot be copied (R-9)', () => {
        mocks.library = [
            libraryCard('c1', el(KEY_B, { badges: ['needs_reselect'] })),
            libraryCard('c2', el(KEY_B, { badges: ['leaving'] })),
            libraryCard('c3', el(KEY_B)),
        ]
        renderPanel(adventureWith(AFFECTED_CAST))
        expect(screen.queryByTestId('cast-voice-refresh')).toBeNull()
        expect(screen.queryByRole('button', { name: /Voice options/ })).toBeNull()
        expect(screen.getByText('Voice replaced')).toBeInTheDocument()
    })

    it('hides every refresh action when read-only, archived, a local draft or not editable', () => {
        const cases = [
            () => renderPanel(adventureWith(AFFECTED_CAST), { readOnly: true }),
            () => renderPanel(adventureWith(AFFECTED_CAST), { archived: true }),
            () => renderPanel(adventureWith(AFFECTED_CAST, { draft: { templateId: 'tpl-1', personaId: 'p1' } })),
            () => renderPanel(adventureWith(AFFECTED_CAST), { editable: false }),
        ]
        for (const renderCase of cases) {
            const { unmount } = renderCase()
            expect(screen.queryByTestId('cast-voice-refresh')).toBeNull()
            expect(screen.queryByRole('button', { name: /Voice options/ })).toBeNull()
            // The replaced badge still shows for the substituted member.
            expect(screen.getByText('Voice replaced')).toBeInTheDocument()
            unmount()
        }
    })

    it('does not offer the refresh for a card missing from the library (source absent)', () => {
        mocks.library = [libraryCard('c3', el(KEY_B))]
        renderPanel(adventureWith(AFFECTED_CAST))
        expect(screen.queryByTestId('cast-voice-refresh')).toBeNull()
        expect(screen.queryByRole('button', { name: /Voice options/ })).toBeNull()
    })

    it('sends at most six cards per request', async () => {
        const cast: SnapshotCard[] = Array.from({ length: 7 }, (_, index) => ({
            id: `m${index}`, name: `Member ${index}`, voice: STORED_VOICE, effective_voice: REPLACED,
        }))
        mocks.library = cast.map((entry) => libraryCard(entry.id!, el(KEY_B)))
        renderPanel(adventureWith(cast))
        const panel = screen.getByTestId('cast-voice-refresh')
        fireEvent.click(within(panel).getByRole('button', { name: 'Use the cards’ current voices' }))
        await act(async () => {
            fireEvent.click(within(panel).getByRole('button', { name: 'Update 7 voices' }))
        })
        expect(mocks.refreshAdventureVoices).toHaveBeenCalledTimes(2)
        expect(refreshCall(0).cardIds).toHaveLength(6)
        expect(refreshCall(1).cardIds).toEqual(['m6'])
    })
})
